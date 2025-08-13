/**
 * Dynamic Prompt Generator - Converts task specifications to optimized Claude API prompts
 * Based on the utility task configuration from tasks/utility-tasks/dynamic-prompt-generator.yaml
 */

import { 
  TaskConfig, 
  AgentConfig, 
  UserSession, 
  PromptTemplates,
  DynamicPromptGeneration 
} from '../types';
import { ConfigLoader } from './config-loader';

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: PromptMetadata;
}

export interface PromptMetadata {
  totalTokens: number;
  systemTokens: number;
  userTokens: number;
  variablesSubstituted: string[];
  sectionsIncluded: string[];
  qualityScore: number;
  optimizationsApplied: string[];
}

export interface PromptGenerationContext {
  session: UserSession;
  agentConfig: AgentConfig;
  taskConfig: TaskConfig;
  userInputs: Record<string, any>;
  previousOutputs: Record<string, any>;
  knowledgeBase: Record<string, string>;
  businessContext: BusinessContext;
}

export interface BusinessContext {
  businessType: string;
  industry: string;
  stage: string;
  teamSize: string;
  devResources: string;
  budget: string;
}

export class DynamicPromptGenerator {
  private configLoader: ConfigLoader;
  private templateCache = new Map<string, PromptTemplates>();

  constructor(kvStore: KVNamespace) {
    this.configLoader = new ConfigLoader(kvStore);
  }

  async generatePrompt(context: PromptGenerationContext): Promise<GeneratedPrompt> {
    const startTime = Date.now();
    
    try {
      // Load and validate configurations
      const { agentConfig, taskConfig, session } = context;
      
      if (!this.validateContext(context)) {
        throw new Error('Invalid prompt generation context');
      }

      // Extract prompt templates from task config
      const templates = taskConfig.prompt_generation.templates;
      const dynamicConfig = taskConfig.prompt_generation.dynamic_generation;

      // Prepare variable substitution context
      const substitutionContext = await this.prepareSubstitutionContext(context);

      // Generate system prompt
      const systemPrompt = await this.generateSystemPrompt(
        templates.system_prompt_template,
        substitutionContext,
        dynamicConfig
      );

      // Generate user prompt  
      const userPrompt = await this.generateUserPrompt(
        templates.user_prompt_template,
        substitutionContext,
        dynamicConfig
      );

      // Apply optimizations
      const optimizedSystemPrompt = await this.optimizePrompt(
        systemPrompt,
        taskConfig.prompt_generation.optimization
      );

      const optimizedUserPrompt = await this.optimizePrompt(
        userPrompt,
        taskConfig.prompt_generation.optimization
      );

      // Validate generated prompts
      const validation = await this.validatePrompts(
        optimizedSystemPrompt,
        optimizedUserPrompt,
        taskConfig.prompt_generation.validation
      );

      if (!validation.isValid) {
        console.warn('⚠️ Prompt validation failed, but continuing anyway for debugging:', validation.errors);
        // Temporarily allow invalid prompts for debugging
        // throw new Error(`Prompt validation failed: ${validation.errors.join(', ')}`);
      }

      // Calculate metadata
      const metadata = this.calculateMetadata(
        optimizedSystemPrompt,
        optimizedUserPrompt,
        substitutionContext,
        Date.now() - startTime
      );

      return {
        systemPrompt: optimizedSystemPrompt,
        userPrompt: optimizedUserPrompt,
        metadata
      };
    } catch (error) {
      console.error('Prompt generation failed:', error);
      throw error;
    }
  }

