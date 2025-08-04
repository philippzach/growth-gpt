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
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
    this.websocketEmitter = websocketEmitter;
  }

  async executeAgent(
    agentId: AgentType,
    generatedPrompt: GeneratedPrompt,
    context: PromptGenerationContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // Check rate limits
      await this.checkRateLimits(agentId);

      // Prepare API request
      const apiRequest = this.prepareAPIRequest(generatedPrompt, context);

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
    generatedPrompt: GeneratedPrompt,
    context: PromptGenerationContext
  ): Anthropic.MessageCreateParams {
    const agentConfig = context.agentConfig;
    const taskConfig = context.taskConfig;

    // Get model and parameters from configuration
    const model = 'claude-3-haiku-20240307'; // Using Haiku for development
    const temperature = agentConfig.configuration.temperature || 0.7;
    const maxTokens = Math.min(
      agentConfig.configuration.max_tokens || 4000,
      4096 // Haiku's max output tokens
    );

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
    generatedPrompt: GeneratedPrompt,
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
    generatedPrompt: GeneratedPrompt,
    context: PromptGenerationContext,
    startTime: number
  ): Promise<AgentExecutionResult> {
    let fullContent = '';
    let finalMessage: Anthropic.Message | null = null;

    // Process the stream and collect content
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
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
    generatedPrompt: GeneratedPrompt
  ): Promise<number> {
    let score = 0.5; // Base score

    // Content length check (adequate detail)
    if (content.length > 1000) score += 0.1;
    if (content.length > 2000) score += 0.1;

    // Structure check (headers, lists, organization)
    if (content.includes('##') || content.includes('**')) score += 0.1;
    if (content.includes('•') || content.includes('-')) score += 0.05;

    // Required elements check
    const requiredElements =
      taskConfig.workflow_integration.quality_gates.validation_rules || [];
    let elementsFound = 0;

    for (const element of requiredElements) {
      if (this.checkElementPresent(content, element)) {
        elementsFound++;
      }
    }

    if (requiredElements.length > 0) {
      score += (elementsFound / requiredElements.length) * 0.2;
    }

    // Deliverables alignment check
    const deliverables =
      taskConfig.task_specification.deliverables.primary_deliverables || [];
    let deliverablesAddressed = 0;

    for (const deliverable of deliverables) {
      if (this.checkDeliverableAddressed(content, deliverable)) {
        deliverablesAddressed++;
      }
    }

    if (deliverables.length > 0) {
      score += (deliverablesAddressed / deliverables.length) * 0.15;
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
    const qualityGates =
      taskConfig.workflow_integration.quality_gates.post_execution || [];

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
    generatedPrompt: GeneratedPrompt,
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

  // Health check for API connectivity
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      });

      return { healthy: true };
    } catch (error) {
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
}
