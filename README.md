# Cap

Add a spend cap to your AI route.

Cap is a hosted gate you call before running AI routes. One atomic `consume()` call checks and records usage. No Stripe, no dashboard, no plan objects in v1.

## Quick Start (Hosted API)

```bash
# 1. Mint a sandbox key (no signup)
curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Returns: { "projectId": "...", "apiKey": "cap_..." }

# 2. Consume units
curl -X POST https://cap-alpha-one.vercel.app/v1/consume \
  -H "Authorization: Bearer cap_..." \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","units":1}'
# Returns: { "ok": true, "remaining": 19 }
```

### TypeScript Example

```typescript
// Before calling your AI route
const response = await fetch('https://cap-alpha-one.vercel.app/v1/consume', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CAP_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: req.user.id,
    units: 1,
    idempotencyKey: req.headers['x-request-id'] // optional
  })
});

const gate = await response.json();

if (!gate.ok) {
  // HTTP 402: { ok: false, reason: "insufficient_balance", remaining: 0 }
  return res.status(402).json({ error: 'Daily limit exceeded' });
}

// HTTP 200: { ok: true, remaining: 19 }
// Proceed with AI route
```

## How It Works

- **Daily Limits**: 20 units/day per user (default), resets UTC midnight
- **Fail Closed**: If consume() fails, deny the request
- **Idempotency**: Use `idempotencyKey` to safely retry
- **No Billing**: Cap is a gate, not Stripe. For billing, use Stripe.

## Documentation

- [llms.txt](https://cap-alpha-one.vercel.app/llms.txt) - Complete API reference
- [SKILL.md](https://cap-alpha-one.vercel.app/SKILL.md) - Cursor skill guide

## API Endpoints

- `POST /v1/mint_sandbox_key` - Create sandbox key (no auth)
- `POST /v1/consume` - Consume units (requires Bearer token)
- `POST /v1/why_denied` - Check balance details (requires Bearer token)

## MCP Server

Cap includes an MCP server for agent workflows. See [mcp.json](./mcp.json) for configuration. The MCP server calls the hosted API at https://cap-alpha-one.vercel.app by default.

---

## Running Cap Yourself

If you want to self-host Cap or contribute to development:

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your Supabase credentials to .env:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Build
npm run build

# Run tests
npm test

# Start API server (local)
npm start

# Run MCP server (local)
npm run mcp
```

### Deploying to Vercel

To deploy your own instance:

1. **Connect Repository**: Go to [vercel.com](https://vercel.com), click "Add New Project", and import this repository.

2. **Configure Environment Variables**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

3. **Deploy**: Click "Deploy" and wait for the build to complete.

4. **Test**: Your API will be available at `https://your-project.vercel.app`

### TypeScript SDK (In This Repo)

The SDK client at `src/sdk/index.ts` defaults to the hosted API. For local development:

```typescript
import { CapClient } from './src/sdk';

const cap = new CapClient({ 
  apiKey: 'cap_...',
  baseUrl: 'http://localhost:3000' // override for local
});
```

The SDK is NOT published to npm. Use the fetch snippets in the docs, or copy the SDK files from this repo.

## License

MIT
