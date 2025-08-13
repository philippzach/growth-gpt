/**
 * Growth Strategy Agent System - Unified Worker
 * Serves React frontend via Static Assets and handles API endpoints
 * Handles WebSocket connections, session management, and agent orchestration
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createClient } from '@supabase/supabase-js';
import {
  Env,
  UserSession,
  ChatMessage,
  APIRequest,
  APIResponse,
  WorkflowConfig,
  AgentType,
} from '../types';
import { SessionStateManager } from './session-state-manager';
import { ConfigLoader } from '../lib/config-loader';
import { WorkflowOrchestrator } from '../lib/workflow-orchestrator';
import { validateJWT, extractUserFromJWT } from '../lib/auth-utils';
import { createAPIResponse, createAPIError } from '../lib/api-utils';
import { agentChatHandler } from './agent-chat-handler';

// Enhanced environment interface for Static Assets
interface EnhancedEnv extends Env {
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: EnhancedEnv }>();

// Middleware setup with detailed logging
app.use('*', logger());

// Add detailed request logging for all requests
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/')) {
    console.log('🔍 API REQUEST:', {
      method: c.req.method,
      path: url.pathname,
      search: url.search,
      headers: Object.fromEntries(c.req.raw.headers),
      timestamp: new Date().toISOString()
    });
  }
  await next();
});

// CORS for API routes
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:3000', 'https://growth-gpt.com', 'https://growth-strategy-system.waimeazach.workers.dev'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  })
);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// KV debugging endpoint
app.get('/api/debug-kv', async (c) => {
  try {
    console.log('Testing KV access...');
    console.log('CONFIG_STORE available:', !!c.env.CONFIG_STORE);
    
    // Test basic KV access
    const testKey = 'workflows/master-workflow-v2.json';
    const result = await c.env.CONFIG_STORE.get(testKey);
    console.log(`KV get result for ${testKey}:`, result ? `${result.length} characters` : 'null');
    
    // List ALL keys to see what's actually in the KV
    const allKeysResult = await c.env.CONFIG_STORE.list();
    console.log('All KV keys:', allKeysResult.keys.map(k => k.name));
    
    // List all workflow keys
    const listResult = await c.env.CONFIG_STORE.list({ prefix: 'workflows/' });
    console.log('Available workflow keys:', listResult.keys.map(k => k.name));
    
    return c.json({
      kvAvailable: !!c.env.CONFIG_STORE,
      environment: c.env.ENVIRONMENT,
      testKeyExists: !!result,
      testKeyLength: result?.length || 0,
      allKeys: allKeysResult.keys.map(k => k.name).slice(0, 10), // First 10 keys
      totalKeyCount: allKeysResult.keys.length,
      availableWorkflowKeys: listResult.keys.map(k => k.name),
      testKeyContent: result ? JSON.parse(result) : null
    });
  } catch (error) {
    console.error('KV debug error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// API key test endpoint
app.get('/api/test-anthropic', async (c) => {
  try {
    console.log('🧪 Testing Anthropic API key directly...');
    console.log('🔐 API Key exists:', !!c.env.ANTHROPIC_API_KEY);
    console.log('🔐 API Key length:', c.env.ANTHROPIC_API_KEY?.length || 0);
    console.log('🔐 API Key format:', c.env.ANTHROPIC_API_KEY?.substring(0, 25) + '...' || 'MISSING');
    
    // Test direct fetch to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello test' }],
      }),
    });
    
    const result = await response.json() as any;
    
    if (response.ok) {
      console.log('✅ Direct API test successful');
      return c.json({
        status: 'success',
        message: 'API key works with direct fetch',
        response_id: result.id,
      });
    } else {
      console.log('❌ Direct API test failed:', result);
      return c.json({
        status: 'error',
        message: 'API key failed with direct fetch',
        error: result,
      }, 400);
    }
  } catch (error: any) {
    console.log('❌ Direct API test error:', error);
    return c.json({
      status: 'error',
      message: 'Exception during API test',
      error: error?.message || 'Unknown error',
    }, 500);
  }
});

// Session Management API - handle both with and without trailing slash
app.post('/api/sessions', sessionCreateHandler);
app.post('/api/sessions/', sessionCreateHandler);

async function sessionCreateHandler(c: any) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json(
        createAPIError('AUTH_REQUIRED', 'Authorization header required'),
        401
      );
    }

    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );
    if (!user) {
      return c.json(createAPIError('INVALID_TOKEN', 'Invalid JWT token'), 401);
    }

    const body = await c.req.json();
    const { workflowId = 'master-workflow-v2', userInputs = {} } = body;

    // Load workflow configuration
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    const workflowConfig = await configLoader.loadWorkflowConfig(workflowId);

    if (!workflowConfig) {
      return c.json(
        createAPIError(
          'WORKFLOW_NOT_FOUND',
          `Workflow ${workflowId} not found`
        ),
        404
      );
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const session: UserSession = {
      id: sessionId,
      userId: user.sub,
      workflowId,
      status: 'active',
      currentAgent: workflowConfig.sequence[0].agent_id,
      currentStep: 0,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userInputs,
      agentOutputs: {},
      conversationHistory: [],
      progress: {
        totalSteps: workflowConfig.sequence.length,
        completedSteps: 0,
        currentStepId: workflowConfig.sequence[0].step_id,
        estimatedTimeRemaining: 0,
        stageProgress: {
          foundation: 0,
          strategy: 0,
          validation: 0,
        },
      },
    };

    // Store session in KV
    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    // Update user session index
    await updateUserSessionIndex(c.env.SESSION_STORE, user.sub, sessionId);

    // No initial system message - start clean

    return c.json(createAPIResponse(session));
  } catch (error) {
    console.error('Session creation error:', error);
    return c.json(
      createAPIError('SESSION_CREATION_FAILED', 'Failed to create session'),
      500
    );
  }
}

app.get('/api/users/:userId/sessions', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const requestedUserId = c.req.param('userId');

    if (!user || user.sub !== requestedUserId) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    // Get all sessions for the user using the session index
    const sessions = await getUserSessions(c.env.SESSION_STORE, user.sub);
    return c.json(createAPIResponse(sessions));
  } catch (error) {
    console.error('Session list error:', error);
    return c.json(
      createAPIError('SESSION_LIST_FAILED', 'Failed to list sessions'),
      500
    );
  }
});

app.get('/api/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    return c.json(createAPIResponse(session));
  } catch (error) {
    console.error('Session get error:', error);
    return c.json(
      createAPIError('SESSION_GET_FAILED', 'Failed to get session'),
      500
    );
  }
});

// Enhance prompt endpoint
app.post('/api/sessions/:sessionId/enhance-prompt', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    // Get session
    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    const body = await c.req.json();
    const { businessIdea } = body;

    if (!businessIdea || typeof businessIdea !== 'string' || businessIdea.length < 50) {
      return c.json(
        createAPIError('INVALID_INPUT', 'Business idea must be at least 50 characters long'),
        400
      );
    }

    // Import AgentExecutor
    const { AgentExecutor } = await import('../lib/agent-executor');
    const agentExecutor = new AgentExecutor(c.env);

    // Create enhancement prompt
    const enhancementSystemPrompt = `You are a business strategy expert who helps entrepreneurs create comprehensive business descriptions for AI analysis.

CRITICAL: You MUST respond with valid JSON format only. No additional text, explanations, or formatting.

TASK: Transform the provided business idea into a comprehensive business description.

REQUIREMENTS:
1. Generate a catchy 2-3 word project name
2. Create a 250-350 word enhanced description including:
   - Clear product/service definition
   - Specific target market with demographics  
   - Problem being solved
   - Unique solution approach
   - Business model/revenue streams
   - Competitive advantages
   - Specific goals with timelines

CRITICAL: Response must be valid JSON format exactly like this:
{"projectName":"YourProjectName","enhancedPrompt":"Your enhanced description here..."}

IMPORTANT: Do NOT include line breaks, newlines, or special characters in the JSON string. Write the entire enhanced prompt as one continuous paragraph.

EXAMPLE RESPONSE:
{"projectName":"EcoFit","enhancedPrompt":"I'm launching EcoFit, a D2C sustainable activewear brand using recycled ocean plastic. Target: environmentally conscious millennials (25-40) who prioritize sustainability and home fitness. Problem: existing activewear isn't truly sustainable and lacks transparency. Solution: fully traceable, carbon-neutral workout gear with impact tracking app. Revenue: subscription model + one-time purchases. Advantage: only brand with complete supply chain transparency and measurable environmental impact. Goals: $1M ARR by year 2, expand to 10 product lines, capture 2% of sustainable activewear market."}`;

    const enhancementUserPrompt = `Original business idea: "${businessIdea}"

Please enhance this business idea following the requirements above. Make sure the enhanced description is comprehensive, specific, and provides all the context needed for strategic analysis.`;

    console.log('🤖 Calling Claude for prompt enhancement...');
    
    // Load config loader and agent config for the enhancement task
    const configLoader = new (await import('../lib/config-loader')).ConfigLoader(c.env.CONFIG_STORE);
    const gtmAgentConfig = await configLoader.loadAgentConfig('gtm-consultant');
    const taskConfig = await configLoader.loadTaskConfig('gtm-consultant-task');
    
    if (!gtmAgentConfig || !taskConfig) {
      return c.json(
        createAPIError('CONFIG_ERROR', 'Agent or task configuration not found'),
        500
      );
    }
    
    // Load knowledge base based on task config
    const knowledgeFocus = taskConfig.agent_integration?.behavior_overrides?.knowledge_focus || [];
    const knowledgeBase: Record<string, string> = {};
    
    const focusMapping: Record<string, string> = {
      'value-proposition': 'method/01value-proposition.md',
      'problem-solution-fit': 'method/02problem-solution-fit.md',
      'business-model': 'method/03business-model.md',
      'psychographic-persona': 'method/04psychograhpic-persona.md',
      'product-market-fit': 'method/05product-market-fit.md',
      'pirate-funnel': 'method/07pirate-funnel.md',
      'growth-hacking-process': 'method/00growth-hacking-process.md',
    };
    
    // Load relevant knowledge sources
    for (const focus of knowledgeFocus) {
      const knowledgeFile = focusMapping[focus];
      if (knowledgeFile) {
        try {
          const content = await configLoader.loadKnowledgeBase(knowledgeFile);
          if (content) {
            knowledgeBase[focus] = content;
          }
        } catch (error) {
          console.warn(`Failed to load knowledge file: ${knowledgeFile}`, error);
        }
      }
    }
    
    // Extract business context
    const businessContext = {
      businessType: session.userInputs?.businessType || 'startup',
      industry: session.userInputs?.industry || 'technology', 
      stage: session.userInputs?.businessStage || 'early-stage',
      teamSize: session.userInputs?.teamSize || 'small',
      devResources: session.userInputs?.developmentResources || 'limited',
      budget: session.userInputs?.budget || 'limited',
    };
    
    // Create complete PromptGenerationContext
    const context = {
      session,
      agentConfig: gtmAgentConfig,
      taskConfig,
      knowledgeBase,
      businessContext,
      userInputs: { businessIdea },
      previousOutputs: {},
      workflowStep: 0, // Enhancement is step 0
    };
    
    const result = await agentExecutor.executeAgent(
      'gtm-consultant',
      {
        systemPrompt: enhancementSystemPrompt,
        userPrompt: enhancementUserPrompt,
      },
      context
    );

    let enhancedResult;
    try {
      // Clean up the response - remove any markdown formatting or extra text
      let cleanContent = result.content.trim();
      
      // Extract JSON from the response if it's wrapped in markdown or other text
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      // Fix control characters and escape sequences in JSON strings
      cleanContent = cleanContent
        .replace(/\n/g, '\\n')        // Escape newlines
        .replace(/\r/g, '\\r')        // Escape carriage returns
        .replace(/\t/g, '\\t')        // Escape tabs
        .replace(/[\b]/g, '\\b')      // Escape backspaces (literal backspace chars)
        .replace(/\f/g, '\\f');       // Escape form feeds
      
      enhancedResult = JSON.parse(cleanContent);
      
      // Validate that required fields exist
      if (!enhancedResult.projectName || !enhancedResult.enhancedPrompt) {
        throw new Error('Missing required fields in JSON response');
      }
      
      // Ensure enhanced prompt is not too long (max 500 words)
      const wordCount = enhancedResult.enhancedPrompt.split(' ').length;
      if (wordCount > 500) {
        enhancedResult.enhancedPrompt = enhancedResult.enhancedPrompt.split(' ').slice(0, 400).join(' ') + '...';
      }
      
      console.log('✅ Successfully parsed enhancement result:', {
        projectName: enhancedResult.projectName,
        enhancedLength: enhancedResult.enhancedPrompt.length,
        wordCount: enhancedResult.enhancedPrompt.split(' ').length,
      });
      
    } catch (error) {
      console.error('Failed to parse enhancement result, using fallback format:', error);
      console.error('Raw LLM response:', result.content);
      
      // Generate a simple project name from business idea
      const words = businessIdea.trim().split(' ').slice(0, 3);
      const fallbackProjectName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
      
      enhancedResult = {
        projectName: fallbackProjectName || 'Growth Project',
        enhancedPrompt: businessIdea, // Use original input as fallback
      };
    }

    // Update session with project name
    session.userInputs.projectName = enhancedResult.projectName;
    session.userInputs.originalBusinessIdea = businessIdea;
    session.userInputs.businessIdea = enhancedResult.enhancedPrompt;
    session.lastActive = new Date().toISOString();

    // Save updated session
    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    console.log('✅ Prompt enhanced successfully:', {
      projectName: enhancedResult.projectName,
      originalLength: businessIdea.length,
      enhancedLength: enhancedResult.enhancedPrompt.length,
    });

    return c.json(createAPIResponse({
      projectName: enhancedResult.projectName,
      enhancedPrompt: enhancedResult.enhancedPrompt,
      session,
    }));
  } catch (error) {
    console.error('Prompt enhancement error:', error);
    return c.json(
      createAPIError('ENHANCEMENT_FAILED', 'Failed to enhance prompt'),
      500
    );
  }
});

// Chat API
app.post('/api/chat/:sessionId/message', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    // Get session
    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    const body = await c.req.json();
    const { content, type = 'text' } = body;

    // Add user message to conversation
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      sender: 'user',
      type,
      content,
      timestamp: new Date().toISOString(),
    };

    session.conversationHistory.push(userMessage);
    session.lastActive = new Date().toISOString();

    // Process message with current agent
    const orchestrator = new WorkflowOrchestrator(c.env);
    const agentResponse = await orchestrator.processUserMessage(
      session,
      userMessage
    );

    if (agentResponse) {
      session.conversationHistory.push(agentResponse);
    }

    // Update session
    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(
      createAPIResponse({
        message: userMessage,
        response: agentResponse,
        session,
      })
    );
  } catch (error) {
    console.error('Message processing error:', error);
    return c.json(
      createAPIError('MESSAGE_PROCESSING_FAILED', 'Failed to process message'),
      500
    );
  }
});

app.get('/api/chat/:sessionId/history', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    return c.json(createAPIResponse(session.conversationHistory));
  } catch (error) {
    console.error('Chat history error:', error);
    return c.json(
      createAPIError('CHAT_HISTORY_FAILED', 'Failed to get chat history'),
      500
    );
  }
});

app.put('/api/chat/:sessionId/approve', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    const body = await c.req.json();
    const { outputId, feedback } = body;

    // Approve agent output
    if (session.agentOutputs[outputId]) {
      session.agentOutputs[outputId].status = 'approved';
      session.agentOutputs[outputId].approvedAt = new Date().toISOString();
      session.agentOutputs[outputId].userFeedback = feedback;

      // Move to next agent (but don't auto-trigger)
      const orchestrator = new WorkflowOrchestrator(c.env);
      await orchestrator.moveToNextAgent(session);
    }

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, session }));
  } catch (error) {
    console.error('Approval error:', error);
    return c.json(
      createAPIError('APPROVAL_FAILED', 'Failed to approve output'),
      500
    );
  }
});

app.put('/api/chat/:sessionId/edit', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    const body = await c.req.json();
    const { outputId, editedContent } = body;

    // Update agent output with user edits
    if (session.agentOutputs[outputId]) {
      session.agentOutputs[outputId].content = editedContent;
      session.agentOutputs[outputId].status = 'approved';
      session.agentOutputs[outputId].approvedAt = new Date().toISOString();
      session.agentOutputs[outputId].userFeedback = 'User edited content';

      // Move to next agent (but don't auto-trigger)
      const orchestrator = new WorkflowOrchestrator(c.env);
      await orchestrator.moveToNextAgent(session);
    }

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, session }));
  } catch (error) {
    console.error('Edit error:', error);
    return c.json(createAPIError('EDIT_FAILED', 'Failed to edit output'), 500);
  }
});

app.post('/api/chat/:sessionId/regenerate', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    const body = await c.req.json();
    const { outputId, feedback } = body;

    // Regenerate agent output with feedback
    const orchestrator = new WorkflowOrchestrator(c.env);
    const newOutput = await orchestrator.regenerateAgentOutput(
      session,
      outputId,
      feedback
    );

    if (newOutput) {
      session.agentOutputs[outputId] = newOutput;

      // Add system message about regeneration
      const systemMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        sender: 'system',
        type: 'text',
        content:
          "I've regenerated the output based on your feedback. Please review the updated content.",
        timestamp: new Date().toISOString(),
      };

      session.conversationHistory.push(systemMessage);
    }

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, newOutput, session }));
  } catch (error) {
    console.error('Regeneration error:', error);
    return c.json(
      createAPIError('REGENERATION_FAILED', 'Failed to regenerate output'),
      500
    );
  }
});

// Next Agent - Manual progression after approval
app.post('/api/sessions/:sessionId/next-agent', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    // Check if current agent output is approved
    const currentAgentOutput = session.agentOutputs[session.currentAgent];
    if (!currentAgentOutput || currentAgentOutput.status !== 'approved') {
      return c.json(
        createAPIError('AGENT_NOT_APPROVED', 'Current agent output must be approved before proceeding'),
        400
      );
    }

    // Move to next agent
    const orchestrator = new WorkflowOrchestrator(c.env);
    await orchestrator.moveToNextAgent(session);

    // Add a system message about the transition
    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      sender: 'system',
      type: 'text',
      content: `Moved to ${session.currentAgent}. The agent will now analyze your business based on the previous approved outputs.`,
      timestamp: new Date().toISOString(),
    };

    session.conversationHistory.push(systemMessage);

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, session }));
  } catch (error) {
    console.error('Next agent error:', error);
    return c.json(
      createAPIError('NEXT_AGENT_FAILED', 'Failed to move to next agent'),
      500
    );
  }
});

// WebSocket upgrade handler for real-time communication
app.get('/api/ws/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const upgradeHeader = c.req.header('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    // Get session to validate access
    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return new Response('Session not found', { status: 404 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Handle WebSocket connection
    server.accept();

    // Create WebSocket emitter function for streaming
    const websocketEmitter = (targetSessionId: string, data: any) => {
      if (targetSessionId === sessionId && server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify(data));
      }
    };

    // Set up WebSocket message handling
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        const { type, payload } = data;

        switch (type) {
          case 'ping':
            server.send(
              JSON.stringify({ type: 'pong', timestamp: Date.now() })
            );
            break;

          case 'message':
            // Handle real-time message processing
            const session: UserSession = JSON.parse(
              (await c.env.SESSION_STORE.get(`session:${sessionId}`)) || '{}'
            );
            const orchestrator = new WorkflowOrchestrator(c.env, websocketEmitter);

            const userMessage: ChatMessage = {
              id: crypto.randomUUID(),
              sessionId,
              sender: 'user',
              type: 'text',
              content: payload.content,
              timestamp: new Date().toISOString(),
            };

            session.conversationHistory.push(userMessage);

            // Send typing indicator
            server.send(
              JSON.stringify({
                type: 'agent_typing',
                agentId: session.currentAgent,
              })
            );

            // Send initial streaming message placeholder
            const streamingMessageId = crypto.randomUUID();
            server.send(
              JSON.stringify({
                type: 'streaming_start',
                messageId: streamingMessageId,
                agentId: session.currentAgent,
              })
            );

            // Process with agent (this will now stream chunks via websocketEmitter)
            const agentResponse = await orchestrator.processUserMessage(
              session,
              userMessage
            );

            if (agentResponse) {
              session.conversationHistory.push(agentResponse);
              // Send final complete message
              server.send(
                JSON.stringify({
                  type: 'streaming_complete',
                  messageId: streamingMessageId,
                  message: agentResponse,
                })
              );
            }

            await c.env.SESSION_STORE.put(
              `session:${sessionId}`,
              JSON.stringify(session)
            );
            break;

          default:
            server.send(
              JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${type}`,
              })
            );
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
          })
        );
      }
    });

    server.addEventListener('close', () => {
      console.log('WebSocket connection closed for session:', sessionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  } catch (error) {
    console.error('WebSocket upgrade error:', error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
});

// Session control endpoints
app.put('/api/sessions/:sessionId/pause', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    session.status = 'paused';
    session.lastActive = new Date().toISOString();

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, session }));
  } catch (error) {
    console.error('Session pause error:', error);
    return c.json(
      createAPIError('SESSION_PAUSE_FAILED', 'Failed to pause session'),
      500
    );
  }
});

app.put('/api/sessions/:sessionId/resume', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    session.status = 'active';
    session.lastActive = new Date().toISOString();

    await c.env.SESSION_STORE.put(
      `session:${sessionId}`,
      JSON.stringify(session)
    );

    return c.json(createAPIResponse({ success: true, session }));
  } catch (error) {
    console.error('Session resume error:', error);
    return c.json(
      createAPIError('SESSION_RESUME_FAILED', 'Failed to resume session'),
      500
    );
  }
});

app.delete('/api/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const authHeader = c.req.header('Authorization');
    const user = await validateJWT(
      authHeader,
      c.env.SUPABASE_SERVICE_ROLE_KEY,
      c.env.SUPABASE_URL
    );

    const sessionData = await c.env.SESSION_STORE.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(
        createAPIError('SESSION_NOT_FOUND', 'Session not found'),
        404
      );
    }

    const session: UserSession = JSON.parse(sessionData);

    if (!user || session.userId !== user.sub) {
      return c.json(createAPIError('UNAUTHORIZED', 'Unauthorized access'), 403);
    }

    // Delete session data
    await c.env.SESSION_STORE.delete(`session:${sessionId}`);
    
    // Remove from user session index
    await removeFromUserSessionIndex(c.env.SESSION_STORE, session.userId, sessionId);

    return c.json(createAPIResponse({ success: true }));
  } catch (error) {
    console.error('Session delete error:', error);
    return c.json(
      createAPIError('SESSION_DELETE_FAILED', 'Failed to delete session'),
      500
    );
  }
});

// Agent Chat Routes - Delegated to dedicated handler
app.route('/api/refine', agentChatHandler);

// Helper functions for session management

/**
 * Updates the user session index when a new session is created
 */
