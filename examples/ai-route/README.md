# AI Route Example

Add a spend cap to your AI route using Cap.

This minimal Express server demonstrates calling the Cap API before running your AI route. No OpenAI key required — the example returns a stub response after checking the spend cap.

## Quick Start

```bash
# 1. Get a sandbox API key
curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Copy the "apiKey" from the response

# 2. Install and start
cd examples/ai-route
npm install
CAP_API_KEY=cap_... npm start

# 3. Test the chat endpoint
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","message":"hello"}'
```

## How It Works

The server:
1. Receives `POST /chat` with `{ userId, message }`
2. Calls `POST https://cap-alpha-one.vercel.app/v1/consume` with 1 unit
3. Returns **HTTP 402** if the user hit their daily limit
4. Returns **HTTP 200** with a stub reply if allowed

No AI model is called — this is just the gating pattern.

## Endpoints

- `POST /chat` - Chat endpoint with spend cap gate
- `GET /health` - Health check

## Mint Script (Optional)

Run `./mint.sh` to fetch a new sandbox key:

```bash
chmod +x mint.sh
./mint.sh
```

## Learn More

- [Cap Documentation](https://cap-alpha-one.vercel.app/llms.txt)
- [Main README](../../README.md)
