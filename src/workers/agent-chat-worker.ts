/**
 * Agent Chat Worker - Handles Q&A conversations with individual agents
 * Provides specialized guidance and actionable deliverables based on completed strategy
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ConfigLoader } from '../lib/config-loader';
import { SimplePromptBuilder, SimplePromptContext } from '../lib/simple-prompt-builder';
import { AgentConfig, UserSession, ChatMessage } from '../types';

interface AgentChatSession {
  id: string;
  sessionId: string; // Reference to main strategy session
  agentId: string;
  agentConfig: AgentConfig | null;
  messages: ChatMessage[];
  strategyContext: UserSession | null; // Full strategy session for context
  createdAt: string;
  lastActive: string;
}

interface AgentChatMessage extends ChatMessage {
  metadata?: {
    agentId?: string;
    agentName?: string;
    tokensUsed?: number;
  };
}

interface Env {
  ANTHROPIC_API_KEY: string;
  CONFIG_STORE: KVNamespace;
  SESSION_STORE: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Initialize ConfigLoader and PromptBuilder
let configLoader: ConfigLoader;
let promptBuilder: SimplePromptBuilder;

const initializeServices = (env: Env) => {
  if (!configLoader) {
    configLoader = new ConfigLoader(env.CONFIG_STORE);
  }
  if (!promptBuilder) {
    promptBuilder = new SimplePromptBuilder();
  }
};

// Validate JWT token from Supabase
const validateToken = async (authHeader: string | undefined): Promise<{ userId: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    // For now, we'll do basic JWT parsing - in production, verify with Supabase
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.sub };
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
};

// Get or create agent chat session
app.get('/refine/:sessionId/chat/:agentId', async (c) => {
  const env = c.env;
  initializeServices(env);

  try {
    const sessionId = c.req.param('sessionId');
    const agentId = c.req.param('agentId');
    const authHeader = c.req.header('Authorization');

    const auth = await validateToken(authHeader);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Load main strategy session for context
    const mainSessionData = await env.SESSION_STORE.get(`session:${sessionId}`);
    if (!mainSessionData) {
      return c.json({ error: 'Strategy session not found' }, 404);
    }

    const strategySession: UserSession = JSON.parse(mainSessionData);
    if (strategySession.userId !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Load agent configuration
    const agentConfig = await configLoader.loadAgentConfig(agentId);
    if (!agentConfig) {
      return c.json({ error: 'Agent configuration not found' }, 404);
    }

    // Try to load existing agent chat session
    const chatSessionKey = `agent-chat:${sessionId}:${agentId}`;
    let agentChatSession: AgentChatSession;

    const existingChatData = await env.SESSION_STORE.get(chatSessionKey);
    if (existingChatData) {
      agentChatSession = JSON.parse(existingChatData);
      agentChatSession.lastActive = new Date().toISOString();
    } else {
      // Create new agent chat session
      agentChatSession = {
        id: `chat-${sessionId}-${agentId}-${Date.now()}`,
        sessionId,
        agentId,
        agentConfig,
        messages: [],
        strategyContext: strategySession,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
    }

    // Save updated session
    await env.SESSION_STORE.put(chatSessionKey, JSON.stringify(agentChatSession));

    return c.json({ 
      success: true, 
      data: agentChatSession 
    });

  } catch (error) {
    console.error('Error in agent chat session:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Send message to agent chat
app.post('/refine/:sessionId/chat/:agentId/message', async (c) => {
  const env = c.env;
  initializeServices(env);

  try {
    const sessionId = c.req.param('sessionId');
    const agentId = c.req.param('agentId');
    const authHeader = c.req.header('Authorization');
    const { content } = await c.req.json();

    const auth = await validateToken(authHeader);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Load agent chat session
    const chatSessionKey = `agent-chat:${sessionId}:${agentId}`;
    const chatSessionData = await env.SESSION_STORE.get(chatSessionKey);
    if (!chatSessionData) {
      return c.json({ error: 'Agent chat session not found' }, 404);
    }

    const agentChatSession: AgentChatSession = JSON.parse(chatSessionData);
    
    // Add user message
    const userMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      sessionId: agentChatSession.id,
      sender: 'user',
      type: 'text',
      content,
      timestamp: new Date().toISOString(),
    };

    agentChatSession.messages.push(userMessage);

    // Prepare context for agent
    const businessIdea = agentChatSession.strategyContext?.userInputs?.businessIdea || 
                        'Business concept from strategy session';

    // Get all approved agent outputs for context
    const previousOutputs: Record<string, string> = {};
    if (agentChatSession.strategyContext) {
      for (const [outputAgentId, output] of Object.entries(agentChatSession.strategyContext.agentOutputs)) {
        if (output.status === 'approved') {
          previousOutputs[outputAgentId] = output.content;
        }
      }
    }

    const promptContext: SimplePromptContext = {
      businessIdea,
      userInputs: agentChatSession.strategyContext?.userInputs || {},
      previousOutputs,
      agentConfig: agentChatSession.agentConfig!,
      session: agentChatSession.strategyContext!,
      configLoader,
      workflowPosition: promptBuilder.getWorkflowPosition(agentId).position,
      totalAgents: promptBuilder.getWorkflowPosition(agentId).total,
    };

    // Build enhanced prompt with full strategy context
    const taskDefinition = `You are in Q&A mode. The user has a completed growth strategy and is asking for specific guidance and actionable deliverables based on that strategy.

User Question: ${content}

Please provide detailed, actionable guidance based on:
1. Your domain expertise as ${agentChatSession.agentConfig?.name}
2. The complete strategy context from all previous agents
3. The user's specific business context and goals

Focus on providing immediately implementable advice, templates, frameworks, or step-by-step guidance that the user can act on right away.`;

    const outputFormat = `Provide a detailed, actionable response that:
- Addresses the user's specific question directly
- Includes concrete next steps or implementation guidance
- References relevant parts of their strategy when applicable
- Provides templates, frameworks, or specific examples when helpful
- Uses markdown formatting for clarity and structure`;

    // Load knowledge files for this agent
    const knowledgeFiles = [
      ...((agentChatSession.agentConfig as any)?.static_knowledge?.knowledge_files?.primary || []),
      ...((agentChatSession.agentConfig as any)?.static_knowledge?.knowledge_files?.secondary || [])
    ];

    const prompt = await promptBuilder.buildPrompt(
      taskDefinition,
      promptContext,
      outputFormat,
      knowledgeFiles
    );

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.ANTHROPIC_API_KEY,
        'Anthropic-Version': '2023-06-01',
      },
      body: JSON.stringify({
        model: (agentChatSession.agentConfig as any)?.claude_config?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: (agentChatSession.agentConfig as any)?.claude_config?.max_tokens || 3000,
        temperature: (agentChatSession.agentConfig as any)?.claude_config?.temperature || 0.7,
        system: prompt.systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt.userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const claudeResponse = await response.json() as any;
    const agentResponse = claudeResponse.content[0].text;

    // Add agent response
    const agentMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      sessionId: agentChatSession.id,
      sender: 'agent',
      type: 'output',
      content: agentResponse,
      timestamp: new Date().toISOString(),
      metadata: {
        agentId,
        agentName: (agentChatSession.agentConfig as any)?.agent_identity?.name,
        tokensUsed: (claudeResponse as any).usage?.output_tokens || 0,
      },
    };

    agentChatSession.messages.push(agentMessage);
    agentChatSession.lastActive = new Date().toISOString();

    // Save updated session
    await env.SESSION_STORE.put(chatSessionKey, JSON.stringify(agentChatSession));

    return c.json({ 
      success: true, 
      data: {
        userMessage,
        agentMessage,
        session: agentChatSession
      }
    });

  } catch (error) {
    console.error('Error in agent chat message:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// WebSocket endpoint for real-time agent chat
app.get('/refine/:sessionId/chat/:agentId/ws', async (c) => {
  const env = c.env;
  const sessionId = c.req.param('sessionId');
  const agentId = c.req.param('agentId');

  // Check if this is a WebSocket upgrade request
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'WebSocket connection required' }, 400);
  }

  try {
    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Handle WebSocket connection
    server.accept();

    // Load agent chat session
    const chatSessionKey = `agent-chat:${sessionId}:${agentId}`;
    const chatSessionData = await env.SESSION_STORE.get(chatSessionKey);
    
    if (chatSessionData) {
      const agentChatSession: AgentChatSession = JSON.parse(chatSessionData);
      
      // Send current session state
      server.send(JSON.stringify({
        type: 'chat_session_state',
        data: agentChatSession
      }));
    }

    // Handle incoming WebSocket messages
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        
        switch (data.type) {
          case 'message':
            // Handle new message - could implement streaming here
            // For now, we redirect to the HTTP endpoint
            break;
            
          case 'ping':
            server.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    server.addEventListener('close', () => {
      console.log('Agent chat WebSocket closed');
    });

    return new Response(null, { status: 101, webSocket: client });

  } catch (error) {
    console.error('WebSocket setup error:', error);
    return c.json({ error: 'WebSocket setup failed' }, 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'agent-chat-worker' });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Agent chat endpoint not found' }, 404);
});

export default app;