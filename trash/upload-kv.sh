#!/bin/bash

echo "🚀 Uploading configuration files to Cloudflare KV (excluding resources and tasks)..."
echo "Total files to upload: 32 (instead of 57)"

# Counter for progress
counter=0

# Agent Configurations (8 files)
echo "📁 Uploading Agent Configurations..."
for file in agents/*.json; do
    if [[ -f "$file" ]]; then
        key_name="$file"
        wrangler kv key put "$key_name" --path="$file" --binding="CONFIG_STORE"
        counter=$((counter + 1))
        echo "✅ Uploaded $key_name ($counter/32)"
    fi
done

# Knowledge Base - Method Files (17 files)
echo "📚 Uploading Knowledge Base - Method Files..."
for file in knowledge-base/method/*.md; do
    if [[ -f "$file" ]]; then
        key_name="$file"
        wrangler kv key put "$key_name" --path="$file" --binding="CONFIG_STORE"
        counter=$((counter + 1))
        echo "✅ Uploaded $key_name ($counter/32)"
    fi
done

# Knowledge Base - Other Files (3 files)
echo "📚 Uploading Knowledge Base - Other Files..."
wrangler kv key put "knowledge-base/glossary/growth-hacking-dictionary.md" --path="knowledge-base/glossary/growth-hacking-dictionary.md" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded knowledge-base/glossary/growth-hacking-dictionary.md ($counter/32)"

wrangler kv key put "knowledge-base/experiments/experiment-process.md" --path="knowledge-base/experiments/experiment-process.md" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded knowledge-base/experiments/experiment-process.md ($counter/32)"

wrangler kv key put "knowledge-base/experiments/master-experiments.json" --path="knowledge-base/experiments/master-experiments.json" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded knowledge-base/experiments/master-experiments.json ($counter/32)"

# Workflow & System Configuration (3 files)
echo "⚙️ Uploading Workflow & System Configuration..."
wrangler kv key put "workflows/master-workflow-v2.json" --path="workflows/master-workflow-v2.json" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded workflows/master-workflow-v2.json ($counter/32)"

wrangler kv key put "workflows/workflow-schema.json" --path="workflows/workflow-schema.json" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded workflows/workflow-schema.json ($counter/32)"

wrangler kv key put "config/runtime-config.json" --path="config/runtime-config.json" --binding="CONFIG_STORE"
counter=$((counter + 1))
echo "✅ Uploaded config/runtime-config.json ($counter/32)"

echo "🎉 Upload complete! Uploaded $counter/32 files to CONFIG_STORE"
echo "⚠️  Skipped: Resource files (17) and Task configurations (8) as requested"
echo "🔍 Verifying upload..."
wrangler kv key list --binding="CONFIG_STORE"