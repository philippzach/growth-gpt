// Core TypeScript types and interfaces for Growth Strategy Agent System
// Based on PRD data models and YAML schema definitions

export interface UserSession {
  id: string;
  userId: string;
  workflowId: string;
  status: 'active' | 'paused' | 'completed';
  currentAgent: string;
  currentStep: number;
  createdAt: string;
  lastActive: string;
  userInputs: Record<string, any>;
  agentOutputs: Record<string, AgentOutput>;
  conversationHistory: ChatMessage[];
  progress: WorkflowProgress;
}

export interface AgentOutput {
  agentId: string;
  status: 'pending' | 'approved' | 'rejected';
  content: string;
  template: string;
  variables: Record<string, any>;
  qualityScore: number;
  userFeedback?: string;
  generatedAt: string;
  approvedAt?: string;
  metadata?: AgentOutputMetadata;
}

export interface AgentOutputMetadata {
  tokensUsed: number;
  processingTime: number;
  templateApplied: string;
  knowledgeSourcesUsed: string[];
  qualityGatesPassed: string[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'agent' | 'system';
  agentId?: string;
  type:
    | 'text'
    | 'output'
    | 'approval_request'
    | 'system'
    | 'user_input_request';
  content: string;
  metadata?: ChatMessageMetadata;
  timestamp: string;
}

export interface ChatMessageMetadata {
  agentId?: string;
  outputId?: string;
  requiresApproval?: boolean;
  qualityScore?: number;
  inputType?: 'text' | 'selection' | 'confirmation';
  options?: string[];
  templateStructure?: any;
}

export interface WorkflowProgress {
  totalSteps: number;
  completedSteps: number;
  currentStepId: string;
  estimatedTimeRemaining: number;
  stageProgress: {
    foundation: number;
    strategy: number;
    validation: number;
  };
}

// Agent Configuration Types
export interface AgentConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  persona: AgentPersona;
  capabilities: AgentCapabilities;
  configuration: AgentExecutionConfig;
  workflow_integration: AgentWorkflowIntegration;
}

export interface AgentPersona {
  identity: string;
  expertise: string[];
  communication_style: string;
  decision_making_approach: string;
}

export interface AgentCapabilities {
  core_competencies: string[];
  tools_available: string[];
  knowledge_domains: string[];
  output_formats: string[];
}

export interface AgentExecutionConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  timeout: number;
  retry_attempts: number;
}

export interface AgentWorkflowIntegration {
  workflow_position: number;
  stage: 'foundation' | 'strategy' | 'validation';
  dependencies: string[];
  handoff_requirements: string[];
}

// Task Configuration Types
export interface TaskConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  type: string;
  task_specification: TaskSpecification;
  agent_integration: TaskAgentIntegration;
  workflow_integration: TaskWorkflowIntegration;
  prompt_generation: PromptGenerationConfig;
}

export interface TaskSpecification {
  primary_objective: string;
  secondary_objectives: string[];
  deliverables: TaskDeliverables;
  success_criteria: TaskSuccessCriteria;
  constraints: TaskConstraints;
}

export interface TaskDeliverables {
  primary_deliverables: string[];
  secondary_deliverables: string[];
  deliverable_format: string;
  quality_standards: string[];
}

export interface TaskSuccessCriteria {
  mandatory_criteria: string[];
  optional_criteria: string[];
  measurement_approach: string;
  validation_method: string;
}

export interface TaskConstraints {
  scope_constraints: string[];
  resource_constraints: string[];
  dependency_constraints: string[];
  quality_constraints: string[];
}

export interface TaskAgentIntegration {
  agent_config_path: string;
  agent_id: string;
  agent_role: string;
  behavior_overrides: AgentBehaviorOverrides;
}

export interface AgentBehaviorOverrides {
  temperature?: number;
  max_tokens?: number;
  system_prompt_additions?: string;
  knowledge_focus: string[];
}

export interface TaskWorkflowIntegration {
  workflow_id: string;
  workflow_stage: string;
  step_id: string;
  sequence_order: number;
  inputs: TaskInputs;
  outputs: TaskOutputs;
  coordination: TaskCoordination;
  quality_gates: TaskQualityGates;
}

