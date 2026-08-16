# Cap Cursor Skill

Cap is an agent-first spend-cap product. Add a spend cap to your AI route with one atomic `consume()` call.

## When to Use This Skill

Use this skill when:
- Adding rate limiting or spend caps to AI routes
- Testing consumption patterns against limits
- Debugging why requests are being denied
- Setting up sandbox environments for development

## Quick Integration

```typescript
import { CapClient, mintSandboxKey } from 'cap';

// Get a sandbox key
const { apiKey } = await mintSandboxKey();

// Create client
const cap = new CapClient({ apiKey });

// Before calling your AI route, check the cap
const result = await cap.consume({ userId: req.userId });

if (!result.ok) {
  return res.status(402).json({
    error: 'Payment required - daily limit exceeded',
    reason: result.reason,
    remaining: result.remaining
  });
}

// Proceed with AI route
await yourAIRoute(req);
```

## Key Concepts

1. **Sandbox Keys**: No signup required - mint instantly
2. **Daily Limits**: Default 20 units/day per user, resets at UTC midnight
3. **Idempotency**: Safe retries with `idempotencyKey`
4. **Atomic Check**: One `consume()` call checks and records

## MCP Tools Available

If Cap MCP server is connected:
- `mint_key` - Create a new sandbox API key
- `set_limit` - Update a user's daily limit
- `consume_test` - Test consumption scenarios
- `why_denied` - Debug denial reasons

## API Endpoints

- `POST /v1/mint_sandbox_key` - Get sandbox credentials
- `POST /v1/consume` - Consume units (requires API key)
- `POST /v1/why_denied` - Check balance details (requires API key)

## Example: Rate Limit an Express Route

```typescript
app.post('/api/ai/chat', async (req, res) => {
  const userId = req.user.id;
  
  const result = await cap.consume({ 
    userId,
    units: 1,
    idempotencyKey: req.headers['x-request-id']
  });
  
  if (!result.ok) {
    return res.status(402).json({ 
      error: 'Payment required - daily limit exceeded',
      remaining: result.remaining 
    });
  }
  
  const response = await openai.chat.completions.create({...});
  res.json(response);
});
```

## Not Included in v1

Cap is a gate, not a billing system:
- No Stripe integration
- No dashboard UI
- No plan builder
- No checkout flow
- No invoices or tax handling

For agent workflows, use the MCP server or direct API calls.
