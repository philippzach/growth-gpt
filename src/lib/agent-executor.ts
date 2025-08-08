/**
 * Agent Executor - Handles Claude API integration and agent execution
 * Manages the actual AI API calls and response processing
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Env,
  AgentType,
  GeneratedPrompt,
  PromptGenerationContext,
} from '../types';
import { SimplePrompt } from './simple-prompt-builder';
import { ConfigLoader } from './config-loader';

export interface AgentExecutionResult {
  content: string;
  qualityScore: number;
  tokensUsed: number;
  processingTime: number;
  knowledgeSourcesUsed: string[];
  qualityGatesPassed: string[];
  metadata: AgentExecutionMetadata;
}

export interface AgentExecutionMetadata {
  model: string;
  temperature: number;
  maxTokens: number;
  actualTokens: number;
  responseTime: number;
  apiCallId: string;
  rateLimitInfo?: {
    remaining: number;
    resetTime: number;
  };
}

export class AgentExecutor {
  private anthropic: Anthropic;
  private rateLimitTracker = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private websocketEmitter?: (sessionId: string, data: any) => void;

  constructor(
    private env: Env,
    websocketEmitter?: (sessionId: string, data: any) => void
  ) {
    console.log('🔐 DEBUG: API Key exists:', !!env.ANTHROPIC_API_KEY);
    console.log(
      '🔐 DEBUG: API Key length:',
      env.ANTHROPIC_API_KEY?.length || 0
    );
    console.log(
      '🔐 DEBUG: API Key format:',
      env.ANTHROPIC_API_KEY?.substring(0, 25) + '...' || 'MISSING'
    );
    console.log(
      '🔐 DEBUG: API Key starts with sk-ant:',
      env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')
    );
    console.log('🔐 DEBUG: Full env keys available:', Object.keys(env));

    // Test API key validity format
    if (!env.ANTHROPIC_API_KEY) {
      console.error(
        '❌ CRITICAL: ANTHROPIC_API_KEY is missing from environment'
      );
    } else if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      console.error(
        '❌ CRITICAL: ANTHROPIC_API_KEY does not start with sk-ant- (invalid format)'
      );
    } else if (env.ANTHROPIC_API_KEY.length < 50) {
      console.error(
        '❌ CRITICAL: ANTHROPIC_API_KEY seems too short (possibly truncated)'
      );
    } else {
      console.log('✅ DEBUG: API Key format appears valid');
    }

    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      // Explicitly set the API version and headers for Cloudflare Workers
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
    this.websocketEmitter = websocketEmitter;
  }

  async executeAgent(
    agentId: AgentType,
    generatedPrompt: GeneratedPrompt | SimplePrompt,
    context: PromptGenerationContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // Check rate limits
      await this.checkRateLimits(agentId);

      // Prepare API request
      const apiRequest = this.prepareAPIRequest(generatedPrompt, context);

      // Log the complete API request body for debugging
      this.logAPIRequest(agentId, apiRequest, context);

      // Execute Claude API call with streaming enabled
      const stream = await this.anthropic.messages.create({
        ...apiRequest,
        stream: true,
      });

      // Process streaming response
      const result = await this.processStreamingResponse(
        stream,
        generatedPrompt,
        context,
        startTime
      );

      // Log the API response for debugging
      this.logAPIResponse(agentId, result, context);

      // Update rate limit tracking
      this.updateRateLimitTracking(agentId);

      // Log execution for monitoring
      this.logExecution(agentId, result, context.session.id);

      return result;
    } catch (error) {
      console.error(`Agent execution failed for ${agentId}:`, error);

      // Handle specific error types
      if (error instanceof Anthropic.APIError) {
        return this.handleAPIError(error, generatedPrompt, startTime);
      }

      throw error;
    }
  }

  private prepareAPIRequest(
    generatedPrompt: GeneratedPrompt | SimplePrompt,
    context: PromptGenerationContext
  ): Anthropic.MessageCreateParams {
    const agentConfig = context.agentConfig;

    // Get model and parameters from configuration
    const model = 'claude-3-haiku-20240307'; // Using Haiku for development
    const temperature = agentConfig?.configuration?.temperature || 0.7;
    const maxTokens = 3000; // Haiku's max output tokens
    return {
      model,
      max_tokens: maxTokens,
      temperature,
      system: generatedPrompt.systemPrompt,
      messages: [
        {
          role: 'user',
          content: generatedPrompt.userPrompt,
        },
      ],
      // Note: metadata removed as session_id is not supported by Anthropic API
    };
  }

  private async processAPIResponse(
    response: Anthropic.Message,
    generatedPrompt: GeneratedPrompt | SimplePrompt,
    context: PromptGenerationContext,
    startTime: number
  ): Promise<AgentExecutionResult> {
    const processingTime = Date.now() - startTime;

    // Extract content from response
    const content = this.extractContent(response);

    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(
      content,
      context.taskConfig,
      generatedPrompt
    );

    // Determine knowledge sources used
    const knowledgeSourcesUsed = this.identifyKnowledgeSourcesUsed(
      content,
      context.knowledgeBase
    );

    // Check quality gates
    const qualityGatesPassed = await this.checkQualityGates(
      content,
      context.taskConfig
    );

    // Extract token usage
    const tokensUsed = this.calculateTokenUsage(response);

    return {
      content,
      qualityScore,
      tokensUsed,
      processingTime,
      knowledgeSourcesUsed,
      qualityGatesPassed,
      metadata: {
        model: response.model,
        temperature: context.agentConfig.configuration.temperature || 0.7,
        maxTokens: context.agentConfig.configuration.max_tokens || 4000,
        actualTokens: tokensUsed,
        responseTime: processingTime,
        apiCallId: response.id,
        rateLimitInfo: this.extractRateLimitInfo(response),
      },
    };
  }

  private async processStreamingResponse(
    stream: any,
    generatedPrompt: GeneratedPrompt | SimplePrompt,
    context: PromptGenerationContext,
    startTime: number
  ): Promise<AgentExecutionResult> {
    let fullContent = '';
    let finalMessage: Anthropic.Message | null = null;

    // Process the stream and collect content
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        fullContent += chunk.delta.text;

        // Emit streaming update via WebSocket if available
        if (context.session?.id) {
          this.emitStreamingUpdate(context.session.id, chunk.delta.text);
        }
      } else if (chunk.type === 'message_stop') {
        // Stream completed, we should have the final message
        finalMessage = chunk.message || {
          id: crypto.randomUUID(),
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: fullContent }],
          model:
            context.agentConfig.configuration.model ||
            'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }
    }

    const processingTime = Date.now() - startTime;

    // Calculate quality score using the full content
    const qualityScore = await this.calculateQualityScore(
      fullContent,
      context.taskConfig,
      generatedPrompt
    );

    // Determine knowledge sources used
    const knowledgeSourcesUsed = this.identifyKnowledgeSourcesUsed(
      fullContent,
      context.knowledgeBase
    );

    // Check quality gates
    const qualityGatesPassed = await this.checkQualityGates(
      fullContent,
      context.taskConfig
    );

    // Calculate token usage (approximate for streaming)
    const tokensUsed = Math.ceil(fullContent.length / 4); // Rough estimate

    return {
      content: fullContent,
      qualityScore,
      tokensUsed,
      processingTime,
      knowledgeSourcesUsed,
      qualityGatesPassed,
      metadata: {
        model:
          context.agentConfig.configuration.model || 'claude-sonnet-4-20250514',
        temperature: context.agentConfig.configuration.temperature || 0.7,
        maxTokens: context.agentConfig.configuration.max_tokens || 4000,
        actualTokens: tokensUsed,
        responseTime: processingTime,
        apiCallId: finalMessage?.id || crypto.randomUUID(),
        rateLimitInfo: { remaining: -1, resetTime: -1 }, // Not available in streaming
      },
    };
  }

  private emitStreamingUpdate(sessionId: string, textChunk: string): void {
    // Emit streaming update via WebSocket if emitter is available
    if (this.websocketEmitter) {
      this.websocketEmitter(sessionId, {
        type: 'content_chunk',
        chunk: textChunk,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private extractContent(response: Anthropic.Message): string {
    // Handle different content types from Claude API
    if (response.content && Array.isArray(response.content)) {
      return response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');
    }

    // Handle string content directly
    if (typeof response.content === 'string') {
      return response.content;
    }

    return '';
  }

  private async calculateQualityScore(
    content: string,
    taskConfig: any,
    generatedPrompt: GeneratedPrompt | SimplePrompt
  ): Promise<number> {
    let score = 0.5; // Base score

    // Content length check (adequate detail)
    if (content.length > 1000) score += 0.1;
    if (content.length > 2000) score += 0.1;

    // Structure check (headers, lists, organization)
    if (content.includes('##') || content.includes('**')) score += 0.1;
    if (content.includes('•') || content.includes('-')) score += 0.05;

    // Required elements check (only if taskConfig exists)
    if (taskConfig?.workflow_integration?.quality_gates?.validation_rules) {
      const requiredElements =
        taskConfig.workflow_integration.quality_gates.validation_rules;
      let elementsFound = 0;

      for (const element of requiredElements) {
        if (this.checkElementPresent(content, element)) {
          elementsFound++;
        }
      }

      if (requiredElements.length > 0) {
        score += (elementsFound / requiredElements.length) * 0.2;
      }
    }

    // Deliverables alignment check (only if taskConfig exists)
    if (taskConfig?.task_specification?.deliverables?.primary_deliverables) {
      const deliverables =
        taskConfig.task_specification.deliverables.primary_deliverables;
      let deliverablesAddressed = 0;

      for (const deliverable of deliverables) {
        if (this.checkDeliverableAddressed(content, deliverable)) {
          deliverablesAddressed++;
        }
      }

      if (deliverables.length > 0) {
        score += (deliverablesAddressed / deliverables.length) * 0.15;
      }
    } else {
      // For new simplified system without taskConfig, use basic scoring
      score += 0.15; // Give benefit of doubt for simplified system
    }

    return Math.min(score, 1.0);
  }

  private checkElementPresent(content: string, element: string): boolean {
    // Check if required element is present in content
    const normalizedContent = content.toLowerCase();
    const normalizedElement = element.toLowerCase();

    // Check for key terms
    const keyTerms = this.extractKeyTerms(normalizedElement);
    return keyTerms.some((term) => normalizedContent.includes(term));
  }

  private extractKeyTerms(element: string): string[] {
    // Extract key terms from element description
    const commonWords = [
      'must',
      'should',
      'include',
      'contain',
      'have',
      'be',
      'are',
      'is',
    ];

    return element
      .split(' ')
      .filter((word) => word.length > 3 && !commonWords.includes(word))
      .slice(0, 3); // Take first 3 meaningful words
  }

  private checkDeliverableAddressed(
    content: string,
    deliverable: string
  ): boolean {
    // Check if deliverable is addressed in content
    const deliverableKeywords = this.extractDeliverableKeywords(deliverable);
    const normalizedContent = content.toLowerCase();

    return deliverableKeywords.some((keyword) =>
      normalizedContent.includes(keyword)
    );
  }

  private extractDeliverableKeywords(deliverable: string): string[] {
    // Extract keywords from deliverable description
    const normalized = deliverable.toLowerCase();

    if (normalized.includes('framework'))
      return ['framework', 'structure', 'approach'];
    if (normalized.includes('strategy'))
      return ['strategy', 'plan', 'approach'];
    if (normalized.includes('analysis'))
      return ['analysis', 'assessment', 'evaluation'];
    if (normalized.includes('recommendation'))
      return ['recommendation', 'suggest', 'advise'];

    return [normalized.split(' ')[0]]; // Fallback to first word
  }

  private identifyKnowledgeSourcesUsed(
    content: string,
    knowledgeBase: Record<string, string>
  ): string[] {
    const sourcesUsed: string[] = [];
    const normalizedContent = content.toLowerCase();

    for (const [source, knowledgeContent] of Object.entries(knowledgeBase)) {
      // Check if content references concepts from this knowledge source
      const knowledgeKeywords = this.extractKnowledgeKeywords(knowledgeContent);

      if (
        knowledgeKeywords.some((keyword) => normalizedContent.includes(keyword))
      ) {
        sourcesUsed.push(source);
      }
    }

    return sourcesUsed;
  }

  private extractKnowledgeKeywords(knowledgeContent: string): string[] {
    // Extract key terms from knowledge content
    const lines = knowledgeContent.split('\n');
    const keywords: string[] = [];

    // Extract from headers and first sentences
    for (const line of lines.slice(0, 10)) {
      if (line.startsWith('#') || line.startsWith('##')) {
        keywords.push(...line.replace(/#+\s*/, '').toLowerCase().split(' '));
      }
    }

    return keywords.filter((word) => word.length > 4).slice(0, 10);
  }

  private async checkQualityGates(
    content: string,
    taskConfig: any
  ): Promise<string[]> {
    const passedGates: string[] = [];

    if (!taskConfig?.workflow_integration?.quality_gates?.post_execution) {
      // For simplified system without taskConfig, use basic quality gates
      if (content.length > 500) passedGates.push('adequate_length');
      if (content.includes('##') || content.includes('**'))
        passedGates.push('structured_content');
      if (content.includes('recommend') || content.includes('suggest'))
        passedGates.push('actionable_content');
      return passedGates;
    }

    const qualityGates =
      taskConfig.workflow_integration.quality_gates.post_execution;

    for (const gate of qualityGates) {
      if (await this.evaluateQualityGate(content, gate)) {
        passedGates.push(gate);
      }
    }

    return passedGates;
  }

  private async evaluateQualityGate(
    content: string,
    gate: string
  ): Promise<boolean> {
    // Evaluate specific quality gates
    const normalizedGate = gate.toLowerCase();
    const normalizedContent = content.toLowerCase();

    if (normalizedGate.includes('comprehensive')) {
      return content.length > 1500; // Minimum length for comprehensive content
    }

    if (normalizedGate.includes('specific')) {
      return content.includes('specific') || content.includes('detailed');
    }

    if (normalizedGate.includes('actionable')) {
      return (
        content.includes('action') ||
        content.includes('implement') ||
        content.includes('steps')
      );
    }

    if (normalizedGate.includes('strategic')) {
      return (
        content.includes('strategy') ||
        content.includes('goal') ||
        content.includes('objective')
      );
    }

    return true; // Default pass if gate not recognized
  }

  private calculateTokenUsage(response: Anthropic.Message): number {
    // Extract token usage from response metadata
    if (response.usage) {
      return response.usage.input_tokens + response.usage.output_tokens;
    }

    // Fallback estimation
    return Math.ceil(response.content?.toString().length || 0 / 4);
  }

  private extractRateLimitInfo(
    response: Anthropic.Message
  ): { remaining: number; resetTime: number } | undefined {
    // Extract rate limit information from response headers
    // This would be implementation-specific to Anthropic's API
    return undefined;
  }

  private async checkRateLimits(agentId: string): Promise<void> {
    const now = Date.now();
    const rateLimitInfo = this.rateLimitTracker.get(agentId);

    if (rateLimitInfo) {
      if (now < rateLimitInfo.resetTime && rateLimitInfo.count >= 50) {
        const waitTime = rateLimitInfo.resetTime - now;
        throw new Error(
          `Rate limit exceeded for ${agentId}. Please wait ${Math.ceil(waitTime / 1000)} seconds.`
        );
      }

      if (now >= rateLimitInfo.resetTime) {
        // Reset counter
        this.rateLimitTracker.set(agentId, {
          count: 0,
          resetTime: now + 60000,
        });
      }
    }
  }

  private updateRateLimitTracking(agentId: string): void {
    const now = Date.now();
    const rateLimitInfo = this.rateLimitTracker.get(agentId);

    if (rateLimitInfo) {
      rateLimitInfo.count++;
    } else {
      this.rateLimitTracker.set(agentId, { count: 1, resetTime: now + 60000 });
    }
  }

  private handleAPIError(
    error: any,
    generatedPrompt: GeneratedPrompt | SimplePrompt,
    startTime: number
  ): AgentExecutionResult {
    console.error('Anthropic API Error:', error);

    // Return fallback result for certain error types
    return {
      content: `I apologize, but I encountered an error while processing your request. Error: ${error.message}`,
      qualityScore: 0.1,
      tokensUsed: 0,
      processingTime: Date.now() - startTime,
      knowledgeSourcesUsed: [],
      qualityGatesPassed: [],
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4000,
        actualTokens: 0,
        responseTime: Date.now() - startTime,
        apiCallId: 'error',
      },
    };
  }

  private logExecution(
    agentId: string,
    result: AgentExecutionResult,
    sessionId: string
  ): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'agent_execution',
        agentId,
        sessionId,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        contentLength: result.content.length,
      })
    );
  }

  /**
   * Log the complete API request body for debugging and troubleshooting
   */
  private logAPIRequest(
    agentId: AgentType,
    apiRequest: Anthropic.MessageCreateParams,
    context: PromptGenerationContext
  ): void {
    // Calculate token estimates
    const systemPromptString =
      typeof apiRequest.system === 'string'
        ? apiRequest.system
        : JSON.stringify(apiRequest.system || '');
    const systemPromptTokens = this.estimateTokens(systemPromptString);

    // Extract user content for token estimation
    let userContentString = '';
    if (Array.isArray(apiRequest.messages) && apiRequest.messages.length > 0) {
      const userMessage = apiRequest.messages[0];
      if (typeof userMessage.content === 'string') {
        userContentString = userMessage.content;
      } else if (Array.isArray(userMessage.content)) {
        userContentString = userMessage.content
          .map((block) =>
            typeof block === 'object' && 'text' in block
              ? block.text
              : JSON.stringify(block)
          )
          .join(' ');
      } else {
        userContentString = JSON.stringify(userMessage.content);
      }
    }
    const userPromptTokens = this.estimateTokens(userContentString);
    const totalInputTokens = systemPromptTokens + userPromptTokens;

    console.log('\n' + '='.repeat(80));
    console.log(`🤖 ANTHROPIC API REQUEST - Agent: ${agentId.toUpperCase()}`);
    console.log('='.repeat(80));

    console.log('\n📊 REQUEST METADATA:');
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          sessionId: context.session.id,
          agentId,
          model: apiRequest.model,
          temperature: apiRequest.temperature,
          maxTokens: apiRequest.max_tokens,
          estimatedInputTokens: totalInputTokens,
          systemPromptTokens,
          userPromptTokens,
          workflowStep: context.workflowStep,
          currentAgent: context.session.currentAgent,
        },
        null,
        2
      )
    );

    console.log('\n🔧 SYSTEM PROMPT:');
    console.log('-'.repeat(60));
    console.log(apiRequest.system || 'No system prompt');

    console.log('\n👤 USER PROMPT:');
    console.log('-'.repeat(60));
    if (Array.isArray(apiRequest.messages) && apiRequest.messages.length > 0) {
      const userMessage = apiRequest.messages[0];
      if (typeof userMessage.content === 'string') {
        console.log(userMessage.content);
      } else {
        console.log(JSON.stringify(userMessage.content, null, 2));
      }
    } else {
      console.log('No user messages');
    }

    console.log('\n📋 CONTEXT SUMMARY:');
    console.log('-'.repeat(60));
    console.log(
      JSON.stringify(
        {
          businessIdea:
            context.userInputs?.businessIdea?.substring(0, 100) + '...' ||
            'Not provided',
          previousOutputsCount: Object.keys(context.previousOutputs || {})
            .length,
          previousAgents: Object.keys(context.previousOutputs || {}),
          userInputsKeys: Object.keys(context.userInputs || {}),
          knowledgeBaseKeys: Object.keys(context.knowledgeBase || {}),
        },
        null,
        2
      )
    );

    console.log('\n💾 COMPLETE API REQUEST BODY:');
    console.log('-'.repeat(60));
    console.log(
      JSON.stringify(
        {
          model: apiRequest.model,
          max_tokens: apiRequest.max_tokens,
          temperature: apiRequest.temperature,
          system: apiRequest.system,
          messages: apiRequest.messages,
          // Note: Only showing structure, full content logged above for readability
        },
        null,
        2
      )
    );

    console.log('\n' + '='.repeat(80));
    console.log(
      `📤 SENDING TO ANTHROPIC API - Estimated ${totalInputTokens} input tokens`
    );
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Log the API response for debugging and troubleshooting
   */
  private logAPIResponse(
    agentId: AgentType,
    result: AgentExecutionResult,
    context: PromptGenerationContext
  ): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📥 ANTHROPIC API RESPONSE - Agent: ${agentId.toUpperCase()}`);
    console.log('='.repeat(80));

    console.log('\n📊 RESPONSE METADATA:');
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          sessionId: context.session.id,
          agentId,
          tokensUsed: result.tokensUsed,
          processingTime: result.processingTime,
          qualityScore: result.qualityScore,
          contentLength: result.content.length,
          model: result.metadata.model,
          apiCallId: result.metadata.apiCallId,
          responseTime: result.metadata.responseTime,
        },
        null,
        2
      )
    );

    console.log('\n📝 GENERATED CONTENT:');
    console.log('-'.repeat(60));
    console.log(result.content);

    console.log('\n🎯 QUALITY ANALYSIS:');
    console.log('-'.repeat(60));
    console.log(
      JSON.stringify(
        {
          qualityScore: result.qualityScore,
          knowledgeSourcesUsed: result.knowledgeSourcesUsed,
          qualityGatesPassed: result.qualityGatesPassed,
          contentWordCount: result.content.split(' ').length,
          contentCharCount: result.content.length,
        },
        null,
        2
      )
    );

    console.log('\n' + '='.repeat(80));
    console.log(
      `✅ RESPONSE PROCESSED - ${result.tokensUsed} tokens used, ${result.processingTime}ms`
    );
    console.log('='.repeat(80) + '\n');
  }

  // Health check for API connectivity
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      console.log('🩺 DEBUG: Starting API health check...');
      console.log('🩺 DEBUG: Using model: claude-3-haiku-20240307');
      console.log(
        '🩺 DEBUG: API Key length:',
        this.env.ANTHROPIC_API_KEY?.length
      );

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Use Haiku for health check
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      });

      console.log('✅ DEBUG: Health check successful, response:', response.id);
      return { healthy: true };
    } catch (error) {
      console.log('❌ DEBUG: Health check failed with error:', error);
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Utility method for token estimation
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Clean up rate limit tracking (call periodically)
  cleanupRateLimitTracking(): void {
    const now = Date.now();

    for (const [agentId, info] of this.rateLimitTracker.entries()) {
      if (now >= info.resetTime) {
        this.rateLimitTracker.delete(agentId);
      }
    }
  }

  // Configuration methods removed - using simple defaults for now
}