async function updateUserSessionIndex(
  sessionStore: KVNamespace,
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    const userIndexKey = `user:${userId}:sessions`;
    const existingIndex = await sessionStore.get(userIndexKey);
    
    let sessionList: string[] = [];
    if (existingIndex) {
      sessionList = JSON.parse(existingIndex);
    }
    
    // Add new session ID if not already present
    if (!sessionList.includes(sessionId)) {
      sessionList.push(sessionId);
      await sessionStore.put(userIndexKey, JSON.stringify(sessionList));
    }
  } catch (error) {
    console.error('Failed to update user session index:', error);
    // Don't throw - session creation should continue even if indexing fails
  }
}

/**
 * Removes a session from the user session index
 */
async function removeFromUserSessionIndex(
  sessionStore: KVNamespace,
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    const userIndexKey = `user:${userId}:sessions`;
    const existingIndex = await sessionStore.get(userIndexKey);
    
    if (existingIndex) {
      let sessionList: string[] = JSON.parse(existingIndex);
      sessionList = sessionList.filter(id => id !== sessionId);
      await sessionStore.put(userIndexKey, JSON.stringify(sessionList));
    }
  } catch (error) {
    console.error('Failed to remove from user session index:', error);
  }
}

/**
 * Gets all sessions for a user from the index
 */
