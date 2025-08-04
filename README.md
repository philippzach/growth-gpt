# Growth Strategy Agent System 🚀

An AI-powered Growth Strategy Agent System that guides users through building comprehensive growth strategies using 8 specialized AI agents working collaboratively through structured workflows.

## 🌟 **Key Features**

1. **User Authentication**: Email/Password via Supabase
2. **Multi-Agent Workflow**: 8 specialized growth agents collaborate through structured workflows
3. **Real-time Chat Interface**: Interactive WebSocket-powered conversations with AI agents
4. **Session Management**: Persistent conversation history and session state
5. **Template-Driven Outputs**: Structured, professional outputs using dynamic templates
6. **Progress Tracking**: Visual workflow progress and milestone tracking

## 🏗️ **System Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │────│  Cloudflare      │────│   AI Agents     │
│   (Email Auth)   │    │  Workers         │    │   (8 Types)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Supabase Auth   │    │ Session State   │    │ Configuration   │
│ (Email/Password)│    │(Durable Object) │    │   (KV Store)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### KV Storage Architecture

The system uses **Cloudflare KV** for persistent storage with two main namespaces:

**CONFIG_STORE** - Contains all system configurations:
- **8 Agent Configurations** (`agents/*.yaml`) - Agent personalities, capabilities, and settings
- **Workflow Definitions** (`workflows/*.yaml`) - Multi-agent workflow sequences  
- **Task Configurations** (`tasks/*.yaml`) - Individual agent task specifications
- **Knowledge Base** (`knowledge-base/*.md`) - 35 files of growth methodology content
- **System Settings** (`config/*.yaml`) - Runtime and integration configurations

**SESSION_STORE** - Contains user session data:
- User session persistence with conversation history
- Workflow progress and agent outputs
- User-specific data with secure indexing (`user:${userId}:sessions`)

**Hybrid Storage Strategy:**
- **KV Store**: Long-term persistence, global distribution, configuration caching
- **Durable Objects**: Real-time session state, WebSocket connections, temporary cache

## 🛠️ **Tech Stack**

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers (Hono framework)
- **Auth**: Supabase Auth (Email/Password)
- **AI**: Anthropic Claude API
- **Storage**: Cloudflare KV (sessions, configs)
- **Templates**: Nunjucks templating engine

## 🚀 **Quick Start**

### Prerequisites

- Node.js 18+
- Cloudflare account
- Supabase project
- Anthropic API key

### 1. Clone & Install

```bash
git clone <repository-url>
cd growth-strategy-agent-system
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Fill in your environment variables:

```env
# Cloudflare
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Anthropic
ANTHROPIC_API_KEY=your_api_key_here

# Supabase (Email Authentication)
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Frontend (for Vite)
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Security
WEBHOOK_SECRET=your_webhook_secret_here
ENVIRONMENT=development
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Enable email authentication in Authentication > Settings
3. Configure email templates and settings as needed
4. Copy your project URL and keys to the environment file

### 4. Cloudflare Setup

#### Create API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Use **"Edit Cloudflare Workers"** template
4. Configure permissions:
   - **Account**: `Cloudflare Workers:Edit`
   - **Zone**: `Zone:Read` (for all zones)
5. Copy the token to your environment file

#### Create KV Namespaces

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare when not using API Token
wrangler login

