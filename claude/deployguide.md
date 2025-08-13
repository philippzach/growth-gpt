# Complete Guide: Deploy to Cloudflare Workers (Frontend + Backend)

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Version 16.17.0 or later
3. **Package Manager**: npm, yarn, pnpm, or bun

## Step 1: Install Wrangler CLI

Wrangler is Cloudflare's command-line tool for managing Workers.

```bash
npm install -g wrangler
# or
npm install --save-dev wrangler
```

## Step 2: Create Your Worker Project

### Option A: Using C3 (Create-Cloudflare CLI) - Recommended

```bash
npm create cloudflare@latest my-worker-app
# or
npx create-cloudflare@latest my-worker-app
```

When prompted:

- Choose "Website or web app" for frontend projects
- Select your framework (React, Vue, Svelte, etc.) or "Worker only" for backend
- Choose JavaScript or TypeScript
- Enable git for version control

### Option B: Manual Setup

Create project structure:

```bash
mkdir my-worker-app
cd my-worker-app
npm init -y
npm install --save-dev wrangler
```

## Step 3: Configure wrangler.toml

Create a `wrangler.toml` file in your project root:

```toml
# Basic configuration
name = "my-worker-app"
main = "src/index.js"  # or "src/index.ts" for TypeScript
compatibility_date = "2025-01-20"
workers_dev = true

# For frontend apps with static assets
[site]
bucket = "./dist"  # or "./build" depending on your framework

# Or use the new Assets feature (recommended for static files)
[assets]
directory = "./public"  # Static files directory
serve_directly = true

# Environment variables
[vars]
API_URL = "https://api.example.com"
ENVIRONMENT = "production"

# Secrets (set via CLI, not in file)
# wrangler secret put SECRET_KEY

# KV Namespace binding (if needed)
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-namespace-id"

# D1 Database binding (if needed)
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your-database-id"

# R2 Bucket binding (if needed)
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"

# Durable Objects (if needed)
[[durable_objects.bindings]]
name = "MY_DURABLE_OBJECT"
class_name = "MyDurableObject"
script_name = "my-worker-app"
```

## Step 4: Create Your Worker Code

### Backend Worker Example

Create `src/index.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route handling
    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello from Worker!' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Serve static assets if configured
    if (url.pathname === '/') {
      return new Response('Welcome to my Worker!', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

### Frontend with Framework Example (React/Vite)

For a React app with Vite:

1. Install Cloudflare Vite plugin:

```bash
npm install --save-dev @cloudflare/vite-plugin-workers
```

2. Configure `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflareWorkers } from '@cloudflare/vite-plugin-workers';

export default defineConfig({
  plugins: [react(), cloudflareWorkers()],
});
```

3. Create worker entry point `src/worker.js`:

```javascript
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
    try {
      // Serve static assets
      return await getAssetFromKV({
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      });
    } catch (e) {
      // Handle API routes or errors
      return new Response('Not found', { status: 404 });
    }
  },
};
```

## Step 5: Environment Configuration

### Multiple Environments

Add environment-specific configurations in `wrangler.toml`:

```toml
# Default/Development configuration
name = "my-worker-dev"
main = "src/index.js"
compatibility_date = "2025-01-20"

[env.staging]
name = "my-worker-staging"
vars = { ENVIRONMENT = "staging" }
route = "staging.example.com/*"

[env.production]
name = "my-worker-prod"
vars = { ENVIRONMENT = "production" }
route = "example.com/*"
workers_dev = false
```

## Step 6: Local Development

Start the development server:

```bash
# Default environment
wrangler dev

# With live reload
wrangler dev --live-reload

# Specific port
wrangler dev --port 3000

# Specific environment
wrangler dev --env staging
```

Access your app at `http://localhost:8787`

## Step 7: Build Your Frontend (if applicable)

For frontend frameworks:

