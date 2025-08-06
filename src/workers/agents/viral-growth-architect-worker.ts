/**
 * Enhanced Viral Growth Architect Agent Worker - Seventh agent in the growth strategy workflow
 * Specializes in viral mechanisms, growth loops, and network effects optimization
 * Uses enhanced prompt engineering with full context sharing
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from '../../types';
import { ConfigLoader } from '../../lib/config-loader';
import { SimplePromptBuilder } from '../../lib/simple-prompt-builder';
import { AgentExecutor } from '../../lib/agent-executor';
import { createAPIResponse, createAPIError } from '../../lib/api-utils';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Enhanced agent configuration
const AGENT_ID = 'viral-growth-architect';

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    agentId: AGENT_ID,
    version: '3.0-enhanced',
    timestamp: new Date().toISOString(),
  });
});

// Enhanced agent execution endpoint
app.post('/execute', async (c) => {
  const startTime = Date.now();

  try {
    console.log(`🚀 Enhanced Viral Growth Architect Worker - Starting execution`);
    
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
        createAPIError('MISSING_PARAMS', 'sessionId and userId are required'),
        400
      );
    }

    console.log(`📋 Enhanced Viral Growth Architect - Processing request:`, {
      sessionId,
      userId,
      userInputsKeys: Object.keys(userInputs || {}),
      previousOutputsCount: Object.keys(previousOutputs).length,
      previousAgents: Object.keys(previousOutputs),
    });

    // Initialize enhanced configuration loader
    const configLoader = new ConfigLoader(c.env.CONFIG_STORE);
    
    // Load unified configuration with fallback to legacy
    console.log(`🔧 Loading unified configuration for ${AGENT_ID}...`);
    const unifiedConfig = await configLoader.loadUnifiedAgentConfig(AGENT_ID);
    const agentConfig = unifiedConfig 
      ? configLoader.convertUnifiedToLegacyConfig(unifiedConfig)
      : await configLoader.loadAgentConfig(AGENT_ID);

    if (!agentConfig) {
      console.error(`❌ Failed to load agent configuration for ${AGENT_ID}`);
      return c.json(
        createAPIError('CONFIG_NOT_FOUND', `Agent configuration not found for ${AGENT_ID}`),
        404
      );
    }

    console.log(`✅ Configuration loaded successfully:`, {
      configType: unifiedConfig ? 'unified' : 'legacy',
      agentName: agentConfig.name,
      hasCapabilities: !!agentConfig.capabilities,
      knowledgeDomains: agentConfig.capabilities?.knowledge_domains?.length || 0
    });

    // Initialize enhanced prompt builder
    const promptBuilder = new SimplePromptBuilder();
    
    // Create enhanced context with full previous outputs
    const enhancedContext = promptBuilder.createEnhancedContext({
      businessIdea: userInputs?.businessIdea || userInputs?.businessConcept || 'Business concept not provided',
      userInputs,
      previousOutputs, // Full context - All 6 previous agents' outputs
      agentConfig,
      session: {
        id: sessionId,
        userId,
        currentStep: 6, // Viral Growth Architect is 7th agent (0-indexed)
        conversationHistory: [],
      } as any,
      configLoader,
      workflowPosition: 7, // 7th agent in workflow
      totalAgents: 8,
    }, AGENT_ID);

    console.log(`📊 Enhanced context created:`, {
      businessIdea: enhancedContext.businessIdea?.substring(0, 100) + '...',
      workflowPosition: enhancedContext.workflowPosition,
      totalAgents: enhancedContext.totalAgents,
      previousOutputsReceived: Object.keys(previousOutputs).length,
      expectedPreviousAgents: ['gtm-consultant', 'persona-strategist', 'product-manager', 'growth-manager', 'head-of-acquisition', 'head-of-retention'],
      actualPreviousAgents: Object.keys(previousOutputs)
    });

    // Define relevant knowledge files for Viral Growth Architect
    const knowledgeFiles = [
      'knowledge-base/method/16growth-loop.md',
      'knowledge-base/method/15pirate-funnel-referrals.md',
      'knowledge-base/resources/virality.md',
      'knowledge-base/resources/cialdini-persuasion.md',
      'knowledge-base/resources/hierachy-of-engagement.md',
      'knowledge-base/method/08friction-to-value.md',
      'knowledge-base/resources/psychographics-socialmedia.md'
    ];

    // Generate dynamic output format from unified config
    const outputFormat = unifiedConfig 
      ? generateOutputFormatFromConfig(unifiedConfig.output_specifications)
      : `Generate comprehensive viral growth strategy with:
- Growth loop architecture and sustainable viral mechanisms
- Network effects optimization and viral coefficient enhancement
- Referral program design and incentive optimization
- Behavioral psychology integration for viral motivation
- Viral content strategies and social sharing optimization
- Implementation timeline with resource requirements`;

    console.log(`🎯 Task definition:`, {
      taskObjective: unifiedConfig?.task_specification.primary_objective?.substring(0, 150) + '...' || 'Default viral growth strategy development',
      outputFormatLength: outputFormat.length,
      knowledgeFilesCount: knowledgeFiles.length
    });

    // Generate enhanced prompt with full context
    const prompt = await promptBuilder.buildPrompt(
      unifiedConfig?.task_specification.primary_objective || 
      'Design sustainable viral growth system architecture with growth loops, network effects optimization, referral programs, and behavioral psychology integration that creates compound growth and competitive moats',
      enhancedContext,
      outputFormat,
      knowledgeFiles
    );

    console.log(`✅ Enhanced prompt generated successfully`);

    // Execute agent with enhanced prompt
    const agentExecutor = new AgentExecutor(c.env);
    const agentResult = await agentExecutor.executeAgent(
      AGENT_ID as any,
      prompt,
      {
        session: enhancedContext.session,
        agentConfig,
        taskConfig: {} as any, // Simplified for enhanced system
        userInputs: enhancedContext.userInputs,
        previousOutputs: enhancedContext.previousOutputs,
        knowledgeBase: {},
        businessContext,
        workflowStep: 6,
      }
    );

    const processingTime = Date.now() - startTime;
    
    console.log(`🎉 Viral Growth Architect execution completed:`, {
      processingTime,
      contentLength: agentResult.content.length,
      qualityScore: agentResult.qualityScore,
      tokensUsed: agentResult.tokensUsed
    });

    // Return enhanced response
    return c.json(createAPIResponse({
      agentId: AGENT_ID,
      sessionId,
      execution: {
        success: true,
        processingTime,
        qualityScore: agentResult.qualityScore,
      },
      output: {
        content: agentResult.content,
        template: 'direct-output',
        variables: {},
        structure: {
          type: 'direct-content',
          sections: extractOutputSections(agentResult.content),
        },
      },
      metadata: {
        tokensUsed: agentResult.tokensUsed,
        qualityScore: agentResult.qualityScore,
        processingTime,
        promptValidation: { valid: true, errors: [] },
        systemType: 'enhanced-prompt-builder',
        unifiedConfig: !!unifiedConfig,
        contextType: 'full-previous-outputs',
        workflowPosition: 7,
        totalAgents: 8,
        knowledgeSourcesUsed: agentResult.knowledgeSourcesUsed,
        qualityGatesPassed: agentResult.qualityGatesPassed,
      },
    }));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Enhanced Viral Growth Architect execution error:', error);
    
    return c.json(
      createAPIError(
        'EXECUTION_FAILED',
        `Viral Growth Architect execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          agentId: AGENT_ID,
          processingTime,
          error: error instanceof Error ? error.message : String(error),
        }
      ),
      500
    );
  }
});

/**
 * Generate output format from unified configuration
 */
function generateOutputFormatFromConfig(outputSpecs: any): string {
  if (!outputSpecs?.required_sections) {
    return 'Generate comprehensive viral growth strategy and recommendations in markdown format';
  }

  const sections = Object.entries(outputSpecs.required_sections).map(([key, spec]: [string, any]) => {
    return `## ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
${spec.description}
${spec.requirements ? spec.requirements.map((req: string) => `- ${req}`).join('\n') : ''}`;
  }).join('\n\n');

  return `Generate comprehensive viral growth strategy with the following sections:

${sections}

Ensure all recommendations are specific, actionable, and aligned with sustainable viral growth principles.`;
}

/**
 * Extract sections from generated content for structure metadata
 */
function extractOutputSections(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      const section = line.replace(/^#+\s*/, '').trim();
      if (section && !sections.includes(section)) {
        sections.push(section);
      }
    }
  }
  
  return sections.length > 0 ? sections : ['comprehensive-viral-growth-strategy'];
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};