/**
 * GTM Consultant Agent Worker - First agent in the growth strategy workflow
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
const AGENT_CONFIG_PATH = 'agents/gtm-consultant.yaml';

// Task definition (moved from external YAML to code)
const TASK_DEFINITION = `Develop comprehensive go-to-market foundation strategy that establishes market positioning, validates customer demand, and creates actionable business model framework.

Analyze the business concept to create:
1. Market foundation analysis with target market definition
2. Value proposition development with competitive differentiation
3. Problem-solution fit validation with evidence
4. Business model framework with revenue strategy
5. Go-to-market strategy with channel recommendations

Focus on creating a solid foundation that enables all subsequent growth activities and agent collaboration.`;

const OUTPUT_FORMAT = `# GTM Consultant Analysis & Recommendations

## Executive Summary
Brief overview of the go-to-market foundation strategy and key strategic priorities (2-3 sentences)

## Market Foundation Analysis
- Target market definition with specific customer segments
- Market size and opportunity assessment
- Customer demographics and characteristics
- Market trends and growth potential
- Competitive landscape overview

## Value Proposition Development
- Core value proposition statement
- Primary customer benefits and outcomes
- Competitive differentiation and unique advantages
- Value delivery mechanisms
- Proof points and supporting evidence

## Problem-Solution Fit Validation
- Customer problem definition and validation
- Solution concept and approach
- Problem-solution alignment analysis
- Market demand indicators
- Validation methodology and next steps

## Business Model Framework
- Revenue model and pricing strategy
- Cost structure and key expenses
- Key partnerships and resources
- Customer acquisition approach
- Unit economics and scalability factors

## Go-to-Market Strategy
- Market entry strategy and positioning
- Customer acquisition channels and tactics
- Sales and marketing approach
- Launch sequence and milestones
- Success metrics and KPIs

## Implementation Roadmap
- Phase 1: Market validation and positioning (Week 1-2)
- Phase 2: Product development and testing (Week 3-6)
- Phase 3: Go-to-market execution (Week 7-12)
- Resource requirements and timeline estimates
- Risk mitigation strategies`;

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
    const promptBuilder = new SimplePromptBuilder();
    const agentExecutor = new AgentExecutor(c.env);

    // Load agent configuration from KV storage
    console.log('Loading agent configuration from KV storage for:', AGENT_ID);
    let agentConfig = await configLoader.loadAgentConfig(AGENT_ID);

    if (!agentConfig) {
      console.warn(
        'Failed to load agent config from KV, using fallback configuration'
      );
      // Fallback configuration if KV loading fails
      agentConfig = {
        id: 'gtm-consultant',
        name: 'Angelina',
        version: '2.0',
        description:
          'Expert in market strategy development, value proposition design, and business model validation',
        persona: {
          identity:
            'Go-to-market strategist specializing in market entry, value proposition design, unique selling proposition development, and problem-solution fit validation',
          expertise: [
            'GTM consulting and value propositions',
            'Unique Value Proposition development',
            'Market segmentation and brand positioning',
            'KPI setting and measurement',
            'Revenue Operations and route-to-market planning',
            'Problem-solution fit validation',
            'Business model design and validation',
          ],
          communication_style:
            'Strategic, data-driven, customer-centric, collaborative, results-oriented, market-savvy',
          decision_making_approach:
            'Data-driven with customer-centric validation',
        },
        capabilities: {
          core_competencies: [
            'Market opportunity assessment',
            'Value proposition design',
            'Unique selling proposition development',
            'Problem-solution fit validation',
            'Customer journey mapping',
            'Revenue modeling and competitive differentiation',
          ],
          tools_available: [
            'market_research_generator',
            'competitor_analysis',
            'value_proposition_canvas',
            'business_model_canvas',
          ],
          knowledge_domains: [
            'value-proposition',
            'problem-solution-fit',
            'business-model',
            'unique-value-proposition',
            'market-segmentation',
          ],
          output_formats: ['markdown'],
        },
        configuration: {
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          max_tokens: 4000,
          timeout: 120000,
          retry_attempts: 3,
        },
        workflow_integration: {
          workflow_position: 1,
          stage: 'foundation' as const,
          dependencies: [
            'gtm-strategy.md',
            'create-deep-research-prompt.md',
            'advanced-elicitation.md',
          ],
          handoff_requirements: [
            'Value proposition clearly articulated',
            'Target market specifically defined',
            'Problem-solution fit hypothesis stated',
            'Business model components identified',
          ],
        },
      };
    } else {
      console.log('Successfully loaded agent config from KV:', {
        id: agentConfig.id,
        name: agentConfig.name,
        identity: agentConfig.persona.identity,
      });
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

    // Extract business idea from user inputs or session
    const businessIdea =
      userInputs.businessIdea ||
      userInputs.businessConcept ||
      userInputs.businessDescription ||
      (session.conversationHistory as any[]).find(
        (msg: any) => msg.sender === 'user'
      )?.content ||
      'Business concept not provided';

    // Build simple context (no previous outputs for first agent)
    const promptContext: SimplePromptContext = {
      businessIdea,
      userInputs,
      previousOutputs: {}, // GTM Consultant is first agent, no previous outputs
      agentConfig,
      session,
      configLoader, // Add configLoader for knowledge loading
    };

    // Define relevant knowledge files for GTM Consultant
    const knowledgeFiles = [
      'knowledge-base/method/01value-proposition.md',
      'knowledge-base/method/02problem-solution-fit.md',
      'knowledge-base/method/03business-model.md',
    ];

    // Generate simple, effective prompt with knowledge
    const prompt = await promptBuilder.buildPrompt(
      TASK_DEFINITION,
      promptContext,
      OUTPUT_FORMAT,
      knowledgeFiles
    );

    // Validate prompt
    const validation = promptBuilder.validatePrompt(prompt);
    if (!validation.isValid) {
      console.warn('Prompt validation issues:', validation.errors);
    }

    // Execute agent with simple prompt
    const agentResult = await agentExecutor.executeAgent(AGENT_ID, prompt, {
      session,
      agentConfig,
      taskConfig: null, // Not needed with new system
      userInputs,
      previousOutputs: {},
      knowledgeBase: {},
      businessContext: businessContext || extractBusinessContext(userInputs),
      workflowStep: 0,
    });

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
        systemType: 'simple-prompt-builder',
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
    const agentConfig = await configLoader.loadAgentConfig(AGENT_ID);

    return c.json(
      createAPIResponse({
        agentConfig,
        taskDefinition: TASK_DEFINITION,
        outputFormat: OUTPUT_FORMAT,
        agentId: AGENT_ID,
        systemType: 'simple-prompt-builder',
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

/**
 * Generate output format string from unified configuration
 */
function generateOutputFormatFromConfig(outputSpecs: any): string {
  let format = `# ${outputSpecs.required_sections.executive_summary?.description || 'Executive Summary'}\n\n`;
  
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
