/**
 * Agent Chat Handler - Complete WebSocket implementation for individual agent chats
 * Handles session management, message routing, and streaming responses
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, UserSession } from '../types';
import { 
  AgentChatSession, 
  AgentChatMessage, 
  AgentChatWebSocketMessage 
} from '../types/agent-chat-types';
import { AgentChatExecutor } from '../lib/agent-chat-executor';
import { ConfigLoader } from '../lib/config-loader';
import { validateJWT, extractUserFromJWT } from '../lib/auth-utils';

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://growth-gpt.com'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Initialize services
let configLoader: ConfigLoader;
let agentChatExecutor: AgentChatExecutor;

const initializeServices = (env: Env) => {
  if (!configLoader) {
    configLoader = new ConfigLoader(env.CONFIG_STORE);
  }
  if (!agentChatExecutor) {
    agentChatExecutor = new AgentChatExecutor(env);
  }
};

/**
 * Get or create agent chat session
 * GET /refine/:sessionId/chat/:agentId
 */
app.get('/:sessionId/chat/:agentId', async (c) => {
  const env = c.env;
  initializeServices(env);

  try {
    const sessionId = c.req.param('sessionId');
    const agentId = c.req.param('agentId');
    const authHeader = c.req.header('Authorization');

    console.log(`🔍 Loading agent chat session: ${sessionId}/${agentId}`);

    // Validate JWT token
    const user = await validateJWT(authHeader, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_URL);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Load main strategy session for context
    const mainSessionData = await env.SESSION_STORE.get(`session:${sessionId}`);
    if (!mainSessionData) {
      return c.json({ error: 'Strategy session not found' }, 404);
    }

    const strategySession: UserSession = JSON.parse(mainSessionData);
    if (strategySession.userId !== user.sub) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Verify session is completed
    if (strategySession.status !== 'completed') {
      return c.json({ error: 'Strategy session must be completed to start agent chat' }, 400);
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
      // Load existing session
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

    console.log(`✅ Agent chat session loaded: ${agentId} (${agentChatSession.messages.length} messages)`);

    return c.json({ 
      success: true, 
      data: agentChatSession 
    });

  } catch (error) {
    console.error('❌ Error loading agent chat session:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Send message to agent chat (HTTP fallback)
 * POST /refine/:sessionId/chat/:agentId/message
 */
app.post('/:sessionId/chat/:agentId/message', async (c) => {
  const env = c.env;
  initializeServices(env);

  try {
    const sessionId = c.req.param('sessionId');
    const agentId = c.req.param('agentId');
    const authHeader = c.req.header('Authorization');
    const { content } = await c.req.json();

    console.log(`📤 Agent chat message: ${agentId} - ${content.substring(0, 50)}...`);

    // Validate JWT token
    const user = await validateJWT(authHeader, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_URL);
    if (!user) {
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

    // Execute agent response (non-streaming for HTTP)
    const result = await agentChatExecutor.executeChatMessage(
      agentId, 
      content, 
      agentChatSession
    );

    // Add agent response
    const agentMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      sessionId: agentChatSession.id,
      sender: 'agent',
      type: 'output',
      content: result.content,
      timestamp: new Date().toISOString(),
      metadata: {
        agentId,
        agentName: agentChatSession.agentConfig?.name,
        tokensUsed: result.tokensUsed,
        contextType: result.contextType,
        qualityScore: result.qualityScore,
      },
    };

    agentChatSession.messages.push(agentMessage);
    agentChatSession.lastActive = new Date().toISOString();

    // Save updated session
    await env.SESSION_STORE.put(chatSessionKey, JSON.stringify(agentChatSession));

    console.log(`✅ Agent chat response generated: ${agentId} (${result.tokensUsed} tokens)`);

    return c.json({ 
      success: true, 
      data: {
        userMessage,
        agentMessage,
        session: agentChatSession
      }
    });

  } catch (error) {
    console.error('❌ Error in agent chat message:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * WebSocket endpoint for real-time agent chat
 * WebSocket /refine/:sessionId/chat/:agentId/ws
 */
app.get('/:sessionId/chat/:agentId/ws', async (c) => {
  const env = c.env;
  initializeServices(env);
  
  const sessionId = c.req.param('sessionId');
  const agentId = c.req.param('agentId');

  console.log(`🔌 WebSocket connection request: ${sessionId}/${agentId}`);

  // Check if this is a WebSocket upgrade request
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'WebSocket connection required' }, 400);
  }

  try {
    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Handle WebSocket connection
    server.accept();
    console.log(`✅ WebSocket connected: ${sessionId}/${agentId}`);

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
        const data = JSON.parse(event.data as string) as AgentChatWebSocketMessage;
        
        switch (data.type) {
          case 'message':
            if (!data.payload?.content) break;

            console.log(`💬 WebSocket message: ${agentId} - ${data.payload.content.substring(0, 50)}...`);

            // Send typing indicator
            server.send(JSON.stringify({ type: 'agent_typing' }));

            try {
              // Load current chat session
              const currentChatData = await env.SESSION_STORE.get(chatSessionKey);
              if (!currentChatData) {
                server.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Chat session not found' 
                }));
                break;
              }

              const currentChatSession: AgentChatSession = JSON.parse(currentChatData);

              // Add user message to session
              const userMessage: AgentChatMessage = {
                id: crypto.randomUUID(),
                sessionId: currentChatSession.id,
                sender: 'user',
                type: 'text',
                content: data.payload.content,
                timestamp: new Date().toISOString(),
              };

              currentChatSession.messages.push(userMessage);
              
              // Note: We don't send the user message back to the client
              // because the client already added it to the UI when sending

              // Execute agent response with streaming
              const result = await agentChatExecutor.executeChatMessage(
                agentId,
                data.payload.content,
                currentChatSession,
                server // Pass WebSocket for streaming
              );

              // Create and add agent message to session
              const agentMessage: AgentChatMessage = {
                id: crypto.randomUUID(),
                sessionId: currentChatSession.id,
                sender: 'agent',
                type: 'output',
                content: result.content,
                timestamp: new Date().toISOString(),
                metadata: {
                  agentId,
                  agentName: currentChatSession.agentConfig?.name,
                  tokensUsed: result.tokensUsed,
                  contextType: result.contextType,
                  qualityScore: result.qualityScore,
                },
              };

              // Add agent message to session
              currentChatSession.messages.push(agentMessage);
              currentChatSession.lastActive = new Date().toISOString();
              
              // Save updated session with both user and agent messages
              await env.SESSION_STORE.put(chatSessionKey, JSON.stringify(currentChatSession));

              console.log(`✅ WebSocket response completed: ${agentId} (${result.tokensUsed} tokens)`);

            } catch (error) {
              console.error('❌ WebSocket message processing error:', error);
              server.send(JSON.stringify({ 
                type: 'error', 
                message: 'Failed to process message' 
              }));
            }
            break;
            
          case 'ping':
            server.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            console.log(`❓ Unknown WebSocket message type: ${data.type}`);
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
      }
    });

    server.addEventListener('close', () => {
      console.log(`🔌 WebSocket disconnected: ${sessionId}/${agentId}`);
    });

    server.addEventListener('error', (error) => {
      console.error(`❌ WebSocket error: ${sessionId}/${agentId}:`, error);
    });

    return new Response(null, { status: 101, webSocket: client });

  } catch (error) {
    console.error('❌ WebSocket setup error:', error);
    return c.json({ error: 'WebSocket setup failed' }, 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'agent-chat-handler',
    timestamp: new Date().toISOString()
  });
});

// Export the app
export { app as agentChatHandler };