/**
 * Configuration loader for agents, workflows, templates, and tasks
 * Loads YAML configurations from KV store and provides caching
 */

import { parse as parseYAML } from 'yaml';
import {
  AgentConfig,
  WorkflowConfig,
  TaskConfig,
  RuntimeConfig,
} from '../types';

export class ConfigLoader {
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

  constructor(private kvStore: KVNamespace) {}

  async loadAgentConfig(agentId: string): Promise<AgentConfig | null> {
    const cacheKey = `agent:${agentId}`;

    // Check cache first
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const yamlContent = await this.kvStore.get(`agents/${agentId}.yaml`);
      if (!yamlContent) {
        console.warn(`Agent config not found: ${agentId}`);
        return null;
      }

      const rawConfig = parseYAML(yamlContent) as any;

      // Handle nested agent structure - flatten it for validation
      const config: AgentConfig = {
        id: rawConfig.agent?.id || rawConfig.id,
        name: rawConfig.agent?.name || rawConfig.name,
        version: rawConfig.agent?.version || rawConfig.version,
        description: rawConfig.agent?.description || rawConfig.description,
        persona: {
          identity: rawConfig.persona?.identity || '',
          expertise: rawConfig.persona?.expertise || rawConfig.persona?.personality_traits || [],
          communication_style:
            rawConfig.persona?.behavioral_guidelines?.communication_style ||
            rawConfig.persona?.communication_style ||
            'professional',
          decision_making_approach:
            rawConfig.persona?.behavioral_guidelines?.decision_making ||
            rawConfig.persona?.decision_making_approach ||
            'systematic',
        },
        capabilities: {
          core_competencies: rawConfig.persona?.core_principles || [],
          tools_available: rawConfig.tools?.available || [],
          knowledge_domains: Object.values(
            rawConfig.knowledge_domains || {}
          ).flat() as string[],
          output_formats: rawConfig.tools?.templates
            ? Object.keys(rawConfig.tools.templates)
            : [],
        },
        configuration: {
          model: rawConfig.claude_config?.model || rawConfig.configuration?.model || 'claude-3-haiku-20240307',
          temperature: rawConfig.claude_config?.temperature || rawConfig.configuration?.temperature || 0.7,
          max_tokens: rawConfig.claude_config?.max_tokens || rawConfig.configuration?.max_tokens || 4000,
          timeout: rawConfig.configuration?.timeout || 120000,
          retry_attempts: rawConfig.configuration?.retry_attempts || 3
        },
        workflow_integration: {
          workflow_position: rawConfig.workflow?.sequence_order || 1,
          stage: (rawConfig.workflow?.stage || 'foundation') as 'foundation' | 'strategy' | 'validation',
          dependencies: rawConfig.workflow?.inputs?.required || [],
          handoff_requirements: rawConfig.workflow?.outputs?.required || [],
        },
      };

      // Validate config structure
      if (!this.validateAgentConfig(config)) {
        console.error(`Invalid agent config: ${agentId}`);
        console.error('Config structure:', JSON.stringify(config, null, 2));
        return null;
      }

      // Cache the config
      this.setCache(cacheKey, config);

      return config;
    } catch (error) {
      console.error(`Failed to load agent config ${agentId}:`, error);
      return null;
    }
  }

  async loadWorkflowConfig(workflowId: string): Promise<WorkflowConfig | null> {
    const cacheKey = `workflow:${workflowId}`;

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const yamlContent = await this.kvStore.get(
        `workflows/${workflowId}.yaml`
      );
      if (!yamlContent) {
        console.warn(`Workflow config not found: ${workflowId}`);
        return null;
      }

      const rawConfig = parseYAML(yamlContent) as any;

      // Handle nested workflow structure - flatten it for validation
      const config: WorkflowConfig = {
        id: rawConfig.workflow?.id || rawConfig.id,
        name: rawConfig.workflow?.name || rawConfig.name,
        version: rawConfig.workflow?.version || rawConfig.version,
        description: rawConfig.workflow?.description || rawConfig.description,
        type: rawConfig.workflow?.type || rawConfig.type,
        category: rawConfig.workflow?.category || rawConfig.category,
        execution: rawConfig.execution,
        sequence: rawConfig.sequence,
      };

      if (!this.validateWorkflowConfig(config)) {
        console.error(`Invalid workflow config: ${workflowId}`);
        console.error('Config structure:', JSON.stringify(config, null, 2));
        return null;
      }

      this.setCache(cacheKey, config);
      return config;
    } catch (error) {
      console.error(`Failed to load workflow config ${workflowId}:`, error);
      return null;
    }
  }


  async loadTaskConfig(
    taskId: string,
    taskPath?: string
  ): Promise<TaskConfig | null> {
    const cacheKey = `task:${taskId}`;

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const path = taskPath || `tasks/agent-tasks/${taskId}.yaml`;
      const yamlContent = await this.kvStore.get(path);

      if (!yamlContent) {
        console.warn(`Task config not found: ${taskId} at ${path}`);
        return null;
      }

      const config = parseYAML(yamlContent) as TaskConfig;

      if (!this.validateTaskConfig(config)) {
        console.error(`Invalid task config: ${taskId}`);
        return null;
      }

      this.setCache(cacheKey, config);
      return config;
    } catch (error) {
      console.error(`Failed to load task config ${taskId}:`, error);
      return null;
    }
  }

  async loadRuntimeConfig(): Promise<RuntimeConfig | null> {
    const cacheKey = 'runtime-config';

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const yamlContent = await this.kvStore.get('config/runtime-config.yaml');
      if (!yamlContent) {
        console.warn('Runtime config not found');
        return null;
      }

      const config = parseYAML(yamlContent) as RuntimeConfig;

      this.setCache(cacheKey, config);
      return config;
    } catch (error) {
      console.error('Failed to load runtime config:', error);
      return null;
    }
  }

  async loadKnowledgeBase(knowledgePath: string): Promise<string | null> {
    const cacheKey = `knowledge:${knowledgePath}`;

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const content = await this.kvStore.get(`knowledge-base/${knowledgePath}`);
      if (!content) {
        console.warn(`Knowledge base file not found: ${knowledgePath}`);
        return null;
      }

      this.setCache(cacheKey, content);
      return content;
    } catch (error) {
      console.error(`Failed to load knowledge base ${knowledgePath}:`, error);
      return null;
    }
  }

  async loadExperimentDatabase(): Promise<string | null> {
    const cacheKey = 'experiment-database';

    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const csvContent = await this.kvStore.get(
        'knowledge-base/experiments/master-experiments.csv'
      );
      if (!csvContent) {
        console.warn('Experiment database not found');
        return null;
      }

      this.setCache(cacheKey, csvContent);
      return csvContent;
    } catch (error) {
      console.error('Failed to load experiment database:', error);
      return null;
    }
  }

  // Cache management
  private isValidCache(key: string): boolean {
    if (!this.cache.has(key) || !this.cacheExpiry.has(key)) {
      return false;
    }

    const expiry = this.cacheExpiry.get(key)!;
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }

    return true;
  }

  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  public clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // Validation methods
  private validateAgentConfig(config: any): config is AgentConfig {
    return (
      config &&
      typeof config.id === 'string' &&
      typeof config.name === 'string' &&
      typeof config.version === 'string' &&
      config.persona &&
      config.capabilities &&
      config.configuration
    );
  }

  private validateWorkflowConfig(config: any): config is WorkflowConfig {
    return (
      config &&
      typeof config.id === 'string' &&
      typeof config.name === 'string' &&
      typeof config.version === 'string' &&
      config.execution &&
      Array.isArray(config.sequence) &&
      config.sequence.length > 0
    );
  }


  private validateTaskConfig(config: any): config is TaskConfig {
    return (
      config &&
      config.task &&
      typeof config.task.id === 'string' &&
      typeof config.task.name === 'string' &&
      typeof config.task.version === 'string' &&
      config.task_specification &&
      config.agent_integration &&
      config.workflow_integration
    );
  }

  // Utility methods
  async listAgents(): Promise<string[]> {
    try {
      // This would need to be implemented based on KV listing capabilities
      // For now, return known agents
      return [
        'gtm-consultant',
        'persona-strategist',
        'product-manager',
        'growth-manager',
        'head-of-acquisition',
        'head-of-retention',
        'viral-growth-architect',
        'growth-hacker',
      ];
    } catch (error) {
      console.error('Failed to list agents:', error);
      return [];
    }
  }

  async preloadConfigs(): Promise<void> {
    try {
      // Preload commonly used configurations
      await Promise.all([
        this.loadRuntimeConfig(),
        this.loadWorkflowConfig('master-workflow-v2'),
        ...(await this.listAgents().then((agents) =>
          agents.map((agentId) => this.loadAgentConfig(agentId))
        )),
      ]);

      console.log('Configurations preloaded successfully');
    } catch (error) {
      console.error('Failed to preload configurations:', error);
    }
  }
}
