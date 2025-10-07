/*
  Script para corregir el error de registro de usuarios

  PROBLEMA:
  - La tabla auth_logs tiene RLS habilitado
  - Las políticas solo permiten inserts a usuarios "authenticated"
  - Durante el registro, el usuario NO está autenticado todavía
  - Esto causa que falle la inserción de logs durante el signup

  SOLUCIÓN:
  - Permitir inserts cuando auth.uid() es NULL (llamadas del sistema/triggers)
  - Mantener la seguridad para usuarios autenticados

  INSTRUCCIONES:
  1. Ve a tu dashboard de Supabase
  2. Navega a SQL Editor
  3. Copia y pega este script completo
  4. Ejecuta el script
*/

-- Eliminar la política restrictiva existente
DROP POLICY IF EXISTS "Authenticated users can insert auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Service can insert auth logs" ON auth_logs;

-- Crear nueva política que permite inserts del sistema Y usuarios autenticados
CREATE POLICY "Allow system and authenticated auth log inserts"
  ON auth_logs
  FOR INSERT
  WITH CHECK (
    -- Permitir si es una llamada del sistema (auth.uid() es NULL)
    -- O si es un usuario autenticado
    auth.uid() IS NULL OR auth.role() = 'authenticated'
  );

-- Verificar que la política se creó correctamente
SELECT
  policyname,
  cmd as command,
  with_check
FROM pg_policies
WHERE tablename = 'auth_logs'
  AND policyname = 'Allow system and authenticated auth log inserts';
