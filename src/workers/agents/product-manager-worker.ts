/**
 * Product Manager Agent Worker - Third agent in the growth strategy workflow
 * Enhanced with unified configuration system and full context sharing
 * Specializes in product-market fit validation, brand positioning, and competitive differentiation
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from '../../types';
import { ConfigLoader } from '../../lib/config-loader';
import {
  SimplePromptBuilder,
  SimplePromptContext,
} from '../../lib/simple-prompt-builder';
import { AgentExecutor } from '../../lib/agent-executor';
import { createAPIResponse, createAPIError } from '../../lib/api-utils';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Agent configuration
const AGENT_ID = 'product-manager';

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    agentId: AGENT_ID,
    timestamp: new Date().toISOString(),
  });
});

// Main agent execution endpoint
app.post('/execute', async (c) => {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await c.req.json();
    const {
      sessionId,
      userId,
      userInputs,
      previousOutputs = {},
      businessContext,
    } = body;

    if (!sessionId || !userId) {
      return c.json(
        createAPIError('INVALID_REQUEST', 'sessionId and userId are required'),
        400
      );
    }

    // Validate dependencies - GTM Consultant and Persona Strategist
    if (!previousOutputs['gtm-consultant']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'GTM Consultant output is required for product positioning'
        ),
        400
      );
    }

    if (!previousOutputs['persona-strategist']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'Persona Strategist output is required for brand positioning'
        ),
        400
      );
    }

    // Initialize components
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    const promptBuilder = new SimplePromptBuilder();
    const agentExecutor = new AgentExecutor(c.env);

    // Load unified agent configuration
    console.log('Loading unified agent configuration for:', AGENT_ID);
    const unifiedConfig = await configLoader.loadUnifiedAgentConfig(AGENT_ID);

    if (!unifiedConfig) {
      console.error('Failed to load unified configuration, attempting fallback...');
      const legacyConfig = await configLoader.loadAgentConfig(AGENT_ID);
      
      if (!legacyConfig) {
        return c.json(
          createAPIError(
            'CONFIG_NOT_FOUND',
            'Agent configuration not found'
          ),
          404
        );
      }

      // Use legacy path (shouldn't happen in normal operation)
      console.warn('Using legacy configuration path for', AGENT_ID);
    }

    // Convert unified config to legacy format for compatibility
    const agentConfig = unifiedConfig 
      ? await convertUnifiedToLegacy(unifiedConfig)
      : await configLoader.loadAgentConfig(AGENT_ID);

    if (!agentConfig) {
      return c.json(
        createAPIError(
          'CONFIG_CONVERSION_FAILED',
          'Failed to convert agent configuration'
        ),
        500
      );
    }

    // Prepare execution context
    const session = {
      id: sessionId,
      userId,
      workflowId: 'master-workflow-v2',
      status: 'active' as const,
      currentAgent: AGENT_ID,
      currentStep: 2,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userInputs,
      agentOutputs: {},
      conversationHistory: [],
      progress: {
        totalSteps: 8,
        completedSteps: 2,
        currentStepId: 'product_brand_development',
        estimatedTimeRemaining: 180,
        stageProgress: {
          foundation: 0.375,
          strategy: 0,
          validation: 0,
        },
      },
    };

    // Extract business idea from user inputs or session
    const businessIdea =
      userInputs.businessIdea ||
      userInputs.businessConcept ||
      userInputs.businessDescription ||
      (session.conversationHistory as any[]).find(
        (msg: any) => msg.sender === 'user'
      )?.content ||
      'Business concept not provided';

    // Create enhanced context for prompt builder with full previous outputs
    const enhancedContext = promptBuilder.createEnhancedContext(
      {
        businessIdea,
        userInputs,
        previousOutputs, // Full previous outputs, not summaries
        agentConfig,
        session,
        configLoader,
        workflowPosition: 3,
        totalAgents: 8,
      },
      AGENT_ID
    );

    // Define relevant knowledge files for Product Manager
    const knowledgeFiles = [
      'knowledge-base/method/05product-market-fit.md',
      'knowledge-base/method/03business-model.md',
      'knowledge-base/ressources/unique-value-proposition.md',
      'knowledge-base/ressources/market-segmentation.md',
      'knowledge-base/ressources/copywriting-cheat-sheet.md',
    ];

    // Generate dynamic output format from unified config
    const outputFormat = unifiedConfig 
      ? generateOutputFormatFromConfig(unifiedConfig.output_specifications)
      : getDefaultOutputFormat();

    // Generate prompt with full context from previous agents
    const prompt = await promptBuilder.buildPrompt(
      unifiedConfig?.task_specification.primary_objective || 'Validate product-market fit and develop comprehensive brand positioning strategy',
      enhancedContext,
      outputFormat,
      knowledgeFiles
    );

    // Validate prompt
    const validation = promptBuilder.validatePrompt(prompt);
    if (!validation.isValid) {
      console.warn('Prompt validation issues:', validation.errors);
    }

    // Execute agent with enhanced prompt
    const agentResult = await agentExecutor.executeAgent(AGENT_ID, prompt, {
      session,
      agentConfig,
      taskConfig: null, // Not needed with new unified system
      userInputs,
      previousOutputs,
      knowledgeBase: {},
      businessContext: businessContext || extractBusinessContext(userInputs),
      workflowStep: 2,
    });

    // Prepare response (direct output)
    const response = {
      agentId: AGENT_ID,
      sessionId,
      execution: {
        success: true,
        processingTime: Date.now() - startTime,
        qualityScore: agentResult.qualityScore,
      },
      output: {
        content: agentResult.content,
        template: 'direct-output',
        variables: {},
        structure: {
          type: 'direct-content',
          sections: ['content'],
        },
      },
      metadata: {
        tokensUsed: agentResult.tokensUsed,
        qualityScore: agentResult.qualityScore,
        processingTime: agentResult.processingTime,
        promptValidation: validation,
        systemType: 'enhanced-prompt-builder',
        unifiedConfig: !!unifiedConfig,
        contextType: 'full-previous-outputs',
      },
    };

    return c.json(createAPIResponse(response));
  } catch (error) {
    console.error('Product Manager execution error:', error);

    const errorResponse = {
      agentId: AGENT_ID,
      execution: {
        success: false,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };

    return c.json(
      createAPIError(
        'EXECUTION_FAILED',
        'Agent execution failed',
        errorResponse
      ),
      500
    );
  }
});

// Validation endpoint
app.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { content, validationRules } = body;

    if (!content) {
      return c.json(
        createAPIError('INVALID_REQUEST', 'Content is required for validation'),
        400
      );
    }

    const validation = await validateProductOutput(content, validationRules);

    return c.json(createAPIResponse(validation));
  } catch (error) {
    console.error('Product Manager validation error:', error);
    return c.json(
      createAPIError('VALIDATION_FAILED', 'Validation failed'),
      500
    );
  }
});

// Configuration endpoint
app.get('/config', async (c) => {
  try {
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    const { unified, legacy, task } = await configLoader.loadCompleteAgentConfiguration(AGENT_ID);

    return c.json(
      createAPIResponse({
        unifiedConfig: unified,
        agentConfig: legacy,
        taskConfig: task,
        agentId: AGENT_ID,
        systemType: 'enhanced-prompt-builder',
      })
    );
  } catch (error) {
    console.error('Product Manager config error:', error);
    return c.json(
      createAPIError('CONFIG_LOAD_FAILED', 'Failed to load configuration'),
      500
    );
  }
});

// Helper functions

/**
 * Convert unified configuration to legacy AgentConfig format
 */
