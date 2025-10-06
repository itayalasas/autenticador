/*
  # Sistema de Notificaciones

  1. Nueva Tabla: `notifications`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key a auth.users)
    - `title` (text) - Título de la notificación
    - `message` (text) - Mensaje de la notificación
    - `type` (text) - Tipo: info, success, warning, error
    - `category` (text) - Categoría: security, billing, system, application
    - `is_read` (boolean) - Si fue leída
    - `link` (text, nullable) - Link opcional para más detalles
    - `metadata` (jsonb, nullable) - Datos adicionales
    - `created_at` (timestamptz)
    - `read_at` (timestamptz, nullable)

  2. Nueva Tabla: `notification_preferences`
    - `user_id` (uuid, primary key, foreign key a auth.users)
    - `email_updates` (boolean) - Actualizaciones por email
    - `security_alerts` (boolean) - Alertas de seguridad
    - `billing_notifications` (boolean) - Notificaciones de facturación
    - `product_updates` (boolean) - Actualizaciones de producto
    - `email_frequency` (text) - Frecuencia: immediate, daily, weekly
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Seguridad
    - Habilitar RLS en ambas tablas
    - Usuarios solo pueden ver/editar sus propias notificaciones y preferencias
*/

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category text NOT NULL DEFAULT 'system' CHECK (category IN ('security', 'billing', 'system', 'application')),
  is_read boolean DEFAULT false,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para notificaciones
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Crear tabla de preferencias de notificaciones
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_updates boolean DEFAULT true,
  security_alerts boolean DEFAULT true,
  billing_notifications boolean DEFAULT true,
  product_updates boolean DEFAULT false,
  email_frequency text DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para preferencias
CREATE POLICY "Users can view own preferences"
  ON notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at_trigger ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at_trigger
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Función para crear notificación de bienvenida
CREATE OR REPLACE FUNCTION create_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, category)
  VALUES (
    NEW.id,
    'Bienvenido a AuthSystem',
    'Gracias por unirte a AuthSystem. Estamos emocionados de tenerte aquí.',
    'success',
    'system'
  );
  
  -- Crear preferencias por defecto
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear notificación de bienvenida
DROP TRIGGER IF EXISTS create_welcome_notification_trigger ON auth.users;
CREATE TRIGGER create_welcome_notification_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_welcome_notification();