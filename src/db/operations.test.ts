import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { createSandboxProject, verifyApiKey, consume, whyDenied } from './operations.js';
import { supabase } from './client.js';

describe('Cap Operations', () => {
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

  describe('API Key Management', () => {
    test('should create sandbox project with API key', async () => {
      const result = await createSandboxProject();
      expect(result.projectId).toBeTruthy();
      expect(result.apiKey).toMatch(/^cap_/);
    });

    test('should verify valid API key', async () => {
      const project = await verifyApiKey(testApiKey);
      expect(project).toBeTruthy();
      expect(project?.id).toBe(testProjectId);
    });

    test('should reject invalid API key', async () => {
      const project = await verifyApiKey('cap_invalid_key');
      expect(project).toBeNull();
    });
  });

  describe('Consume - Allow', () => {
    test('should allow consumption within daily limit', async () => {
      const result = await consume(testProjectId, 'user_allow_1', 1);
      
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(19);
      expect(result.reason).toBeUndefined();
    });

    test('should track multiple consumptions', async () => {
      const result1 = await consume(testProjectId, 'user_allow_2', 5);
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(15);

      const result2 = await consume(testProjectId, 'user_allow_2', 3);
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(12);
    });

    test('should allow consumption up to exact limit', async () => {
      const result = await consume(testProjectId, 'user_allow_3', 20);
      
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Consume - Deny', () => {
    test('should deny consumption over daily limit', async () => {
      await consume(testProjectId, 'user_deny_1', 20);
      
      const result = await consume(testProjectId, 'user_deny_1', 1);
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.remaining).toBe(0);
    });

    test('should deny when requesting more than available', async () => {
      await consume(testProjectId, 'user_deny_2', 15);
      
      const result = await consume(testProjectId, 'user_deny_2', 10);
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.remaining).toBe(5);
    });

    test('should deny when requesting more than limit initially', async () => {
      const result = await consume(testProjectId, 'user_deny_3', 25);
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.remaining).toBe(20);
    });
  });

  describe('Consume - Idempotency', () => {
    test('should return same result for duplicate idempotency key', async () => {
      const idempotencyKey = 'test_idem_1';
      
      const result1 = await consume(testProjectId, 'user_idem_1', 5, idempotencyKey);
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(15);
      
      const result2 = await consume(testProjectId, 'user_idem_1', 5, idempotencyKey);
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(15);
      
      const events = await supabase
        .from('consume_events')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('user_id', 'user_idem_1');
      
      expect(events.data?.length).toBe(1);
    });

    test('should handle idempotent denied requests', async () => {
      await consume(testProjectId, 'user_idem_2', 20);
      
      const idempotencyKey = 'test_idem_2';
      const result1 = await consume(testProjectId, 'user_idem_2', 5, idempotencyKey);
      expect(result1.ok).toBe(false);
      expect(result1.reason).toBe('insufficient_balance');
      
      const result2 = await consume(testProjectId, 'user_idem_2', 5, idempotencyKey);
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe('insufficient_balance');
      expect(result2.remaining).toBe(result1.remaining);
    });

    test('should allow different requests with different idempotency keys', async () => {
      const result1 = await consume(testProjectId, 'user_idem_3', 5, 'key_1');
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(15);
      
      const result2 = await consume(testProjectId, 'user_idem_3', 5, 'key_2');
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(10);
    });
  });

  describe('Why Denied', () => {
    test('should provide balance details for user with available balance', async () => {
      await consume(testProjectId, 'user_why_1', 5);
      
      const result = await whyDenied(testProjectId, 'user_why_1');
      
      expect(result.reason).toBe('sufficient_balance');
      expect(result.details.dailyLimit).toBe(20);
      expect(result.details.usedToday).toBe(5);
      expect(result.details.available).toBe(15);
    });

    test('should explain insufficient balance', async () => {
      await consume(testProjectId, 'user_why_2', 20);
      
      const result = await whyDenied(testProjectId, 'user_why_2');
      
      expect(result.reason).toBe('insufficient_balance');
      expect(result.details.dailyLimit).toBe(20);
      expect(result.details.usedToday).toBe(20);
      expect(result.details.available).toBe(0);
    });

    test('should show details for new user', async () => {
      const result = await whyDenied(testProjectId, 'user_why_3');
      
      expect(result.reason).toBe('sufficient_balance');
      expect(result.details.dailyLimit).toBe(20);
      expect(result.details.usedToday).toBe(0);
      expect(result.details.available).toBe(20);
    });
  });

  describe('Custom Limits', () => {
    test('should respect custom daily limit for end user', async () => {
      await supabase
        .from('end_users')
        .insert({
          project_id: testProjectId,
          user_id: 'user_custom_1',
          daily_limit: 50,
        });
      
      const result1 = await consume(testProjectId, 'user_custom_1', 30);
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(20);
      
      const result2 = await consume(testProjectId, 'user_custom_1', 20);
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(0);
    });

    test('should use extra balance', async () => {
      await supabase
        .from('end_users')
        .insert({
          project_id: testProjectId,
          user_id: 'user_custom_2',
          extra_balance: 10,
        });
      
      const result1 = await consume(testProjectId, 'user_custom_2', 25);
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(5);
      
      const result2 = await consume(testProjectId, 'user_custom_2', 5);
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(0);
    });
  });
});