async function convertUnifiedToLegacy(unifiedConfig: any): Promise<any> {
  const identity = unifiedConfig.agent_identity;
  const capabilities = unifiedConfig.capabilities_constraints;

  return {
    id: identity.id,
    name: identity.name,
    version: identity.version,
    description: identity.persona.identity,
    persona: {
      identity: identity.persona.identity,
      expertise: identity.persona.expertise || [],
      communication_style: identity.persona.communication_style,
      decision_making_approach: 'Data-driven with strategic focus',
    },
    capabilities: {
      core_competencies: capabilities.capabilities.core_competencies || [],
      tools_available: [],
      knowledge_domains: unifiedConfig.static_knowledge?.knowledge_files?.primary || [],
      output_formats: ['markdown'],
    },
    configuration: {
      model: unifiedConfig.claude_config?.model || 'claude-3-5-sonnet-20241022',
      temperature: unifiedConfig.claude_config?.temperature || 0.7,
      max_tokens: unifiedConfig.claude_config?.max_tokens || 4000,
      timeout: 120000,
      retry_attempts: 3,
    },
    workflow_integration: {
      workflow_position: unifiedConfig.workflow_integration.sequence_order,
      stage: unifiedConfig.workflow_integration.stage as 'foundation' | 'strategy' | 'validation',
      dependencies: [],
      handoff_requirements: [],
    },
  };
}

/**
 * Generate output format string from unified configuration
 */