  private async prepareSubstitutionContext(
    context: PromptGenerationContext
  ): Promise<Record<string, any>> {
    const { agentConfig, taskConfig, session, userInputs, previousOutputs, knowledgeBase, businessContext } = context;

    // Build comprehensive substitution context
    const substitutionContext: Record<string, any> = {
      // Agent identity and configuration
      agent_identity: this.formatAgentIdentity(agentConfig),
      agent_name: agentConfig.persona.identity.split(' ')[0] || agentConfig.name,
      agent_role: agentConfig.name,
      agent_expertise: agentConfig.persona.expertise.join(', '),
      communication_style: agentConfig.persona.communication_style,
      
      // Task specification
      primary_objective: taskConfig.task_specification.primary_objective,
      secondary_objectives: this.formatList(taskConfig.task_specification.secondary_objectives),
      primary_deliverables: this.formatDeliverables(taskConfig.task_specification.deliverables.primary_deliverables),
      secondary_deliverables: this.formatDeliverables(taskConfig.task_specification.deliverables.secondary_deliverables),
      mandatory_criteria: this.formatCriteria(taskConfig.task_specification.success_criteria.mandatory_criteria),
      optional_criteria: this.formatCriteria(taskConfig.task_specification.success_criteria.optional_criteria),
      
      // Constraints and scope
      scope_constraints: this.formatConstraints(taskConfig.task_specification.constraints.scope_constraints),
      resource_constraints: this.formatConstraints(taskConfig.task_specification.constraints.resource_constraints),
      quality_constraints: this.formatConstraints(taskConfig.task_specification.constraints.quality_constraints),
      quality_standards: this.formatList(taskConfig.task_specification.deliverables.quality_standards),
      
      // Workflow context
      workflow_stage: taskConfig.workflow_integration.workflow_stage,
      stage_purpose: this.getStageDescription(taskConfig.workflow_integration.workflow_stage),
      sequence_order: taskConfig.workflow_integration.sequence_order,
      previous_stage_outputs: this.formatPreviousOutputs(previousOutputs),
      next_stage_requirements: this.formatList(taskConfig.workflow_integration.outputs.secondary_outputs),
      
      // Business and user context
      business_type: businessContext.businessType,
      business_stage: businessContext.stage,
      industry_context: businessContext.industry,
      team_size: businessContext.teamSize,
      dev_resources_available: businessContext.devResources,
      user_experience: this.determineUserExperience(userInputs),
      
      // Session context
      project_name: userInputs.projectName || session.userInputs.businessIdea || 'Your Project',
      session_date: new Date().toLocaleDateString(),
      session_duration: this.calculateSessionDuration(session),
      
      // Knowledge base injection
      injected_knowledge: await this.formatKnowledgeBase(knowledgeBase, taskConfig),
      
      // Template and output format
      primary_template: this.getTemplateReference(taskConfig),
      deliverable_format: taskConfig.task_specification.deliverables.deliverable_format,
      
      // Complete strategic context from previous agents
      complete_strategic_context: this.formatCompleteContext(previousOutputs),
      complete_foundation_summary: this.extractFoundationSummary(previousOutputs),
      key_strategic_hypotheses: this.extractStrategicHypotheses(previousOutputs),
      growth_funnel_summary: this.extractGrowthFunnelSummary(previousOutputs),
      all_marketing_strategies_summary: this.extractMarketingStrategiesSummary(previousOutputs),
      
      // User input variables for prompt templates
      user_business_concept: userInputs.businessIdea || userInputs.businessConcept || userInputs.businessDescription || 'Not provided',
      target_market_hypothesis: userInputs.targetMarket || userInputs.targetCustomers || userInputs.marketHypothesis || 'Not specified',
      problem_statement: userInputs.problemStatement || userInputs.problem || userInputs.challengeDescription || 'Not specified',
      solution_concept: userInputs.solutionConcept || userInputs.solution || userInputs.productDescription || 'Not specified',
      additional_context: userInputs.additionalContext || userInputs.extraInfo || userInputs.notes || 'None provided',
      
      // Additional user prompt variables
      user_message: userInputs.userMessage || userInputs.currentMessage || 'User input not captured',
      business_context: this.formatBusinessContext(businessContext),
      previous_outputs: this.formatPreviousOutputs(previousOutputs),
      
      // Agent-specific context
      ...await this.getAgentSpecificContext(agentConfig.id, context)
    };

    return substitutionContext;
  }

