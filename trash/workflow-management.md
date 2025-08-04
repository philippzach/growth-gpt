# Workflow Management

Enables BMad orchestrator to manage and execute team workflows.

## Dynamic Workflow Loading

Read available workflows from current team configuration's `workflows` field. Each team bundle defines its own supported workflows.

## Execution Flow

1. **Starting**: Load definition → Identify first stage → Transition to agent → Guide artifact creation

2. **Stage Transitions**: Mark complete → Check conditions → Load next agent → Pass artifacts

3. **Artifact Tracking**: Track status, creator, timestamps in workflow_state

4. **Interruption Handling**: Analyze provided artifacts → Determine position → Suggest next step

## Context Passing

When transitioning, pass:

- Previous artifacts
- Current workflow stage
- Expected outputs
- Decisions/constraints

## Multi-Path Workflows

Handle conditional paths by asking clarifying questions when needed.

## Best Practices

1. Show progress
2. Explain transitions
3. Preserve context
4. Allow flexibility
5. Track state

## Agent Integration

Agents should be workflow-aware: know active workflow, their role, access artifacts, understand expected outputs.
