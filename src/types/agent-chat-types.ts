/**
 * Type definitions for individual agent chat functionality
 * Separate from main types to maintain clean architecture
 */

import { ChatMessage, UserSession, AgentConfig } from './index';

export interface AgentChatSession {
  id: string;
  sessionId: string; // Reference to main strategy session
  agentId: string;
  agentConfig: AgentConfig | null;
  messages: AgentChatMessage[];
  strategyContext: UserSession | null; // Full strategy session for context
  createdAt: string;
  lastActive: string;
}

export interface AgentChatMessage extends ChatMessage {
  metadata?: {
    agentId?: string;
    agentName?: string;
    tokensUsed?: number;
    contextType?: 'own' | 'full'; // What context the agent had access to
    qualityScore?: number;
  };
}

export interface AgentChatContext {
  businessIdea: string;
  userInputs: Record<string, any>;
  chatHistory: AgentChatMessage[]; // Recent chat messages for this agent
  agentSpecificOutput?: string; // Only this agent's approved output
  fullStrategyContext?: Record<string, string>; // All outputs (CEO only)
  contextType: 'own' | 'full';
}

export interface AgentChatExecutionResult {
  content: string;
  tokensUsed: number;
  contextType: 'own' | 'full';
  qualityScore: number;
  processingTime: number;
}

export interface AgentChatWebSocketMessage {
  type: 'message' | 'ping' | 'agent_typing' | 'streaming_start' | 'content_chunk' | 'streaming_complete' | 'pong';
  payload?: {
    content?: string;
  };
  messageId?: string;
  chunk?: string;
  message?: AgentChatMessage;
}

export interface QuickPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  description?: string;
}

export interface AgentPromptConfig {
  systemPrompt: string;
  contextInstructions: string;
  outputFormat: string;
  chatOptimized: boolean;
}