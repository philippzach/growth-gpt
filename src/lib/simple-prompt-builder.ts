/**
 * Enhanced Simple Prompt Builder - Implements structured prompt engineering
 * Following the architecture defined in prompts/gtm.md for consistent, high-quality outputs
 */

import { AgentConfig, UserSession } from '../types';
import { ConfigLoader } from './config-loader';

export interface SimplePromptContext {
  businessIdea: string;
  userInputs: Record<string, any>;
  previousOutputs: Record<string, string>; // agentId -> FULL previous agent output (not summary)
  agentConfig: AgentConfig;
  session: UserSession;
  configLoader?: ConfigLoader; // Optional for knowledge loading
  workflowPosition?: number; // Position in workflow (1-8)
  totalAgents?: number; // Total number of agents in workflow
  experiments?: any[]; // Optional experiments database for Growth Hacker
}

export interface SimplePrompt {
  systemPrompt: string;
  userPrompt: string;
}

export class SimplePromptBuilder {
  async buildPrompt(
    taskDefinition: string,
    context: SimplePromptContext,
    outputFormat: string,
    knowledgeFiles?: string[]
  ): Promise<SimplePrompt> {
    console.log(`🔍 DEBUG: SimplePromptBuilder.buildPrompt() called:`, {
      taskDefinition:
        taskDefinition?.substring(0, 100) + '...' || 'No task definition',
      hasContext: !!context,
      hasAgentConfig: !!context?.agentConfig,
      agentConfigId: context?.agentConfig?.id,
      businessIdea:
        context?.businessIdea?.substring(0, 50) + '...' || 'No business idea',
      knowledgeFilesCount: knowledgeFiles?.length || 0,
      workflowPosition: context?.workflowPosition,
      totalAgents: context?.totalAgents,
    });

    // Load relevant knowledge if specified and configLoader is available
    let knowledgeContent = '';
    if (knowledgeFiles && knowledgeFiles.length > 0 && context.configLoader) {
      console.log(`📚 DEBUG: Loading knowledge files:`, knowledgeFiles);
      knowledgeContent = await this.loadRelevantKnowledge(
        context.configLoader,
        knowledgeFiles
      );
      console.log(`📚 DEBUG: Knowledge content loaded:`, {
        knowledgeLength: knowledgeContent.length,
        hasContent: !!knowledgeContent,
      });
    }

    console.log(`🔧 DEBUG: Building system prompt...`);
    const systemPrompt = this.buildEnhancedSystemPrompt(
      context.agentConfig,
      knowledgeContent,
      context.experiments
    );
    console.log(`🔧 DEBUG: System prompt built:`, {
      systemPromptLength: systemPrompt.length,
      firstLine: systemPrompt.split('\n')[0],
    });

    console.log(`👤 DEBUG: Building instruction prompt...`);
    const instructionPrompt = this.buildEnhancedInstructionPrompt(
      taskDefinition,
      context,
      outputFormat
    );
    console.log(`👤 DEBUG: Instruction prompt built:`, {
      instructionPromptLength: instructionPrompt.length,
      firstLine: instructionPrompt.split('\n')[0],
    });

    console.log(`✅ DEBUG: SimplePrompt created successfully`);
    return {
      systemPrompt,
      userPrompt: instructionPrompt,
    };
  }

  // Synchronous version for backward compatibility
  buildPromptSync(
    taskDefinition: string,
    context: SimplePromptContext,
    outputFormat: string
  ): SimplePrompt {
    const systemPrompt = this.buildEnhancedSystemPrompt(context.agentConfig, '', context.experiments);
    const instructionPrompt = this.buildEnhancedInstructionPrompt(
      taskDefinition,
      context,
      outputFormat
    );

    return {
      systemPrompt,
      userPrompt: instructionPrompt,
    };
  }

