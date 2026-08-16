import { supabase } from './client.js';
import { createHash } from 'crypto';

export interface Project {
  id: string;
  name: string;
  default_daily_limit: number;
  fail_closed: boolean;
}

export interface ConsumeResult {
  ok: boolean;
  reason?: string;
  remaining?: number;
}

export async function hashApiKey(key: string): Promise<string> {
  return createHash('sha256').update(key).digest('hex');
}

export async function verifyApiKey(key: string): Promise<Project | null> {
  const keyHash = await hashApiKey(key);
  
  const { data: apiKey } = await supabase
    .from('api_keys')
    .select('project_id')
    .eq('key_hash', keyHash)
    .single();
  
  if (!apiKey) return null;
  
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', apiKey.project_id)
    .single();
  
  return project;
}

export async function createSandboxProject(): Promise<{ projectId: string; apiKey: string }> {
  const { nanoid } = await import('nanoid');
  
  const claimToken = nanoid(32);
  
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: 'sandbox',
      default_daily_limit: 20,
      fail_closed: true,
      claim_token: claimToken
    })
    .select()
    .single();
  
  if (projectError || !project) {
    throw new Error('Failed to create sandbox project');
  }
  
  const apiKey = `cap_${nanoid(32)}`;
  const keyHash = await hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 11);
  
  const { error: keyError } = await supabase
    .from('api_keys')
    .insert({
      project_id: project.id,
      key_prefix: keyPrefix,
      key_hash: keyHash
    });
  
  if (keyError) {
    throw new Error('Failed to create API key');
  }
  
  return { projectId: project.id, apiKey };
}

export async function consume(
  projectId: string,
  userId: string,
  units: number,
  idempotencyKey?: string
): Promise<ConsumeResult> {
  const { nanoid } = await import('nanoid');
  const effectiveIdempotencyKey = idempotencyKey || nanoid();
  
  const { data: existing } = await supabase
    .from('consume_events')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('idempotency_key', effectiveIdempotencyKey)
    .single();
  
  if (existing) {
    return {
      ok: existing.ok,
      reason: existing.reason || undefined,
      remaining: existing.remaining !== null ? Number(existing.remaining) : undefined
    };
  }
  
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (!project) {
    return { ok: false, reason: 'project_not_found' };
  }
  
  const { data: endUser } = await supabase
    .from('end_users')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  
  const dailyLimit = endUser?.daily_limit !== null 
    ? Number(endUser.daily_limit) 
    : Number(project.default_daily_limit);
  const extraBalance = endUser ? Number(endUser.extra_balance) : 0;
  
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const { data: todayEvents } = await supabase
    .from('consume_events')
    .select('units')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('ok', true)
    .gte('created_at', todayStart.toISOString());
  
  const usedToday = todayEvents?.reduce((sum, e) => sum + Number(e.units), 0) || 0;
  const available = dailyLimit + extraBalance - usedToday;
  
  const ok = available >= units;
  const reason = ok ? undefined : 'insufficient_balance';
  const remaining = ok ? available - units : available;
  
  await supabase
    .from('consume_events')
    .insert({
      project_id: projectId,
      user_id: userId,
      units,
      idempotency_key: effectiveIdempotencyKey,
      ok,
      reason: reason || null,
      remaining
    });
  
  return { ok, reason, remaining };
}

export async function whyDenied(
  projectId: string,
  userId: string
): Promise<{ reason: string; details: any }> {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (!project) {
    return { 
      reason: 'project_not_found',
      details: { projectId }
    };
  }
  
  const { data: endUser } = await supabase
    .from('end_users')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  
  const dailyLimit = endUser?.daily_limit !== null 
    ? Number(endUser.daily_limit) 
    : Number(project.default_daily_limit);
  const extraBalance = endUser ? Number(endUser.extra_balance) : 0;
  
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const { data: todayEvents } = await supabase
    .from('consume_events')
    .select('units')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('ok', true)
    .gte('created_at', todayStart.toISOString());
  
  const usedToday = todayEvents?.reduce((sum, e) => sum + Number(e.units), 0) || 0;
  const available = dailyLimit + extraBalance - usedToday;
  
  return {
    reason: available > 0 ? 'sufficient_balance' : 'insufficient_balance',
    details: {
      userId,
      dailyLimit,
      extraBalance,
      usedToday,
      available
    }
  };
}
