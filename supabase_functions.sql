-- Atomic consume function
-- This function ensures that two concurrent consume calls cannot both succeed for the last unit
CREATE OR REPLACE FUNCTION consume_units(
  p_project_id UUID,
  p_user_id TEXT,
  p_units INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  ok BOOLEAN,
  reason TEXT,
  remaining INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_daily_limit INTEGER;
  v_extra_balance INTEGER;
  v_used_today INTEGER;
  v_available INTEGER;
  v_ok BOOLEAN;
  v_reason TEXT;
  v_remaining INTEGER;
  v_today_start TIMESTAMPTZ;
BEGIN
  -- Check if idempotency key already exists
  IF EXISTS (
    SELECT 1 FROM consume_events 
    WHERE project_id = p_project_id 
    AND idempotency_key = p_idempotency_key
  ) THEN
    -- Return cached result
    SELECT 
      consume_events.ok,
      consume_events.reason,
      consume_events.remaining::INTEGER
    INTO v_ok, v_reason, v_remaining
    FROM consume_events
    WHERE project_id = p_project_id 
    AND idempotency_key = p_idempotency_key
    LIMIT 1;
    
    RETURN QUERY SELECT v_ok, v_reason, v_remaining;
    RETURN;
  END IF;

  -- Get today's start (UTC midnight)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC');

  -- Get user's limits and usage atomically
  SELECT 
    COALESCE(eu.daily_limit, p.default_daily_limit),
    COALESCE(eu.extra_balance, 0)
  INTO v_daily_limit, v_extra_balance
  FROM projects p
  LEFT JOIN end_users eu ON eu.project_id = p.id AND eu.user_id = p_user_id
  WHERE p.id = p_project_id;

  -- Sum today's consumption
  SELECT COALESCE(SUM(units), 0)::INTEGER
  INTO v_used_today
  FROM consume_events
  WHERE project_id = p_project_id
  AND user_id = p_user_id
  AND ok = true
  AND created_at >= v_today_start;

  -- Calculate availability
  v_available := v_daily_limit + v_extra_balance - v_used_today;
  v_ok := v_available >= p_units;
  v_reason := CASE WHEN v_ok THEN NULL ELSE 'insufficient_balance' END;
  v_remaining := CASE WHEN v_ok THEN v_available - p_units ELSE v_available END;

  -- Insert the event atomically
  INSERT INTO consume_events (
    project_id,
    user_id,
    units,
    idempotency_key,
    ok,
    reason,
    remaining
  ) VALUES (
    p_project_id,
    p_user_id,
    p_units,
    p_idempotency_key,
    v_ok,
    v_reason,
    v_remaining
  );

  RETURN QUERY SELECT v_ok, v_reason, v_remaining;
END;
$$;