export interface TaskInputs {
  required_inputs: string[];
  optional_inputs: string[];
  user_inputs: string[];
  context_requirements: {
    user_context: boolean;
    business_context: boolean;
    market_context: boolean;
  };
}

export interface TaskOutputs {
  primary_output: string;
  secondary_outputs: string[];
  output_format: string;
  storage_location: string;
}

export interface TaskCoordination {
  depends_on: string[];
  blocks: string[];
  parallel_execution: boolean;
  timeout: string;
}

export interface TaskQualityGates {
  pre_execution: string[];
  post_execution: string[];
  validation_rules: string[];
  success_criteria: string[];
}

export interface PromptGenerationConfig {
  templates: PromptTemplates;
  dynamic_generation: DynamicPromptGeneration;
  optimization: PromptOptimization;
  validation: PromptValidation;
}

export interface PromptTemplates {
  system_prompt_template: string;
  user_prompt_template: string;
  context_injection_template: string;
  knowledge_injection_template: string;
}

export interface DynamicPromptGeneration {
  context_injection_points: string[];
  variable_substitution: Record<string, string>;
  conditional_sections: Record<string, string>;
  personalization_options: Record<string, string>;
}

export interface PromptOptimization {
  token_optimization: boolean;
  clarity_enhancement: boolean;
  context_compression: boolean;
  quality_instructions: boolean;
}

export interface PromptValidation {
  prompt_validation: boolean;
  length_limits: {
    system_prompt_max_tokens: number;
    user_prompt_max_tokens: number;
    total_prompt_max_tokens: number;
  };
  required_elements: string[];
  quality_checks: string[];
}


// Workflow Types
export interface WorkflowConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  type: string;
  category: string;
  execution: WorkflowExecution;
  sequence: WorkflowStep[];
}

export interface WorkflowExecution {
  mode: 'sequential' | 'parallel' | 'hybrid';
  parallelization: ParallelizationConfig;
  error_handling: ErrorHandlingConfig;
  state_management: StateManagementConfig;
}

export interface ParallelizationConfig {
  max_concurrent_agents: number;
  parallel_groups: string[][];
  synchronization_points: string[];
}

export interface ErrorHandlingConfig {
  strategy: 'retry_failed' | 'skip_failed' | 'abort_workflow';
  max_retries: number;
  rollback_on_failure: boolean;
}

export interface StateManagementConfig {
  persist_state: boolean;
  checkpoint_frequency: 'per_agent' | 'per_stage' | 'manual';
  resume_capability: boolean;
}

export interface WorkflowStep {
  step_id: string;
  step_name: string;
  agent_id: string;
  stage: 'foundation' | 'strategy' | 'validation';
  condition?: string;
  inputs: StepInputs;
  outputs: StepOutputs;
  agent_overrides?: AgentExecutionConfig;
  validation: StepValidation;
  dependencies: StepDependencies;
  optional_steps?: string[];
  tools_available?: string[];
  knowledge_focus?: string[];
  user_interaction?: UserInteraction;
  notes?: string;
}

export interface StepInputs {
  required: string[];
  optional: string[];
  user_inputs: string[];
  context_injection: boolean;
}

export interface StepOutputs {
  primary: string;
  secondary: string[];
  format: string;
  storage_location: string;
}

export interface StepValidation {
  required_elements: string[];
  quality_gates: string[];
  human_review_required: boolean;
}

export interface StepDependencies {
  hard_dependencies: string[];
  soft_dependencies: string[];
  timeout: string;
}

export interface UserInteraction {
  required: boolean;
  interaction_type: 'input' | 'approval' | 'selection';
  prompt_template: string;
  timeout_behavior: string;
}

