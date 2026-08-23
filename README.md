# Cap

Add a spend cap to your AI route.

Cap is a hosted gate you call before running AI routes. One atomic `consume()` call checks and records usage. No Stripe, no dashboard, no plan objects in v1.

## Quick Start (Hosted API)

```bash
# 1. Mint a sandbox key (no signup)
curl -X POST https://cap-alpha-one.vercel.app/v1/mint_sandbox_key
# Returns: { "projectId": "...", "apiKey": "cap_..." }

# 2. Consume units (idempotencyKey required)
curl -X POST https://cap-alpha-one.vercel.app/v1/consume \
  -H "Authorization: Bearer cap_..." \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","units":1,"idempotencyKey":"req_abc123"}'
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
    idempotencyKey: req.headers['x-request-id'] // REQUIRED
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

**Example:** See [examples/ai-route](./examples/ai-route) for a working Express demo.

## How It Works

- **Daily Limits**: 20 units/day per user (default), resets UTC midnight
- **Customizable Limits**: Use `/v1/set_limit` to change per-user daily caps
- **Atomic Operations**: consume() uses Postgres advisory locks to prevent race conditions
- **Fail Closed**: If consume() fails, deny the request
- **Idempotency**: Required `idempotencyKey` for safe retries and race prevention
- **No Billing**: Cap is a gate, not Stripe. For billing, use Stripe.

## Documentation

- [llms.txt](https://cap-alpha-one.vercel.app/llms.txt) - Complete API reference
- [SKILL.md](https://cap-alpha-one.vercel.app/SKILL.md) - Cursor skill guide

## API Endpoints

- `POST /v1/mint_sandbox_key` - Create sandbox key (no auth)
- `POST /v1/consume` - Consume units (requires Bearer token, idempotencyKey required)
- `POST /v1/set_limit` - Set user's daily limit (requires Bearer token)
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

# Run the SQL function in your Supabase project
# Execute the contents of supabase_functions.sql in the SQL editor

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

### TypeScript SDK

Publishing as **@usecap/sdk** (not yet on npm registry).

```typescript
import { CapClient, consume, setLimit } from '@usecap/sdk';

// Option 1: Use the client class
const cap = new CapClient({ 
  apiKey: 'cap_...',
  baseUrl: 'https://cap-alpha-one.vercel.app' // optional, defaults to hosted
});

await cap.consume({ 
  userId: 'user_123', 
  units: 1,
  idempotencyKey: 'req_abc' // required
});

await cap.setLimit({ 
  userId: 'user_123', 
  dailyLimit: 50 
});

// Option 2: Use standalone functions
await consume('cap_...', { 
  userId: 'user_123', 
  units: 1,
  idempotencyKey: 'req_abc'
});

await setLimit('cap_...', { 
  userId: 'user_123', 
  dailyLimit: 50 
});
```

To publish:
```bash
npm run build
npm publish --access public
```

## License

MIT