function generateOutputFormatFromConfig(outputSpecs: any): string {
  let format = `# ${outputSpecs.required_sections.executive_summary?.description || 'Product Manager Analysis & Recommendations'}\n\n`;
  
  // Add each required section
  for (const [sectionKey, sectionConfig] of Object.entries(outputSpecs.required_sections)) {
    if (sectionKey === 'executive_summary') continue; // Already added
    
    const config = sectionConfig as any;
    const sectionTitle = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    format += `## ${sectionTitle}\n`;
    format += `${config.description}\n\n`;
    
    if (config.requirements && Array.isArray(config.requirements)) {
      config.requirements.forEach((req: string) => {
        format += `- ${req}\n`;
      });
      format += '\n';
    }
  }
  
  return format;
}

/**
 * Default output format when unified config is not available
 */
function getDefaultOutputFormat(): string {
  return `# Product Manager Analysis & Recommendations

## Executive Summary
Brief overview of product-market fit status and brand positioning strategy (2-3 sentences)

## Product-Market Fit Validation
- Current market fit assessment with specific evidence
- Customer validation insights and metrics
- Problem-solution alignment analysis
- Market demand indicators
- Recommended validation framework and next steps

## Brand Positioning Strategy  
- Core brand positioning statement
- Unique value proposition and differentiation
- Brand personality and values framework
- Competitive positioning analysis
- Brand storytelling and messaging pillars

## Competitive Analysis & Differentiation
- Direct and indirect competitor analysis
- Competitive advantages and unique differentiators  
- Market gaps and positioning opportunities
- Defensive strategies and competitive moats
- Positioning defense recommendations

## Messaging Framework
- Master message architecture with key value propositions
- Audience-specific messaging by customer segment
- Message hierarchy for different customer journey stages
- Proof points and supporting evidence
- Content strategy guidelines

## Implementation Roadmap
- Phase 1: Immediate positioning and messaging priorities (Week 1-2)
- Phase 2: Brand development and market validation (Week 3-6) 
- Phase 3: Competitive positioning and optimization (Week 7-12)
- Success metrics and measurement framework
- Resource requirements and timeline estimates`;
}

function extractBusinessContext(userInputs: Record<string, any>): any {
  return {
    businessType:
      userInputs.businessType || userInputs.businessModel || 'startup',
    industry: userInputs.industry || userInputs.market || 'technology',
    stage: userInputs.businessStage || userInputs.stage || 'early-stage',
    teamSize: userInputs.teamSize || 'small',
    devResources:
      userInputs.developmentResources || userInputs.techResources || 'limited',
    budget: userInputs.budget || userInputs.marketingBudget || 'limited',
    customerFeedback:
      userInputs.customerFeedback || userInputs.customer_feedback || '',
    marketFeedback:
      userInputs.marketFeedback || userInputs.market_feedback || '',
    competitiveInsights:
      userInputs.competitiveInsights || userInputs.competitive_insights || '',
  };
}

async function validateProductOutput(
  content: string,
  validationRules: string[] = []
): Promise<{
  valid: boolean;
  scores: Record<string, number>;
  issues: string[];
}> {
  const scores: Record<string, number> = {};
  const issues: string[] = [];

  // Core Product Manager validation checks
  const checks = [
    {
      name: 'product_market_fit_analysis',
      check: () => checkProductMarketFitAnalysis(content),
      weight: 0.3,
    },
    {
      name: 'brand_positioning_clarity',
      check: () => checkBrandPositioningClarity(content),
      weight: 0.25,
    },
    {
      name: 'competitive_differentiation',
      check: () => checkCompetitiveDifferentiation(content),
      weight: 0.2,
    },
    {
      name: 'messaging_framework_completeness',
      check: () => checkMessagingFrameworkCompleteness(content),
      weight: 0.15,
    },
    {
      name: 'implementation_roadmap',
      check: () => checkImplementationRoadmap(content),
      weight: 0.1,
    },
  ];

  let totalScore = 0;
  let totalWeight = 0;

  for (const checkItem of checks) {
    const result = checkItem.check();
    scores[checkItem.name] = result.score;
    totalScore += result.score * checkItem.weight;
    totalWeight += checkItem.weight;

    if (result.issues) {
      issues.push(...result.issues);
    }
  }

  const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  scores.overall = overallScore;

  return {
    valid: overallScore >= 0.8 && issues.length === 0,
    scores,
    issues,
  };
}

