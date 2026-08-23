# Cap Supabase Functions

This file contains Postgres functions that must be deployed to your Supabase instance.

## consume_units

Atomic consumption function with advisory locking.

### Locking Strategy

**Problem:** Without locking, two concurrent transactions can both:
1. Check idempotency → not found
2. Read today's consumption → 19 units
3. Calculate available → 20 - 19 = 1
4. Both see remaining=1 and both insert ok=true
5. Result: 21 units consumed (race condition!)

**Solution:** `pg_advisory_xact_lock`

Before reading consumption data, the function takes a transaction-scoped advisory lock:

```sql
PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text), hashtext(p_user_id));
```

This ensures:
- Two consume calls for the same (project_id, user_id) are serialized
- First transaction completes fully before second transaction reads
- Lock is automatically released at transaction end (XACT = transaction-scoped)
- Different users can consume in parallel (lock is per user)

### Idempotency Handling

The function handles concurrent requests with the same idempotency key:

1. **Fast path:** Check idempotency before taking lock (performance)
2. **After lock:** Double-check idempotency (handles race where key was just inserted)
3. **On INSERT:** EXCEPTION block catches `unique_violation` and returns existing result

This ensures that if two requests use the same idempotency key:
- Only one INSERT succeeds
- Both requests return the same result
- No 500 errors

### Deployment

Run this SQL in your Supabase SQL Editor:

```bash
cat supabase_functions.sql | pbcopy  # copy to clipboard
```

Then paste in Supabase Dashboard → SQL Editor → New Query → Run

### Testing

The race condition is tested in `src/db/operations.atomic.test.ts`:
- Two concurrent calls for the last unit → one success, one 402
- Tests call the actual Postgres RPC (not mocked)
- Requires real Supabase instance with function deployed
