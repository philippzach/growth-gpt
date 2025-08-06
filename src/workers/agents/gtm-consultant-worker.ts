/**
 * GTM Consultant Agent Worker - Enhanced with Unified Configuration
 * First agent in the growth strategy workflow using improved prompt structure
 * Specializes in market foundation, value proposition, and business model development
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
const AGENT_ID = 'gtm-consultant';

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    agentId: AGENT_ID,
    timestamp: new Date().toISOString(),
    version: '3.0',
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
    const promptBuilder = new SimplePromptBuilder();
    const agentExecutor = new AgentExecutor(c.env);

    // Load unified agent configuration
    console.log('Loading unified agent configuration for:', AGENT_ID);
    const unifiedConfig = await configLoader.loadUnifiedAgentConfig(AGENT_ID);
    
    if (!unifiedConfig) {
      throw new Error(`Failed to load unified configuration for ${AGENT_ID}`);
    }

    // Validate unified config structure
    const validation = configLoader.validateUnifiedConfig(unifiedConfig);
    if (!validation.valid) {
      throw new Error(`Invalid unified config: ${validation.errors.join(', ')}`);
    }

    console.log('Successfully loaded unified config:', {
      id: unifiedConfig.agent_identity.id,
      name: unifiedConfig.agent_identity.name,
      version: unifiedConfig.agent_identity.version,
    });

    // Convert to legacy format for AgentExecutor compatibility
    const agentConfig = await configLoader.loadAgentConfig(AGENT_ID);
    if (!agentConfig) {
      throw new Error('Failed to convert unified config to legacy format');
    }

    // Extract business idea from user inputs
    const businessIdea = extractBusinessIdea(userInputs, businessContext);

    // Create session object for context
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

    // Create base prompt context
    const basePromptContext: SimplePromptContext = {
      businessIdea,
      userInputs,
      previousOutputs: {}, // GTM Consultant is first agent, no previous outputs
      agentConfig,
      session,
      configLoader, // Include for knowledge loading
    };

    // Create enhanced context with workflow position
    const enhancedContext = promptBuilder.createEnhancedContext(basePromptContext, AGENT_ID);

    // Extract components from unified config
    const taskDefinition = unifiedConfig.task_specification.primary_objective;
    
    // Debug output specifications
    console.log('🔍 DEBUG - Output specifications:', {
      hasOutputSpecs: !!unifiedConfig.output_specifications,
      hasRequiredSections: !!unifiedConfig.output_specifications?.required_sections,
      sectionCount: Object.keys(unifiedConfig.output_specifications?.required_sections || {}).length,
      sectionKeys: Object.keys(unifiedConfig.output_specifications?.required_sections || {})
    });
    
    const outputFormat = generateOutputFormatFromConfig(unifiedConfig.output_specifications);
    console.log('🔍 DEBUG - Generated output format length:', outputFormat.length);
    console.log('🔍 DEBUG - Output format preview:', outputFormat.substring(0, 200) + '...');
    
    const knowledgeFiles = unifiedConfig.static_knowledge?.knowledge_files?.primary || [];

    console.log('Building enhanced prompt with:', {
      taskDefinition: taskDefinition.substring(0, 100) + '...',
      knowledgeFilesCount: knowledgeFiles.length,
      workflowPosition: enhancedContext.workflowPosition,
    });

    // Generate enhanced prompt with new structure
    const prompt = await promptBuilder.buildPrompt(
      taskDefinition,
      enhancedContext,
      outputFormat,
      knowledgeFiles
    );

    // Validate prompt
    const promptValidation = promptBuilder.validatePrompt(prompt);
    if (!promptValidation.isValid) {
      console.warn('Prompt validation issues:', promptValidation.errors);
    }

    // Execute agent with enhanced prompt
    const agentResult = await agentExecutor.executeAgent(AGENT_ID, prompt, {
      session,
      agentConfig,
      taskConfig: null, // Not needed with unified system
      userInputs,
      previousOutputs: {},
      knowledgeBase: {},
      businessContext: businessIdea,
      workflowStep: 0,
    });

    // Prepare response
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
        promptValidation: promptValidation,
        systemType: 'unified-config-v3',
        configVersion: unifiedConfig.agent_identity.version,
        knowledgeSourcesUsed: agentResult.knowledgeSourcesUsed,
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

    const validation = await validateGTMOutput(content, validationRules);

    return c.json(
      createAPIResponse({
        agentId: AGENT_ID,
        validation,
      })
    );
  } catch (error) {
    return c.json(
      createAPIError('VALIDATION_FAILED', 'Validation failed', { error }),
      500
    );
  }
});

// Configuration info endpoint
app.get('/config', async (c) => {
  try {
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    const unifiedConfig = await configLoader.loadUnifiedAgentConfig(AGENT_ID);

    if (!unifiedConfig) {
      return c.json(
        createAPIError('CONFIG_NOT_FOUND', 'Configuration not found'),
        404
      );
    }

    return c.json(
      createAPIResponse({
        agentId: AGENT_ID,
        version: unifiedConfig.agent_identity.version,
        name: unifiedConfig.agent_identity.name,
        capabilities: unifiedConfig.capabilities_constraints.capabilities,
        knowledgeSources: unifiedConfig.static_knowledge.knowledge_files,
        outputSections: Object.keys(unifiedConfig.output_specifications.required_sections),
      })
    );
  } catch (error) {
    return c.json(
      createAPIError('CONFIG_ERROR', 'Failed to load configuration', { error }),
      500
    );
  }
});

// Helper functions

/**
 * Generate output format string from unified configuration
 */
