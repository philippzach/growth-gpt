/**
 * Head of Acquisition Agent Worker - Fifth agent in the growth strategy workflow
 * Specializes in customer acquisition strategies, channel optimization, and paid marketing
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
const AGENT_ID = 'head-of-acquisition';
const AGENT_CONFIG_PATH = 'agents/head-of-acquisition.yaml';
const TASK_CONFIG_PATH = 'tasks/agent-tasks/head-of-acquisition-task.yaml';

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

    // Validate dependencies - Growth funnel and metrics
    if (!previousOutputs['growth-manager'] && !previousOutputs['growth-funnel.md']) {
      return c.json(
        createAPIError(
          'MISSING_DEPENDENCY',
          'Growth funnel from Growth Manager is required for acquisition strategy'
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
      currentStep: 4,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      userInputs,
      agentOutputs: previousOutputs,
      conversationHistory: [],
      progress: {
        totalSteps: 8,
        completedSteps: 4,
        currentStepId: 'acquisition_strategy',
        estimatedTimeRemaining: 120,
        stageProgress: {
          foundation: 0.75,
          strategy: 0.25,
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
      workflowStep: 4,
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
    console.error('Head of Acquisition execution error:', error);

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
    console.error('Head of Acquisition config error:', error);
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

    // Load Head of Acquisition-specific knowledge
    const knowledgeMapping: Record<string, string> = {
      'acquisition-channels': 'knowledge-base/method/10pirate-funnel-acquisition.md',
      'paid-advertising': 'knowledge-base/ressources/facebook-Ads.md',
      'content-marketing': 'knowledge-base/ressources/copywriting-cheat-sheet.md',
      'seo-strategy': 'knowledge-base/ressources/market-segmentation.md',
      'conversion-optimization': 'knowledge-base/ressources/cro.md',
      'acquisition-funnel': 'knowledge-base/method/09pirate-funnel-awareness.md',
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
    currentChannels: userInputs.currentChannels || userInputs.current_channels || [],
    acquisitionBudget: userInputs.acquisitionBudget || userInputs.acquisition_budget || '',
    targetCPA: userInputs.targetCPA || userInputs.target_cpa || '',
    currentCAC: userInputs.currentCAC || userInputs.current_cac || '',
  };
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
};