  /**
   * Build Enhanced System Prompt following prompts/gtm.md structure:
   * 1. Agent Identity & Role
   * 2. Capabilities & Constraints
   * 3. Static Knowledge Base
   */
  private buildEnhancedSystemPrompt(
    agentConfig: AgentConfig,
    knowledgeContent?: string,
    experiments?: any[]
  ): string {
    console.log(`🔧 DEBUG: buildEnhancedSystemPrompt() called:`, {
      hasAgentConfig: !!agentConfig,
      agentId: agentConfig?.id,
      agentName: agentConfig?.name,
      hasPersona: !!agentConfig?.persona,
      hasCapabilities: !!agentConfig?.capabilities,
      knowledgeContentLength: knowledgeContent?.length || 0,
      hasExperiments: !!experiments,
      experimentsCount: experiments?.length || 0,
    });

    if (!agentConfig) {
      console.error(
        `❌ DEBUG: No agentConfig provided to buildEnhancedSystemPrompt`
      );
      return 'Error: No agent configuration available';
    }

    let prompt = '';

    // . AGENT IDENTITY & ROLE
    prompt += `<system_role>
 ${agentConfig.persona?.identity}.
You are part of an 8 Step Growth Strategy Development System. Go-to-Market, Persona, Product, Growth, Acquisition, Retention, Growth Loops, Hacking.
And are a specialist in your domain, creating collaborative outputs so other agents can work with the information I provided.        
</system_role>
`;

    if (
      agentConfig.persona?.expertise &&
      agentConfig.persona.expertise.length > 0
    ) {
      prompt += `<expertise>
${agentConfig.persona.expertise.map((exp) => `- ${exp}`).join('\n')}
</expertise>
`;
    }

    if (agentConfig.persona?.communication_style) {
      prompt += `<communication_style>
${agentConfig.persona.communication_style}
</communication_style>
`;
    }

    // . STATIC KNOWLEDGE BASE
    if (knowledgeContent && knowledgeContent.trim()) {
      prompt += `<Analytical_framework>
${knowledgeContent}
</Analytical_framework>
`;
    }

    // . EXPERIMENTS DATABASE (for Growth Hacker agent)
    if (experiments && experiments.length > 0) {
      prompt += `<experiments_database>
You have access to ${experiments.length} growth experiments to analyze and select from.

EXPERIMENTS DATA:
${JSON.stringify(experiments, null, 2)}

SELECTION CRITERIA:
- Analyze each experiment's relevance to the business context from previous agents
- Consider business type, customer personas, funnel priorities, and resource constraints
- Score experiments based on probability of success for this specific business
- Select the 20 most relevant experiments with highest success potential
- Organize into 3 tiers: Quick Wins, Strategic Tests, Innovation Experiments
</experiments_database>
`;
    }

    // . CAPABILITIES & CONSTRAINTS

    prompt += `
    <capabilities>
- Generate comprehensive, actionable analysis based on provided context
- Apply relevant frameworks and methodologies to business problems
- Provide specific, measurable recommendations
- Create structured outputs following specified formats
</capabilities>
`;

    prompt += `
<output_standards>
    <quality_requirements>
    - Support every strategic recommendation with reasoning
    - Provide specific numbers, percentages, and timelines
    - Create immediately actionable recommendations
    - Use actual context (never placeholders like [Company Name])
    </quality_requirements>

    <analytical_approach>
    - Maintain internal consistency across all sections
    - Start with market reality and customer evidence
    - Build strategy from customer needs outward
    - Validate assumptions with market data
    - Focus on differentiation and competitive advantage
    - Ensure scalability and sustainability
    </analytical_approach>
</output_standards>
`;

    prompt += `<constraints>
- Work only with provided context and knowledge - do not make unsupported assumptions
- Stay within your defined role and expertise area
- Do not provide financial, legal, or medical advice
- Do not provide generic advice applicable to any business
- Do not provide placeholder text or variables
- Do not make unsupported assumptions
- Do not provide technical implementation details beyond strategic scope
- Focus on strategic insights, not tactical implementation details
</constraints>
`;

    return prompt;
  }

