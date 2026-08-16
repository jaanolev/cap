#!/usr/bin/env bash
# Mint a Cap sandbox API key

response=$(curl -s -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key)
api_key=$(echo "$response" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)

if [ -n "$api_key" ]; then
  echo "export CAP_API_KEY=$api_key"
else
  echo "Failed to mint key. Response:"
  echo "$response"
  exit 1
fi