# Create KV namespaces
wrangler kv namespace create "CONFIG_STORE"
wrangler kv namespace create "SESSION_STORE"
```

Copy the namespace IDs to `wrangler.toml`.

**Quick Setup**: You can also use our helper script:

```bash
npm run kv:create
```

This will create both namespaces and display the IDs to add to your `wrangler.toml`.

#### Upload Configuration Files to KV Store

The system requires uploading configuration files and knowledge base content to Cloudflare KV. Here are the commands to upload all required files:

**Upload Agent Configurations (8 files):**
```bash
# Upload all agent configurations
wrangler kv key put "agents/gtm-consultant.yaml" --path="agents/gtm-consultant.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/persona-strategist.yaml" --path="agents/persona-strategist.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/product-manager.yaml" --path="agents/product-manager.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/growth-manager.yaml" --path="agents/growth-manager.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/head-of-acquisition.yaml" --path="agents/head-of-acquisition.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/head-of-retention.yaml" --path="agents/head-of-retention.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/viral-growth-architect.yaml" --path="agents/viral-growth-architect.yaml" --binding="CONFIG_STORE"
wrangler kv key put "agents/growth-hacker.yaml" --path="agents/growth-hacker.yaml" --binding="CONFIG_STORE"
```

**Upload Workflow & Task Configurations:**
```bash
# Workflow configurations
wrangler kv key put "workflows/master-workflow-v2.yaml" --path="workflows/master-workflow-v2.yaml" --binding="CONFIG_STORE"
wrangler kv key put "workflows/workflow-schema.yaml" --path="workflows/workflow-schema.yaml" --binding="CONFIG_STORE"

# Agent task configurations
wrangler kv key put "tasks/agent-tasks/gtm-consultant-task.yaml" --path="tasks/agent-tasks/gtm-consultant-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/persona-strategist-task.yaml" --path="tasks/agent-tasks/persona-strategist-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/product-manger-task.yaml" --path="tasks/agent-tasks/product-manger-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/growth-manager-task.yaml" --path="tasks/agent-tasks/growth-manager-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/head-of-acquisition-task.yaml" --path="tasks/agent-tasks/head-of-acquisition-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/head-of-retention-task.yaml" --path="tasks/agent-tasks/head-of-retention-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/viral-growth-architect-task.yaml" --path="tasks/agent-tasks/viral-growth-architect-task.yaml" --binding="CONFIG_STORE"
wrangler kv key put "tasks/agent-tasks/growth-hacker-task.yaml" --path="tasks/agent-tasks/growth-hacker-task.yaml" --binding="CONFIG_STORE"

# System configurations
wrangler kv key put "config/runtime-config.yaml" --path="config/runtime-config.yaml" --binding="CONFIG_STORE"
wrangler kv key put "config/integrations.yaml" --path="config/integrations.yaml" --binding="CONFIG_STORE"
```

**Upload Knowledge Base Content (35 files):**
```bash
# Growth methodology files
wrangler kv key put "knowledge-base/method/00growth-hacking-process.md" --path="knowledge-base/method/00growth-hacking-process.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/01value-proposition.md" --path="knowledge-base/method/01value-proposition.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/02problem-solution-fit.md" --path="knowledge-base/method/02problem-solution-fit.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/03business-model.md" --path="knowledge-base/method/03business-model.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/04psychograhpic-persona.md" --path="knowledge-base/method/04psychograhpic-persona.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/05product-market-fit.md" --path="knowledge-base/method/05product-market-fit.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/06one-metric-that-matters.md" --path="knowledge-base/method/06one-metric-that-matters.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/07pirate-funnel.md" --path="knowledge-base/method/07pirate-funnel.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/08friction-to-value.md" --path="knowledge-base/method/08friction-to-value.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/09pirate-funnel-awareness.md" --path="knowledge-base/method/09pirate-funnel-awareness.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/10pirate-funnel-acquisition.md" --path="knowledge-base/method/10pirate-funnel-acquisition.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/11wow-moment.md" --path="knowledge-base/method/11wow-moment.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/12pirate-funnel-activation.md" --path="knowledge-base/method/12pirate-funnel-activation.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/13pirate-funnel-revenue.md" --path="knowledge-base/method/13pirate-funnel-revenue.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/14pirate-funnel-retention.md" --path="knowledge-base/method/14pirate-funnel-retention.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/15pirate-funnel-referrals.md" --path="knowledge-base/method/15pirate-funnel-referrals.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/method/16growth-loop.md" --path="knowledge-base/method/16growth-loop.md" --binding="CONFIG_STORE"

