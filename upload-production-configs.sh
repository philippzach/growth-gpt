#!/bin/bash

echo "🚀 Uploading all configuration files to production KV store..."

PRODUCTION_CONFIG_STORE_ID="eaaec34e641d43388f00d8e02ead8296"

# Function to upload a file to KV
upload_file() {
    local key=$1
    local file_path=$2
    echo "📤 Uploading: $key"
    npx wrangler kv key put "$key" --path="$file_path" --namespace-id="$PRODUCTION_CONFIG_STORE_ID" --remote
}

# Upload Agent Configurations (JSON unified configs)
echo "🤖 Uploading Agent Configurations..."
upload_file "agents/gtm-consultant-unified.json" "agents/gtm-consultant-unified.json"
upload_file "agents/persona-strategist-unified.json" "agents/persona-strategist-unified.json"
upload_file "agents/product-manager-unified.json" "agents/product-manager-unified.json"
upload_file "agents/growth-manager-unified.json" "agents/growth-manager-unified.json"
upload_file "agents/head-of-acquisition-unified.json" "agents/head-of-acquisition-unified.json"
upload_file "agents/head-of-retention-unified.json" "agents/head-of-retention-unified.json"
upload_file "agents/viral-growth-architect-unified.json" "agents/viral-growth-architect-unified.json"
upload_file "agents/growth-hacker-unified.json" "agents/growth-hacker-unified.json"
upload_file "agents/ceo-unified.json" "agents/ceo-unified.json"

# Upload Workflow Configurations (JSON)
echo "🔄 Uploading Workflow Configurations..."
upload_file "workflows/master-workflow-v2.json" "workflows/master-workflow-v2.json"
upload_file "workflows/workflow-schema.json" "workflows/workflow-schema.json"

# System configurations
echo "⚙️ Uploading System Configurations..."
upload_file "config/runtime-config.json" "config/runtime-config.json"

# Upload Knowledge Base Content
echo "📚 Uploading Knowledge Base Content..."

# Growth methodology files (method folder)
echo "🔬 Uploading Growth Methods..."
upload_file "knowledge-base/method/00growth-hacking-process.md" "knowledge-base/method/00growth-hacking-process.md"
upload_file "knowledge-base/method/01value-proposition.md" "knowledge-base/method/01value-proposition.md"
upload_file "knowledge-base/method/02problem-solution-fit.md" "knowledge-base/method/02problem-solution-fit.md"
upload_file "knowledge-base/method/03business-model.md" "knowledge-base/method/03business-model.md"
upload_file "knowledge-base/method/04psychograhpic-persona.md" "knowledge-base/method/04psychograhpic-persona.md"
upload_file "knowledge-base/method/05product-market-fit.md" "knowledge-base/method/05product-market-fit.md"
upload_file "knowledge-base/method/06one-metric-that-matters.md" "knowledge-base/method/06one-metric-that-matters.md"
upload_file "knowledge-base/method/07pirate-funnel.md" "knowledge-base/method/07pirate-funnel.md"
upload_file "knowledge-base/method/08friction-to-value.md" "knowledge-base/method/08friction-to-value.md"
upload_file "knowledge-base/method/09pirate-funnel-awareness.md" "knowledge-base/method/09pirate-funnel-awareness.md"
upload_file "knowledge-base/method/10pirate-funnel-acquisition.md" "knowledge-base/method/10pirate-funnel-acquisition.md"
upload_file "knowledge-base/method/11wow-moment.md" "knowledge-base/method/11wow-moment.md"
upload_file "knowledge-base/method/12pirate-funnel-activation.md" "knowledge-base/method/12pirate-funnel-activation.md"
upload_file "knowledge-base/method/13pirate-funnel-revenue.md" "knowledge-base/method/13pirate-funnel-revenue.md"
upload_file "knowledge-base/method/14pirate-funnel-retention.md" "knowledge-base/method/14pirate-funnel-retention.md"
upload_file "knowledge-base/method/15pirate-funnel-referrals.md" "knowledge-base/method/15pirate-funnel-referrals.md"
upload_file "knowledge-base/method/16growth-loop.md" "knowledge-base/method/16growth-loop.md"

# Experiments database (experiments folder)  
echo "🧪 Uploading Experiments Database..."
upload_file "knowledge-base/experiments/experiment-process.md" "knowledge-base/experiments/experiment-process.md"
upload_file "knowledge-base/experiments/master-experiments.json" "knowledge-base/experiments/master-experiments.json"

# Glossary (glossary folder)
echo "📖 Uploading Glossary..."
upload_file "knowledge-base/glossary/growth-hacking-dictionary.md" "knowledge-base/glossary/growth-hacking-dictionary.md"

echo "✅ Production configuration upload complete!"
echo "📊 Uploaded configuration files to KV store: $PRODUCTION_CONFIG_STORE_ID"
echo "🎯 Ready for production deployment!"