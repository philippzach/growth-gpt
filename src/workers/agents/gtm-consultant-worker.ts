/**
 * GTM Consultant Agent Worker - First agent in the growth strategy workflow
 * Specializes in market foundation, value proposition, and business model development
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
const AGENT_ID = 'gtm-consultant';
const AGENT_CONFIG_PATH = 'agents/gtm-consultant.yaml';
const TASK_CONFIG_PATH = 'tasks/agent-tasks/gtm-consultant-task.yaml';

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
      currentStep: 0,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userInputs,
      agentOutputs: {},
      conversationHistory: [],
      progress: {
        totalSteps: 8,
        completedSteps: 0,
        currentStepId: 'foundation_gtm',
        estimatedTimeRemaining: 240,
        stageProgress: {
          foundation: 0,
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
      workflowStep: 0,
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
    console.error('GTM Consultant execution error:', error);

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

    const validation = await validateGTMOutput(content, validationRules);

    return c.json(createAPIResponse(validation));
  } catch (error) {
    console.error('GTM Consultant validation error:', error);
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
    console.error('GTM Consultant config error:', error);
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

    // Load GTM-specific knowledge
    const knowledgeMapping: Record<string, string> = {
      'value-proposition': 'method/01value-proposition.md',
      'problem-solution-fit': 'method/02problem-solution-fit.md',
      'business-model': 'method/03business-model.md',
      'target-market': 'resources/market-segmentation.md',
      'competitive-positioning': 'resources/unique-value-proposition.md',
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
    devResources:
      userInputs.developmentResources || userInputs.techResources || 'limited',
    budget: userInputs.budget || userInputs.marketingBudget || 'limited',
  };
}

async function validateGTMOutput(
  content: string,
  validationRules: string[] = []
): Promise<{
  valid: boolean;
  scores: Record<string, number>;
  issues: string[];
}> {
  const scores: Record<string, number> = {};
  const issues: string[] = [];

  // Core GTM validation checks
  const checks = [
    {
      name: 'value_proposition_clarity',
      check: () => checkValuePropositionClarity(content),
      weight: 0.25,
    },
    {
      name: 'target_market_specificity',
      check: () => checkTargetMarketSpecificity(content),
      weight: 0.25,
    },
    {
      name: 'problem_validation',
      check: () => checkProblemValidation(content),
      weight: 0.2,
    },
    {
      name: 'business_model_clarity',
      check: () => checkBusinessModelClarity(content),
      weight: 0.15,
    },
    {
      name: 'competitive_differentiation',
      check: () => checkCompetitiveDifferentiation(content),
      weight: 0.15,
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
    valid: overallScore >= 0.7 && issues.length === 0,
    scores,
    issues,
  };
}

function checkValuePropositionClarity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for value proposition keywords
  const vpKeywords = [
    'value proposition',
    'unique value',
    'benefit',
    'advantage',
    'solve',
  ];
  const hasVPKeywords = vpKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasVPKeywords) score += 0.2;

  // Check for specific benefits
  const benefitPattern = /(save|increase|reduce|improve|provide|enable|help)/gi;
  const benefits = content.match(benefitPattern);
  if (benefits && benefits.length >= 2) score += 0.2;

  // Check for clarity and specificity
  if (content.includes('specifically') || content.includes('exactly'))
    score += 0.1;

  // Issues
  if (!hasVPKeywords) {
    issues.push('Value proposition not clearly articulated');
  }

  if (content.length < 200) {
    issues.push('Value proposition section too brief');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkTargetMarketSpecificity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for target market keywords
  const targetKeywords = [
    'target market',
    'target audience',
    'customer segment',
    'ideal customer',
  ];
  const hasTargetKeywords = targetKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasTargetKeywords) score += 0.2;

  // Check for demographic specificity
  const demographicKeywords = [
    'age',
    'income',
    'location',
    'company size',
    'industry',
    'role',
  ];
  const demographics = demographicKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (demographics.length >= 2) score += 0.2;
  else if (demographics.length === 1) score += 0.1;

  // Check for behavioral characteristics
  const behaviorKeywords = [
    'behavior',
    'preference',
    'habit',
    'challenge',
    'pain point',
  ];
  const hasBehavior = behaviorKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasBehavior) score += 0.1;

  // Issues
  if (!hasTargetKeywords) {
    issues.push('Target market not clearly defined');
  }

  if (demographics.length === 0) {
    issues.push('Target market lacks demographic specificity');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkProblemValidation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for problem identification
  const problemKeywords = [
    'problem',
    'challenge',
    'pain point',
    'issue',
    'difficulty',
  ];
  const hasProblem = problemKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasProblem) score += 0.2;

  // Check for evidence or validation
  const evidenceKeywords = [
    'research',
    'survey',
    'interview',
    'data',
    'evidence',
    'validate',
  ];
  const hasEvidence = evidenceKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasEvidence) score += 0.2;

  // Check for urgency/importance
  const urgencyKeywords = [
    'urgent',
    'critical',
    'important',
    'significant',
    'major',
  ];
  const hasUrgency = urgencyKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasUrgency) score += 0.1;

  // Issues
  if (!hasProblem) {
    issues.push('Problem not clearly identified');
  }

  if (!hasEvidence) {
    issues.push('Problem validation or evidence missing');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkBusinessModelClarity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for business model keywords
  const modelKeywords = [
    'business model',
    'revenue model',
    'monetization',
    'pricing',
  ];
  const hasModel = modelKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasModel) score += 0.2;

  // Check for revenue streams
  const revenueKeywords = [
    'subscription',
    'one-time',
    'recurring',
    'commission',
    'advertising',
  ];
  const hasRevenue = revenueKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasRevenue) score += 0.2;

  // Check for cost structure
  const costKeywords = ['cost', 'expense', 'investment', 'resource'];
  const hasCosts = costKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasCosts) score += 0.1;

  // Issues
  if (!hasModel) {
    issues.push('Business model not clearly described');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkCompetitiveDifferentiation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for competitive analysis
  const compKeywords = [
    'competitor',
    'competition',
    'alternative',
    'differentiation',
  ];
  const hasComp = compKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasComp) score += 0.2;

  // Check for unique advantages
  const advantageKeywords = [
    'unique',
    'advantage',
    'different',
    'better',
    'superior',
  ];
  const hasAdvantage = advantageKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasAdvantage) score += 0.2;

  // Check for specific differentiators
  const diffKeywords = [
    'feature',
    'capability',
    'approach',
    'technology',
    'method',
  ];
  const hasDiff = diffKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasDiff) score += 0.1;

  // Issues
  if (!hasComp) {
    issues.push('Competitive landscape not addressed');
  }

  if (!hasAdvantage) {
    issues.push('Competitive advantages not clearly articulated');
  }

  return { score: Math.min(score, 1.0), issues };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};
