Now lets create a new workers/agents/gtm-consultant-worker.ts you can rename the old one to gtm-consultant-worker.backup. Make sure you use the new config-loader.ts and the updated simple-prompt-builder.ts
Once you are finished check if the workflow-orchestrator.ts is still functioning as expected .

Create a console.log() with the body of the API call to Anthropic so I can see the whole prompt being send to Anthropic in the server log an I am able to troubleshoot it. It would also be great to see how many tokens are being sent.

Create 2 new files, PRDv2.md and READMEv2.md and reflect the current state of the application. The architeture should be like the one we implemented for the first 3 agents. Make sure you create the PRDv2.md in such a way that I can prompt another LLM and he builds the project in a simplified way with the exact features we were planning to do. Include the file structure, architecutre, frameworks, deployment and everything else that is necessary

Great now that we have 7 Agents working. I only have an missunderstanding with the Instruction Prompt. Does each agent have the same instruction prompt?
Like you exlpained below? Lets think and create a simple plane on how I can give each agent a individual Instruchtion prompt. Some things might be good to have in general. But I need to specifically have individual prompts for each agent for the output format and Task instructions.

2. Instruction Prompts (Task + Context + Specifications)

Primary Location: src/lib/simple-prompt-builder.ts

- Method: buildEnhancedInstructionPrompt() (lines ~156-240)
- Controls: Task primer, business context, previous outputs, output format

Key Sections You Can Modify:

- Context Primer: Workflow position and agent sequence information
- Task Instructions: Primary objectives and deliverables
- Business Context: How user inputs are presented
- Previous Agent Outputs: How full context is shared between agents
- Output Specifications: Required format and structure

Lets keep working on the features. I want to the user to be able to talk to each agent after he has finished the strategy setup. In the /refine │
│ remove drop down of the content of the reponses and create a button "Refine with Agent". This should open another page with the Chat open to each │
│ individal agent. Each agent should have the summarized content from

 Lets keep working on the PRDv3.md I am brainstorming some features right now and one thing I want to have implemented is a Q&A Chat with each │
│ agent once the strategy was layed out. Can we implement this in the /refine page? For example instaed of showing the contetn in the dropdown, │
│ lets have a button open another page with a 2 colum layout (3/4 and 1/4) on the bigger left side should be the chat and in the smaller right │
│ column should be premade prompt buttons to prompt the LLM Like (create Facebok Ad Campaign with Copy and prompts for image generation, Create a │
│ Brand Strategy Visual Guideline with Prompts,
