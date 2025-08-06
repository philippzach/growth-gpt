/**
 * Enhanced Config Loader - Handles unified JSON configuration structure
 * Supports both legacy and unified configuration formats
 */

import { AgentConfig, WorkflowConfig, TaskConfig } from '../types';

// Interface for runtime configuration structure
interface RuntimeConfig {
  config_version: string;
  description: string;
  paths: {
    agents_path: string;
    workflows_path: string;
    templates_path: string;
    tasks_path: string;
    knowledge_base_path: string;
    file_patterns: {
      agent_configs: string;
      workflow_configs: string;
      template_configs: string;
      task_configs: string;
      knowledge_files: string;
    };
  };
  api: {
    primary_provider: {
      name: string;
      base_url: string;
      model: string;
      api_key_env_var: string;
    };
    default_parameters: {
      temperature: number;
      max_tokens: number;
      top_p: number;
      timeout: number;
    };
    rate_limiting: {
      requests_per_minute: number;
      tokens_per_minute: number;
      burst_allowance: number;
    };
    retry_config: {
      max_retries: number;
      base_delay: number;
      max_delay: number;
      backoff_factor: number;
      retry_on_status: number[];
    };
  };
  agents: {
    execution_defaults: {
      timeout: number;
      memory_limit: string;
      retry_attempts: number;
    };
    agent_overrides: Record<string, {
      timeout?: number;
      temperature?: number;
      max_tokens?: number;
    }>;
  };
  workflows: {
    execution: {
      default_mode: string;
      checkpoint_enabled: boolean;
      resume_capability: boolean;
    };
    quality_gates: {
      enabled: boolean;
      enforcement_level: string;
      auto_retry_on_failure: boolean;
      max_retry_attempts: number;
    };
  };
  knowledge_base: {
    injection: {
      auto_injection_enabled: boolean;
      relevance_threshold: number;
      max_tokens_per_injection: number;
    };
    sources: {
      primary_sources: string[];
      secondary_sources: string[];
      dynamic_sources: string[];
    };
  };
  performance: {
    resource_limits: {
      max_memory_usage: string;
      max_cpu_usage: string;
      max_execution_time: number;
    };
    caching: {
      global_cache_enabled: boolean;
      cache_backend: string;
    };
  };
  logging: {
    log_config: {
      level: string;
      format: string;
      retention_days: number;
    };
    categories: Record<string, boolean>;
  };
  features: {
    experimental: Record<string, boolean>;
    beta: Record<string, boolean>;
    stable: Record<string, boolean>;
  };
}

// Interface for unified configuration structure
interface UnifiedAgentConfig {
  agent_identity: {
    id: string;
    name: string;
    title: string;
    version: string;
    icon: string;
    persona: {
      identity: string;
      role: string;
      expertise: string[];
      communication_style: string;
      personality_traits: string[];
    };
  };
  capabilities_constraints: {
    capabilities: {
      core_competencies: string[];
      analytical_abilities?: string[];
      output_capabilities?: string[];
    };
  };
  static_knowledge: {
    knowledge_files?: {
      primary: string[];
      secondary?: string[];
    };
  };
  task_specification: {
    primary_objective: string;
    deliverables: any;
  };
  output_specifications: {
    required_sections: Record<string, any>;
  };
  workflow_integration: {
    stage: string;
    sequence_order: number;
  };
  claude_config?: {
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
  };
  metadata?: any;
}

export class ConfigLoader {
  constructor(private kvNamespace: KVNamespace) {}