  /**
   * Build Enhanced Instruction Prompt following prompts/gtm.md structure:
   * 1. Context Primer
   * 2. Specific Task Instructions
   * 3. Dynamic Context (Full Previous Outputs)
   * 4. Output Specifications
   */
  private buildEnhancedInstructionPrompt(
    taskDefinition: string,
    context: SimplePromptContext,
    outputFormat: string
  ): string {
    let prompt = '';

    // 1. CONTEXT PRIMER
    prompt += `<context>

`;
    const position = context.workflowPosition || 1;
    const total = context.totalAgents || 8;
    prompt += `
    <position>
    You are Agent ${position} of ${total} in the Growth Strategy Development System. You are creating a comprehensive Growth Strategy protocol that will be used by the business to focus their marketing efforts on.  
    Your output will directly influence the work of subsequent agents, so ensure all content is specific, actionable, and strategically aligned.
    </position>`;

    prompt += `<task_instructions>
${taskDefinition}
Before answering, work through this step-by-step:
1. REMEMBER: All the context from the previous agents and your specific knowledge base.
2. UNDERSTAND: What is the core question being asked?
3. ANALYZE: What are the key factors/components involved?
4. REASON: What logical connections can I make?
5. SYNTHESIZE: How do these elements combine?
6. CONCLUDE: What is the most accurate/helpful response?
</task_instructions>

`;

    prompt += `<business_concept  >
      ${context.businessIdea}
      </business_concept>
      `;
    prompt += `</context>
`;

    // 2. SPECIFIC TASK INSTRUCTIONS

    // Full Previous Agent Outputs (not summaries!)
    if (Object.keys(context.previousOutputs).length > 0) {
      prompt += `
      <previous_agent_outputs>
      The following are the COMPLETE outputs from previous agents in this workflow. Use this comprehensive context to inform your analysis and ensure strategic alignment:
        `;

      for (const [agentId, fullOutput] of Object.entries(
        context.previousOutputs
      )) {
        const agentName = this.formatAgentName(agentId);
        prompt += `### ${agentName} Complete Output:\n\n${fullOutput}\n\n---\n\n`;
      }
      prompt += `</previous_agent_outputs>
      `;
    }

    // User-provided inputs and preferences
    const relevantInputs = this.extractRelevantInputs(context.userInputs);
    if (relevantInputs) {
      prompt += `## Additional User Context
${relevantInputs}\n\n`;
    }

    // 4. OUTPUT SPECIFICATIONS
    prompt += `<output_format>
${outputFormat}
</output_format>
`;

    return prompt;
  }

  private formatAgentName(agentId: string): string {
    const nameMap: Record<string, string> = {
      'gtm-consultant': 'GTM Consultant',
      'persona-strategist': 'Persona Strategist',
      'product-manager': 'Product Manager',
      'growth-manager': 'Growth Manager',
      'head-of-acquisition': 'Head of Acquisition',
      'head-of-retention': 'Head of Retention',
      'viral-growth-architect': 'Viral Growth Architect',
      'growth-hacker': 'Growth Hacker',
    };

    return nameMap[agentId] || agentId;
  }

  private extractRelevantInputs(userInputs: Record<string, any>): string {
    const relevantKeys = [
      'targetMarket',
      'problemStatement',
      'solutionConcept',
      'businessModel',
      'competitiveAdvantage',
      'additionalContext',
    ];

    const relevantInputs: string[] = [];

    for (const key of relevantKeys) {
      if (
        userInputs[key] &&
        typeof userInputs[key] === 'string' &&
        userInputs[key].trim()
      ) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        relevantInputs.push(`${formattedKey}: ${userInputs[key]}`);
      }
    }

