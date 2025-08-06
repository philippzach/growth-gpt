/**
 * Product Manager Agent Worker - Third agent in the growth strategy workflow
 * Specializes in product-market fit validation, brand positioning, and competitive differentiation
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from '../../types';
import { ConfigLoader } from '../../lib/config-loader';
import { SimplePromptBuilder, SimplePromptContext } from '../../lib/simple-prompt-builder';
import { AgentExecutor } from '../../lib/agent-executor';
import { createAPIResponse, createAPIError } from '../../lib/api-utils';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Agent configuration
const AGENT_ID = 'product-manager';
const AGENT_CONFIG_PATH = 'agents/product-manager.yaml';

// Task definition (moved from external YAML to code)
const TASK_DEFINITION = `Validate product-market fit and develop comprehensive brand positioning strategy that creates distinctive market position and competitive advantages.

Analyze the business concept and customer personas to create:
1. Product-market fit validation with specific evidence
2. Brand positioning strategy with unique value articulation  
3. Competitive differentiation analysis
4. Messaging framework aligned with customer psychology
5. Implementation roadmap with clear priorities

Focus on creating defensible competitive advantages and consistent messaging that resonates with target customers.`;

const OUTPUT_FORMAT = `# Product Manager Analysis & Recommendations

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

    // Validate dependencies - GTM Brief and Personas
    if (!previousOutputs['gtm-consultant'] && !previousOutputs['gtm-brief.md']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'GTM brief from GTM Consultant is required for product positioning'
        ),
        400
      );
    }

    if (!previousOutputs['persona-strategist'] && !previousOutputs['psychographic-personas.md']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'Personas from Persona Strategist are required for brand positioning'
        ),
        400
      );
    }

    // Initialize components
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    const promptBuilder = new SimplePromptBuilder();
    const agentExecutor = new AgentExecutor(c.env);

    // Load agent configuration
    const agentConfig = await configLoader.loadAgentConfig(AGENT_ID);

    if (!agentConfig) {
      return c.json(
        createAPIError(
          'CONFIG_NOT_FOUND',
          'Agent configuration not found'
        ),
        404
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
      agentOutputs: previousOutputs,
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
    const businessIdea = userInputs.businessIdea || 
                        userInputs.businessConcept || 
                        userInputs.businessDescription ||
                        (session.conversationHistory as any[]).find((msg: any) => msg.sender === 'user')?.content ||
                        'Business concept not provided';

    // Extract key insights from previous agents
    const previousInsights: Record<string, string> = {};
    
    if (previousOutputs['gtm-consultant']) {
      previousInsights['gtm-consultant'] = promptBuilder.extractKeyInsights('gtm-consultant', previousOutputs['gtm-consultant']);
    }
    
    if (previousOutputs['persona-strategist']) {
      previousInsights['persona-strategist'] = promptBuilder.extractKeyInsights('persona-strategist', previousOutputs['persona-strategist']);
    }

    // Build simple context
    const promptContext: SimplePromptContext = {
      businessIdea,
      userInputs,
      previousOutputs: previousInsights,
      agentConfig,
      session
    };

    // Generate simple, effective prompt
    const prompt = promptBuilder.buildPromptSync(TASK_DEFINITION, promptContext, OUTPUT_FORMAT);

    // Validate prompt
    const validation = promptBuilder.validatePrompt(prompt);
    if (!validation.isValid) {
      console.warn('Prompt validation issues:', validation.errors);
    }

    // Execute agent with simple prompt
    const agentResult = await agentExecutor.executeAgent(
      AGENT_ID,
      prompt,
      {
        session,
        agentConfig,
        taskConfig: null, // Not needed with new system
        userInputs,
        previousOutputs: previousInsights,
        knowledgeBase: {},
        businessContext: businessContext || extractBusinessContext(userInputs),
        workflowStep: 2
      }
    );

    // Prepare response (no template processing)
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
        systemType: 'simple-prompt-builder'
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

    const validation = await validateProductManagerOutput(content, validationRules);

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
    const agentConfig = await configLoader.loadAgentConfig(AGENT_ID);

    return c.json(
      createAPIResponse({
        agentConfig,
        taskDefinition: TASK_DEFINITION,
        outputFormat: OUTPUT_FORMAT,
        agentId: AGENT_ID,
        systemType: 'simple-prompt-builder'
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

function extractBusinessContext(userInputs: Record<string, any>): any {
  return {
    businessType:
      userInputs.businessType || userInputs.businessModel || 'startup',
    industry: userInputs.industry || userInputs.market || 'technology',
    stage: userInputs.businessStage || userInputs.stage || 'early-stage',
    teamSize: userInputs.teamSize || 'small',
    productFeatures: userInputs.productFeatures || userInputs.product_features || '',
    brandPreferences: userInputs.brandPreferences || userInputs.brand_preferences || '',
    competitiveIntelligence: userInputs.competitiveIntelligence || userInputs.competitive_intelligence || '',
  };
}

async function validateProductManagerOutput(
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
      name: 'product_market_fit_validation',
      check: () => checkProductMarketFitValidation(content),
      weight: 0.3,
    },
    {
      name: 'brand_positioning_differentiation',
      check: () => checkBrandPositioningDifferentiation(content),
      weight: 0.25,
    },
    {
      name: 'messaging_framework_consistency',
      check: () => checkMessagingFrameworkConsistency(content),
      weight: 0.2,
    },
    {
      name: 'competitive_analysis_depth',
      check: () => checkCompetitiveAnalysisDepth(content),
      weight: 0.15,
    },
    {
      name: 'implementation_feasibility',
      check: () => checkImplementationFeasibility(content),
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

function checkProductMarketFitValidation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for product-market fit validation keywords
  const pmfKeywords = [
    'product-market fit',
    'market fit',
    'validation',
    'customer validation',
    'market demand',
    'problem-solution fit',
  ];
  const hasPMFKeywords = pmfKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasPMFKeywords) score += 0.15;

  // Check for validation evidence
  const evidenceKeywords = [
    'data shows',
    'evidence indicates',
    'metrics demonstrate',
    'research confirms',
    'validated by',
    'proven through',
  ];
  const hasEvidence = evidenceKeywords.some((evidence) =>
    content.toLowerCase().includes(evidence.toLowerCase())
  );

  if (hasEvidence) score += 0.2;

  // Check for customer problem validation
  const problemKeywords = [
    'customer problem',
    'pain point',
    'problem statement',
    'customer need',
    'market need',
    'unmet need',
  ];
  const problemCount = problemKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (problemCount >= 2) score += 0.15;
  else if (problemCount >= 1) score += 0.1;

  // Issues
  if (!hasPMFKeywords) {
    issues.push('Product-market fit validation not clearly addressed');
  }

  if (!hasEvidence) {
    issues.push('Validation claims lack supporting evidence or data');
  }

  if (problemCount === 0) {
    issues.push('Customer problem validation not demonstrated');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkBrandPositioningDifferentiation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for brand positioning keywords
  const positioningKeywords = [
    'brand positioning',
    'positioning statement',
    'brand identity',
    'brand strategy',
    'market position',
    'differentiation',
  ];
  const positioningCount = positioningKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (positioningCount >= 3) score += 0.2;
  else if (positioningCount >= 2) score += 0.1;

  // Check for differentiation elements
  const differentiationKeywords = [
    'unique',
    'distinctive',
    'different',
    'stands out',
    'competitive advantage',
    'differentiator',
    'unlike competitors',
  ];
  const differentiationCount = differentiationKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (differentiationCount >= 3) score += 0.2;
  else if (differentiationCount >= 2) score += 0.1;

  // Check for specific positioning attributes
  const attributeKeywords = [
    'brand personality',
    'brand values',
    'brand promise',
    'brand essence',
    'brand archetype',
    'brand voice',
  ];
  const attributeCount = attributeKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (attributeCount >= 2) score += 0.1;

  // Issues
  if (positioningCount === 0) {
    issues.push('Brand positioning strategy not clearly defined');
  }

  if (differentiationCount < 2) {
    issues.push('Competitive differentiation not sufficiently articulated');
  }

  if (content.length < 500) {
    issues.push('Brand positioning lacks depth and detail');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkMessagingFrameworkConsistency(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for messaging framework keywords
  const messagingKeywords = [
    'messaging',
    'message',
    'communication',
    'value proposition',
    'key messages',
    'messaging framework',
  ];
  const messagingCount = messagingKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (messagingCount >= 3) score += 0.2;
  else if (messagingCount >= 2) score += 0.1;

  // Check for consistency elements
  const consistencyKeywords = [
    'consistent',
    'cohesive',
    'aligned',
    'unified',
    'integrated',
    'coherent',
  ];
  const hasConsistency = consistencyKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasConsistency) score += 0.15;

  // Check for message components
  const componentKeywords = [
    'headline',
    'tagline',
    'proof points',
    'benefits',
    'features',
    'call to action',
    'elevator pitch',
  ];
  const componentCount = componentKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (componentCount >= 3) score += 0.15;
  else if (componentCount >= 2) score += 0.1;

  // Issues
  if (messagingCount === 0) {
    issues.push('Messaging framework not clearly defined');
  }

  if (!hasConsistency) {
    issues.push('Message consistency not addressed');
  }

  if (componentCount < 2) {
    issues.push('Key messaging components not specified');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkCompetitiveAnalysisDepth(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for competitive analysis keywords
  const competitiveKeywords = [
    'competitor',
    'competitive',
    'competition',
    'competitive analysis',
    'market landscape',
    'competitive advantage',
  ];
  const competitiveCount = competitiveKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (competitiveCount >= 3) score += 0.2;
  else if (competitiveCount >= 2) score += 0.1;

  // Check for specific competitive elements
  const analysisKeywords = [
    'strengths',
    'weaknesses',
    'opportunities',
    'threats',
    'market share',
    'positioning',
    'pricing',
  ];
  const analysisCount = analysisKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (analysisCount >= 4) score += 0.2;
  else if (analysisCount >= 2) score += 0.1;

  // Check for competitive insights
  const insightKeywords = [
    'gap in market',
    'opportunity',
    'white space',
    'unserved market',
    'competitive moat',
    'barrier to entry',
  ];
  const hasInsights = insightKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasInsights) score += 0.1;

  // Issues
  if (competitiveCount === 0) {
    issues.push('Competitive analysis not provided');
  }

  if (analysisCount < 2) {
    issues.push('Competitive analysis lacks depth and structure');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkImplementationFeasibility(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for implementation keywords
  const implementationKeywords = [
    'implementation',
    'roadmap',
    'timeline',
    'execution',
    'plan',
    'strategy',
    'tactics',
  ];
  const implementationCount = implementationKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (implementationCount >= 3) score += 0.2;
  else if (implementationCount >= 2) score += 0.1;

  // Check for feasibility considerations
  const feasibilityKeywords = [
    'feasible',
    'achievable',
    'realistic',
    'practical',
    'resource',
    'budget',
    'timeline',
  ];
  const feasibilityCount = feasibilityKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (feasibilityCount >= 2) score += 0.2;
  else if (feasibilityCount >= 1) score += 0.1;

  // Check for prioritization
  const priorityKeywords = [
    'priority',
    'prioritize',
    'first',
    'next',
    'phase',
    'stage',
    'milestone',
  ];
  const hasPriority = priorityKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasPriority) score += 0.1;

  // Issues
  if (implementationCount === 0) {
    issues.push('Implementation guidance not provided');
  }

  if (feasibilityCount === 0) {
    issues.push('Feasibility considerations not addressed');
  }

  return { score: Math.min(score, 1.0), issues };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};