```bash
# React/Vue/Svelte apps
npm run build

# This creates a dist/ or build/ folder with static files
```

## Step 8: Authentication

Login to Cloudflare:

```bash
wrangler login
```

This opens a browser for OAuth authentication.

## Step 9: Deploy to Cloudflare Workers

### Deploy to workers.dev subdomain

```bash
# Deploy to default environment
wrangler deploy

# Deploy to specific environment
wrangler deploy --env production

# Skip confirmation prompt
wrangler deploy --yes
```

Your app will be available at: `https://my-worker-app.<your-subdomain>.workers.dev`

### Deploy to Custom Domain

1. Add route in `wrangler.toml`:

```toml
route = "example.com/*"
zone_id = "your-zone-id"  # Found in Cloudflare dashboard
```

2. Deploy:

```bash
wrangler deploy
```

## Step 10: Managing Secrets

Add sensitive data as secrets (not in wrangler.toml):

```bash
# Add a secret
wrangler secret put API_KEY

# List secrets
wrangler secret list

# Delete a secret
wrangler secret delete API_KEY
```

## Step 11: Monitoring and Logs

### View Logs

```bash
# Stream live logs
wrangler tail

# Filter logs
wrangler tail --format pretty
```

### Enable Logpush

Add to `wrangler.toml`:

```toml
logpush = true
```

## Step 12: CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

Add your Cloudflare API token to GitHub secrets.

## Advanced Features

### Serving Static Files with Workers

Update `wrangler.toml`:

```toml
[assets]
directory = "./public"
serve_directly = true

# File serving rules
[[assets.rules]]
type = "Text"
globs = ["**/*.txt"]

[[assets.rules]]
type = "CompiledWasm"
globs = ["**/*.wasm"]
```

### Version Management

```bash
# Upload a new version without deploying
wrangler versions upload

# Deploy a specific version
wrangler versions deploy

# List versions
wrangler versions list

# Gradual rollout
wrangler versions deploy --percentage 25
```

### Using Workers with Frameworks

**Next.js**: Use `@cloudflare/next-on-pages`

```bash
npm install --save-dev @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
```

**React Router/Remix**: Native support

```bash
npm create cloudflare@latest my-remix-app -- --framework=remix
```

**Astro**: Built-in adapter

```bash
npm install @astrojs/cloudflare
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Change port with `wrangler dev --port 3001`

2. **Authentication errors**: Run `wrangler logout` then `wrangler login`

3. **Build failures**: Check Node version and compatibility_date

4. **Route conflicts**: Ensure routes don't overlap with existing Workers

5. **523 errors**: Wait 1-2 minutes after first deployment

### Useful Commands

```bash
# Check wrangler version
wrangler --version

# View account info
wrangler whoami

# List all workers
wrangler list

# Delete a worker
wrangler delete my-worker-app

# View worker metrics
wrangler metrics my-worker-app
```

## Best Practices

1. **Use environments** for dev/staging/production separation
2. **Store secrets properly** - never commit them to git
3. **Set appropriate compatibility dates** for feature support
4. **Use TypeScript** for better type safety
5. **Implement proper error handling** in your fetch handler
6. **Use Durable Objects** for stateful applications
7. **Leverage KV/R2/D1** for data storage needs
8. **Monitor with Workers Analytics** and Logpush
9. **Use service bindings** for Worker-to-Worker communication
10. **Test locally** before deploying to production

## Pricing Notes

- **Free tier**: 100,000 requests/day, 10ms CPU time per invocation
- **Paid tier**: $5/month for 10 million requests + $0.50 per additional million
- **No charges** for bandwidth or static asset serving
- **Additional costs** for KV, R2, D1, Durable Objects usage

## Resources

- [Official Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Framework Guides](https://developers.cloudflare.com/workers/framework-guides/)
- [Examples Repository](https://github.com/cloudflare/workers-examples)
- [Discord Community](https://discord.cloudflare.com)