# Resources and frameworks
wrangler kv key put "knowledge-base/ressources/brainstorming-techniques.md" --path="knowledge-base/ressources/brainstorming-techniques.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/cialdini-persuasion.md" --path="knowledge-base/ressources/cialdini-persuasion.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/copywriting-cheat-sheet.md" --path="knowledge-base/ressources/copywriting-cheat-sheet.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/cro.md" --path="knowledge-base/ressources/cro.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/facebook-Ads.md" --path="knowledge-base/ressources/facebook-Ads.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/growthhacking-process-overview.md" --path="knowledge-base/ressources/growthhacking-process-overview.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/hierachy-of-engagement.md" --path="knowledge-base/ressources/hierachy-of-engagement.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/lift-model.md" --path="knowledge-base/ressources/lift-model.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/market-segmentation.md" --path="knowledge-base/ressources/market-segmentation.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/north-start-metric.md" --path="knowledge-base/ressources/north-start-metric.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/ocean-personality.md" --path="knowledge-base/ressources/ocean-personality.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/psychographic-segmentation.md" --path="knowledge-base/ressources/psychographic-segmentation.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/psychographics-socialmedia.md" --path="knowledge-base/ressources/psychographics-socialmedia.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/retention-lifecycle.md" --path="knowledge-base/ressources/retention-lifecycle.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/unique-value-proposition.md" --path="knowledge-base/ressources/unique-value-proposition.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/ressources/virality.md" --path="knowledge-base/ressources/virality.md" --binding="CONFIG_STORE"