  /**
   * Load unified agent configuration from KV store
   * Handles the new unified JSON structure that combines agent + task specs
   */
  async loadUnifiedAgentConfig(agentId: string): Promise<UnifiedAgentConfig | null> {
    try {
      // Try loading unified config first
      const unifiedPath = `agents/${agentId}-unified.json`;
      console.log(`Loading unified agent config from: ${unifiedPath}`);
      
      const jsonContent = await this.kvNamespace.get(unifiedPath);
      if (!jsonContent) {
        console.warn(`Unified config not found at ${unifiedPath}`);
        return null;
      }

      const config = JSON.parse(jsonContent) as any;
      
      // Validate unified config structure
      if (!config.agent_identity || !config.capabilities_constraints || !config.task_specification) {
        throw new Error('Invalid unified configuration structure - missing required sections');
      }

      console.log(`Successfully loaded unified config for ${agentId}:`, {
        id: config.agent_identity.id,
        name: config.agent_identity.name,
        version: config.agent_identity.version,
      });

      return config;
    } catch (error) {
      console.error(`Failed to load unified config for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Load legacy agent configuration from KV store
   * Maintains backward compatibility with existing agents
   */
  async loadAgentConfig(agentId: string): Promise<AgentConfig | null> {
    try {
      console.log(`🔍 DEBUG: ConfigLoader.loadAgentConfig() called for agentId: ${agentId}`);
      
      // First try unified config and convert it
      const unifiedConfig = await this.loadUnifiedAgentConfig(agentId);
      if (unifiedConfig) {
        console.log(`✅ DEBUG: Found unified config for ${agentId}, converting to legacy format`);
        const legacyConfig = this.convertUnifiedToLegacyConfig(unifiedConfig);
        console.log(`✅ DEBUG: Legacy config conversion successful for ${agentId}:`, {
          id: legacyConfig.id,
          name: legacyConfig.name,
          hasPersona: !!legacyConfig.persona,
          hasCapabilities: !!legacyConfig.capabilities,
          knowledgeDomains: legacyConfig.capabilities?.knowledge_domains?.length || 0
        });
        return legacyConfig;
      }

      console.log(`⚠️ DEBUG: No unified config found for ${agentId}, trying legacy config`);
      
      // Fall back to legacy config
      const configPath = `agents/${agentId}.json`;
      console.log(`Loading legacy agent config from: ${configPath}`);
      
      const jsonContent = await this.kvNamespace.get(configPath);
      if (!jsonContent) {
        console.warn(`Agent config not found: ${configPath}`);
        return null;
      }

      let config = JSON.parse(jsonContent) as any;
      
      // Convert legacy format to current format if needed
      if (config.agent && !config.id) {
        config = this.convertLegacyAgentConfig(config);
      }
      
      // Validate basic structure
      if (!config.id) {
        throw new Error('Invalid agent configuration structure - missing agent ID');
      }
      
      if (!config.persona) {
        throw new Error('Invalid agent configuration structure - missing persona');
      }

      return config as AgentConfig;
    } catch (error) {
      console.error(`Failed to load agent config for ${agentId}:`, error);
      return null;
    }
  }


  /**
   * Load task configuration from KV store
   * Supports both unified and legacy formats
   */
  async loadTaskConfig(taskId: string): Promise<TaskConfig | null> {
    try {
      // For unified configs, extract task from the agent config
      const agentId = taskId.replace('-task', '');
      const unifiedConfig = await this.loadUnifiedAgentConfig(agentId);
      
      if (unifiedConfig && unifiedConfig.task_specification) {
        return this.convertUnifiedTaskToLegacy(unifiedConfig);
      }

      // Fall back to legacy task config
      const taskPath = `tasks/agent-tasks/${taskId}.json`;
      console.log(`Loading legacy task config from: ${taskPath}`);
      
      const jsonContent = await this.kvNamespace.get(taskPath);
      if (!jsonContent) {
        console.warn(`Task config not found: ${taskPath}`);
        return null;
      }

      return JSON.parse(jsonContent) as TaskConfig;
    } catch (error) {
      console.error(`Failed to load task config for ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Convert unified task specification to legacy TaskConfig format
   */
  private convertUnifiedTaskToLegacy(unifiedConfig: UnifiedAgentConfig): TaskConfig {
    const taskSpec = unifiedConfig.task_specification;

    return {
      id: `${unifiedConfig.agent_identity.id}-task`,
      name: taskSpec.primary_objective,
      version: unifiedConfig.agent_identity.version,
      description: taskSpec.primary_objective,
      category: 'agent-execution',
      type: 'agent-task',
      task_specification: {
        primary_objective: taskSpec.primary_objective,
        secondary_objectives: [],
        deliverables: {
          primary_deliverables: ['strategy-analysis'],
          secondary_deliverables: [],
          deliverable_format: 'markdown',
          quality_standards: ['comprehensive', 'actionable', 'data-driven'],
        },
        success_criteria: {
          mandatory_criteria: ['output-generated', 'quality-validated'],
          optional_criteria: ['user-satisfaction'],
          measurement_approach: 'qualitative-review',
          validation_method: 'human-validation',
        },
        constraints: {
          scope_constraints: [],
          resource_constraints: [],
          dependency_constraints: [],
          quality_constraints: [],
        },
      },
      agent_integration: {
        agent_config_path: `agents/${unifiedConfig.agent_identity.id}-unified.json`,
        agent_id: unifiedConfig.agent_identity.id,
        agent_role: unifiedConfig.agent_identity.title,
        behavior_overrides: {
          knowledge_focus: unifiedConfig.static_knowledge?.knowledge_files?.primary || [],
        },
      },
      workflow_integration: {
        workflow_id: 'master-workflow-v2',
        workflow_stage: unifiedConfig.workflow_integration.stage,
        step_id: `${unifiedConfig.agent_identity.id}-step`,
        sequence_order: unifiedConfig.workflow_integration.sequence_order,
        inputs: {
          required_inputs: [],
          optional_inputs: [],
          user_inputs: [],
          context_requirements: {
            user_context: true,
            business_context: true,
            market_context: true,
          },
        },
        outputs: {
          primary_output: 'agent-analysis',
          secondary_outputs: [],
          output_format: 'markdown',
          storage_location: 'session-state',
        },
        coordination: {
          depends_on: [],
          blocks: [],
          parallel_execution: false,
          timeout: '30 minutes',
        },
        quality_gates: {
          pre_execution: [],
          post_execution: [],
          validation_rules: [],
          success_criteria: [],
        },
      },
      prompt_generation: {
        templates: {
          system_prompt_template: '',
          user_prompt_template: '',
          context_injection_template: '',
          knowledge_injection_template: '',
        },
        dynamic_generation: {
          context_injection_points: [],
          variable_substitution: {},
          conditional_sections: {},
          personalization_options: {},
        },
        optimization: {
          token_optimization: true,
          clarity_enhancement: true,
          context_compression: true,
          quality_instructions: true,
        },
        validation: {
          prompt_validation: true,
          length_limits: {
            system_prompt_max_tokens: 4000,
            user_prompt_max_tokens: 8000,
            total_prompt_max_tokens: 12000,
          },
          required_elements: [],
          quality_checks: [],
        },
      },
    };
  }

  /**
   * Load workflow configuration from KV store
   */
  async loadWorkflowConfig(workflowId: string): Promise<WorkflowConfig | null> {
    try {
      const workflowPath = `workflows/${workflowId}.json`;
      console.log(`Loading workflow config from: ${workflowPath}`);
      
      const jsonContent = await this.kvNamespace.get(workflowPath);
      if (!jsonContent) {
        console.warn(`Workflow config not found: ${workflowPath}`);
        return null;
      }

      return JSON.parse(jsonContent) as WorkflowConfig;
    } catch (error) {
      console.error(`Failed to load workflow config for ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * Load runtime configuration from KV store
   */
  async loadRuntimeConfig(): Promise<RuntimeConfig | null> {
    try {
      const configPath = 'config/runtime-config.json';
      console.log(`Loading runtime config from: ${configPath}`);
      
      const jsonContent = await this.kvNamespace.get(configPath);
      if (!jsonContent) {
        console.warn(`Runtime config not found: ${configPath}`);
        return null;
      }

      const config = JSON.parse(jsonContent) as RuntimeConfig;
      
      // Validate basic structure
      if (!config.config_version || !config.api || !config.agents) {
        throw new Error('Invalid runtime configuration structure - missing required sections');
      }

      console.log(`✅ Runtime config loaded successfully:`, {
        version: config.config_version,
        apiProvider: config.api.primary_provider.name,
        model: config.api.primary_provider.model,
        featuresEnabled: Object.keys(config.features.stable).filter(key => config.features.stable[key]).length
      });

      return config;
    } catch (error) {
      console.error('Failed to load runtime config:', error);
      return null;
    }
  }

  /**
   * Get configuration value with fallback
   */
  getConfigValue<T>(runtimeConfig: RuntimeConfig | null, path: string, fallback: T): T {
    if (!runtimeConfig) {
      return fallback;
    }

    const pathParts = path.split('.');
    let current: any = runtimeConfig;
    
    for (const part of pathParts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return fallback;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : fallback;
  }

  /**
   * Load experiment database from KV store
   */
  async loadExperimentDatabase(): Promise<string | null> {
    try {
      console.log('Loading experiment database from: knowledge-base/experiments/experiment-process.md');
      const content = await this.kvNamespace.get('knowledge-base/experiments/experiment-process.md');
      
      if (!content) {
        console.warn('Experiment database not found');
        return null;
      }

      return content;
    } catch (error) {
      console.error('Failed to load experiment database:', error);
      return null;
    }
  }

  /**
   * Load knowledge base content from KV store
   */
  async loadKnowledgeBase(filePath: string): Promise<string | null> {
    try {
      console.log(`Loading knowledge from: ${filePath}`);
      const content = await this.kvNamespace.get(filePath);
      
      if (!content) {
        console.warn(`Knowledge file not found: ${filePath}`);
        return null;
      }

      return content;
    } catch (error) {
      console.error(`Failed to load knowledge from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load all configurations for a specific agent
   * Returns both unified and legacy formats
   */
  async loadCompleteAgentConfiguration(agentId: string): Promise<{
    unified: UnifiedAgentConfig | null;
    legacy: AgentConfig | null;
    task: TaskConfig | null;
  }> {
    const unified = await this.loadUnifiedAgentConfig(agentId);
    const legacy = await this.loadAgentConfig(agentId);
    const task = await this.loadTaskConfig(`${agentId}-task`);

    return { unified, legacy, task };
  }

  /**
   * Convert legacy agent configuration to current format
   */
  private convertLegacyAgentConfig(legacyConfig: any): AgentConfig {
    return {
      id: legacyConfig.agent?.id || legacyConfig.id,
      name: legacyConfig.agent?.name || legacyConfig.name,
      version: legacyConfig.agent?.version || legacyConfig.version || '1.0',
      description: legacyConfig.agent?.description || legacyConfig.description || '',
      persona: {
        identity: legacyConfig.persona?.identity || legacyConfig.agent?.description || '',
        expertise: legacyConfig.persona?.core_principles || [],
        communication_style: legacyConfig.persona?.style || '',
        decision_making_approach: legacyConfig.persona?.decision_making || 'data-driven',
      },
      capabilities: {
        core_competencies: legacyConfig.persona?.focus?.split(', ') || [],
        tools_available: legacyConfig.tools?.available || [],
        knowledge_domains: legacyConfig.knowledge_domains?.primary || [],
        output_formats: ['markdown'],
      },
      configuration: {
        model: legacyConfig.claude_config?.model || 'claude-3-5-sonnet-20241022',
        temperature: legacyConfig.claude_config?.temperature || 0.7,
        max_tokens: legacyConfig.claude_config?.max_tokens || 4000,
        timeout: 120000,
        retry_attempts: 3,
      },
      workflow_integration: {
        workflow_position: legacyConfig.workflow?.sequence_order || 1,
        stage: legacyConfig.workflow?.stage as 'foundation' | 'strategy' | 'validation' || 'foundation',
        dependencies: legacyConfig.dependencies?.other_agents || [],
        handoff_requirements: legacyConfig.workflow?.quality_gates || [],
      },
    };
  }

  /**
   * Convert unified configuration to legacy AgentConfig format (public method)
   * This enables compatibility with existing code that expects legacy format
   */
  convertUnifiedToLegacyConfig(unifiedConfig: UnifiedAgentConfig): AgentConfig {
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
   * Validate configuration structure
   */
  validateUnifiedConfig(config: UnifiedAgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required top-level sections
    const requiredSections = [
      'agent_identity',
      'capabilities_constraints',
      'static_knowledge',
      'task_specification',
      'output_specifications',
      'workflow_integration',
    ];

    for (const section of requiredSections) {
      if (!(config as any)[section]) {
        errors.push(`Missing required section: ${section}`);
      }
    }

    // Validate agent_identity
    if (config.agent_identity) {
      if (!config.agent_identity.id) errors.push('Missing agent_identity.id');
      if (!config.agent_identity.name) errors.push('Missing agent_identity.name');
      if (!config.agent_identity.persona) errors.push('Missing agent_identity.persona');
    }

    // Validate task_specification
    if (config.task_specification) {
      if (!config.task_specification.primary_objective) {
        errors.push('Missing task_specification.primary_objective');
      }
      if (!config.task_specification.deliverables) {
        errors.push('Missing task_specification.deliverables');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}