# Execution Flow Example

1. Workflow Start: Load master-workflow-v2.yaml
2. Agent Task Load: Load gtm-consultant-task.yaml
3. Agent Config: Load gtm-consultant-v2.yaml
4. Context Preparation: Inject knowledge base + user input
5. Claude API Call: Execute agent with prepared context
6. Template Application: Apply gtm-strategy-output-v2.yaml
7. Output Validation: Validate against quality rules
8. Context Handoff: Prepare context for next agent
9. Save the output to a database from the user
10. Workflow Transition: Move to persona-strategist

📋 Integration Layer Components

1. Task Schema & Structure

- /tasks/task-schema.yaml - Complete schema for agent task configuration
- /tasks/agent-tasks/ - Agent-specific task definitions
- /tasks/workflow-tasks/ - Workflow orchestration tasks
- /tasks/utility-tasks/ - Reusable utility tasks

2. Reference Implementation

- /tasks/agent-tasks/gtm-consultant-task.yaml - Complete GTM Consultant integration
- /tasks/workflow-tasks/execute-workflow.yaml - Workflow orchestration engine
- /tasks/utility-tasks/apply-template.yaml - Template processing system

3. Configuration Layer

- /config/runtime-config.yaml - System-wide runtime configuration
- /config/integrations.yaml - Agent-workflow-template mappings

🔗 How They Link Together

Agent → Task → Template Flow:

1. Workflow Engine loads master-workflow-v2.yaml
2. Agent Task (e.g., gtm-consultant-task.yaml) executes with:

   - Agent config from agents/gtm-consultant-v2.yaml
   - Knowledge injection from knowledge-base/
   - Template processing via templates/gtm-strategy-output-v2.yaml

3. Context handoff to next agent with structured data

Key Integration Features:

✅ Agent Coordination - Sequential execution with quality gates
✅ Context Passing - Structured handoff between agents
✅ Template Processing - Dynamic variable binding and multi-format output
✅ Knowledge Injection - Automatic relevant knowledge integration
✅ Quality Validation - Built-in quality gates and scoring
✅ Error Recovery - Comprehensive error handling and fallbacks
✅ Performance Optimization - Caching, compression, and resource management
✅ Configuration Management - Centralized configuration with environment support
