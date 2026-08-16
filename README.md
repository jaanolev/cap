# Cap

Add a spend cap to your AI route.

Cap is a gate in front of AI routes, not a billing company. One atomic `consume()` call. No Stripe, no dashboard, no plan objects in v1.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your SUPABASE_SERVICE_ROLE_KEY

# Build
npm run build

# Run tests
npm test

# Start API server
npm start

# Run MCP server
npm run mcp
```

## Deploying to Vercel

Deploy the Cap API to a public URL in a few clicks:

1. **Connect Repository**: Go to [vercel.com](https://vercel.com), click "Add New Project", and import the `jaanolev/cap` GitHub repository.

2. **Configure Environment Variables**:
   - `SUPABASE_URL`: `https://iywsldhgmcyawpoxfhdn.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (required)

3. **Deploy**: Click "Deploy" and wait for the build to complete.

4. **Test**: Your API will be available at `https://your-project.vercel.app` with these endpoints:
   - `POST /v1/mint_sandbox_key` - Create a new sandbox API key
   - `POST /v1/consume` - Consume units for a user
   - `POST /v1/why_denied` - Check why a user was denied

Example usage with deployed API:
```bash
# Mint a sandbox key
curl -X POST https://your-project.vercel.app/v1/mint_sandbox_key

# Consume units
curl -X POST https://your-project.vercel.app/v1/consume \
  -H "Authorization: Bearer cap_..." \
  -d '{"user_id":"user_123","units":1}'
```

## Usage

See [llms.txt](./llms.txt) for complete API documentation.

### TypeScript SDK

```typescript
import { CapClient, mintSandboxKey } from 'cap';

const { apiKey } = await mintSandboxKey();
const cap = new CapClient({ apiKey });

const result = await cap.consume({ userId: 'user_123' });
if (result.ok) {
  console.log(`Allowed. Remaining: ${result.remaining}`);
}
```

### HTTP API

```bash
# Mint sandbox key
curl -X POST http://localhost:3000/v1/mint_sandbox_key

# Consume units
curl -X POST http://localhost:3000/v1/consume \
  -H "Authorization: Bearer cap_..." \
  -d '{"user_id":"user_123","units":1}'
```

## MCP Server

Cap includes an MCP server for agent workflows. See [mcp.json](./mcp.json) for configuration.

## Documentation

- [llms.txt](./llms.txt) - Complete API reference
- [SKILL.md](./SKILL.md) - Cursor skill guide

## License

MIT