async function getUserSessions(
  sessionStore: KVNamespace,
  userId: string
): Promise<UserSession[]> {
  try {
    const userIndexKey = `user:${userId}:sessions`;
    const sessionIndex = await sessionStore.get(userIndexKey);
    
    if (!sessionIndex) {
      return [];
    }
    
    const sessionIds: string[] = JSON.parse(sessionIndex);
    const sessions: UserSession[] = [];
    
    // Fetch all sessions in parallel
    const sessionPromises = sessionIds.map(async (sessionId) => {
      const sessionData = await sessionStore.get(`session:${sessionId}`);
      if (sessionData) {
        try {
          return JSON.parse(sessionData) as UserSession;
        } catch (error) {
          console.error(`Failed to parse session ${sessionId}:`, error);
          return null;
        }
      }
      return null;
    });
    
    const sessionResults = await Promise.all(sessionPromises);
    
    // Filter out null results and sort by last activity (newest first)
    const validSessions = sessionResults
      .filter((session): session is UserSession => session !== null)
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    
    return validSessions;
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    return [];
  }
}

// Static Assets Handler - Serve React frontend
// Handle all non-API routes by serving static assets
app.all('*', async (c) => {
  const url = new URL(c.req.url);
  
  // API routes are handled above, so this catches all frontend routes
  if (url.pathname.startsWith('/api/')) {
    return c.json({ 
      error: 'API endpoint not found',
      method: c.req.method,
      path: url.pathname
    }, 404);
  }
  
  // Only serve static assets for GET requests (frontend routes)
  if (c.req.method === 'GET') {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  
  // For non-GET requests to non-API routes, return 405
  return c.json({ error: 'Method not allowed for frontend routes' }, 405);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};

export { SessionStateManager };