function checkProductMarketFitAnalysis(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for product-market fit keywords
  const pmfKeywords = [
    'product-market fit',
    'market fit',
    'customer validation',
    'market demand',
    'problem-solution fit',
  ];
  const hasPMFKeywords = pmfKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasPMFKeywords) score += 0.2;

  // Check for validation evidence
  const evidenceKeywords = [
    'evidence',
    'metrics',
    'data',
    'validation',
    'testing',
    'feedback',
    'survey',
    'interview',
  ];
  const evidenceCount = evidenceKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (evidenceCount >= 3) score += 0.2;
  else if (evidenceCount >= 1) score += 0.1;

  // Check for specific validation methods
  const validationMethods = [
    'a/b test',
    'mvp',
    'prototype',
    'landing page',
    'cohort analysis',
    'retention rate',
  ];
  const hasValidationMethods = validationMethods.some((method) =>
    content.toLowerCase().includes(method.toLowerCase())
  );

  if (hasValidationMethods) score += 0.1;

  // Issues
  if (!hasPMFKeywords) {
    issues.push('Product-market fit analysis not clearly addressed');
  }

  if (evidenceCount === 0) {
    issues.push('No validation evidence or metrics provided');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkBrandPositioningClarity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for brand positioning keywords
  const brandKeywords = [
    'brand positioning',
    'value proposition',
    'brand identity',
    'brand personality',
    'positioning statement',
  ];
  const hasBrandKeywords = brandKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasBrandKeywords) score += 0.15;

  // Check for differentiation elements
  const diffKeywords = [
    'unique',
    'different',
    'advantage',
    'superior',
    'distinctive',
    'differentiation',
  ];
  const diffCount = diffKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (diffCount >= 2) score += 0.2;
  else if (diffCount >= 1) score += 0.1;

  // Check for brand values/personality
  const personalityKeywords = [
    'values',
    'personality',
    'brand traits',
    'brand character',
    'brand essence',
  ];
  const hasPersonality = personalityKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasPersonality) score += 0.15;

  // Issues
  if (!hasBrandKeywords) {
    issues.push('Brand positioning not clearly defined');
  }

  if (diffCount === 0) {
    issues.push('Brand differentiation elements missing');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkCompetitiveDifferentiation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for competitive analysis keywords
  const compKeywords = [
    'competitor',
    'competition',
    'competitive',
    'market player',
    'rival',
  ];
  const hasCompKeywords = compKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasCompKeywords) score += 0.2;

  // Check for competitive advantages
  const advantageKeywords = [
    'advantage',
    'moat',
    'barrier',
    'defensible',
    'protection',
    'strength',
  ];
  const advantageCount = advantageKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (advantageCount >= 2) score += 0.2;
  else if (advantageCount >= 1) score += 0.1;

  // Check for market gaps analysis
  const gapKeywords = [
    'gap',
    'opportunity',
    'white space',
    'unmet need',
    'underserved',
  ];
  const hasGaps = gapKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasGaps) score += 0.1;

  // Issues
  if (!hasCompKeywords) {
    issues.push('Competitive analysis not clearly provided');
  }

  if (advantageCount === 0) {
    issues.push('Competitive advantages not identified');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkMessagingFrameworkCompleteness(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for messaging keywords
  const messagingKeywords = [
    'messaging',
    'message',
    'communication',
    'content strategy',
    'key messages',
  ];
  const hasMessaging = messagingKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasMessaging) score += 0.2;

  // Check for audience segmentation
  const audienceKeywords = [
    'audience',
    'segment',
    'persona',
    'customer type',
    'target group',
  ];
  const hasAudience = audienceKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasAudience) score += 0.15;

  // Check for proof points
  const proofKeywords = [
    'proof',
    'evidence',
    'case study',
    'testimonial',
    'example',
    'success story',
  ];
  const hasProof = proofKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasProof) score += 0.15;

  // Issues
  if (!hasMessaging) {
    issues.push('Messaging framework not clearly defined');
  }

  if (!hasAudience) {
    issues.push('Audience-specific messaging not addressed');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkImplementationRoadmap(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for roadmap keywords
  const roadmapKeywords = [
    'roadmap',
    'implementation',
    'timeline',
    'phase',
    'milestone',
    'priority',
  ];
  const hasRoadmap = roadmapKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasRoadmap) score += 0.2;

  // Check for time-based planning
  const timeKeywords = [
    'week',
    'month',
    'quarter',
    'deadline',
    'schedule',
    'duration',
  ];
  const hasTime = timeKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasTime) score += 0.15;

  // Check for success metrics
  const metricsKeywords = [
    'metric',
    'kpi',
    'measurement',
    'success criteria',
    'goal',
    'target',
  ];
  const hasMetrics = metricsKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasMetrics) score += 0.15;

  // Issues
  if (!hasRoadmap) {
    issues.push('Implementation roadmap not provided');
  }

  if (!hasTime) {
    issues.push('Timeline or phasing not specified');
  }

  return { score: Math.min(score, 1.0), issues };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};