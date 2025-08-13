/**
 * Agent Chat Executor - Specialized executor for individual agent chat sessions
 * Handles agent-specific context, streaming responses, and chat-optimized prompts
 */

import Anthropic from '@anthropic-ai/sdk';
import { Env, UserSession, AgentConfig } from '../types';
import {
  AgentChatSession,
  AgentChatMessage,
  AgentChatContext,
  AgentChatExecutionResult,
  AgentChatWebSocketMessage,
} from '../types/agent-chat-types';
import { getAgentChatPrompt } from './agent-chat-prompts';
import { ConfigLoader } from './config-loader';

export class AgentChatExecutor {
  private anthropic: Anthropic;
  private configLoader: ConfigLoader;

  constructor(private env: Env) {
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
    this.configLoader = new ConfigLoader(env.CONFIG_STORE);
  }

  /**
   * Execute agent chat message with streaming support
   */
  async executeChatMessage(
    agentId: string,
    userMessage: string,
    chatSession: AgentChatSession,
    websocketServer?: WebSocket
  ): Promise<AgentChatExecutionResult> {
    const startTime = Date.now();

    try {
      // Build agent-specific context
      const chatContext = this.buildAgentChatContext(agentId, chatSession);

      // Get agent prompt configuration
      const promptConfig = getAgentChatPrompt(agentId);
      if (!promptConfig) {
        throw new Error(
          `No chat prompt configuration found for agent: ${agentId}`
        );
      }

      // Build the complete prompt
      const systemPrompt = this.buildSystemPrompt(
        agentId,
        promptConfig,
        chatContext
      );
      const userPrompt = this.buildUserPrompt(userMessage, chatContext);

      console.log(`🤖 Executing agent chat for ${agentId}:`, {
        contextType: chatContext.contextType,
        messageLength: userMessage.length,
        hasWebSocket: !!websocketServer,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
      });

      console.log(
        `📝 System prompt preview (first 500 chars):`,
        systemPrompt.substring(0, 500) + '...'
      );
      console.log(`💬 User prompt:`, userPrompt);

      // Prepare Claude API request
      const claudeRequest = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0.8,
        system: systemPrompt,
        messages: [
          {
            role: 'user' as const,
            content: userPrompt,
          },
        ],
        stream: !!websocketServer, // Stream if WebSocket is available
      };

      console.log(`🔧 Claude API request config:`, {
        model: claudeRequest.model,
        max_tokens: claudeRequest.max_tokens,
        temperature: claudeRequest.temperature,
        stream: claudeRequest.stream,
        systemPromptLength: claudeRequest.system.length,
        messagesCount: claudeRequest.messages.length,
      });

      let responseContent = '';
      let tokensUsed = 0;

      if (websocketServer && claudeRequest.stream) {
        // Streaming response via WebSocket
        const messageId = crypto.randomUUID();

        console.log(`🌊 Starting streaming response for message: ${messageId}`);

        // Send streaming start
        this.sendWebSocketMessage(websocketServer, {
          type: 'streaming_start',
          messageId,
        });

        console.log(`🚀 Calling Claude API for streaming...`);
        const stream = (await this.anthropic.messages.create(
          claudeRequest
        )) as any;
        console.log(`📡 Stream established, processing events...`);

        let chunkCount = 0;
        for await (const messageStreamEvent of stream) {
          console.log(`📦 Stream event type: ${messageStreamEvent.type}`);

          if (messageStreamEvent.type === 'content_block_delta') {
            const chunk = messageStreamEvent.delta.text || '';
            responseContent += chunk;
            chunkCount++;

            if (chunkCount % 10 === 0) {
              console.log(
                `📊 Processed ${chunkCount} chunks, current length: ${responseContent.length}`
              );
            }

            // Send chunk to WebSocket
            this.sendWebSocketMessage(websocketServer, {
              type: 'content_chunk',
              chunk,
            });
          }

          if (messageStreamEvent.type === 'message_delta') {
            tokensUsed = messageStreamEvent.usage?.output_tokens || 0;
            console.log(`🪙 Tokens used: ${tokensUsed}`);
          }
        }

        console.log(
          `✅ Streaming completed: ${chunkCount} chunks, ${responseContent.length} chars, ${tokensUsed} tokens`
        );

        // Send streaming complete
        const agentMessage: AgentChatMessage = {
          id: crypto.randomUUID(),
          sessionId: chatSession.id,
          sender: 'agent',
          type: 'output',
          content: responseContent,
          timestamp: new Date().toISOString(),
          metadata: {
            agentId,
            agentName: chatSession.agentConfig?.name,
            tokensUsed,
            contextType: chatContext.contextType,
          },
        };

        this.sendWebSocketMessage(websocketServer, {
          type: 'streaming_complete',
          messageId,
          message: agentMessage,
        });

        console.log(`🎯 Streaming complete message sent for: ${messageId}`);
      } else {
        // Non-streaming response
        console.log(`📞 Calling Claude API (non-streaming)...`);
        const response = await this.anthropic.messages.create({
          ...claudeRequest,
          stream: false,
        });

        responseContent = (response.content[0] as any)?.text || '';
        tokensUsed = response.usage?.output_tokens || 0;
        console.log(
          `✅ Non-streaming response: ${responseContent.length} chars, ${tokensUsed} tokens`
        );
      }

      const processingTime = Date.now() - startTime;

      return {
        content: responseContent,
        tokensUsed,
        contextType: chatContext.contextType,
        qualityScore: 0.85, // Default quality score for chat responses
        processingTime,
      };
    } catch (error) {
      console.error(`❌ Agent chat execution failed for ${agentId}:`, error);
      throw new Error(
        `Agent chat execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build agent-specific context for chat
   */
  private buildAgentChatContext(
    agentId: string,
    chatSession: AgentChatSession
  ): AgentChatContext {
    const strategySession = chatSession.strategyContext;

    if (!strategySession) {
      throw new Error('Strategy context is required for agent chat');
    }

    const baseContext = {
      businessIdea:
        strategySession.userInputs?.businessIdea ||
        'Business concept from strategy session',
      userInputs: strategySession.userInputs || {},
      chatHistory: chatSession.messages.slice(-10), // Last 10 messages for context
    };

    if (agentId === 'ceo') {
      // CEO gets ALL approved outputs for strategic oversight
      const fullStrategyContext: Record<string, string> = {};

      for (const [outputAgentId, output] of Object.entries(
        strategySession.agentOutputs
      )) {
        if (output.status === 'approved') {
          fullStrategyContext[outputAgentId] = output.content;
        }
      }

      return {
        ...baseContext,
        fullStrategyContext,
        contextType: 'full' as const,
      };
    } else {
      // Other agents get ONLY their own approved output
      const agentOutput = strategySession.agentOutputs[agentId];

      return {
        ...baseContext,
        agentSpecificOutput: agentOutput?.content || '',
        contextType: 'own' as const,
      };
    }
  }

  /**
   * Build system prompt for agent chat
   */
  private buildSystemPrompt(
    agentId: string,
    promptConfig: any,
    context: AgentChatContext
  ): string {
    let systemPrompt = promptConfig.systemPrompt + '\n\n';

    // Add context instructions
    systemPrompt += promptConfig.contextInstructions + '\n\n';

    // Add context data
    if (context.contextType === 'full' && context.fullStrategyContext) {
      systemPrompt += '## Complete Strategy Context:\n';
      for (const [contextAgentId, output] of Object.entries(
        context.fullStrategyContext
      )) {
        systemPrompt += `\n### ${contextAgentId.toUpperCase()} STRATEGY:\n${output}\n`;
      }
    } else if (context.agentSpecificOutput) {
      systemPrompt += `## Your Approved Strategy Output:\n${context.agentSpecificOutput}\n\n`;
    }

    // Add business context
    systemPrompt += `## Business Context:\n`;
    systemPrompt += `**Business Idea**: ${context.businessIdea}\n`;

    if (context.userInputs.projectName) {
      systemPrompt += `**Project Name**: ${context.userInputs.projectName}\n`;
    }

    // Add recent chat history for context
    if (context.chatHistory.length > 0) {
      systemPrompt += `\n## Recent Conversation:\n`;
      context.chatHistory.forEach((msg) => {
        const role = msg.sender === 'user' ? 'User' : 'You';
        systemPrompt += `**${role}**: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
      });
    }

    // Add output format instructions
    systemPrompt += `\n## Output Format:\n${promptConfig.outputFormat}`;

    return systemPrompt;
  }

  /**
   * Build user prompt for current message
   */
  private buildUserPrompt(
    userMessage: string,
    context: AgentChatContext
  ): string {
    return `${userMessage}

Please provide specific, actionable guidance based on your expertise and the strategy context available to you.`;
  }

  /**
   * Send message via WebSocket with error handling
   */
  private sendWebSocketMessage(
    websocket: WebSocket,
    message: AgentChatWebSocketMessage
  ): void {
    try {
      websocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }
}
