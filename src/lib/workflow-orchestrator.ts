/**
 * Workflow Orchestrator - Manages agent sequence, coordination, and handoffs
 * Handles the execution flow between the 8 specialized agents
 */

import {
  Env,
  UserSession,
  ChatMessage,
  AgentOutput,
  WorkflowConfig,
  WorkflowStep,
  AgentType,
  PromptGenerationContext,
  GeneratedPrompt,
} from '../types';
import { ConfigLoader } from './config-loader';
import { DynamicPromptGenerator } from './dynamic-prompt-generator';
import { AgentExecutor } from './agent-executor';

export class WorkflowOrchestrator {
  private configLoader: ConfigLoader;
  private promptGenerator: DynamicPromptGenerator;
  private agentExecutor: AgentExecutor;
  private websocketEmitter?: (sessionId: string, data: any) => void;

  constructor(private env: Env, websocketEmitter?: (sessionId: string, data: any) => void) {
    this.configLoader = new ConfigLoader(env.CONFIG_STORE);
    this.promptGenerator = new DynamicPromptGenerator(env.CONFIG_STORE);
    this.agentExecutor = new AgentExecutor(env, websocketEmitter);
    this.websocketEmitter = websocketEmitter;
  }

  async processUserMessage(
    session: UserSession,
    userMessage: ChatMessage
  ): Promise<ChatMessage | null> {
    try {
      // Load workflow configuration
      const workflowConfig = await this.configLoader.loadWorkflowConfig(
        session.workflowId
      );
      if (!workflowConfig) {
        throw new Error(`Workflow ${session.workflowId} not found`);
      }

      // Get current workflow step
      const currentStep = workflowConfig.sequence[session.currentStep];
      if (!currentStep) {
        return this.createCompletionMessage(session);
      }

      // Always process user input directly - no introduction step
      return await this.processAgentInteraction(
        session,
        userMessage,
        currentStep
      );
    } catch (error) {
      console.error('Workflow processing error:', error);
      return this.createErrorMessage(session, error);
    }
  }

  async moveToNextAgent(session: UserSession): Promise<void> {
    try {
      const workflowConfig = await this.configLoader.loadWorkflowConfig(
        session.workflowId
      );
      if (!workflowConfig) {
        throw new Error(`Workflow ${session.workflowId} not found`);
      }

      // Update progress
      session.currentStep += 1;
      session.progress.completedSteps += 1;

      // Check if workflow is complete
      if (session.currentStep >= workflowConfig.sequence.length) {
        session.status = 'completed';
        session.currentAgent = '';

        // Add completion message
        const completionMessage = this.createCompletionMessage(session);
        session.conversationHistory.push(completionMessage);

        return;
      }

      // Move to next agent
      const nextStep = workflowConfig.sequence[session.currentStep];
      session.currentAgent = nextStep.agent_id;
      session.progress.currentStepId = nextStep.step_id;

      // Update stage progress
      this.updateStageProgress(session, nextStep.stage);

      // Calculate estimated time remaining
      session.progress.estimatedTimeRemaining = this.calculateRemainingTime(
        workflowConfig,
        session.currentStep
      );

      session.lastActive = new Date().toISOString();
    } catch (error) {
      console.error('Agent transition error:', error);
      throw error;
    }
  }

  async regenerateAgentOutput(
    session: UserSession,
    outputId: string,
    feedback: string
  ): Promise<AgentOutput | null> {
    try {
      const workflowConfig = await this.configLoader.loadWorkflowConfig(
        session.workflowId
      );
      if (!workflowConfig) {
        throw new Error(`Workflow ${session.workflowId} not found`);
      }

      const currentStep = workflowConfig.sequence[session.currentStep];
      const agentConfig = await this.configLoader.loadAgentConfig(
        currentStep.agent_id
      );
      const taskConfig = await this.configLoader.loadTaskConfig(
        `${currentStep.agent_id}-task`
      );

      if (!agentConfig || !taskConfig) {
        throw new Error(
          `Configuration not found for agent ${currentStep.agent_id}`
        );
      }

      // Prepare context with feedback
      const context = await this.prepareExecutionContext(session, currentStep, {
        feedback,
      });

      // Generate new prompt with feedback incorporated
      const promptWithFeedback =
        await this.promptGenerator.generatePrompt(context);

      // Execute agent with new prompt
      const newOutput = await this.agentExecutor.executeAgent(
        currentStep.agent_id as AgentType,
        promptWithFeedback as any,
        context
      );

      // Use output directly (no template processing)
      const agentOutput: AgentOutput = {
        agentId: currentStep.agent_id,
        status: 'pending',
        content: newOutput.content,
        template: 'direct-output',
        variables: {},
        qualityScore: newOutput.qualityScore,
        generatedAt: new Date().toISOString(),
        metadata: {
          tokensUsed: newOutput.tokensUsed,
          processingTime: newOutput.processingTime,
          templateApplied: 'direct-output',
          knowledgeSourcesUsed: newOutput.knowledgeSourcesUsed,
          qualityGatesPassed: newOutput.qualityGatesPassed,
        },
      };

      return agentOutput;
    } catch (error) {
      console.error('Output regeneration error:', error);
      return null;
    }
  }


