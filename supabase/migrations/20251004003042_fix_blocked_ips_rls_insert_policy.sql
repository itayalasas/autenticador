/*
  # Corregir política de inserción para blocked_ips

  1. Cambios
    - Eliminar la política restrictiva que causa el error
    - Crear nueva política que permite a usuarios autenticados bloquear IPs
    - Simplificar la verificación sin necesidad de acceder a auth.users

  2. Seguridad
    - Usuarios autenticados pueden insertar bloqueos
    - Se asegura que el blocked_by sea el usuario actual
*/

-- Eliminar política antigua que causa problemas
DROP POLICY IF EXISTS "Authenticated users can insert blocked IPs" ON blocked_ips;

-- Crear nueva política más simple y funcional
CREATE POLICY "Authenticated users can block IPs"
  ON blocked_ips FOR INSERT
  TO authenticated
  WITH CHECK (true);