#!/usr/bin/env bash
# Quick smoke test for the LLM endpoint.
# Usage: RUNPOD_API_KEY=... RUNPOD_LLM_ENDPOINT_ID=... ./test.sh
set -euo pipefail

: "${RUNPOD_API_KEY:?RUNPOD_API_KEY is required}"
: "${RUNPOD_LLM_ENDPOINT_ID:?RUNPOD_LLM_ENDPOINT_ID is required}"

curl -s -X POST \
  "https://api.runpod.ai/v2/${RUNPOD_LLM_ENDPOINT_ID}/openai/v1/chat/completions" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"$(dirname "$0")/test_input.json" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'choices' in d:
    print(d['choices'][0]['message']['content'])
else:
    print(json.dumps(d, indent=2, ensure_ascii=False))
"