  private async processAgentInteraction(
    session: UserSession,
    userMessage: ChatMessage,
    step: WorkflowStep
  ): Promise<ChatMessage> {
    try {
      // Load configurations
      const agentConfig = await this.configLoader.loadAgentConfig(
        step.agent_id
      );
      const taskConfig = await this.configLoader.loadTaskConfig(
        `${step.agent_id}-task`
      );

      if (!agentConfig || !taskConfig) {
        throw new Error(`Configuration not found for agent ${step.agent_id}`);
      }

      // Prepare execution context
      const context = await this.prepareExecutionContext(session, step, {
        userMessage: userMessage.content,
      });

      // Generate optimized prompt
      const generatedPrompt =
        await this.promptGenerator.generatePrompt(context);

      // Execute agent
      const agentResult = await this.agentExecutor.executeAgent(
        step.agent_id as AgentType,
        generatedPrompt as any,
        context
      );

      // Use agent output directly (no template processing)
      const agentOutput: AgentOutput = {
        agentId: step.agent_id,
        status: 'pending',
        content: agentResult.content,
        template: 'direct-output',
        variables: {},
        qualityScore: agentResult.qualityScore,
        generatedAt: new Date().toISOString(),
        metadata: {
          tokensUsed: agentResult.tokensUsed,
          processingTime: agentResult.processingTime,
          templateApplied: 'direct-output',
          knowledgeSourcesUsed: agentResult.knowledgeSourcesUsed,
          qualityGatesPassed: agentResult.qualityGatesPassed,
        },
      };

      // Store agent output
      session.agentOutputs[step.agent_id] = agentOutput;

      // Create response message with approval request
      const responseMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        sender: 'agent',
        agentId: step.agent_id,
        type: 'output',
        content: this.formatOutputForChat(agentOutput, agentConfig),
        metadata: {
          agentId: step.agent_id,
          outputId: step.agent_id,
          requiresApproval: true,
          qualityScore: agentOutput.qualityScore,
        },
        timestamp: new Date().toISOString(),
      };

      return responseMessage;
    } catch (error) {
      console.error('Agent interaction error:', error);
      return this.createErrorMessage(session, error);
    }
  }


  private async prepareExecutionContext(
    session: UserSession,
    step: WorkflowStep,
    additionalContext: Record<string, any> = {}
  ): Promise<PromptGenerationContext> {
    // Load configurations
    const agentConfig = await this.configLoader.loadAgentConfig(step.agent_id);
    const taskConfig = await this.configLoader.loadTaskConfig(
      `${step.agent_id}-task`
    );

    if (!agentConfig || !taskConfig) {
      throw new Error(`Configuration not found for agent ${step.agent_id}`);
    }

    // Load knowledge base
    const knowledgeBase = await this.loadRelevantKnowledge(taskConfig);

    // Extract previous outputs for context
    const previousOutputs = this.extractPreviousOutputs(session, step);

    // Prepare business context
    const businessContext = this.extractBusinessContext(session);

    return {
      session,
      agentConfig,
      taskConfig,
      userInputs: { ...session.userInputs, ...additionalContext },
      previousOutputs,
      knowledgeBase,
      businessContext,
      workflowStep: session.currentStep,
    };
  }

  private async loadRelevantKnowledge(
    taskConfig: any
  ): Promise<Record<string, string>> {
    const knowledgeBase: Record<string, string> = {};

    try {
      // Load knowledge sources specified in task config
      const knowledgeFocus =
        taskConfig.agent_integration.behavior_overrides.knowledge_focus || [];

      for (const focus of knowledgeFocus) {
        // Map focus areas to knowledge base files
        const knowledgeFile = this.mapFocusToFile(focus);
        if (knowledgeFile) {
          const content =
            await this.configLoader.loadKnowledgeBase(knowledgeFile);
          if (content) {
            knowledgeBase[focus] = content;
          }
        }
      }

      // Special handling for experiment database
      if (knowledgeFocus.includes('master-experiments-database')) {
        const experimentDb = await this.configLoader.loadExperimentDatabase();
        if (experimentDb) {
          knowledgeBase['master-experiments-database'] = experimentDb;
        }
      }
    } catch (error) {
      console.error('Knowledge loading error:', error);
    }

    return knowledgeBase;
  }

  private mapFocusToFile(focus: string): string | null {
    const focusMapping: Record<string, string> = {
      'value-proposition': 'method/01value-proposition.md',
      'problem-solution-fit': 'method/02problem-solution-fit.md',
      'business-model': 'method/03business-model.md',
      'psychographic-persona': 'method/04psychograhpic-persona.md',
      'product-market-fit': 'method/05product-market-fit.md',
      'pirate-funnel': 'method/07pirate-funnel.md',
      'growth-hacking-process': 'method/00growth-hacking-process.md',
      'experiment-process': 'experiments/experiment-process.md',
      'growth-experiment-methodology': 'method/00growth-hacking-process.md',
      'a-b-testing': 'resources/cro.md',
      'retention-lifecycle': 'resources/retention-lifecycle.md',
      virality: 'resources/virality.md',
    };

    return focusMapping[focus] || null;
  }

  private extractPreviousOutputs(
    session: UserSession,
    currentStep: WorkflowStep
  ): Record<string, any> {
    const previousOutputs: Record<string, any> = {};

    // Extract content from all previous agent outputs
    for (const [agentId, output] of Object.entries(session.agentOutputs)) {
      if (output.status === 'approved') {
        previousOutputs[agentId] = output.content;
      }
    }

    return previousOutputs;
  }

  private extractBusinessContext(session: UserSession): any {
    const userInputs = session.userInputs;

    return {
      businessType: userInputs.businessType || 'startup',
      industry: userInputs.industry || 'technology',
      stage: userInputs.businessStage || 'early-stage',
      teamSize: userInputs.teamSize || 'small',
      devResources: userInputs.developmentResources || 'limited',
      budget: userInputs.budget || 'limited',
    };
  }


  private formatOutputForChat(output: AgentOutput, agentConfig: any): string {
    const agentName =
      agentConfig.persona.identity.split(' ')[0] || agentConfig.name;

    return `## ${agentName}'s Analysis & Recommendations

${output.content}

---

**Quality Score:** ${Math.round(output.qualityScore * 100)}%
**Generated:** ${new Date(output.generatedAt).toLocaleString()}

Please review this output. You can:
• **Approve** it to continue to the next agent
• **Edit** it to make changes
• **Regenerate** it with specific feedback

What would you like to do?`;
  }

  private createCompletionMessage(session: UserSession): ChatMessage {
    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
      sender: 'system',
      type: 'text',
      content: `🎉 **Congratulations!** 

Your comprehensive growth strategy is complete! You've worked through all 8 specialized agents and created:

${Object.keys(session.agentOutputs)
  .map((agentId) => `✅ ${this.getAgentOutputName(agentId)}`)
  .join('\n')}

Your strategy is now ready for implementation. You can:
• Export your complete strategy (PDF, Markdown, or Presentation)
• Review and refine any sections
• Share with your team

Thank you for using the Growth Strategy Agent System!`,
      timestamp: new Date().toISOString(),
    };
  }

  private createErrorMessage(session: UserSession, error: any): ChatMessage {
    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
      sender: 'system',
      type: 'text',
      content: `⚠️ I encountered an error while processing your request: ${error.message}

Please try again, or contact support if this issue persists.`,
      timestamp: new Date().toISOString(),
    };
  }

  private getAgentOutputName(agentId: string): string {
    const outputNames: Record<string, string> = {
      'gtm-consultant': 'Market Foundation & GTM Strategy',
      'persona-strategist': 'Customer Psychology & Personas',
      'product-manager': 'Product Positioning & Brand Guide',
      'growth-manager': 'Growth Funnel & Metrics Framework',
      'head-of-acquisition': 'Customer Acquisition Strategy',
      'head-of-retention': 'Retention & Lifecycle Strategy',
      'viral-growth-architect': 'Viral Growth & Referral Strategy',
      'growth-hacker': 'Experimentation Framework',
    };

    return outputNames[agentId] || agentId;
  }

  private updateStageProgress(session: UserSession, stage: string): void {
    const stageSteps = {
      foundation: [0, 1, 2], // GTM, Persona, Product
      strategy: [3, 4, 5, 6], // Growth, Acquisition, Retention, Viral
      validation: [7], // Growth Hacker
    };

    const totalStepsInStage =
      stageSteps[stage as keyof typeof stageSteps]?.length || 1;
    const completedInStage = session.progress.completedSteps;

    if (stage === 'foundation') {
      session.progress.stageProgress.foundation = Math.min(
        completedInStage / 3,
        1
      );
    } else if (stage === 'strategy') {
      session.progress.stageProgress.strategy = Math.min(
        (completedInStage - 3) / 4,
        1
      );
    } else if (stage === 'validation') {
      session.progress.stageProgress.validation = Math.min(
        (completedInStage - 7) / 1,
        1
      );
    }
  }

  private calculateRemainingTime(
    workflowConfig: WorkflowConfig,
    currentStep: number
  ): number {
    // Estimate remaining time based on workflow configuration
    const remainingSteps = workflowConfig.sequence.length - currentStep;
    const avgTimePerStep = 30; // 30 minutes average per agent

    return remainingSteps * avgTimePerStep;
  }
}
