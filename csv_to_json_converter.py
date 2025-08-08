#!/usr/bin/env python3
"""
CSV to JSON Converter for Growth Experiments
Converts master-experiments.csv to JSON and estimates token count
"""

import csv
import json
import os
import re

def estimate_tokens(text):
    """Rough token estimation: ~4 characters per token for English text"""
    if not text:
        return 0
    # Remove extra whitespace and normalize
    normalized = re.sub(r'\s+', ' ', str(text).strip())
    return len(normalized) // 4

def convert_csv_to_json(csv_file_path, json_file_path):
    """Convert CSV to JSON and provide statistics"""
    
    experiments = []
    total_tokens = 0
    
    with open(csv_file_path, 'r', encoding='utf-8', newline='') as csvfile:
        # Handle potential CSV parsing issues with multi-line fields
        reader = csv.DictReader(csvfile)
        
        for i, row in enumerate(reader, 1):
            # Clean and structure the data
            experiment = {
                "id": int(row['#']) if row['#'].isdigit() else i,
                "tactic": row['Tactic'].strip(),
                "description": row['Description/Hypothesis'].strip(),
                "funnel_step": row['Funnel Step'].strip(),
                "probability": row['Probabiliy of Success'].strip(),  # Note: typo in original CSV
                "business_type": row['Business Type'].strip(),
                "effort": row['Effort'].strip(),
                "dev_needed": row['Dev needed'].strip().lower() in ['yes', 'true', '1']
            }
            
            # Estimate tokens for this experiment
            experiment_text = json.dumps(experiment)
            tokens = estimate_tokens(experiment_text)
            total_tokens += tokens
            
            experiments.append(experiment)
    
    # Write JSON file
    with open(json_file_path, 'w', encoding='utf-8') as jsonfile:
        json.dump(experiments, jsonfile, indent=2, ensure_ascii=False)
    
    # Calculate statistics
    file_size = os.path.getsize(json_file_path)
    avg_tokens_per_experiment = total_tokens // len(experiments) if experiments else 0
    
    print(f"Conversion completed!")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"📊 STATISTICS:")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"Total experiments: {len(experiments):,}")
    print(f"JSON file size: {file_size:,} bytes ({file_size/1024/1024:.2f} MB)")
    print(f"Estimated total tokens: {total_tokens:,}")
    print(f"Average tokens per experiment: {avg_tokens_per_experiment}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"💡 TOKEN ANALYSIS:")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"Claude 3.5 Sonnet context limit: 200,000 tokens")
    print(f"Percentage of context used: {(total_tokens/200000)*100:.1f}%")
    
    if total_tokens > 200000:
        print(f"⚠️  WARNING: Token count exceeds model limits!")
        recommended_batch = 200000 // avg_tokens_per_experiment
        print(f"📝 Recommendation: Process in batches of ~{recommended_batch} experiments")
    else:
        print(f"✅ Token count is within model limits")
    
    # Show sample of first 3 experiments
    print(f"\n📋 SAMPLE EXPERIMENTS:")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    for i, exp in enumerate(experiments[:3], 1):
        tokens = estimate_tokens(json.dumps(exp))
        print(f"{i}. {exp['tactic']} ({tokens} tokens)")
        print(f"   Funnel: {exp['funnel_step']} | Probability: {exp['probability']} | Effort: {exp['effort']}")
        print(f"   Description: {exp['description'][:100]}...")
        print()
    
    return experiments, total_tokens

if __name__ == "__main__":
    csv_path = "/Users/philippzach/NoSync/growth/knowledge-base/experiments/master-experiments.csv"
    json_path = "/Users/philippzach/NoSync/growth/knowledge-base/experiments/master-experiments.json"
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        exit(1)
    
    try:
        experiments, total_tokens = convert_csv_to_json(csv_path, json_path)
        print(f"🎉 Successfully converted {len(experiments)} experiments to JSON!")
        print(f"📁 JSON file saved to: {json_path}")
        
    except Exception as e:
        print(f"❌ Error during conversion: {e}")
        exit(1)