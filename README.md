# Growth Strategy Platform v3.0 🚀

**AI-Powered Strategic Planning & Execution System**

A comprehensive platform that transforms fragmented growth efforts into a unified, data-driven system where strategic planning seamlessly flows into execution. Build your growth strategy through an 8-step foundation process with specialized AI agents, then activate powerful execution branches powered by Model Context Protocol (MCP) integrations.

## 📋 Version Status

- **Current Version**: v2.0 (Foundation Complete)
- **Target Version**: v3.0 (MCP Integration)
- **Phase 1-2**: ✅ Complete - 8-Agent Foundation + Refinement
- **Phase 3-6**: 🚧 In Development - Execution Branches

## 🆕 What's New in v2.0

### Recent Features (January 2025)
- **✨ Strategy Refinement Page**: AI-powered validation and optimization of completed strategies
- **💬 Agent Q&A Chat**: Individual consultation sessions with any of the 9 specialized agents
- **🤖 CEO Agent Added**: Alexandra Sterling for holistic strategy integration
- **🔄 Improved Session Management**: Enhanced persistence with user indexing
- **📊 Production Deployment**: Live on Cloudflare Workers with production KV namespaces
- **🎨 UI Enhancements**: Agent tabs, visual progress indicators, streaming persistence

### Coming in v3.0 (Q2-Q4 2025)
- **📈 Analytics Branch**: Real-time KPI tracking with Google Analytics MCP
- **🔍 Research Branch**: Market intelligence with Perplexity MCP
- **🎨 Creative Branch**: AI-powered asset generation with DALL-E MCP
- **🔄 Continuous Optimization**: Feedback loops from execution to strategy

## 🎯 **Live Production Deployment**

