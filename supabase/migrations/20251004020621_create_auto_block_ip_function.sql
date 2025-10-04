/*
  # Auto-Block IP Function

  1. New Functions
    - `check_and_auto_block_ip` - Checks failed login attempts and auto-blocks IP if threshold is reached
      - Parameters:
        - p_application_id: UUID of the application
        - p_ip_address: IP address to check
        - p_time_window: Minutes to look back for failed attempts (default: 60)
      - Returns: boolean (true if IP was blocked, false otherwise)
    
  2. How it works
    - Counts failed login attempts within the time window
    - Gets the application's auto_block settings
    - If auto_block_enabled AND failed attempts >= max_failed_attempts:
      - Creates a blocked_ips entry
      - Sets expires_at to lockout_duration from metadata
    - Returns true if blocked, false otherwise

  3. Security
    - Function is security definer to allow inserting into blocked_ips
    - Only counts recent failed attempts (within time window)
    - Respects application-specific settings
*/

-- Function to check and auto-block IP based on failed attempts
CREATE OR REPLACE FUNCTION check_and_auto_block_ip(
  p_application_id uuid,
  p_ip_address inet,
  p_time_window integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_count integer;
  v_max_attempts integer;
  v_auto_block_enabled boolean;
  v_lockout_duration integer;
  v_already_blocked boolean;
BEGIN
  -- Check if IP is already blocked
  SELECT EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip_address
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_already_blocked;

  -- If already blocked, return false (no action needed)
  IF v_already_blocked THEN
    RETURN false;
  END IF;

  -- Get application auto-block settings
  SELECT 
    COALESCE(max_failed_attempts, 5),
    COALESCE(auto_block_enabled, true),
    COALESCE((metadata->>'lockout_duration')::integer, 15)
  INTO 
    v_max_attempts,
    v_auto_block_enabled,
    v_lockout_duration
  FROM applications
  WHERE id = p_application_id;

  -- If auto-block is disabled or max_attempts is NULL/0, don't block
  IF NOT v_auto_block_enabled OR v_max_attempts IS NULL OR v_max_attempts <= 0 THEN
    RETURN false;
  END IF;

  -- Count failed login attempts within time window
  SELECT COUNT(*)
  INTO v_failed_count
  FROM auth_logs
  WHERE application_id = p_application_id
    AND ip_address = p_ip_address
    AND event_type = 'failed_login'
    AND success = false
    AND created_at >= NOW() - (p_time_window || ' minutes')::interval;

  -- If failed attempts reached threshold, block the IP
  IF v_failed_count >= v_max_attempts THEN
    INSERT INTO blocked_ips (
      ip_address,
      reason,
      blocked_by_system,
      expires_at,
      metadata
    ) VALUES (
      p_ip_address,
      'Bloqueado automáticamente por ' || v_failed_count || ' intentos fallidos',
      true,
      NOW() + (v_lockout_duration || ' minutes')::interval,
      jsonb_build_object(
        'application_id', p_application_id,
        'failed_attempts', v_failed_count,
        'auto_blocked_at', NOW(),
        'time_window_minutes', p_time_window
      )
    )
    ON CONFLICT (ip_address) WHERE is_active = true
    DO UPDATE SET
      reason = EXCLUDED.reason,
      blocked_at = NOW(),
      expires_at = EXCLUDED.expires_at,
      metadata = EXCLUDED.metadata;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Add comment
COMMENT ON FUNCTION check_and_auto_block_ip IS 'Automatically blocks an IP address if it exceeds the configured failed login attempt threshold for an application';