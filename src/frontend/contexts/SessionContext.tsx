import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useParams } from 'react-router-dom';
import { UserSession, ChatMessage, AgentOutput } from '../../types';
import { useAuth } from './AuthContext';

interface SessionContextType {
  session: UserSession | null;
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  approveOutput: (outputId: string, feedback?: string) => Promise<void>;
  editOutput: (outputId: string, editedContent: string) => Promise<void>;
  regenerateOutput: (outputId: string, feedback: string) => Promise<void>;
  isAgentTyping: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  streamingMessages: Record<string, string>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, supabase } = useAuth();

  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected'
  >('connecting');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, string>>({});

  // Initialize session and WebSocket connection
  useEffect(() => {
    if (!sessionId || !user) return;

    let isMounted = true;

    const initializeSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get session from API
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`/api/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load session: ${response.statusText}`);
        }

        const data = (await response.json()) as { data: UserSession };

        if (isMounted) {
          setSession(data.data);

          // Initialize WebSocket connection
          initializeWebSocket(sessionId, token);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load session'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      if (websocket) {
        websocket.close();
      }
    };
  }, [sessionId, user, supabase]);

  const initializeWebSocket = useCallback(
    (sessionId: string, token: string) => {
      // Use WebSocket protocol but same host (proxy will handle routing)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/${sessionId}`;

      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectionStatus('connected');
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('WebSocket disconnected');

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (sessionId && user) {
            setConnectionStatus('connecting');
            initializeWebSocket(sessionId, token);
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

      setWebsocket(ws);
    },
    []
  );

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'session_state':
        setSession(data.data);
        break;

      case 'new_message':
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            conversationHistory: [...prev.conversationHistory, data.data],
          };
        });
        break;

      case 'agent_response':
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            conversationHistory: [...prev.conversationHistory, data.message],
          };
        });
        setIsAgentTyping(false);
        break;

      case 'agent_typing':
        setIsAgentTyping(true);
        break;

      case 'streaming_start':
        setIsAgentTyping(true);
        setStreamingMessages(prev => ({
          ...prev,
          [data.messageId]: '',
        }));
        break;

      case 'content_chunk':
        setStreamingMessages(prev => {
          const messageIds = Object.keys(prev);
          if (messageIds.length === 0) return prev;
          
          const lastMessageId = messageIds[messageIds.length - 1];
          return {
            ...prev,
            [lastMessageId]: (prev[lastMessageId] || '') + data.chunk,
          };
        });
        break;

      case 'streaming_complete':
        setIsAgentTyping(false);
        
        // Update session with the message and agent output first
        setSession((prev) => {
          if (!prev) return prev;
          
          // Update conversation history
          const updatedSession = {
            ...prev,
            conversationHistory: [...prev.conversationHistory, data.message],
          };
          
          // If this message contains agent output, save it to agentOutputs
          if (data.message.type === 'output' && data.message.metadata?.agentId && data.message.content) {
            updatedSession.agentOutputs = {
              ...prev.agentOutputs,
              [data.message.metadata.agentId]: {
                agentId: data.message.metadata.agentId,
                status: 'pending',
                content: data.message.content,
                qualityScore: data.message.metadata?.qualityScore || 0.8,
                generatedAt: data.message.timestamp,
              }
            };
          }
          
          return updatedSession;
        });
        
        // Clear streaming messages after a small delay to ensure session state is updated
        setTimeout(() => {
          setStreamingMessages(prev => {
            const newStreamingMessages = { ...prev };
            delete newStreamingMessages[data.messageId];
            return newStreamingMessages;
          });
        }, 100);
        break;

      case 'agent_output':
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            agentOutputs: {
              ...prev.agentOutputs,
              [data.agentId]: data.output,
            },
          };
        });
        break;

      case 'session_updated':
        setSession(data.data);
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        // Unknown message type - ignore silently
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session || !websocket || connectionStatus !== 'connected') {
        throw new Error('Not connected to session');
      }

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        sender: 'user',
        type: 'text',
        content,
        timestamp: new Date().toISOString(),
      };

      // Add message to local state immediately
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          conversationHistory: [...prev.conversationHistory, message],
        };
      });

      // Send via WebSocket
      websocket.send(
        JSON.stringify({
          type: 'message',
          payload: { content },
        })
      );
    },
    [session, websocket, connectionStatus]
  );

  const approveOutput = useCallback(
    async (outputId: string, feedback?: string) => {
      if (!session || !user) {
        throw new Error('No active session');
      }

      try {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`/api/chat/${session.id}/approve`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ outputId, feedback }),
        });

        if (!response.ok) {
          throw new Error(`Failed to approve output: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          data: { session: UserSession };
        };
        setSession(data.data.session);
      } catch (error) {
        console.error('Error approving output:', error);
        throw error;
      }
    },
    [session, user, supabase]
  );

  const editOutput = useCallback(
    async (outputId: string, editedContent: string) => {
      if (!session || !user) {
        throw new Error('No active session');
      }

      try {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`/api/chat/${session.id}/edit`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ outputId, editedContent }),
        });

        if (!response.ok) {
          throw new Error(`Failed to edit output: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          data: { session: UserSession };
        };
        setSession(data.data.session);
      } catch (error) {
        console.error('Error editing output:', error);
        throw error;
      }
    },
    [session, user, supabase]
  );

  const regenerateOutput = useCallback(
    async (outputId: string, feedback: string) => {
      if (!session || !user) {
        throw new Error('No active session');
      }

      try {
        setIsAgentTyping(true);

        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`/api/chat/${session.id}/regenerate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ outputId, feedback }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to regenerate output: ${response.statusText}`
          );
        }

        const data = (await response.json()) as {
          data: { session: UserSession };
        };
        setSession(data.data.session);
      } catch (error) {
        console.error('Error regenerating output:', error);
        throw error;
      } finally {
        setIsAgentTyping(false);
      }
    },
    [session, user, supabase]
  );

  // Keep WebSocket alive with periodic pings
  useEffect(() => {
    if (websocket && connectionStatus === 'connected') {
      const pingInterval = setInterval(() => {
        websocket.send(JSON.stringify({ type: 'ping' }));
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [websocket, connectionStatus]);

  const value = {
    session,
    loading,
    error,
    sendMessage,
    approveOutput,
    editOutput,
    regenerateOutput,
    isAgentTyping,
    connectionStatus,
    streamingMessages,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