**🌐 Production URL:** [https://growth-gpt.waimeazach.workers.dev](https://growth-gpt.waimeazach.workers.dev)

**Custom Domain:** Ready for `growth-gpt.com` configuration

**Production Namespaces:**
- CONFIG_STORE: `eaaec34e641d43388f00d8e02ead8296`
- SESSION_STORE: `c1dfd85ed8f74a699a3a25dbb71170a4`

## 🌟 **Key Features**

### ✅ **Completed Features (v2.0)**

1. **8-Step Strategy Foundation**: Complete growth strategy through sequential AI agents
2. **Strategy Refinement**: AI-powered validation and optimization of your strategy
3. **Agent Q&A Chat**: Individual consultations with any of the 9 specialized agents
4. **User Authentication**: Secure email/password via Supabase
5. **Real-time Chat Interface**: WebSocket-powered streaming conversations
6. **Session Management**: Persistent progress with resume capability
7. **Unified Worker Architecture**: Frontend and API from single Cloudflare Worker

### 🚧 **Upcoming Features (v3.0)**

8. **Analytics Branch**: Google Analytics MCP integration for KPI tracking
9. **Research Branch**: Perplexity MCP for market intelligence
10. **Creative Branch**: DALL-E MCP for asset generation
11. **Continuous Optimization**: Feedback loops from execution to strategy

## 🏗️ **System Architecture (v3.0 Vision)**

```
                    ┌─────────────────────────────────────┐
                    │    🎯 GROWTH STRATEGY FOUNDATION    │
                    │         (8-Step Process)            │
                    │                                     │
                    │  1. GTM Consultant                  │
                    │  2. Persona Strategist              │
                    │  3. Product Manager                 │
                    │  4. Growth Manager                  │
                    │  5. Head of Acquisition             │
                    │  6. Head of Retention               │
                    │  7. Viral Growth Architect          │
                    │  8. Growth Hacker                   │
                    │                                     │
                    │  Output: Master Strategy Context    │
                    └──────────────┬──────────────────────┘
                                   │
                        [Strategy Context Flows Down]
                                   │
                    ┌──────────────▼──────────────────────┐
                    │   STRATEGY REFINEMENT AGENT         │
                    │   (Validates & Optimizes Strategy)  │
                    └──────────────┬──────────────────────┘
                                   │
                ┌──────────────────┼──────────────────────┐
                │                  │                       │
     ┌──────────▼──────────┐ ┌────▼──────────┐ ┌─────────▼──────────┐
     │   📊 ANALYTICS &    │ │  🔍 RESEARCH  │ │  🎨 CREATIVE      │
     │    PERFORMANCE      │ │   & MARKET    │ │    GENERATOR       │
     │                     │ │  INTELLIGENCE │ │                    │
     ├─────────────────────┤ ├────────────────┤ ├────────────────────┤
     │ • Google Analytics  │ │ • Perplexity  │ │ • Brand Strategy   │
     │   MCP               │ │   MCP         │ │   Agent            │
     │ • DataForSEO        │ │ • Competitor  │ │ • Ad Copywriter    │
     │ • Real-time KPIs    │ │   Analyzer    │ │ • Campaign Builder │
     │ • Conversion        │ │ • Market      │ │ • DALL-E MCP       │
     │   Tracking          │ │   Trends      │ │ • Creative Assets  │
     └─────────────────────┘ └────────────────┘ └────────────────────┘
                │                  │                       │
                └──────────────────┼───────────────────────┘
                                   │
                        [Continuous Feedback Loop]
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      STRATEGY OPTIMIZATION          │
                    │   (Iterative Improvement Cycle)     │
                    └─────────────────────────────────────┘
```

### Data Architecture

#### KV Storage Namespaces

The system uses **Cloudflare KV** for persistent storage:

**CONFIG_STORE** - System Configurations:
- **9 Agent Configurations** (`agents/*.json`) - Personalities, capabilities, prompts
- **Workflow Definitions** (`workflows/*.json`) - Multi-agent sequences  
- **Knowledge Base** (`knowledge-base/*.md`) - 20+ growth methodology files
- **System Settings** (`config/*.json`) - Runtime configurations

**Production IDs:**
- CONFIG_STORE: `eaaec34e641d43388f00d8e02ead8296`
- SESSION_STORE: `c1dfd85ed8f74a699a3a25dbb71170a4`

#### Master Strategy Context (Output Structure)

```json
{
  "businessModel": { /* Value prop, revenue model, pricing */ },
  "personas": [ /* Detailed psychographic profiles */ ],
  "brandStrategy": { /* Positioning, identity, voice */ },
  "growthMetrics": { /* North Star, KPIs, funnel */ },
  "channels": { /* Acquisition, retention, referral */ },
  "growthMechanisms": { /* Loops, network effects, viral */ },
  "experiments": { /* Framework, backlog, priorities */ }
}
```

## 🛠️ **Tech Stack**

### Current Stack (v2.0)
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers (Hono framework)
- **Configuration**: `wrangler.jsonc` + `wrangler.toml`
- **Auth**: Supabase Auth (Email/Password)
- **AI**: Anthropic Claude API (Opus 4.1)
- **Storage**: Cloudflare KV + Durable Objects
- **Deployment**: Unified Worker with Static Assets

### Planned Integrations (v3.0)
- **Analytics**: Google Analytics MCP, DataForSEO
- **Research**: Perplexity MCP, Ahrefs MCP
- **Creative**: DALL-E MCP, Stable Diffusion MCP
- **CRM**: HubSpot MCP, Salesforce (Coupler.io)

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

# Create development KV namespaces
wrangler kv namespace create "CONFIG_STORE"
wrangler kv namespace create "SESSION_STORE"

# Create production KV namespaces (for custom domain)
wrangler kv namespace create "CONFIG_STORE" --env production
wrangler kv namespace create "SESSION_STORE" --env production
```

Copy the namespace IDs to `wrangler.jsonc` under the appropriate environment.

**Note**: The system now uses `wrangler.jsonc` instead of `wrangler.toml` for modern configuration with Static Assets support.

#### Upload Configuration Files to KV Store

The system uses a **bulk upload script** for easy configuration deployment. All configuration files are now in JSON format for better performance and structure.

**For Development:**
```bash
# Upload all configurations to development KV
./upload-production-configs.sh
```

**For Production:**
```bash
# Upload all configurations to production KV (use the production namespace ID)
PRODUCTION_CONFIG_STORE_ID="eaaec34e641d43388f00d8e02ead8296" ./upload-production-configs.sh
```

**What gets uploaded (32 files total):**

**Agent Configurations (9 JSON files):**
- `agents/gtm-consultant-unified.json`
- `agents/persona-strategist-unified.json`
- `agents/product-manager-unified.json`
- `agents/growth-manager-unified.json`
- `agents/head-of-acquisition-unified.json`
- `agents/head-of-retention-unified.json`
- `agents/viral-growth-architect-unified.json`
- `agents/growth-hacker-unified.json`
- `agents/ceo-unified.json` (for Q&A chat)

**System Configurations:**
- `workflows/master-workflow-v2.json`
- `workflows/workflow-schema.json`
- `config/runtime-config.json`

**Knowledge Base (20 files):**
- Growth methodology files (`knowledge-base/method/*.md`)
- Experiments database (`knowledge-base/experiments/*.json`)
- Growth hacking glossary (`knowledge-base/glossary/*.md`)

**Make script executable:**
```bash
chmod +x upload-production-configs.sh
```

**Verify Upload:**
```bash
# Check uploaded files
wrangler kv key list --namespace-id="eaaec34e641d43388f00d8e02ead8296"
wrangler kv key get "agents/gtm-consultant-unified.json" --namespace-id="eaaec34e641d43388f00d8e02ead8296"
```

### 5. Configuration Setup

Update your `wrangler.jsonc` with the correct KV namespace IDs:

```json
{
  "name": "growth-strategy-agent-system",
  "main": "src/workers/chat-gateway.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  
  "assets": {
    "directory": "./dist/frontend/",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },
  
  "kv_namespaces": [
    {
      "binding": "CONFIG_STORE",
      "id": "your_dev_config_store_id"
    },
    {
      "binding": "SESSION_STORE", 
      "id": "your_dev_session_store_id"
    }
  ],

  "env": {
    "production": {
      "kv_namespaces": [
        {
          "binding": "CONFIG_STORE",
          "id": "eaaec34e641d43388f00d8e02ead8296"
        },
        {
          "binding": "SESSION_STORE", 
          "id": "c1dfd85ed8f74a699a3a25dbb71170a4"
        }
      ]
    }
  }
}
```

### 6. Development

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
| `npm run build`         | Build React frontend for Static Assets deployment     |
| `npm run deploy`        | Deploy to production with Static Assets                |
| `wrangler deploy --env production` | Deploy to production environment |
| `wrangler tail --env production`   | View production logs in real-time |
| `npm run type-check`    | Run TypeScript type checking                           |
| `npm run lint`          | Run ESLint on source code                              |
| `npm run test`          | Run test suite                                         |
| `./upload-production-configs.sh` | Upload all configs to KV store   |

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

## 🤖 **The 9 Strategic AI Agents**

### Foundation Agents (8-Step Strategy Process)

1. **GTM Consultant (Angelina)** 📊: Market foundation & value proposition
2. **Persona Strategist (Dr. Maya Chen)** 👥: Customer psychology & behavior analysis
3. **Product Manager (Alex Rodriguez)** 🎯: Product-market fit & brand positioning
4. **Growth Manager (Sarah Kim)** 📈: Growth funnel & North Star metrics
5. **Head of Acquisition (Marcus Thompson)** 🚀: Customer acquisition strategy
6. **Head of Retention (Emily Watson)** 💝: Lifecycle & engagement programs
7. **Viral Growth Architect (Jordan Lee)** 🔄: Growth loops & viral mechanisms
8. **Growth Hacker (Phoenix Ray)** ⚡: Experimentation & testing framework

### Strategic Integration Agent

9. **CEO (Alexandra Sterling)** 💼: Holistic strategy integration & Q&A consultations

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

## 🚢 **Production Deployment**

The system uses a **single unified Cloudflare Worker** (`chat-gateway.ts`) that handles:
- **React Frontend** served via Static Assets
- **All API endpoints** (sessions, chat, agent execution)
- **Agent AI Processing** via AgentExecutor + Claude API (no separate agent workers needed)
- **Session State Management** via Durable Objects

**Why Unified Worker Architecture?**
✅ **Single Deployment** - One `wrangler deploy` command deploys everything  
✅ **No Worker Limits** - Avoid Cloudflare's 1000 worker per account limit  
✅ **Shared Memory** - AgentExecutor can share context between agents efficiently  
✅ **Simplified Routing** - No complex inter-worker communication needed  
✅ **Cost Effective** - One worker handles all requests instead of spawning multiple  

**Note**: The individual files in `src/workers/agents/` are legacy/templates - all agents execute within the main worker via AgentExecutor.

### Build & Deploy Process

```bash
# 1. Build React frontend for production
npm run build

# 2. Deploy unified worker with Static Assets to production
wrangler deploy --env production

# 3. View production logs
wrangler tail --env production
```

### Custom Domain Setup

After deployment, configure your custom domain in Cloudflare Dashboard:

1. **Add Custom Domain:**
   - Go to Cloudflare Dashboard → Workers & Pages
   - Select your worker → Settings → Domains
   - Click "Add Custom Domain"
   - Enter your domain (e.g., `growth-gpt.com`)

2. **DNS Configuration:**
   - Ensure your domain is managed by Cloudflare
   - DNS records will be automatically configured

3. **SSL/TLS:**
   - SSL is automatically provisioned
   - Full encryption enabled by default

### Production Configuration

The production environment uses:
- **Worker Name:** `growth-gpt`
- **KV Namespaces:** 
  - CONFIG: `eaaec34e641d43388f00d8e02ead8296`
  - SESSION: `c1dfd85ed8f74a699a3a25dbb71170a4`
- **Environment Variables:** Production credentials in `wrangler.jsonc`
- **Static Assets:** React frontend served via Cloudflare Pages
- **Custom Domain:** Ready for `growth-gpt.com`
- **32 Config Files:** Uploaded via `upload-production-configs.sh`

## 📈 **Development Roadmap**

### ✅ Phase 1-2: Foundation (Complete)
- [x] 8-Step Strategy Creation System
- [x] Strategy Refinement Agent
- [x] Agent Q&A Chat Interface
- [x] Session Persistence & Management
- [x] User Authentication (Supabase)

### 🚧 Phase 3: Analytics Branch (Q2 2025)
- [ ] Google Analytics MCP Integration
- [ ] Automated Dashboard Generation
- [ ] KPI Tracking aligned to North Star
- [ ] Weekly Performance Reports

### 📅 Phase 4: Research Branch (Q3 2025)
- [ ] Perplexity MCP Integration
- [ ] Competitor Intelligence Tracking
- [ ] Market Trend Analysis
- [ ] Content Gap Identification

### 🎨 Phase 5: Creative Branch (Q3 2025)
- [ ] DALL-E MCP Integration
- [ ] Brand Strategy Agent
- [ ] Campaign Builder
- [ ] Asset Generation Pipeline

### 🔄 Phase 6: Optimization Loop (Q4 2025)
- [ ] Feedback Collection System
- [ ] Strategy Auto-Optimization
- [ ] Multi-User Collaboration
- [ ] Custom Agent Builder

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

### Foundation Layer (Strategy Creation)
- `POST /api/sessions` - Create new strategy session
- `GET /api/sessions/:userId` - List user sessions
- `GET /api/sessions/:sessionId` - Get session details
- `POST /api/chat/:sessionId/message` - Send message to agent
- `GET /api/chat/:sessionId/history` - Get conversation history
- `PUT /api/chat/:sessionId/approve` - Approve agent output
- `POST /api/sessions/:sessionId/next-agent` - Move to next agent

### Strategy Refinement
- `POST /api/strategy/:sessionId/refine` - Trigger refinement
- `GET /api/strategy/:sessionId/refinement` - Get refinement results
- `PUT /api/strategy/:sessionId/refinement/accept` - Accept refinements

### Agent Q&A Chat
- `POST /api/agent-chat/:agentId/start` - Start Q&A session
- `POST /api/agent-chat/:sessionId/message` - Send Q&A message
- `GET /api/agent-chat/:sessionId/history` - Get Q&A history

### Session Management
- `PUT /api/sessions/:sessionId/pause` - Pause session
- `PUT /api/sessions/:sessionId/resume` - Resume session
- `DELETE /api/sessions/:sessionId` - Delete session
- `GET /api/sessions/:sessionId/export` - Export strategy (coming soon)

### Future MCP Gateway (v3.0)
- `POST /api/mcp/:server/connect` - Connect MCP server
- `POST /api/mcp/:server/tool/:tool` - Execute MCP tool
- `GET /api/mcp/servers` - List available servers

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

## 📚 **Version History**

### v2.0 (January 2025) - Current
- Added Strategy Refinement capability
- Implemented Agent Q&A Chat for individual consultations
- Added CEO agent for strategic integration
- Enhanced session management with user indexing
- Production deployment on Cloudflare Workers
- UI/UX improvements with agent tabs and progress visualization

### v1.0 (December 2024)
- Initial 8-agent foundation system
- Basic chat interface with streaming responses
- Session persistence with KV storage
- Supabase authentication integration
- MVP deployment

### v3.0 (Target: Q4 2025)
- MCP integrations for Analytics, Research, and Creative branches
- Continuous optimization feedback loops
- Multi-user collaboration features
- Custom agent builder
- Enterprise features

---

Built with ❤️ for growth professionals and entrepreneurs seeking data-driven growth strategies.
