import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { createSandboxProject, consume, setLimit } from './operations.js';
import { supabase } from './client.js';

/**
 * Atomic Operations Tests
 * 
 * IMPORTANT: These tests verify the actual Postgres consume_units RPC function.
 * They are NOT mocked. Before running these tests, you must:
 * 
 * 1. Have a Supabase instance running
 * 2. Execute supabase_functions.sql to create the consume_units function
 * 3. Have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
 * 
 * The race condition tests verify that pg_advisory_xact_lock properly
 * serializes concurrent consume calls for the same (project_id, user_id).
 */
describe('Cap Atomic Operations', () => {
  let testProjectId: string;
  let testApiKey: string;

  beforeAll(async () => {
    const result = await createSandboxProject();
    testProjectId = result.projectId;
    testApiKey = result.apiKey;
  });

  afterEach(async () => {
    await supabase
      .from('consume_events')
      .delete()
      .eq('project_id', testProjectId);
    
    await supabase
      .from('end_users')
      .delete()
      .eq('project_id', testProjectId);
  });

  describe('Idempotency Key Requirement', () => {
    test('should require idempotency key', async () => {
      await expect(async () => {
        // @ts-expect-error - testing missing required parameter
        await consume(testProjectId, 'user_test', 1);
      }).rejects.toThrow();
    });
  });

  describe('Atomic Consume - Race Condition Prevention', () => {
    test('should handle concurrent last-unit consumption atomically', async () => {
      const userId = 'user_race_test_1';
      
      // Consume 19 units first
      await consume(testProjectId, userId, 19, 'setup_key');
      
      // Now try to consume the last unit twice concurrently
      const promises = [
        consume(testProjectId, userId, 1, 'race_key_1'),
        consume(testProjectId, userId, 1, 'race_key_2'),
      ];
      
      const results = await Promise.all(promises);
      
      // Exactly one should succeed and one should fail
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.filter(r => !r.ok).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      
      // The failed one should have reason insufficient_balance
      const failed = results.find(r => !r.ok);
      expect(failed?.reason).toBe('insufficient_balance');
      expect(failed?.remaining).toBe(0);
      
      // The successful one should have remaining 0
      const success = results.find(r => r.ok);
      expect(success?.remaining).toBe(0);
    });

    test('should handle three concurrent calls for last unit', async () => {
      const userId = 'user_race_test_2';
      
      // Consume 19 units first
      await consume(testProjectId, userId, 19, 'setup_key_2');
      
      // Try to consume 1 unit three times concurrently
      const promises = [
        consume(testProjectId, userId, 1, 'race_key_a'),
        consume(testProjectId, userId, 1, 'race_key_b'),
        consume(testProjectId, userId, 1, 'race_key_c'),
      ];
      
      const results = await Promise.all(promises);
      
      // Exactly one should succeed and two should fail
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.filter(r => !r.ok).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(2);
    });

    test('should handle concurrent consumption of multiple units', async () => {
      const userId = 'user_race_test_3';
      
      // Consume 10 units first, leaving 10 available
      await consume(testProjectId, userId, 10, 'setup_key_3');
      
      // Try to consume 6 units twice concurrently (only one should succeed)
      const promises = [
        consume(testProjectId, userId, 6, 'race_key_d'),
        consume(testProjectId, userId, 6, 'race_key_e'),
      ];
      
      const results = await Promise.all(promises);
      
      // Exactly one should succeed and one should fail
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.filter(r => !r.ok).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      
      // The failed one should show remaining 4 (10 - 6)
      const failed = results.find(r => !r.ok);
      expect(failed?.reason).toBe('insufficient_balance');
      expect(failed?.remaining).toBe(4);
    });

    test('should maintain idempotency with same key in concurrent calls', async () => {
      const userId = 'user_race_test_4';
      
      // Try to consume with the same idempotency key twice concurrently
      const sameKey = 'same_idempotency_key';
      const promises = [
        consume(testProjectId, userId, 5, sameKey),
        consume(testProjectId, userId, 5, sameKey),
      ];
      
      const results = await Promise.all(promises);
      
      // Both should return the same result (idempotency)
      expect(results[0].ok).toBe(results[1].ok);
      expect(results[0].remaining).toBe(results[1].remaining);
      
      // Check database - should only have one event
      const { data: events } = await supabase
        .from('consume_events')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('user_id', userId);
      
      expect(events?.length).toBe(1);
      expect(events?.[0].units).toBe(5);
    });
  });

  describe('Set Limit', () => {
    test('should set custom limit for new user', async () => {
      const userId = 'user_set_limit_1';
      
      await setLimit(testProjectId, userId, 50);
      
      // Verify by consuming
      const result = await consume(testProjectId, userId, 30, 'test_key_1');
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(20);
    });

    test('should update existing limit', async () => {
      const userId = 'user_set_limit_2';
      
      // Set initial limit
      await setLimit(testProjectId, userId, 10);
      
      // Consume some
      await consume(testProjectId, userId, 5, 'test_key_2');
      
      // Update limit
      await setLimit(testProjectId, userId, 50);
      
      // Should now be able to consume more (used 5, new limit 50)
      const result = await consume(testProjectId, userId, 30, 'test_key_3');
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(15);
    });

    test('should respect custom limit after set_limit', async () => {
      const userId = 'user_set_limit_3';
      
      // Set limit to 5
      await setLimit(testProjectId, userId, 5);
      
      // Consume 5 units
      const result1 = await consume(testProjectId, userId, 5, 'test_key_4');
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(0);
      
      // Try to consume more - should fail
      const result2 = await consume(testProjectId, userId, 1, 'test_key_5');
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe('insufficient_balance');
      expect(result2.remaining).toBe(0);
    });

    test('should handle set_limit with zero', async () => {
      const userId = 'user_set_limit_4';
      
      // Set limit to 0
      await setLimit(testProjectId, userId, 0);
      
      // Try to consume - should fail immediately
      const result = await consume(testProjectId, userId, 1, 'test_key_6');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.remaining).toBe(0);
    });
  });
});
