# Testing Cap

## Running Tests

Tests require a Supabase service role key. Set it up:

```bash
cp .env.example .env
# Edit .env and add your SUPABASE_SERVICE_ROLE_KEY
npm test
```

## What's Tested

### Allow Scenarios
- ✓ Consumption within daily limit
- ✓ Multiple consumptions tracking
- ✓ Consumption up to exact limit
- ✓ Custom daily limits per user
- ✓ Extra balance usage

### Deny Scenarios
- ✓ Consumption over daily limit
- ✓ Requesting more than available
- ✓ Requesting more than limit initially

### Idempotency
- ✓ Duplicate idempotency keys return same result
- ✓ No double-charging with same key
- ✓ Different keys allow separate requests
- ✓ Idempotent denied requests

### Balance Checking
- ✓ Why denied shows correct balance details
- ✓ Sufficient balance explanation
- ✓ New user balance state

## Test Environment

Tests use the real Supabase project: `iywsldhgmcyawpoxfhdn`

Each test creates a sandbox project and cleans up consume events and end users after execution.

## Security

**Never commit .env files or service role keys to git.**

The service role key has full database access and must be kept secret.