    return relevantInputs.length > 0 ? relevantInputs.join('\n') : '';
  }

  /**
   * DEPRECATED: Extract key insights from an agent's output
   *
   * NOTE: This method is deprecated in favor of using full agent outputs.
   * The new enhanced prompt structure uses complete previous outputs for better context.
   * This method is kept for backward compatibility during transition.
   */
  extractKeyInsights(agentId: string, fullOutput: string): string {
    console.warn(
      'extractKeyInsights is deprecated. Use full outputs for better agent context.'
    );

    // Simple extraction - look for key sections and bullet points
    const lines = fullOutput.split('\n');
    const insights: string[] = [];

    let inImportantSection = false;
    const importantSectionHeaders = [
      'executive summary',
      'key recommendations',
      'primary recommendations',
      'main findings',
      'strategic priorities',
      'core insights',
      'key takeaways',
    ];

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();

      // Check if we're entering an important section
      if (
        importantSectionHeaders.some(
          (header) =>
            lowerLine.includes(header) &&
            (lowerLine.startsWith('#') || lowerLine.startsWith('**'))
        )
      ) {
        inImportantSection = true;
        continue;
      }

      // Exit important section when we hit another header
      if (
        inImportantSection &&
        (line.startsWith('#') || line.startsWith('**')) &&
        !importantSectionHeaders.some((header) => lowerLine.includes(header))
      ) {
        inImportantSection = false;
      }

      // Collect content from important sections
      if (inImportantSection && line.trim()) {
        // Clean up formatting and add to insights
        const cleanLine = line.replace(/^[#*\-•\s]+/, '').trim();
        if (cleanLine && cleanLine.length > 10) {
          insights.push(cleanLine);
        }
      }

      // Also collect any bullet point recommendations throughout
      if (
        (line.includes('•') || line.includes('-')) &&
        (line.toLowerCase().includes('recommend') ||
          line.toLowerCase().includes('suggest') ||
          line.toLowerCase().includes('should'))
      ) {
        const cleanLine = line.replace(/^[#*\-•\s]+/, '').trim();
        if (cleanLine && cleanLine.length > 10) {
          insights.push(cleanLine);
        }
      }
    }

    // Limit to most important insights (top 5-8 points)
    const topInsights = insights.slice(0, 8);

    if (topInsights.length === 0) {
      // Fallback: take first few sentences if no structured content found
      const sentences = fullOutput
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 20);
      return sentences.slice(0, 3).join('. ').substring(0, 300) + '...';
    }

    return (
      topInsights.join('; ').substring(0, 300) +
      (topInsights.join('; ').length > 300 ? '...' : '')
    );
  }

  /**
   * Load relevant knowledge files from KV store
   */
  private async loadRelevantKnowledge(
    configLoader: ConfigLoader,
    knowledgeFiles: string[]
  ): Promise<string> {
    const knowledgeContents: string[] = [];

    for (const filePath of knowledgeFiles) {
      try {
        const content = await configLoader.loadKnowledgeBase(filePath);
        if (content && content.trim()) {
          // Add a header and clean up the content
          const fileName =
            filePath.split('/').pop()?.replace('.md', '') || 'Knowledge';
          knowledgeContents.push(`## ${fileName.toUpperCase()}\n${content}`);
        }
      } catch (error) {
        console.warn(`Failed to load knowledge file: ${filePath}`, error);
      }
    }

    return knowledgeContents.join('\n\n---\n\n');
  }

  /**
   * Determine workflow position based on agent ID
   */
  public getWorkflowPosition(agentId: string): {
    position: number;
    total: number;
  } {
    const agentOrder: Record<string, number> = {
      'gtm-consultant': 1,
      'persona-strategist': 2,
      'product-manager': 3,
      'growth-manager': 4,
      'head-of-acquisition': 5,
      'head-of-retention': 6,
      'viral-growth-architect': 7,
      'growth-hacker': 8,
    };

    return {
      position: agentOrder[agentId] || 1,
      total: 8,
    };
  }

  /**
   * Create enhanced context with workflow position
   */
  public createEnhancedContext(
    baseContext: SimplePromptContext,
    agentId: string
  ): SimplePromptContext {
    const workflowInfo = this.getWorkflowPosition(agentId);

    return {
      ...baseContext,
      workflowPosition: workflowInfo.position,
      totalAgents: workflowInfo.total,
    };
  }

  /**
   * Validate that the generated prompt doesn't contain template variables
   */
  validatePrompt(prompt: SimplePrompt): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const combinedPrompt = prompt.systemPrompt + ' ' + prompt.userPrompt;

    // Check for common template variables
    const templateVariables = combinedPrompt.match(/\[([^\]]+)\]/g);
    if (templateVariables) {
      errors.push(`Template variables found: ${templateVariables.join(', ')}`);
    }

    // Check for unsubstituted placeholders
    const placeholders = combinedPrompt.match(/\{([^}]+)\}/g);
    if (placeholders) {
      errors.push(
        `Unsubstituted placeholders found: ${placeholders.join(', ')}`
      );
    }

    // Check minimum length
    if (prompt.systemPrompt.length < 200) {
      errors.push('System prompt too short');
    }

    if (prompt.userPrompt.length < 50) {
      errors.push('User prompt too short');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
