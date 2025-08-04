/**
 * Product Manager Agent Worker - Third agent in the growth strategy workflow
 * Specializes in product-market fit validation, brand positioning, and competitive differentiation
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env, GeneratedPrompt, PromptGenerationContext } from '../../types';
import { ConfigLoader } from '../../lib/config-loader';
import { DynamicPromptGenerator } from '../../lib/dynamic-prompt-generator';
import { AgentExecutor } from '../../lib/agent-executor';
import { createAPIResponse, createAPIError } from '../../lib/api-utils';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Agent configuration
const AGENT_ID = 'product-manager';
const AGENT_CONFIG_PATH = 'agents/product-manager.yaml';
const TASK_CONFIG_PATH = 'tasks/agent-tasks/product-manager-task.yaml';

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
    const promptGenerator = new DynamicPromptGenerator(c.env.CONFIG_STORE);
    const agentExecutor = new AgentExecutor(c.env);

    // Load configurations
    const [agentConfig, taskConfig] = await Promise.all([
      configLoader.loadAgentConfig(AGENT_ID),
      configLoader.loadTaskConfig(`${AGENT_ID}-task`),
    ]);

    if (!agentConfig || !taskConfig) {
      return c.json(
        createAPIError(
          'CONFIG_NOT_FOUND',
          'Agent or task configuration not found'
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

    const context: PromptGenerationContext = {
      session,
      agentConfig,
      taskConfig,
      userInputs,
      previousOutputs,
      knowledgeBase: await loadRelevantKnowledge(configLoader, taskConfig),
      businessContext: businessContext || extractBusinessContext(userInputs),
      workflowStep: 2,
    };

    // Generate optimized prompt
    const generatedPrompt = await promptGenerator.generatePrompt(context);

    // Execute agent
    const agentResult = await agentExecutor.executeAgent(
      AGENT_ID,
      generatedPrompt as any,
      context
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
        knowledgeSourcesUsed: agentResult.knowledgeSourcesUsed,
        qualityGatesPassed: agentResult.qualityGatesPassed,
        promptMetadata: generatedPrompt.metadata,
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
    const [agentConfig, taskConfig] = await Promise.all([
      configLoader.loadAgentConfig(AGENT_ID),
      configLoader.loadTaskConfig(`${AGENT_ID}-task`),
    ]);

    return c.json(
      createAPIResponse({
        agentConfig,
        taskConfig,
        agentId: AGENT_ID,
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

async function loadRelevantKnowledge(
  configLoader: ConfigLoader,
  taskConfig: any
): Promise<Record<string, string>> {
  const knowledgeBase: Record<string, string> = {};

  try {
    const knowledgeFocus =
      taskConfig.agent_integration.behavior_overrides.knowledge_focus || [];

    // Load Product Manager-specific knowledge
    const knowledgeMapping: Record<string, string> = {
      'product-market-fit': 'knowledge-base/method/05product-market-fit.md',
      'brand-positioning': 'knowledge-base/ressources/unique-value-proposition.md',
      'competitive-analysis': 'knowledge-base/ressources/market-segmentation.md',
      'messaging-strategy': 'knowledge-base/ressources/lift-model.md',
      'value-proposition': 'knowledge-base/method/01value-proposition.md',
      'market-intelligence': 'knowledge-base/glossary/growth-hacking-dictionary.md',
    };

    for (const focus of knowledgeFocus) {
      const filePath = knowledgeMapping[focus];
      if (filePath) {
        const content = await configLoader.loadKnowledgeBase(filePath);
        if (content) {
          knowledgeBase[focus] = content;
        }
      }
    }
  } catch (error) {
    console.error('Knowledge loading error:', error);
  }

  return knowledgeBase;
}

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