// API Types
export interface APIRequest {
  sessionId: string;
  userId?: string;
  type: 'message' | 'approval' | 'edit' | 'regenerate';
  payload: any;
  timestamp: string;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: APIError;
  metadata?: ResponseMetadata;
  timestamp: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

export interface ResponseMetadata {
  processingTime: number;
  tokensUsed?: number;
  agentId?: string;
  sessionId: string;
}

// Runtime Types
export interface RuntimeConfig {
  environment: 'development' | 'staging' | 'production';
  api: APIConfig;
  agents: AgentsConfig;
  workflows: WorkflowsConfig;
  templates: TemplatesConfig;
  knowledge_base: KnowledgeBaseConfig;
  performance: PerformanceConfig;
}

export interface APIConfig {
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
}

export interface AgentsConfig {
  discovery: {
    auto_scan: boolean;
    validation_on_load: boolean;
    cache_configurations: boolean;
  };
  execution_defaults: {
    timeout: number;
    memory_limit: string;
    retry_attempts: number;
  };
  coordination: {
    max_concurrent_agents: number;
    context_passing_enabled: boolean;
    quality_gates_enabled: boolean;
  };
}

export interface WorkflowsConfig {
  execution: {
    default_mode: string;
    checkpoint_enabled: boolean;
    resume_capability: boolean;
  };
  state_management: {
    persistence_enabled: boolean;
    backup_frequency: string;
    cleanup_after_completion: boolean;
    state_retention_days: number;
  };
}

export interface TemplatesConfig {
  processing: {
    engine: string;
    auto_variable_extraction: boolean;
    quality_enhancement: boolean;
    multi_format_generation: boolean;
  };
  output: {
    default_format: string;
    supported_formats: string[];
    compression_enabled: boolean;
  };
}

export interface KnowledgeBaseConfig {
  injection: {
    auto_injection_enabled: boolean;
    relevance_threshold: number;
    max_tokens_per_injection: number;
  };
  processing: {
    preprocessing_enabled: boolean;
    semantic_indexing: boolean;
    caching_enabled: boolean;
  };
  sources: {
    primary_sources: string[];
    secondary_sources: string[];
    dynamic_sources: string[];
  };
}

export interface PerformanceConfig {
  resource_limits: {
    max_memory_usage: string;
    max_cpu_usage: string;
    max_disk_usage: string;
    max_execution_time: number;
  };
  caching: {
    global_cache_enabled: boolean;
    cache_backend: string;
    cache_compression: boolean;
    cache_encryption: boolean;
  };
}

// Environment Bindings (Cloudflare Workers)
export interface Env {
  // KV Namespaces
  CONFIG_STORE: KVNamespace;
  SESSION_STORE: KVNamespace;

  // Durable Objects
  SESSION_STATE: DurableObjectNamespace;

  // Service Bindings
  GTM_CONSULTANT: Fetcher;
  PERSONA_STRATEGIST: Fetcher;
  PRODUCT_MANAGER: Fetcher;
  GROWTH_MANAGER: Fetcher;
  HEAD_OF_ACQUISITION: Fetcher;
  HEAD_OF_RETENTION: Fetcher;
  VIRAL_GROWTH_ARCHITECT: Fetcher;
  GROWTH_HACKER: Fetcher;

  // Environment Variables
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WEBHOOK_SECRET: string;
  ENVIRONMENT: string;
}

// Utility Types
export type AgentType =
  | 'gtm-consultant'
  | 'persona-strategist'
  | 'product-manager'
  | 'growth-manager'
  | 'head-of-acquisition'
  | 'head-of-retention'
  | 'viral-growth-architect'
  | 'growth-hacker';

export type WorkflowStage = 'foundation' | 'strategy' | 'validation';

export type MessageType =
  | 'text'
  | 'output'
  | 'approval_request'
  | 'system'
  | 'user_input_request';

export type SessionStatus = 'active' | 'paused' | 'completed';

export type OutputStatus = 'pending' | 'approved' | 'rejected';

// Additional Types for Agent Execution
export interface GeneratedPrompt {
  content: string;
  systemPrompt: string;
  userPrompt: string;
  variables: Record<string, any>;
  metadata?: {
    agentId: string;
    templateId: string;
    generatedAt: string;
  };
}

export interface PromptGenerationContext {
  session: UserSession;
  agentConfig: AgentConfig;
  taskConfig: any;
  knowledgeBase: any;
  businessContext: any;
  userInputs: Record<string, any>;
  previousOutputs: Record<string, any>;
  workflowStep: number;
}
