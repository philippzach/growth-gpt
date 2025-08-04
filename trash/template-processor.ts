/**
 * Template Processor - Applies structured templates to agent outputs
 * Converts raw agent content into formatted, structured deliverables
 */

import { parse as parseYAML } from 'yaml';
import {
  TemplateConfig,
  TemplateSection,
  VariableDefinitions,
  PromptGenerationContext,
} from '../types';
import { ConfigLoader } from './config-loader';

export interface TemplateProcessingResult {
  content: string;
  templateId: string;
  variables: Record<string, any>;
  structure: TemplateStructure;
  formatOptions: FormatOptions;
}

export interface TemplateStructure {
  sections: ProcessedSection[];
  metadata: TemplateMetadata;
}

export interface ProcessedSection {
  id: string;
  title: string;
  content: string;
  variables: Record<string, any>;
  conditional: boolean;
  included: boolean;
}

export interface TemplateMetadata {
  templateId: string;
  templateVersion: string;
  processingDate: string;
  variablesUsed: string[];
  sectionsIncluded: string[];
  contentLength: number;
}

export interface FormatOptions {
  primaryFormat: string;
  supportedFormats: string[];
  exportOptions: Record<string, any>;
}

export class TemplateProcessor {
  private configLoader: ConfigLoader;
  private templateCache = new Map<string, TemplateConfig>();

  constructor(kvStore: KVNamespace) {
    this.configLoader = new ConfigLoader(kvStore);
  }

  async processTemplate(
    templateId: string,
    agentContent: string,
    context: PromptGenerationContext
  ): Promise<TemplateProcessingResult> {
    try {
      // Load template configuration
      const templateConfigRaw = await this.loadTemplateConfig(templateId);
      if (!templateConfigRaw) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Cast to any to handle dynamic YAML structure
      const templateConfig = templateConfigRaw as any;

      // Extract variables from agent content and context
      const extractedVariables = await this.extractVariables(
        agentContent,
        templateConfig,
        context
      );

      // Process template sections
      const sections =
        templateConfig.sections ||
        templateConfig.template_structure?.sections ||
        [];
      const processedSections = await this.processSections(
        sections,
        extractedVariables,
        agentContent
      );

      // Generate final content
      const finalContent = this.generateFinalContent(
        processedSections,
        templateConfig
      );

      // Prepare structure and metadata
      const structure = this.buildTemplateStructure(
        processedSections,
        templateConfig,
        extractedVariables
      );

      const formatOptions = this.prepareFormatOptions(templateConfig);

      return {
        content: finalContent,
        templateId,
        variables: extractedVariables,
        structure,
        formatOptions,
      };
    } catch (error) {
      console.error('Template processing error:', error);

      // Return fallback result
      return {
        content: agentContent, // Use raw content as fallback
        templateId: templateId,
        variables: {},
        structure: this.createFallbackStructure(agentContent, templateId),
        formatOptions: this.createDefaultFormatOptions(),
      };
    }
  }

  private async loadTemplateConfig(
    templateId: string
  ): Promise<TemplateConfig | null> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    // Load from config store
    const config = await this.configLoader.loadTemplateConfig(templateId);
    if (config) {
      this.templateCache.set(templateId, config);
    }

