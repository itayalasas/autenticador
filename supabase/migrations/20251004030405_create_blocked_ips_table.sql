/*
  # Tabla de IPs Bloqueadas

  1. Nueva Tabla
    - `blocked_ips`
      - `id` (uuid, primary key)
      - `ip_address` (inet, unique) - Dirección IP bloqueada
      - `reason` (text) - Razón del bloqueo
      - `blocked_by` (uuid, foreign key) - Usuario admin que bloqueó
      - `blocked_at` (timestamptz) - Fecha de bloqueo
      - `expires_at` (timestamptz, nullable) - Fecha de expiración (null = permanente)
      - `application_id` (uuid, nullable, foreign key) - Si es específico de una app
      - `blocked_by_system` (boolean) - Si fue bloqueado automáticamente
      - `is_active` (boolean) - Si el bloqueo está activo
      - `metadata` (jsonb) - Información adicional

  2. Seguridad
    - Enable RLS en `blocked_ips`
    - Políticas para que solo administradores puedan gestionar bloqueos

  3. Índices
    - Índice en `ip_address` para búsquedas rápidas
    - Índice en `is_active` para filtrar bloqueos activos
*/

-- Crear tabla de IPs bloqueadas
CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  reason text NOT NULL,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  blocked_by_system boolean DEFAULT false,
  is_active boolean DEFAULT true NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ip_address, is_active)
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_application ON blocked_ips(application_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips(expires_at) WHERE is_active = true;

-- Función para verificar si una IP está bloqueada
CREATE OR REPLACE FUNCTION is_ip_blocked(
  check_ip inet,
  check_app_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = check_ip
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (application_id IS NULL OR application_id = check_app_id OR check_app_id IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden ver bloqueos
CREATE POLICY "Authenticated users can view blocked IPs"
  ON blocked_ips FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo administradores pueden insertar bloqueos
CREATE POLICY "Admins can insert blocked IPs"
  ON blocked_ips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- Política: Solo administradores pueden actualizar bloqueos
CREATE POLICY "Admins can update blocked IPs"
  ON blocked_ips FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Solo administradores pueden eliminar bloqueos
CREATE POLICY "Admins can delete blocked IPs"
  ON blocked_ips FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_blocked_ips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_blocked_ips_updated_at ON blocked_ips;
CREATE TRIGGER trigger_update_blocked_ips_updated_at
  BEFORE UPDATE ON blocked_ips
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_ips_updated_at();