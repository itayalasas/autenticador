/*
  # Agregar role_id a app_users

  1. Cambios
    - Agregar columna `role_id` a la tabla `app_users`
    - Crear relación con `application_roles`
    - Permitir null para compatibilidad con usuarios existentes

  2. Seguridad
    - No se requieren cambios en RLS
*/

-- Add role_id column to app_users
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES application_roles(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_app_users_role_id ON app_users(role_id);