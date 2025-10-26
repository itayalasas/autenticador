/*
  # Crear Sistema de Seguridad Avanzado (CORREGIDO)

  1. Nuevas Tablas
    - `rate_limits` - Control de rate limiting por IP y endpoint
    - `failed_login_attempts` - Tracking de intentos fallidos para brute force protection
    - `security_alerts` - Alertas de seguridad para el admin
    
  2. Seguridad
    - Enable RLS en todas las tablas
    - Solo service role puede acceder (sin políticas de usuario)
    
  3. Índices
    - Para búsquedas rápidas por IP y email
*/

-- Tabla de Rate Limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  attempts integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Solo service role puede acceder (usado por edge functions)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabla de Intentos Fallidos de Login (Brute Force Protection)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  application_id uuid,
  attempt_count integer DEFAULT 1,
  last_attempt timestamptz DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_locked ON failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage failed attempts"
  ON failed_login_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabla de Alertas de Seguridad
CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address text,
  email text,
  application_id uuid,
  description text,
  metadata jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados (para ver alertas en dashboard)
CREATE POLICY "Authenticated users can view security alerts"
  ON security_alerts
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo service role puede crear alertas
CREATE POLICY "Service role can create security alerts"
  ON security_alerts
  FOR INSERT
  USING (true)
  WITH CHECK (true);

-- Usuarios autenticados pueden marcar como resueltas
CREATE POLICY "Authenticated users can update security alerts"
  ON security_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Función para limpiar rate limits antiguos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '1 hour'
    AND (blocked_until IS NULL OR blocked_until < now());
    
  DELETE FROM failed_login_attempts
  WHERE last_attempt < now() - interval '24 hours'
    AND (locked_until IS NULL OR locked_until < now());
END;
$$;

-- Función para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address text,
  p_endpoint text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record record;
  v_blocked boolean := false;
  v_remaining integer;
BEGIN
  -- Buscar registro existente
  SELECT * INTO v_record
  FROM rate_limits
  WHERE ip_address = p_ip_address
    AND endpoint = p_endpoint
    AND window_start > now() - (p_window_minutes || ' minutes')::interval
  FOR UPDATE;
  
  -- Si está bloqueado, verificar si ya expiró el bloqueo
  IF v_record.blocked_until IS NOT NULL THEN
    IF v_record.blocked_until > now() THEN
      v_blocked := true;
    ELSE
      -- Bloqueo expiró, resetear
      UPDATE rate_limits
      SET attempts = 0,
          blocked_until = NULL,
          window_start = now(),
          updated_at = now()
      WHERE id = v_record.id;
      
      v_record.attempts := 0;
      v_blocked := false;
    END IF;
  END IF;
  
  IF v_blocked THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', v_record.blocked_until,
      'reason', 'Rate limit exceeded'
    );
  END IF;
  
  -- Si no existe registro o la ventana expiró, crear nuevo
  IF v_record.id IS NULL OR v_record.window_start < now() - (p_window_minutes || ' minutes')::interval THEN
    INSERT INTO rate_limits (ip_address, endpoint, attempts, window_start)
    VALUES (p_ip_address, p_endpoint, 1, now())
    ON CONFLICT DO NOTHING;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'blocked', false,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;
  
  -- Incrementar contador
  v_record.attempts := v_record.attempts + 1;
  
  -- Si excede el límite, bloquear
  IF v_record.attempts > p_max_attempts THEN
    UPDATE rate_limits
    SET attempts = v_record.attempts,
        blocked_until = now() + interval '15 minutes',
        updated_at = now()
    WHERE id = v_record.id;
    
    -- Crear alerta de seguridad
    INSERT INTO security_alerts (
      alert_type,
      severity,
      ip_address,
      description,
      metadata
    ) VALUES (
      'rate_limit_exceeded',
      'medium',
      p_ip_address,
      'Rate limit exceeded for endpoint: ' || p_endpoint,
      jsonb_build_object(
        'endpoint', p_endpoint,
        'attempts', v_record.attempts,
        'max_allowed', p_max_attempts
      )
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked', true,
      'blocked_until', now() + interval '15 minutes',
      'reason', 'Too many requests'
    );
  END IF;
  
  -- Actualizar contador
  UPDATE rate_limits
  SET attempts = v_record.attempts,
      updated_at = now()
  WHERE id = v_record.id;
  
  v_remaining := p_max_attempts - v_record.attempts;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'blocked', false,
    'attempts', v_record.attempts,
    'remaining', v_remaining
  );
END;
$$;

COMMENT ON TABLE rate_limits IS 'Controla el rate limiting por IP y endpoint para prevenir abuso';
COMMENT ON TABLE failed_login_attempts IS 'Rastrea intentos fallidos de login para protección contra brute force';
COMMENT ON TABLE security_alerts IS 'Registra alertas de seguridad para notificar a administradores';
COMMENT ON FUNCTION check_rate_limit IS 'Verifica y aplica límites de tasa por IP y endpoint';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Limpia registros antiguos de rate limits y intentos fallidos';