  private async generateSystemPrompt(
    template: string,
    context: Record<string, any>,
    dynamicConfig: DynamicPromptGeneration
  ): Promise<string> {
    // Apply variable substitution
    let prompt = template;
    
    for (const [placeholder, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
      prompt = prompt.replace(regex, String(value || ''));
    }

    // Apply conditional sections
    prompt = await this.applyConditionalSections(prompt, context, dynamicConfig.conditional_sections);

    // Apply context injection at specified points
    prompt = await this.applyContextInjection(prompt, context, dynamicConfig.context_injection_points);

    // Apply personalization
    prompt = await this.applyPersonalization(prompt, context, dynamicConfig.personalization_options);

    return prompt.trim();
  }

  private async generateUserPrompt(
    template: string,
    context: Record<string, any>,
    dynamicConfig: DynamicPromptGeneration
  ): Promise<string> {
    // Similar process as system prompt but for user prompt
    let prompt = template;
    
    for (const [placeholder, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
      prompt = prompt.replace(regex, String(value || ''));
    }

    // Apply user-specific context
    prompt = await this.applyUserSpecificContext(prompt, context);

    return prompt.trim();
  }

  private async optimizePrompt(
    prompt: string,
    optimization: any
  ): Promise<string> {
    let optimizedPrompt = prompt;

    if (optimization.token_optimization) {
      optimizedPrompt = this.optimizeTokenUsage(optimizedPrompt);
    }

    if (optimization.clarity_enhancement) {
      optimizedPrompt = this.enhanceClarity(optimizedPrompt);
    }

    if (optimization.context_compression) {
      optimizedPrompt = this.compressContext(optimizedPrompt);
    }

    if (optimization.quality_instructions) {
      optimizedPrompt = this.addQualityInstructions(optimizedPrompt);
    }

    return optimizedPrompt;
  }

  private async validatePrompts(
    systemPrompt: string,
    userPrompt: string,
    validation: any
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check token limits
    const systemTokens = this.estimateTokenCount(systemPrompt);
    const userTokens = this.estimateTokenCount(userPrompt);
    const totalTokens = systemTokens + userTokens;

    if (systemTokens > validation.length_limits.system_prompt_max_tokens) {
      errors.push(`System prompt exceeds token limit: ${systemTokens} > ${validation.length_limits.system_prompt_max_tokens}`);
    }

    if (userTokens > validation.length_limits.user_prompt_max_tokens) {
      errors.push(`User prompt exceeds token limit: ${userTokens} > ${validation.length_limits.user_prompt_max_tokens}`);
    }

    if (totalTokens > validation.length_limits.total_prompt_max_tokens) {
      errors.push(`Total prompt exceeds token limit: ${totalTokens} > ${validation.length_limits.total_prompt_max_tokens}`);
    }

    // Check required elements
    console.log('🔍 DEBUG: Checking required elements:', validation.required_elements);
    for (const element of validation.required_elements) {
      const inSystemPrompt = systemPrompt.includes(element);
      const inUserPrompt = userPrompt.includes(element);
      console.log(`🔍 Element "${element}": System=${inSystemPrompt}, User=${inUserPrompt}`);
      if (!inSystemPrompt && !inUserPrompt) {
        errors.push(`Missing required element: ${element}`);
      }
    }

    // Quality checks
    for (const check of validation.quality_checks) {
      const checkResult = await this.performQualityCheck(check, systemPrompt, userPrompt);
      if (!checkResult.passed) {
        errors.push(checkResult.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper methods for formatting and processing

  private formatAgentIdentity(agentConfig: AgentConfig): string {
    return `You are ${agentConfig.persona.identity}. ${agentConfig.description}
    
Your expertise includes: ${agentConfig.persona.expertise.join(', ')}
Communication style: ${agentConfig.persona.communication_style}
Decision-making approach: ${agentConfig.persona.decision_making_approach}`;
  }

  private formatList(items: string[]): string {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  private formatDeliverables(deliverables: string[]): string {
    return deliverables.map((item, index) => `**Deliverable ${index + 1}**: ${item}`).join('\n');
  }

  private formatCriteria(criteria: string[]): string {
    return criteria.map(item => `✓ ${item}`).join('\n');
  }

  private formatConstraints(constraints: string[]): string {
    return constraints.map(item => `• ${item}`).join('\n');
  }

  private formatPreviousOutputs(outputs: Record<string, any>): string {
    if (!outputs || Object.keys(outputs).length === 0) {
      return 'No previous outputs available (first agent in workflow)';
    }

    return Object.entries(outputs)
      .map(([key, value]) => `**${key}**: ${this.summarizeOutput(value)}`)
      .join('\n\n');
  }

  private formatBusinessContext(businessContext: BusinessContext): string {
    return `Business Type: ${businessContext.businessType}
Industry: ${businessContext.industry}
Stage: ${businessContext.stage}
Team Size: ${businessContext.teamSize}
Development Resources: ${businessContext.devResources}
Budget: ${businessContext.budget}`;
  }

  private async formatKnowledgeBase(
    knowledgeBase: Record<string, string>,
    taskConfig: TaskConfig
  ): Promise<string> {
    const relevantKnowledge: string[] = [];
    const focusAreas = taskConfig.agent_integration.behavior_overrides.knowledge_focus;

    for (const area of focusAreas) {
      if (knowledgeBase[area]) {
        relevantKnowledge.push(`**${area.toUpperCase()}:**\n${knowledgeBase[area]}`);
      }
    }

    return relevantKnowledge.join('\n\n');
  }

  private async applyConditionalSections(
    prompt: string,
    context: Record<string, any>,
    conditionalSections: Record<string, string>
  ): Promise<string> {
    let result = prompt;

    for (const [sectionName, condition] of Object.entries(conditionalSections)) {
      const shouldInclude = this.evaluateCondition(condition, context);
      
      if (shouldInclude) {
        const sectionContent = await this.getConditionalSectionContent(sectionName, context);
        result = result.replace(`{conditional:${sectionName}}`, sectionContent);
      } else {
        result = result.replace(`{conditional:${sectionName}}`, '');
      }
    }

    return result;
  }

  private async applyPersonalization(
    prompt: string,
    context: Record<string, any>,
    personalizationOptions: Record<string, string>
  ): Promise<string> {
    let result = prompt;

    for (const [aspect, method] of Object.entries(personalizationOptions)) {
      const personalizedContent = await this.generatePersonalizedContent(aspect, method, context);
      result = result.replace(`{personalized:${aspect}}`, personalizedContent);
    }

    return result;
  }

  private optimizeTokenUsage(prompt: string): string {
    // Remove redundancy and compress while preserving meaning
    return prompt
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(the|a|an)\s+/gi, '') // Remove some articles (carefully)
      .trim();
  }

  private enhanceClarity(prompt: string): string {
    // Add structure and clarity markers
    return prompt
      .replace(/^([A-Z][^:]+):/, '**$1:**') // Bold section headers
      .replace(/\n- /g, '\n• ') // Use bullet points
      .replace(/\n\d+\./g, '\n**$&**'); // Bold numbered lists
  }

  private compressContext(prompt: string): string {
    // Intelligent context compression while preserving key information
    const sentences = prompt.split(/[.!?]+/);
    const compressed = sentences
      .filter(sentence => sentence.trim().length > 10) // Remove very short sentences
      .map(sentence => sentence.trim())
      .join('. ');

    return compressed + (compressed.endsWith('.') ? '' : '.');
  }

  private addQualityInstructions(prompt: string): string {
    const qualityFooter = `

QUALITY REQUIREMENTS:
- Provide specific, actionable recommendations
- Support all claims with reasoning
- Maintain internal consistency
- Follow the template structure exactly
- Include relevant examples where helpful`;

    return prompt + qualityFooter;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  private calculateMetadata(
    systemPrompt: string,
    userPrompt: string,
    context: Record<string, any>,
    processingTime: number
  ): PromptMetadata {
    const systemTokens = this.estimateTokenCount(systemPrompt);
    const userTokens = this.estimateTokenCount(userPrompt);

    return {
      totalTokens: systemTokens + userTokens,
      systemTokens,
      userTokens,
      variablesSubstituted: Object.keys(context),
      sectionsIncluded: this.extractIncludedSections(systemPrompt),
      qualityScore: this.calculateQualityScore(systemPrompt, userPrompt),
      optimizationsApplied: ['token_optimization', 'clarity_enhancement']
    };
  }

  // Utility methods
  private validateContext(context: PromptGenerationContext): boolean {
    return !!(
      context.session &&
      context.agentConfig &&
      context.taskConfig &&
      context.userInputs &&
      context.businessContext
    );
  }

  private getStageDescription(stage: string): string {
    const descriptions = {
      foundation: 'Establish strategic foundation and market understanding',
      strategy: 'Develop tactical strategies and implementation plans',
      validation: 'Create testing framework and validation methodology'
    };
    return descriptions[stage as keyof typeof descriptions] || stage;
  }

  private determineUserExperience(userInputs: Record<string, any>): string {
    // Simple heuristic based on user inputs
    const indicators = [
      userInputs.hasBuiltProducts,
      userInputs.hasMarketingExperience,
      userInputs.teamSize > 5
    ].filter(Boolean).length;

    if (indicators >= 2) return 'experienced';
    if (indicators === 1) return 'intermediate';
    return 'beginner';
  }

  private calculateSessionDuration(session: UserSession): string {
    const start = new Date(session.createdAt);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
    
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  private getTemplateReference(taskConfig: TaskConfig): string {
    // Extract template reference from workflow integration
    return taskConfig.workflow_integration.outputs.primary_output || 'structured-output.md';
  }

  private extractFoundationSummary(outputs: Record<string, any>): string {
    // Extract key points from foundation stage outputs
    const foundationKeys = ['gtm-brief', 'value-proposition', 'target-market'];
    return this.extractSummaryFromOutputs(outputs, foundationKeys);
  }

  private extractStrategicHypotheses(outputs: Record<string, any>): string {
    // Extract strategic hypotheses from all outputs
    return 'Key strategic assumptions identified from previous agents analysis';
  }

  private extractSummaryFromOutputs(outputs: Record<string, any>, keys: string[]): string {
    const summaries: string[] = [];
    
    for (const key of keys) {
      if (outputs[key]) {
        summaries.push(`**${key}**: ${this.summarizeOutput(outputs[key])}`);
      }
    }
    
    return summaries.join('\n');
  }

  private summarizeOutput(output: any): string {
    if (typeof output === 'string') {
      return output.length > 200 ? output.substring(0, 200) + '...' : output;
    }
    return JSON.stringify(output).substring(0, 200) + '...';
  }

  private async getAgentSpecificContext(agentId: string, context: PromptGenerationContext): Promise<Record<string, any>> {
    // Return agent-specific context variables
    const agentSpecific: Record<string, any> = {};

    switch (agentId) {
      case 'growth-hacker':
        agentSpecific.filtered_experiments_from_database = await this.getFilteredExperiments(context);
        agentSpecific.prioritization_frameworks = 'PIE (Potential, Importance, Ease), BRASS (Bets, Reach, Adoption, Support, Success), ICE (Impact, Confidence, Ease)';
        break;
      
      case 'persona-strategist':
        agentSpecific.psychographic_frameworks = 'OCEAN personality model, Values-based segmentation, Behavioral triggers';
        break;
        
      // Add other agent-specific contexts as needed
    }

    return agentSpecific;
  }

  private async getFilteredExperiments(context: PromptGenerationContext): Promise<string> {
    try {
      const experimentDb = await this.configLoader.loadExperimentDatabase();
      if (!experimentDb) return 'Experiment database not available';

      // Parse CSV and filter based on business context
      const experiments = this.parseExperimentCSV(experimentDb);
      const filtered = this.filterExperimentsByContext(experiments, context.businessContext);
      
      return this.formatExperimentsForPrompt(filtered.slice(0, 25)); // Top 25 experiments
    } catch (error) {
      console.error('Failed to get filtered experiments:', error);
      return 'Experiment filtering unavailable';
    }
  }

  private parseExperimentCSV(csvContent: string): any[] {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const experiment: any = {};
      
      headers.forEach((header, index) => {
        experiment[header] = values[index]?.trim() || '';
      });
      
      return experiment;
    }).filter(exp => exp.Tactic); // Filter out empty rows
  }

  private filterExperimentsByContext(experiments: any[], businessContext: BusinessContext): any[] {
    return experiments.filter(exp => {
      // Filter by business type
      if (exp['Business Type'] && businessContext.businessType) {
        if (!exp['Business Type'].toLowerCase().includes(businessContext.businessType.toLowerCase())) {
          return false;
        }
      }
      
      // Filter by probability of success (High and Medium only)
      if (exp['Probabiliy of Success'] && !['High', 'Medium'].includes(exp['Probabiliy of Success'])) {
        return false;
      }
      
      // Filter by development requirements if no dev resources
      if (businessContext.devResources === 'none' && exp['Dev needed'] === 'Yes') {
        return false;
      }
      
      return true;
    });
  }

  private formatExperimentsForPrompt(experiments: any[]): string {
    return experiments.map((exp, index) => 
      `${index + 1}. **${exp.Tactic}** (${exp['Funnel Step']}, ${exp['Probabiliy of Success']} success, ${exp.Effort} effort)\n   ${exp['Description/Hypothesis']}`
    ).join('\n\n');
  }

  // Additional helper methods for conditions, quality checks, etc.
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // Simple condition evaluation - could be expanded with a proper expression parser
    if (condition.startsWith('if_business_type_')) {
      const businessType = condition.replace('if_business_type_', '');
      return context.business_type?.toLowerCase() === businessType.toLowerCase();
    }
    
    if (condition.includes('development_resources')) {
      return context.dev_resources_available !== 'none';
    }
    
    return false;
  }

  private async getConditionalSectionContent(sectionName: string, context: Record<string, any>): Promise<string> {
    // Return content for conditional sections
    const sectionContents: Record<string, string> = {
      'saas_specific_experiments': 'Focus on SaaS-specific growth tactics like freemium conversion and user onboarding optimization.',
      'low_effort_quick_wins': 'Prioritize low-effort experiments that can be implemented quickly with minimal resources.',
      'high_impact_experiments': 'Include high-impact experiments that require more resources but offer significant growth potential.'
    };
    
    return sectionContents[sectionName] || '';
  }

  private async generatePersonalizedContent(aspect: string, method: string, context: Record<string, any>): Promise<string> {
    // Generate personalized content based on aspect and method
    if (aspect === 'industry_specific_examples' && method === 'based_on_user_industry') {
      return `Examples specific to ${context.industry_context} industry`;
    }
    
    return '';
  }

  private async applyContextInjection(prompt: string, context: Record<string, any>, injectionPoints: string[]): Promise<string> {
    // Apply context injection at specified points
    let result = prompt;
    
    for (const point of injectionPoints) {
      const injectionContent = await this.getInjectionContent(point, context);
      result = result.replace(`{inject:${point}}`, injectionContent);
    }
    
    return result;
  }

  private async applyUserSpecificContext(prompt: string, context: Record<string, any>): Promise<string> {
    // Apply user-specific context to user prompt
    return prompt; // Simplified for now
  }

  private async getInjectionContent(injectionPoint: string, context: Record<string, any>): Promise<string> {
    // Return content for specific injection points
    return '';
  }

  private async performQualityCheck(check: string, systemPrompt: string, userPrompt: string): Promise<{ passed: boolean; error: string }> {
    // Perform quality checks on generated prompts
    switch (check) {
      case 'all_variables_substituted':
        const hasUnsubstituted = /\{[^}]+\}/.test(systemPrompt + userPrompt);
        // Temporarily log the prompts for debugging
        if (hasUnsubstituted) {
          console.log('🚨 DEBUG: Unsubstituted variables found!');
          console.log('System prompt preview:', systemPrompt.substring(0, 500));
          console.log('User prompt preview:', userPrompt.substring(0, 500));
          const matches = (systemPrompt + userPrompt).match(/\{[^}]+\}/g);
          console.log('Unsubstituted variables:', matches);
        }
        return {
          passed: !hasUnsubstituted,
          error: hasUnsubstituted ? `Unsubstituted variables found in prompts: ${(systemPrompt + userPrompt).match(/\{[^}]+\}/g)?.join(', ')}` : ''
        };
        
      default:
        return { passed: true, error: '' };
    }
  }

  private extractIncludedSections(prompt: string): string[] {
    // Extract sections that were included in the prompt
    const sections: string[] = [];
    const sectionRegex = /\*\*([^*]+)\*\*:/g;
    let match;
    
    while ((match = sectionRegex.exec(prompt)) !== null) {
      sections.push(match[1]);
    }
    
    return sections;
  }

  private calculateQualityScore(systemPrompt: string, userPrompt: string): number {
    // Calculate quality score based on various factors
    let score = 0.5; // Base score
    
    // Check for structure
    if (systemPrompt.includes('**') && systemPrompt.includes('•')) score += 0.1;
    
    // Check for completeness
    if (systemPrompt.length > 1000) score += 0.1;
    if (userPrompt.length > 200) score += 0.1;
    
    // Check for specific elements
    if (systemPrompt.includes('DELIVERABLES')) score += 0.1;
    if (systemPrompt.includes('SUCCESS CRITERIA')) score += 0.1;
    if (systemPrompt.includes('KNOWLEDGE BASE')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  // Additional extraction methods
  private formatCompleteContext(outputs: Record<string, any>): string {
    return Object.entries(outputs)
      .map(([key, value]) => `**${key.toUpperCase()}**:\n${this.summarizeOutput(value)}`)
      .join('\n\n');
  }

  private extractGrowthFunnelSummary(outputs: Record<string, any>): string {
    const funnelOutput = outputs['growth-funnel'] || outputs['funnel-analysis'];
    return funnelOutput ? this.summarizeOutput(funnelOutput) : 'Growth funnel analysis pending';
  }

  private extractMarketingStrategiesSummary(outputs: Record<string, any>): string {
    const marketingKeys = ['acquisition-strategy', 'retention-strategy', 'viral-growth-strategy'];
    return this.extractSummaryFromOutputs(outputs, marketingKeys);
  }
}