# Glossary and experiments
wrangler kv key put "knowledge-base/glossary/growth-hacking-dictionary.md" --path="knowledge-base/glossary/growth-hacking-dictionary.md" --binding="CONFIG_STORE"
wrangler kv key put "knowledge-base/experiments/experiment-process.md" --path="knowledge-base/experiments/experiment-process.md" --binding="CONFIG_STORE"
```

**Upload Summary:**
- **8 Agent Configurations** (`agents/*.yaml`)
- **10 Task Configurations** (`tasks/*.yaml`) 
- **2 Workflow Configurations** (`workflows/*.yaml`)
- **2 System Configurations** (`config/*.yaml`)
- **35 Knowledge Base Files** (`knowledge-base/*.md`)
- **Total: 57 files** to upload to CONFIG_STORE

**Bulk Upload Helper Script:**
Create a script file `upload-kv.sh` for easier uploading:
```bash
#!/bin/bash
echo "Uploading all 57 configuration files to Cloudflare KV..."

# Add all the commands above to this script for one-command upload
chmod +x upload-kv.sh
./upload-kv.sh
```

**Verify Upload:**
```bash
# Check if files are uploaded correctly
wrangler kv key list --binding="CONFIG_STORE"
wrangler kv key get "agents/gtm-consultant.yaml" --binding="CONFIG_STORE"
```

### 5. Development

```bash
# Start frontend development server
npm run frontend:dev

# In another terminal, start the Cloudflare Worker
npm run worker:dev

# Alternative: Use the shorthand for worker development
npm run dev
```

## 🛠️ **Available Scripts**

| Script                  | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run frontend:dev`  | Start React frontend development server (port 3000)    |
| `npm run worker:dev`    | Start Cloudflare Worker development server (port 8787) |
| `npm run dev`           | Start Cloudflare Worker (shorthand for worker:dev)     |
| `npm run build`         | Build both frontend and worker for production          |
| `npm run deploy`        | Deploy worker to Cloudflare (shorthand)                |
| `npm run worker:deploy` | Deploy worker to Cloudflare                            |
| `npm run worker:tail`   | View worker logs in real-time                          |
| `npm run type-check`    | Run TypeScript type checking                           |
| `npm run lint`          | Run ESLint on source code                              |
| `npm run test`          | Run test suite                                         |
| `npm run kv:create`     | Create KV namespaces (helper script)                   |

## 📚 **Authentication Flow**

### Email/Password Authentication

1. **User Registration/Login**:
   - User enters email/password on login page
   - Frontend calls Supabase Auth API
   - Supabase validates credentials and returns JWT

2. **API Authentication**:
   - Frontend includes JWT in Authorization header
   - Worker validates JWT with Supabase
   - Authorized requests access protected endpoints

3. **Session Management**:
   - JWT contains user ID for session ownership
   - All sessions are linked to authenticated user
   - Users can only access their own sessions

## 🔒 **Security**

- **Authentication**: JWT tokens from email/password auth
- **Authorization**: User-scoped session access
- **API Protection**: All endpoints require valid JWT
- **Input Validation**: Comprehensive input sanitization
- **Environment Variables**: Secure credential management

## 🤖 **The 8 Growth Agents**

1. **GTM Consultant**: Market foundation and go-to-market strategy
2. **Growth Manager**: Overall growth strategy orchestration
3. **Head of Acquisition**: Customer acquisition strategies
4. **Head of Retention**: Customer retention and loyalty
5. **Persona Strategist**: Customer persona development
6. **Product Manager**: Product-growth alignment
7. **Growth Hacker**: Creative growth experiments
8. **Viral Growth Architect**: Viral mechanics and referral systems

## 📊 **Project Structure**

```
growth/
├── src/
│   ├── frontend/           # React application
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # Auth & Session contexts
│   │   └── pages/          # Application pages
│   ├── workers/            # Cloudflare Workers
│   │   ├── agents/         # Individual agent workers
│   │   ├── chat-gateway.ts # Main API gateway
│   │   └── session-state-manager.ts
│   ├── lib/                # Shared utilities
│   │   ├── auth-utils.ts   # JWT validation
│   │   ├── agent-executor.ts
│   │   └── workflow-orchestrator.ts
│   └── types/              # TypeScript definitions
├── agents/                 # Agent configurations
├── templates/              # Output templates
├── workflows/              # Workflow definitions
└── knowledge-base/         # Domain knowledge
```

## 🚢 **Deployment**

### Frontend (Cloudflare Pages)

```bash
npm run frontend:build
# Deploy build/ directory to Cloudflare Pages
```

### Workers

```bash
# Deploy to production
npm run worker:deploy

# Alternative shorthand
npm run deploy

# View worker logs in real-time
npm run worker:tail
```

## 🔧 **Environment Variables Reference**

| Variable                    | Purpose                | Required |
| --------------------------- | ---------------------- | -------- |
| `CLOUDFLARE_API_TOKEN`      | Workers deployment     | ✅       |
| `ANTHROPIC_API_KEY`         | AI agent responses     | ✅       |
| `SUPABASE_URL`              | Authentication         | ✅       |
| `SUPABASE_ANON_KEY`         | Frontend auth          | ✅       |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker auth validation | ✅       |
| `WEBHOOK_SECRET`            | API security           | ✅       |

## 🛡️ **API Endpoints**

All endpoints require `Authorization: Bearer <jwt_token>` header.

### Sessions

- `POST /api/sessions` - Create new session
- `GET /api/sessions/:userId` - List user sessions
- `GET /api/sessions/:sessionId` - Get session details

### Chat

- `POST /api/chat/:sessionId/message` - Send message
- `GET /api/chat/:sessionId/history` - Get conversation history
- `PUT /api/chat/:sessionId/approve` - Approve agent output

### Session Control

- `PUT /api/sessions/:sessionId/pause` - Pause session
- `PUT /api/sessions/:sessionId/resume` - Resume session
- `DELETE /api/sessions/:sessionId` - Delete session

## 🎯 **What's the Webhook Secret?**

The webhook secret is used for:

- **API Security**: Validates incoming requests to prevent unauthorized access
- **Signature Verification**: Ensures requests come from trusted sources
- **Rate Limiting**: Helps implement request rate limiting

Generate a secure random string (32+ characters) for production use.

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📖 **Documentation**

- [Agent Configurations](./agents/overview.md)
- [Workflow System](./workflows/README.md)
- [Template System](./templates/overview.md)
- [Knowledge Base](./knowledge-base/README.md)

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with ❤️ for growth professionals and entrepreneurs seeking data-driven growth strategies.