function generateOutputFormatFromConfig(outputSpecs: any): string {
  let format = '';
  
  // Add each required section with proper formatting
  for (const [sectionKey, sectionConfig] of Object.entries(outputSpecs.required_sections)) {
    const config = sectionConfig as any;
    
    // Format section title
    const sectionTitle = sectionKey === 'executive_summary' 
      ? 'Executive Summary'
      : sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Add section header
    format += `## ${sectionTitle}\n`;
    
    // Add section description if available
    if (config.description) {
      format += `${config.description}\n\n`;
    }
    
    // Add requirements as bullet points or structured content
    if (config.requirements) {
      if (Array.isArray(config.requirements)) {
        config.requirements.forEach((req: string) => {
          format += `- ${req}\n`;
        });
      } else if (typeof config.requirements === 'object') {
        // Handle nested requirements structure
        for (const [subKey, subReqs] of Object.entries(config.requirements)) {
          if (Array.isArray(subReqs)) {
            format += `\n### ${subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
            (subReqs as string[]).forEach((req: string) => {
              format += `- ${req}\n`;
            });
          }
        }
      }
    }
    
    format += '\n';
  }
  
  return format.trim();
}

/**
 * Extract business idea from various input sources
 */
function extractBusinessIdea(userInputs: Record<string, any>, businessContext?: string): string {
  // Priority order for business idea extraction
  const businessKeys = [
    'businessIdea',
    'businessConcept', 
    'businessDescription',
    'concept',
    'idea',
    'business',
    'startup',
    'company',
  ];

  // Check user inputs first
  for (const key of businessKeys) {
    if (userInputs[key] && typeof userInputs[key] === 'string' && userInputs[key].trim()) {
      return userInputs[key].trim();
    }
  }

  // Use provided business context if available
  if (businessContext && typeof businessContext === 'string' && businessContext.trim()) {
    return businessContext.trim();
  }

  // Check for nested business information
  if (userInputs.business && typeof userInputs.business === 'object') {
    const businessObj = userInputs.business;
    for (const key of ['description', 'idea', 'concept', 'overview']) {
      if (businessObj[key] && typeof businessObj[key] === 'string') {
        return businessObj[key];
      }
    }
  }

  return 'Business concept not provided. Please describe your business idea, product, or service.';
}

/**
 * Validate GTM output against quality criteria
 */
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
    issues.push(...result.issues);
  }

  const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const valid = overallScore >= 0.7 && issues.length === 0;

  return {
    valid,
    scores: {
      ...scores,
      overall: overallScore,
    },
    issues,
  };
}

// Validation helper functions
function checkValuePropositionClarity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  const vpKeywords = ['value proposition', 'value prop', 'core value', 'unique value'];
  const hasVP = vpKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasVP) {
    score += 0.5;
  } else {
    issues.push('Value proposition not clearly stated');
  }

  // Check for specific benefits
  const benefitKeywords = ['benefit', 'advantage', 'outcome', 'result', 'gain'];
  const hasBenefits = benefitKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasBenefits) {
    score += 0.3;
  } else {
    issues.push('Customer benefits not articulated');
  }

  // Check for quantification
  const hasNumbers = /\d+/.test(content);
  if (hasNumbers) {
    score += 0.2;
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkTargetMarketSpecificity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  const marketKeywords = ['target market', 'target customer', 'target audience', 'customer segment'];
  const hasMarket = marketKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasMarket) {
    score += 0.4;
  } else {
    issues.push('Target market not defined');
  }

  // Check for demographics
  const demoKeywords = ['age', 'gender', 'income', 'location', 'industry'];
  const hasDemo = demoKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasDemo) {
    score += 0.3;
  }

  // Check for psychographics
  const psychoKeywords = ['behavior', 'preference', 'lifestyle', 'values', 'needs'];
  const hasPsycho = psychoKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasPsycho) {
    score += 0.3;
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkProblemValidation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  const problemKeywords = ['problem', 'pain point', 'challenge', 'issue', 'struggle'];
  const hasProblem = problemKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasProblem) {
    score += 0.4;
  } else {
    issues.push('Customer problem not clearly identified');
  }

  // Check for solution alignment
  const solutionKeywords = ['solution', 'solve', 'address', 'resolve', 'fix'];
  const hasSolution = solutionKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasSolution) {
    score += 0.3;
  }

  // Check for validation
  const validationKeywords = ['validate', 'evidence', 'research', 'data', 'survey'];
  const hasValidation = validationKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasValidation) {
    score += 0.3;
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkBusinessModelClarity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  // Check for revenue model
  const revenueKeywords = ['revenue', 'pricing', 'monetization', 'business model'];
  const hasRevenue = revenueKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasRevenue) {
    score += 0.4;
  } else {
    issues.push('Revenue model not specified');
  }

  // Check for cost structure
  const costKeywords = ['cost', 'expense', 'investment', 'budget'];
  const hasCost = costKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasCost) {
    score += 0.3;
  }

  // Check for key metrics
  const metricKeywords = ['metric', 'kpi', 'measure', 'track'];
  const hasMetrics = metricKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasMetrics) {
    score += 0.3;
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkCompetitiveDifferentiation(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  // Check for competitive analysis
  const compKeywords = ['competitor', 'competition', 'competitive', 'alternative'];
  const hasComp = compKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasComp) {
    score += 0.4;
  } else {
    issues.push('Competitive landscape not addressed');
  }

  // Check for differentiation
  const diffKeywords = ['differentiate', 'unique', 'different', 'advantage', 'better'];
  const hasDiff = diffKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasDiff) {
    score += 0.4;
  } else {
    issues.push('Differentiation not clearly articulated');
  }

  // Check for positioning
  const posKeywords = ['position', 'positioning', 'place', 'niche'];
  const hasPos = posKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (hasPos) {
    score += 0.2;
  }

  return { score: Math.min(score, 1.0), issues };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};