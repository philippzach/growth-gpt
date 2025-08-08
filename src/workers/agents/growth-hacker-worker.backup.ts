/**
 * Enhanced Growth Hacker Agent Worker - Eighth agent in the growth strategy workflow
 * Specializes in experimentation frameworks, hypothesis formation, and systematic testing
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
const AGENT_ID = 'growth-hacker';

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
    console.log(`🚀 Enhanced Growth Hacker Worker - Starting execution`);
    
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

    console.log(`📋 Enhanced Growth Hacker - Processing request:`, {
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
      previousOutputs, // Full context - All 7 previous agents' outputs
      agentConfig,
      session: {
        id: sessionId,
        userId,
        currentStep: 7, // Growth Hacker is 8th agent (0-indexed)
        conversationHistory: [],
      } as any,
      configLoader,
      workflowPosition: 8, // 8th agent in workflow
      totalAgents: 8,
    }, AGENT_ID);

    console.log(`📊 Enhanced context created:`, {
      businessIdea: enhancedContext.businessIdea?.substring(0, 100) + '...',
      workflowPosition: enhancedContext.workflowPosition,
      totalAgents: enhancedContext.totalAgents,
      previousOutputsReceived: Object.keys(previousOutputs).length,
      expectedPreviousAgents: ['gtm-consultant', 'persona-strategist', 'product-manager', 'growth-manager', 'head-of-acquisition', 'head-of-retention', 'viral-growth-architect'],
      actualPreviousAgents: Object.keys(previousOutputs)
    });

    // Define relevant knowledge files for Growth Hacker
    const knowledgeFiles = [
      'knowledge-base/experiments/experiment-process.md',
      'knowledge-base/method/00growth-hacking-process.md',
      'knowledge-base/resources/brainstorming-techniques.md',
      'knowledge-base/resources/growthhacking-process-overview.md',
      'knowledge-base/glossary/growth-hacking-dictionary.md',
      'knowledge-base/method/07pirate-funnel.md',
      'knowledge-base/resources/north-start-metric.md'
    ];

    // Generate dynamic output format from unified config
    const outputFormat = unifiedConfig 
      ? generateOutputFormatFromConfig(unifiedConfig.output_specifications)
      : `Generate comprehensive experimentation framework with:
- Hypothesis formation and systematic testing roadmap
- Statistically valid experiment designs with proper controls
- Prioritized testing backlog with resource allocation
- Analytics and measurement systems implementation
- Continuous optimization and learning processes
- Implementation timeline with resource requirements`;

    console.log(`🎯 Task definition:`, {
      taskObjective: unifiedConfig?.task_specification.primary_objective?.substring(0, 150) + '...' || 'Default experimentation framework development',
      outputFormatLength: outputFormat.length,
      knowledgeFilesCount: knowledgeFiles.length
    });

    // Generate enhanced prompt with full context
    const prompt = await promptBuilder.buildPrompt(
      unifiedConfig?.task_specification.primary_objective || 
      'Develop comprehensive experimentation framework with hypothesis formation, statistically valid experiment designs, prioritized testing roadmap, and systematic validation processes that enable continuous growth optimization',
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
        workflowStep: 7,
      }
    );

    const processingTime = Date.now() - startTime;
    
    console.log(`🎉 Growth Hacker execution completed:`, {
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
        workflowPosition: 8,
        totalAgents: 8,
        knowledgeSourcesUsed: agentResult.knowledgeSourcesUsed,
        qualityGatesPassed: agentResult.qualityGatesPassed,
      },
    }));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Enhanced Growth Hacker execution error:', error);
    
    return c.json(
      createAPIError(
        'EXECUTION_FAILED',
        `Growth Hacker execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    return 'Generate comprehensive experimentation framework and recommendations in markdown format';
  }

  const sections = Object.entries(outputSpecs.required_sections).map(([key, spec]: [string, any]) => {
    return `## ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
${spec.description}
${spec.requirements ? spec.requirements.map((req: string) => `- ${req}`).join('\n') : ''}`;
  }).join('\n\n');

  return `Generate comprehensive experimentation framework with the following sections:

${sections}

Ensure all recommendations are specific, actionable, and aligned with statistical best practices.`;
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
  
  return sections.length > 0 ? sections : ['comprehensive-experimentation-framework'];
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};