    return config;
  }

  private collectVariableDefinitions(templateConfig: any): Record<string, any> {
    const variableDefinitions: Record<string, any> = {};

    // Handle the actual YAML structure which may not match TypeScript types exactly
    const sections =
      templateConfig.sections ||
      templateConfig.template_structure?.sections ||
      [];

    for (const section of sections) {
      if (section.variables && Array.isArray(section.variables)) {
        for (const variable of section.variables) {
          // Handle both object format and string format
          if (typeof variable === 'object' && variable.variable_name) {
            variableDefinitions[variable.variable_name] = {
              type: variable.data_type || 'string',
              required: variable.required || false,
              description: variable.description || '',
              default_value: variable.default_value,
              examples: variable.examples,
              validation_rules: variable.validation_rules,
            };
          } else if (typeof variable === 'string') {
            variableDefinitions[variable] = {
              type: 'string',
              required: false,
              description: '',
            };
          }
        }
      }

      // Also collect from subsections
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          if (subsection.variables && Array.isArray(subsection.variables)) {
            for (const variable of subsection.variables) {
              if (typeof variable === 'object' && variable.variable_name) {
                variableDefinitions[variable.variable_name] = {
                  type: variable.data_type || 'string',
                  required: variable.required || false,
                  description: variable.description || '',
                  default_value: variable.default_value,
                  examples: variable.examples,
                  validation_rules: variable.validation_rules,
                };
              } else if (typeof variable === 'string') {
                variableDefinitions[variable] = {
                  type: 'string',
                  required: false,
                  description: '',
                };
              }
            }
          }
        }
      }
    }

    return variableDefinitions;
  }

  private async extractVariables(
    agentContent: string,
    templateConfig: any,
    context: PromptGenerationContext
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    // Extract all variables from template sections
    const allVariableDefinitions =
      this.collectVariableDefinitions(templateConfig);

    // Extract agent-generated variables
    const agentVars = await this.extractAgentVariables(
      agentContent,
      allVariableDefinitions
    );
    Object.assign(variables, agentVars);

    // Add user-provided variables
    const userVars = this.extractUserVariables(context, allVariableDefinitions);
    Object.assign(variables, userVars);

    // Add system-generated variables
    const systemVars = this.generateSystemVariables(
      context,
      templateConfig.variables?.global_variables || {}
    );
    Object.assign(variables, systemVars);

    // Calculate computed variables (if any defined)
    const computedVariableDefinitions =
      templateConfig.variables?.computed_variables || {};
    if (Object.keys(computedVariableDefinitions).length > 0) {
      const computedVars = await this.calculateComputedVariables(
        variables,
        computedVariableDefinitions
      );
      Object.assign(variables, computedVars);
    }

    return variables;
  }

  private async extractAgentVariables(
    content: string,
    agentVariableDefinitions: Record<string, any>
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    for (const [varName, definition] of Object.entries(
      agentVariableDefinitions
    )) {
      const extractedValue = await this.extractVariableFromContent(
        content,
        varName,
        definition
      );

      if (extractedValue !== null) {
        variables[varName] = extractedValue;
      } else if (definition.required && definition.default_value) {
        variables[varName] = definition.default_value;
      }
    }

    return variables;
  }

  private async extractVariableFromContent(
    content: string,
    varName: string,
    definition: any
  ): Promise<any> {
    // Use pattern matching and AI extraction to find variables in content
    const patterns = this.getExtractionPatterns(varName, definition);

    for (const pattern of patterns) {
      if (typeof content !== 'string') continue;
      const match = content.match(pattern.regex);
      if (match) {
        return this.processExtractedValue(
          match[1] || match[0],
          definition.type
        );
      }
    }

    // If no pattern match, try semantic extraction
    return await this.semanticExtraction(content, varName, definition);
  }

  private getExtractionPatterns(
    varName: string,
    definition: any
  ): Array<{ regex: RegExp; description: string }> {
    const patterns: Array<{ regex: RegExp; description: string }> = [];

    // Common patterns based on variable name
    if (varName.includes('value_proposition')) {
      patterns.push({
        regex: /(?:value proposition|unique selling point)[:\s]+([^.\n]+)/i,
        description: 'Value proposition extraction',
      });
    }

    if (varName.includes('target_market')) {
      patterns.push({
        regex: /(?:target market|target audience)[:\s]+([^.\n]+)/i,
        description: 'Target market extraction',
      });
    }

    if (varName.includes('problem_statement')) {
      patterns.push({
        regex: /(?:problem|challenge|pain point)[:\s]+([^.\n]+)/i,
        description: 'Problem statement extraction',
      });
    }

    if (varName.includes('solution')) {
      patterns.push({
        regex: /(?:solution|approach|methodology)[:\s]+([^.\n]+)/i,
        description: 'Solution extraction',
      });
    }

    // Generic patterns based on formatting
    patterns.push({
      regex: new RegExp(
        `\\*\\*${varName.replace(/_/g, '\\s*')}\\*\\*[:\\s]+([^\\n]+)`,
        'i'
      ),
      description: 'Bold header pattern',
    });

    patterns.push({
      regex: new RegExp(
        `${varName.replace(/_/g, '\\s+')}[:\\s]+([^\\n]+)`,
        'i'
      ),
      description: 'Label pattern',
    });

    return patterns;
  }

  private processExtractedValue(value: string, type: string): any {
    const cleanValue = value.trim();

    switch (type) {
      case 'string':
        return cleanValue;

      case 'number':
        const num = parseFloat(cleanValue);
        return isNaN(num) ? 0 : num;

      case 'array':
        if (typeof cleanValue !== 'string') return [];
        return cleanValue.split(/[,;]\s*/).map((item) => item.trim());

      case 'boolean':
        return /^(true|yes|1)$/i.test(cleanValue);

      case 'object':
        try {
          return JSON.parse(cleanValue);
        } catch {
          return { value: cleanValue };
        }

      default:
        return cleanValue;
    }
  }

  private async semanticExtraction(
    content: string,
    varName: string,
    definition: any
  ): Promise<any> {
    // Semantic extraction using content analysis
    // This is a simplified version - in production, might use embeddings or NLP

    const contentSections = content.split(/\n\s*\n/);
    const keywords = this.getVariableKeywords(varName);

    for (const section of contentSections) {
      const sectionLower = section.toLowerCase();

      if (keywords.some((keyword) => sectionLower.includes(keyword))) {
        // Found relevant section, extract value
        const sentences = section.split(/[.!?]+/);
        const relevantSentence = sentences.find((sentence) =>
          keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
        );

        if (relevantSentence) {
          return this.processExtractedValue(
            relevantSentence.trim(),
            definition.type
          );
        }
      }
    }

    return null;
  }

  private getVariableKeywords(varName: string): string[] {
    if (typeof varName !== 'string') return [];
    const baseKeywords = varName.split('_').filter((word) => word.length > 2);

    const keywordMap: Record<string, string[]> = {
      value: ['value', 'benefit', 'advantage'],
      proposition: ['proposition', 'promise', 'offering'],
      target: ['target', 'audience', 'customer'],
      market: ['market', 'segment', 'demographic'],
      problem: ['problem', 'challenge', 'pain', 'issue'],
      solution: ['solution', 'fix', 'resolve', 'address'],
      strategy: ['strategy', 'plan', 'approach', 'method'],
      goal: ['goal', 'objective', 'target', 'aim'],
      metric: ['metric', 'measure', 'kpi', 'indicator'],
    };

    const expandedKeywords: string[] = [];

    for (const keyword of baseKeywords) {
      expandedKeywords.push(keyword);
      if (keywordMap[keyword]) {
        expandedKeywords.push(...keywordMap[keyword]);
      }
    }

    return expandedKeywords;
  }

  private extractUserVariables(
    context: PromptGenerationContext,
    userVariableDefinitions: Record<string, any>
  ): Record<string, any> {
    const variables: Record<string, any> = {};

    for (const [varName, definition] of Object.entries(
      userVariableDefinitions
    )) {
      const value = this.findUserVariable(varName, context);

      if (value !== null) {
        variables[varName] = value;
      } else if (definition.default_value) {
        variables[varName] = definition.default_value;
      }
    }

    return variables;
  }

  private findUserVariable(
    varName: string,
    context: PromptGenerationContext
  ): any {
    // Check various context sources for user variables
    const sources = [
      context.userInputs,
      context.session.userInputs,
      context.businessContext,
    ];

    for (const source of sources) {
      if (source && source[varName] !== undefined) {
        return source[varName];
      }

      // Try variations of the variable name
      const variations = [
        varName.replace(/_/g, ''),
        varName.replace(/_/g, '-'),
        varName.charAt(0).toUpperCase() + varName.slice(1),
        varName.toLowerCase(),
      ];

      for (const variation of variations) {
        if (source && source[variation] !== undefined) {
          return source[variation];
        }
      }
    }

    return null;
  }

  private generateSystemVariables(
    context: PromptGenerationContext,
    systemVariableDefinitions: Record<string, any>
  ): Record<string, any> {
    const variables: Record<string, any> = {};
    const now = new Date();

    // Standard system variables
    const systemVars: Record<string, any> = {
      session_date: now.toLocaleDateString(),
      session_time: now.toLocaleTimeString(),
      session_id: context.session.id,
      user_id: context.session.userId,
      agent_name: context.agentConfig.name,
      agent_role: context.agentConfig.persona.identity,
      workflow_stage: context.taskConfig.workflow_integration.workflow_stage,
      step_number: context.session.currentStep + 1,
      total_steps: context.session.progress.totalSteps,
      project_name: context.userInputs.projectName || 'Your Project',
    };

    // Extract requested system variables
    for (const [varName, definition] of Object.entries(
      systemVariableDefinitions
    )) {
      if (systemVars[varName] !== undefined) {
        variables[varName] = systemVars[varName];
      } else if (definition.default_value) {
        variables[varName] = definition.default_value;
      }
    }

    return variables;
  }

  private async calculateComputedVariables(
    variables: Record<string, any>,
    computedVariableDefinitions: Record<string, any>
  ): Promise<Record<string, any>> {
    const computedVars: Record<string, any> = {};

    for (const [varName, definition] of Object.entries(
      computedVariableDefinitions
    )) {
      try {
        const value = await this.evaluateComputation(
          definition.computation,
          variables,
          definition.dependencies
        );

        if (value !== null) {
          computedVars[varName] = value;
        }
      } catch (error) {
        console.warn(`Failed to compute variable ${varName}:`, error);
      }
    }

    return computedVars;
  }

  private async evaluateComputation(
    computation: string,
    variables: Record<string, any>,
    dependencies: string[]
  ): Promise<any> {
    // Simple computation evaluation
    // In production, use a proper expression parser/evaluator

    // Check if all dependencies are available
    for (const dep of dependencies) {
      if (variables[dep] === undefined) {
        return null;
      }
    }

    // Handle common computations
    if (typeof computation === 'string' && computation.includes('concat')) {
      if (!Array.isArray(dependencies)) return '';
      const parts = dependencies.map((dep) => variables[dep] || '');
      return parts.join(' ');
    }

    if (typeof computation === 'string' && computation.includes('count')) {
      if (!Array.isArray(dependencies) || dependencies.length === 0) return 0;
      const arrayVar = variables[dependencies[0]];
      return Array.isArray(arrayVar) ? arrayVar.length : 0;
    }

    if (typeof computation === 'string' && computation.includes('sum')) {
      if (!Array.isArray(dependencies)) return 0;
      return dependencies.reduce((sum, dep) => {
        const value = parseFloat(variables[dep]) || 0;
        return sum + value;
      }, 0);
    }

    return null;
  }

  private async processSections(
    sections: TemplateSection[],
    variables: Record<string, any>,
    agentContent: string
  ): Promise<ProcessedSection[]> {
    const processedSections: ProcessedSection[] = [];

    for (const section of sections) {
      const processedSection = await this.processSection(
        section,
        variables,
        agentContent
      );
      processedSections.push(processedSection);
    }

    return processedSections;
  }

  private async processSection(
    section: TemplateSection,
    variables: Record<string, any>,
    agentContent: string
  ): Promise<ProcessedSection> {
    // Check if section should be included
    const shouldInclude = this.evaluateSectionCondition(section, variables);

    let processedContent = '';

    if (shouldInclude) {
      // Apply variable substitution to content template
      const sectionAny = section as any;
      const template = sectionAny.content_template || sectionAny.content || '';
      processedContent = await this.applyVariableSubstitution(
        template,
        variables
      );

      // If content is not found in variables, extract from agent content
      if (
        !processedContent ||
        (typeof processedContent === 'string' && processedContent.includes('{'))
      ) {
        const extractedContent = await this.extractSectionContent(
          section,
          agentContent,
          variables
        );

        if (extractedContent) {
          processedContent = extractedContent;
        }
      }
    }

    return {
      id: section.id,
      title: section.title,
      content: processedContent,
      variables: this.extractSectionVariables(section, variables),
      conditional: section.conditional,
      included: shouldInclude,
    };
  }

  private evaluateSectionCondition(
    section: any,
    variables: Record<string, any>
  ): boolean {
    if (!section.conditional) {
      return true;
    }

    // Simple condition evaluation
    // Check if required variables are present
    const sectionVariables = section.variables || [];
    if (Array.isArray(sectionVariables)) {
      for (const variable of sectionVariables) {
        const varName =
          typeof variable === 'string' ? variable : variable?.variable_name;
        if (section.required && varName && !variables[varName]) {
          return false;
        }
      }
    }

    return true;
  }

  private async applyVariableSubstitution(
    template: string | undefined,
    variables: Record<string, any>
  ): Promise<string> {
    if (!template || typeof template !== 'string') {
      return '';
    }

    let result = template;

    // Replace variable placeholders
    for (const [varName, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value || ''));
    }

    return result;
  }

  private async extractSectionContent(
    section: TemplateSection,
    agentContent: string,
    variables: Record<string, any>
  ): Promise<string> {
    // Extract content for this section from agent output
    const sectionData = section as any;
    const sectionKeywords = [
      sectionData.title?.toLowerCase?.() || '',
      sectionData.id?.toLowerCase?.() || '',
      sectionData.section_id?.toLowerCase?.() || '',
      ...(sectionData.variables || []).filter(
        (v: any) => typeof v === 'string'
      ),
    ].filter((keyword) => keyword.length > 0);

    const contentSections = agentContent.split(/(?=^#+\s)/m);

    for (const contentSection of contentSections) {
      const sectionLower = contentSection.toLowerCase();

      if (sectionKeywords.some((keyword) => sectionLower.includes(keyword))) {
        // Clean up the content
        return contentSection
          .replace(/^#+\s*/, '') // Remove header markers
          .trim();
      }
    }

    // Fallback: use template with available variables
    const sectionAny = section as any;
    const template = sectionAny.content_template || sectionAny.content || '';
    return await this.applyVariableSubstitution(template, variables);
  }

  private extractSectionVariables(
    section: any,
    allVariables: Record<string, any>
  ): Record<string, any> {
    const sectionVars: Record<string, any> = {};

    // Safely handle variables array - could be array of strings or objects
    const variables = section.variables || [];
    if (Array.isArray(variables)) {
      for (const variable of variables) {
        // Handle both string variable names and variable objects
        const varName =
          typeof variable === 'string' ? variable : variable?.variable_name;
        if (varName && allVariables[varName] !== undefined) {
          sectionVars[varName] = allVariables[varName];
        }
      }
    }

    return sectionVars;
  }

  private generateFinalContent(
    sections: ProcessedSection[],
    templateConfig: any
  ): string {
    const contentParts: string[] = [];

    // Add document header if configured
    const hasHeaders =
      templateConfig.template_structure?.formatting?.headers ||
      templateConfig.formatting?.headers ||
      true; // Default to true

    if (hasHeaders) {
      const headerSection = sections.find(
        (s) =>
          s.id === 'header' ||
          (s.title && s.title.toLowerCase().includes('title'))
      );
      if (headerSection && headerSection.included) {
        contentParts.push(`# ${headerSection.content}\n`);
      }
    }

    // Process all sections
    for (const section of sections.filter(
      (s) => s.included && s.id !== 'header'
    )) {
      if (section.content) {
        // Add section header
        const sectionTitle = section.title || section.id || 'Section';
        contentParts.push(`## ${sectionTitle}\n`);

        // Add section content
        contentParts.push(section.content);
        contentParts.push(''); // Empty line for spacing
      }
    }

    return contentParts.join('\n').trim();
  }

  private buildTemplateStructure(
    sections: ProcessedSection[],
    templateConfig: any,
    variables: Record<string, any>
  ): TemplateStructure {
    return {
      sections,
      metadata: {
        templateId:
          templateConfig.id || templateConfig.template?.id || 'unknown',
        templateVersion:
          templateConfig.version || templateConfig.template?.version || '1.0',
        processingDate: new Date().toISOString(),
        variablesUsed: Object.keys(variables),
        sectionsIncluded: sections.filter((s) => s.included).map((s) => s.id),
        contentLength: sections.reduce(
          (total, s) => total + s.content.length,
          0
        ),
      },
    };
  }

  private prepareFormatOptions(templateConfig: any): FormatOptions {
    const outputFormats =
      templateConfig.output_formats || templateConfig.output || {};
    return {
      primaryFormat:
        outputFormats.primary_format || outputFormats.format || 'markdown',
      supportedFormats: outputFormats.supported_formats ||
        outputFormats.secondary_formats || ['markdown', 'html', 'pdf'],
      exportOptions:
        outputFormats.format_specific_config ||
        outputFormats.exportOptions ||
        {},
    };
  }

  private createFallbackStructure(
    content: string,
    templateId: string
  ): TemplateStructure {
    return {
      sections: [
        {
          id: 'fallback',
          title: 'Content',
          content,
          variables: {},
          conditional: false,
          included: true,
        },
      ],
      metadata: {
        templateId,
        templateVersion: '1.0',
        processingDate: new Date().toISOString(),
        variablesUsed: [],
        sectionsIncluded: ['fallback'],
        contentLength: content.length,
      },
    };
  }

  private createDefaultFormatOptions(): FormatOptions {
    return {
      primaryFormat: 'markdown',
      supportedFormats: ['markdown', 'html', 'pdf'],
      exportOptions: {},
    };
  }

  // Utility methods
  async validateTemplate(
    templateId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const config = await this.loadTemplateConfig(templateId);
      if (!config) {
        return { valid: false, errors: [`Template ${templateId} not found`] };
      }

      const errors: string[] = [];

      // Validate structure
      if (!config.template_structure || !config.template_structure.sections) {
        errors.push('Template structure is missing or invalid');
      }

      // Validate variables
      if (!config.variable_definitions) {
        errors.push('Variable definitions are missing');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return {
        valid: false,
        errors: [
          `Template validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  clearCache(): void {
    this.templateCache.clear();
  }
}
