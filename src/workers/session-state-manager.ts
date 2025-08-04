/**
 * Session State Manager - Durable Object for managing user session state
 * Handles real-time session state, WebSocket connections, and coordination
 */

import { DurableObject } from '@cloudflare/workers-types';
import { UserSession, ChatMessage, AgentOutput, Env } from '../types';

export class SessionStateManager {
  private session: UserSession | null = null;
  private webSockets = new Set<WebSocket>();
  private lastActivity = Date.now();
  private saveInterval: any = null;

  constructor(
    private ctx: DurableObjectState,
    private env: Env
  ) {
    // Set up periodic save
    this.saveInterval = setInterval(() => {
      this.saveSessionToPersistentStorage();
    }, 30000); // Save every 30 seconds
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (request.method) {
        case 'GET':
          if (path === '/session') {
            return this.handleGetSession();
          } else if (path === '/websocket') {
            return this.handleWebSocketUpgrade(request);
          }
          break;

        case 'POST':
          if (path === '/session') {
            return this.handleCreateSession(request);
          } else if (path === '/message') {
            return this.handleAddMessage(request);
          } else if (path === '/output') {
            return this.handleAddOutput(request);
          }
          break;

        case 'PUT':
          if (path === '/session') {
            return this.handleUpdateSession(request);
          } else if (path === '/output/approve') {
            return this.handleApproveOutput(request);
          } else if (path === '/output/edit') {
            return this.handleEditOutput(request);
          }
          break;

        case 'DELETE':
          if (path === '/session') {
            return this.handleDeleteSession();
          }
          break;
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('SessionStateManager error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleGetSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleCreateSession(request: Request): Promise<Response> {
    const sessionData = (await request.json()) as UserSession;

    this.session = {
      ...sessionData,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      conversationHistory: [],
      agentOutputs: {},
    };

    await this.saveSession();

    return new Response(JSON.stringify(this.session), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleUpdateSession(request: Request): Promise<Response> {
    const updates = await request.json();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    // Update session with provided data
    // Update session properties individually to avoid spread issues
    if (this.session && updates) {
      Object.assign(this.session, updates);
      this.session.lastActive = new Date().toISOString();
    }

    await this.saveSession();

    // Broadcast update to connected WebSockets
    this.broadcastUpdate('session_updated', this.session);

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleAddMessage(request: Request): Promise<Response> {
    const message = (await request.json()) as ChatMessage;

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    // Add message to conversation history
    this.session.conversationHistory.push(message);
    this.session.lastActive = new Date().toISOString();

    await this.saveSession();

    // Broadcast message to connected WebSockets
    this.broadcastUpdate('new_message', message);

    return new Response(JSON.stringify(message), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleAddOutput(request: Request): Promise<Response> {
    const { agentId, output } = (await request.json()) as {
      agentId: string;
      output: AgentOutput;
    };

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    // Add agent output
    this.session.agentOutputs[agentId] = output;
    this.session.lastActive = new Date().toISOString();

    await this.saveSession();

    // Broadcast output to connected WebSockets
    this.broadcastUpdate('agent_output', { agentId, output });

    return new Response(JSON.stringify(output), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleApproveOutput(request: Request): Promise<Response> {
    const { agentId, feedback } = (await request.json()) as {
      agentId: string;
      feedback?: string;
    };

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    if (!this.session.agentOutputs[agentId]) {
      return new Response('Output not found', { status: 404 });
    }

    // Approve output
    this.session.agentOutputs[agentId].status = 'approved';
    this.session.agentOutputs[agentId].approvedAt = new Date().toISOString();
    this.session.agentOutputs[agentId].userFeedback = feedback;
    this.session.lastActive = new Date().toISOString();

    await this.saveSession();

    // Broadcast approval to connected WebSockets
    this.broadcastUpdate('output_approved', { agentId, feedback });

    return new Response(JSON.stringify(this.session.agentOutputs[agentId]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleEditOutput(request: Request): Promise<Response> {
    const { agentId, editedContent } = (await request.json()) as {
      agentId: string;
      editedContent: string;
    };

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    if (!this.session.agentOutputs[agentId]) {
      return new Response('Output not found', { status: 404 });
    }

    // Update output with user edits
    this.session.agentOutputs[agentId].content = editedContent;
    this.session.agentOutputs[agentId].status = 'approved';
    this.session.agentOutputs[agentId].approvedAt = new Date().toISOString();
    this.session.agentOutputs[agentId].userFeedback = 'User edited content';
    this.session.lastActive = new Date().toISOString();

    await this.saveSession();

    // Broadcast edit to connected WebSockets
    this.broadcastUpdate('output_edited', { agentId, editedContent });

    return new Response(JSON.stringify(this.session.agentOutputs[agentId]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleDeleteSession(): Promise<Response> {
    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    // Close all WebSocket connections
    for (const ws of this.webSockets) {
      ws.close(1000, 'Session deleted');
    }
    this.webSockets.clear();

    // Delete session from storage
    await this.ctx.storage.deleteAll();
    this.session = null;

    // Clear save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    return new Response('Session deleted', { status: 200 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Add to active connections
    this.webSockets.add(server);

    // Set up WebSocket event handlers
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(server, event);
    });

    server.addEventListener('close', () => {
      this.webSockets.delete(server);
    });

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.webSockets.delete(server);
    });

    // Send initial session state
    if (this.session) {
      server.send(
        JSON.stringify({
          type: 'session_state',
          data: this.session,
        })
      );
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWebSocketMessage(
    ws: WebSocket,
    event: MessageEvent
  ): Promise<void> {
    try {
      const data = JSON.parse(event.data as string);
      const { type, payload } = data;

      switch (type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'subscribe_updates':
          // WebSocket is already subscribed to updates
          ws.send(JSON.stringify({ type: 'subscribed' }));
          break;

        case 'user_typing':
          // Broadcast typing indicator to other connected clients
          this.broadcastToOthers(ws, 'user_typing', payload);
          break;

        case 'heartbeat':
          this.lastActivity = Date.now();
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;

        default:
          ws.send(
            JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${type}`,
            })
          );
      }
    } catch (error) {
      console.error('WebSocket message handling error:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
        })
      );
    }
  }

  private broadcastUpdate(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    // Remove closed connections and broadcast to active ones
    const closedConnections = new Set<WebSocket>();

    for (const ws of this.webSockets) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        } else {
          closedConnections.add(ws);
        }
      } catch (error) {
        console.error('WebSocket send error:', error);
        closedConnections.add(ws);
      }
    }

    // Clean up closed connections
    for (const ws of closedConnections) {
      this.webSockets.delete(ws);
    }
  }

  private broadcastToOthers(sender: WebSocket, type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    for (const ws of this.webSockets) {
      if (ws !== sender && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error('WebSocket broadcast error:', error);
          this.webSockets.delete(ws);
        }
      }
    }
  }

  private async loadSession(): Promise<void> {
    if (this.session) return;

    try {
      const sessionData = await this.ctx.storage.get('session');
      if (sessionData) {
        this.session = JSON.parse(sessionData as string);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.session) return;

    try {
      await this.ctx.storage.put('session', JSON.stringify(this.session));
      this.lastActivity = Date.now();
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private async saveSessionToPersistentStorage(): Promise<void> {
    if (!this.session) return;

    try {
      // Save to KV store for longer-term persistence
      await this.env.SESSION_STORE.put(
        `session:${this.session.id}`,
        JSON.stringify(this.session)
      );
    } catch (error) {
      console.error('Failed to save session to persistent storage:', error);
    }
  }

  // Cleanup and lifecycle management
  async alarm(): Promise<void> {
    // Called by Durable Objects alarm system for cleanup
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

    if (now - this.lastActivity > inactiveThreshold) {
      console.log('Cleaning up inactive session');

      // Save final state
      await this.saveSessionToPersistentStorage();

      // Close WebSocket connections
      for (const ws of this.webSockets) {
        ws.close(1000, 'Session cleanup');
      }
      this.webSockets.clear();

      // Clear interval
      if (this.saveInterval) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
    }
  }

  // Session metrics and health
  getSessionMetrics(): {
    sessionId: string | null;
    activeConnections: number;
    messageCount: number;
    lastActivity: number;
    sessionAge: number;
  } {
    return {
      sessionId: this.session?.id || null,
      activeConnections: this.webSockets.size,
      messageCount: this.session?.conversationHistory.length || 0,
      lastActivity: this.lastActivity,
      sessionAge: this.session
        ? Date.now() - new Date(this.session.createdAt).getTime()
        : 0,
    };
  }

  async getSessionHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const metrics = this.getSessionMetrics();

    // Check for issues
    if (!this.session) {
      issues.push('No active session');
    }

    if (metrics.activeConnections === 0 && this.session?.status === 'active') {
      issues.push('Active session with no connections');
    }

    const inactiveTime = Date.now() - this.lastActivity;
    if (inactiveTime > 60 * 60 * 1000) {
      // 1 hour
      issues.push('Session inactive for over 1 hour');
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }

  // Session recovery and backup
  async createSessionBackup(): Promise<string> {
    if (!this.session) {
      throw new Error('No session to backup');
    }

    const backup = {
      session: this.session,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    const backupId = `backup_${this.session.id}_${Date.now()}`;
    await this.ctx.storage.put(backupId, JSON.stringify(backup));

    return backupId;
  }

  async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      const backupData = await this.ctx.storage.get(backupId);
      if (!backupData) {
        return false;
      }

      const backup = JSON.parse(backupData as string);
      this.session = backup.session;

      await this.saveSession();
      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  // Session state synchronization
  async syncWithKVStore(): Promise<void> {
    if (!this.session) return;

    try {
      // Get latest state from KV store
      const kvData = await this.env.SESSION_STORE.get(
        `session:${this.session.id}`
      );

      if (kvData) {
        const kvSession = JSON.parse(kvData) as UserSession;

        // Merge states (Durable Object state takes precedence for real-time data)
        this.session = {
          ...kvSession,
          conversationHistory: this.session.conversationHistory, // Keep real-time messages
          lastActive: this.session.lastActive, // Keep real-time activity
        };

        await this.saveSession();
      }
    } catch (error) {
      console.error('Failed to sync with KV store:', error);
    }
  }

  // Export session data
  async exportSession(): Promise<any> {
    if (!this.session) {
      throw new Error('No session to export');
    }

    return {
      session: this.session,
      metrics: this.getSessionMetrics(),
      exportedAt: new Date().toISOString(),
    };
  }
}
