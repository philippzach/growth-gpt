/**
 * Persona Strategist Agent Worker - Second agent in the growth strategy workflow
 * Enhanced with unified configuration system and full context sharing
 * Specializes in psychographic persona development, behavioral analysis, and customer journey mapping
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
const AGENT_ID = 'persona-strategist';

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

    // Validate GTM consultant dependency
    if (!previousOutputs['gtm-consultant']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'GTM Consultant output is required for persona development'
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
      currentStep: 1,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userInputs,
      agentOutputs: {},
      conversationHistory: [],
      progress: {
        totalSteps: 8,
        completedSteps: 1,
        currentStepId: 'persona_development',
        estimatedTimeRemaining: 210,
        stageProgress: {
          foundation: 0.25,
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

    // Create enhanced context for prompt builder
    const enhancedContext = promptBuilder.createEnhancedContext(
      {
        businessIdea,
        userInputs,
        previousOutputs, // Full previous outputs, not summaries
        agentConfig,
        session,
        configLoader,
        workflowPosition: 2,
        totalAgents: 8,
      },
      AGENT_ID
    );

    // Define relevant knowledge files for Persona Strategist
    const knowledgeFiles = [
      'knowledge-base/method/04psychograhpic-persona.md',
      'knowledge-base/ressources/psychographic-segmentation.md',
      'knowledge-base/ressources/ocean-personality.md',
      'knowledge-base/ressources/psychographics-socialmedia.md',
      'knowledge-base/ressources/market-segmentation.md',
      'knowledge-base/ressources/hierachy-of-engagement.md',
    ];

    // Generate dynamic output format from unified config
    const outputFormat = unifiedConfig 
      ? generateOutputFormatFromConfig(unifiedConfig.output_specifications)
      : getDefaultOutputFormat();

    // Generate prompt with full GTM context and knowledge files
    const prompt = await promptBuilder.buildPrompt(
      unifiedConfig?.task_specification.primary_objective || 'Develop comprehensive psychographic personas and behavioral analysis',
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
      workflowStep: 1,
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
    console.error('Persona Strategist execution error:', error);

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

    const validation = await validatePersonaOutput(content, validationRules);

    return c.json(createAPIResponse(validation));
  } catch (error) {
    console.error('Persona Strategist validation error:', error);
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
    console.error('Persona Strategist config error:', error);
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
  let format = `# ${outputSpecs.required_sections.executive_summary?.description || 'Persona Strategist Analysis & Recommendations'}\n\n`;
  
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
  return `# Persona Strategist Analysis & Recommendations

## Executive Summary
Brief overview of the customer personas developed and key behavioral insights (2-3 sentences)

## Primary Customer Personas

### Persona 1: [Give it a descriptive name]
**Demographics**: Age range, location, income level, occupation
**Psychographics**: 
- Core values and beliefs
- Lifestyle and interests
- Personality traits (using OCEAN model where relevant)
- Motivations and aspirations
- Fears and concerns

**Behavioral Patterns**:
- Decision-making process and timeline
- Information-seeking behavior
- Purchase triggers and barriers
- Brand loyalty patterns
- Social media and communication preferences

**Customer Journey**:
- Awareness stage behavior and channels
- Consideration stage evaluation criteria
- Decision stage final motivators
- Post-purchase behavior and advocacy potential

**Marketing Implications**:
- Messaging that resonates with this persona
- Preferred communication channels
- Content types that engage them
- Timing and frequency preferences

### Persona 2: [Give it a descriptive name]
[Same structure as Persona 1]

### Persona 3: [Give it a descriptive name] (if applicable)
[Same structure as Persona 1]

## Behavioral Insights & Patterns
- Cross-persona behavioral trends
- Key psychological drivers across all personas
- Common pain points and motivations
- Seasonal or situational behavior patterns

## Customer Journey Mapping
- Unified customer journey across personas
- Key touchpoints and interaction moments
- Critical decision points and conversion opportunities
- Potential friction points and optimization areas

## Messaging & Communication Strategy
- Core messaging themes that resonate across personas
- Persona-specific message customization
- Channel strategy recommendations
- Content strategy framework

## Implementation Recommendations
- Persona validation and testing approach
- Data collection and refinement strategy
- Marketing activation priorities
- Measurement and optimization framework`;
}

function extractBusinessContext(userInputs: Record<string, any>): any {
  return {
    businessType:
      userInputs.businessType || userInputs.businessModel || 'startup',
    industry: userInputs.industry || userInputs.market || 'technology',
    stage: userInputs.businessStage || userInputs.stage || 'early-stage',
    teamSize: userInputs.teamSize || 'small',
    customerInsights:
      userInputs.customerInsights || userInputs.customer_insights || '',
    behavioralObservations:
      userInputs.behavioralObservations ||
      userInputs.behavioral_observations ||
      '',
    targetAudience:
      userInputs.targetAudience || userInputs.target_audience || '',
  };
}

async function validatePersonaOutput(
  content: string,
  validationRules: string[] = []
): Promise<{
  valid: boolean;
  scores: Record<string, number>;
  issues: string[];
}> {
  const scores: Record<string, number> = {};
  const issues: string[] = [];

  // Core Persona validation checks
  const checks = [
    {
      name: 'persona_depth_and_specificity',
      check: () => checkPersonaDepthAndSpecificity(content),
      weight: 0.3,
    },
    {
      name: 'behavioral_insights_actionability',
      check: () => checkBehavioralInsightsActionability(content),
      weight: 0.25,
    },
    {
      name: 'journey_mapping_completeness',
      check: () => checkJourneyMappingCompleteness(content),
      weight: 0.2,
    },
    {
      name: 'targeting_recommendations',
      check: () => checkTargetingRecommendations(content),
      weight: 0.15,
    },
    {
      name: 'psychographic_analysis',
      check: () => checkPsychographicAnalysis(content),
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

function checkPersonaDepthAndSpecificity(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for persona profile keywords
  const personaKeywords = [
    'persona',
    'profile',
    'customer segment',
    'psychographic',
    'behavioral',
  ];
  const hasPersonaKeywords = personaKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasPersonaKeywords) score += 0.15;

  // Check for psychographic elements
  const psychographicElements = [
    'values',
    'attitudes',
    'lifestyle',
    'personality',
    'interests',
    'motivations',
  ];
  const psychographicCount = psychographicElements.filter((element) =>
    content.toLowerCase().includes(element.toLowerCase())
  ).length;

  if (psychographicCount >= 4) score += 0.2;
  else if (psychographicCount >= 2) score += 0.1;

  // Check for specific demographic details
  const demographicKeywords = [
    'age range',
    'income level',
    'education',
    'occupation',
    'location',
    'family status',
  ];
  const demographicCount = demographicKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (demographicCount >= 3) score += 0.1;

  // Check for persona naming and specificity
  const hasPersonaNames = /persona[:\s]*[A-Z][a-z]+/.test(content);
  if (hasPersonaNames) score += 0.05;

  // Issues
  if (!hasPersonaKeywords) {
    issues.push('Persona profiles not clearly defined');
  }

  if (psychographicCount < 2) {
    issues.push(
      'Insufficient psychographic depth - missing values, attitudes, or lifestyle factors'
    );
  }

  if (content.length < 800) {
    issues.push('Persona profiles too brief for actionable insights');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkBehavioralInsightsActionability(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for behavioral analysis keywords
  const behaviorKeywords = [
    'behavior',
    'pattern',
    'trigger',
    'motivation',
    'barrier',
    'decision-making',
    'preference',
  ];
  const behaviorCount = behaviorKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (behaviorCount >= 4) score += 0.2;
  else if (behaviorCount >= 2) score += 0.1;

  // Check for specific behavioral triggers
  const triggerKeywords = [
    'triggered by',
    'motivated by',
    'responds to',
    'influenced by',
    'drives them to',
  ];
  const hasTriggers = triggerKeywords.some((trigger) =>
    content.toLowerCase().includes(trigger.toLowerCase())
  );

  if (hasTriggers) score += 0.15;

  // Check for actionable insights
  const actionableKeywords = [
    'target with',
    'reach through',
    'message with',
    'approach with',
    'engage via',
  ];
  const hasActionable = actionableKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasActionable) score += 0.15;

  // Issues
  if (behaviorCount < 2) {
    issues.push('Insufficient behavioral analysis - missing patterns or triggers');
  }

  if (!hasTriggers) {
    issues.push('Behavioral triggers not identified for targeting');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkJourneyMappingCompleteness(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for journey mapping keywords
  const journeyKeywords = [
    'customer journey',
    'journey map',
    'touchpoint',
    'stage',
    'awareness',
    'consideration',
    'decision',
  ];
  const journeyCount = journeyKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (journeyCount >= 4) score += 0.2;
  else if (journeyCount >= 2) score += 0.1;

  // Check for journey stages
  const stageKeywords = [
    'awareness',
    'discovery',
    'consideration',
    'evaluation',
    'purchase',
    'decision',
    'onboarding',
    'retention',
  ];
  const stageCount = stageKeywords.filter((stage) =>
    content.toLowerCase().includes(stage.toLowerCase())
  ).length;

  if (stageCount >= 4) score += 0.15;
  else if (stageCount >= 2) score += 0.1;

  // Check for emotional states
  const emotionKeywords = [
    'frustrated',
    'excited',
    'confused',
    'confident',
    'anxious',
    'satisfied',
    'emotional',
    'feeling',
  ];
  const hasEmotions = emotionKeywords.some((emotion) =>
    content.toLowerCase().includes(emotion.toLowerCase())
  );

  if (hasEmotions) score += 0.15;

  // Issues
  if (journeyCount < 2) {
    issues.push('Customer journey mapping incomplete or missing');
  }

  if (stageCount < 3) {
    issues.push('Journey stages not comprehensively covered');
  }

  if (!hasEmotions) {
    issues.push('Emotional states not mapped in customer journey');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkTargetingRecommendations(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for targeting keywords
  const targetingKeywords = [
    'target',
    'segment',
    'audience',
    'channel',
    'platform',
    'advertising',
    'marketing',
  ];
  const targetingCount = targetingKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  if (targetingCount >= 3) score += 0.2;

  // Check for specific channels/platforms
  const channelKeywords = [
    'facebook',
    'google',
    'linkedin',
    'twitter',
    'instagram',
    'email',
    'content marketing',
    'seo',
    'social media',
  ];
  const channelCount = channelKeywords.filter((channel) =>
    content.toLowerCase().includes(channel.toLowerCase())
  ).length;

  if (channelCount >= 2) score += 0.2;
  else if (channelCount >= 1) score += 0.1;

  // Check for messaging recommendations
  const messagingKeywords = [
    'message',
    'messaging',
    'communication',
    'tone',
    'language',
    'positioning',
  ];
  const hasMessaging = messagingKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasMessaging) score += 0.1;

  // Issues
  if (targetingCount < 2) {
    issues.push('Targeting recommendations not clearly provided');
  }

  if (channelCount === 0) {
    issues.push('Specific marketing channels not recommended for targeting');
  }

  return { score: Math.min(score, 1.0), issues };
}

function checkPsychographicAnalysis(content: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0.5;

  // Check for psychological frameworks
  const frameworkKeywords = [
    'maslow',
    'hierarchy',
    'ocean',
    'personality',
    'psychology',
    'cognitive',
    'behavioral economics',
  ];
  const hasFramework = frameworkKeywords.some((framework) =>
    content.toLowerCase().includes(framework.toLowerCase())
  );

  if (hasFramework) score += 0.2;

  // Check for value analysis
  const valueKeywords = [
    'values',
    'beliefs',
    'principles',
    'priorities',
    'important to',
    'cares about',
  ];
  const valueCount = valueKeywords.filter((value) =>
    content.toLowerCase().includes(value.toLowerCase())
  ).length;

  if (valueCount >= 2) score += 0.2;
  else if (valueCount >= 1) score += 0.1;

  // Check for lifestyle factors
  const lifestyleKeywords = [
    'lifestyle',
    'habits',
    'routine',
    'hobbies',
    'activities',
    'social',
  ];
  const lifestyleCount = lifestyleKeywords.filter((lifestyle) =>
    content.toLowerCase().includes(lifestyle.toLowerCase())
  ).length;

  if (lifestyleCount >= 2) score += 0.1;

  // Issues
  if (!hasFramework) {
    issues.push('Psychological frameworks not applied in analysis');
  }

  if (valueCount === 0) {
    issues.push('Customer values and beliefs not analyzed');
  }

  return { score: Math.min(score, 1.0), issues };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};