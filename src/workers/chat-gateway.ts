/**
 * Chat Gateway Worker - Main entry point for Growth Strategy Agent System
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

const app = new Hono<{ Bindings: Env }>();

// Middleware setup
app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
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

// Session Management API
app.post('/api/sessions', async (c) => {
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
});

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

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};

export { SessionStateManager };
