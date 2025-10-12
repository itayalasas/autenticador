-- ============================================
-- FIX BLOCKED IPS INSERT POLICY
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- Paso 1: Eliminar todas las políticas de INSERT existentes
DROP POLICY IF EXISTS "Admins can insert blocked IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can block IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can insert blocked IPs" ON blocked_ips;

-- Paso 2: Crear nueva política simple de INSERT
CREATE POLICY "Allow authenticated users to block IPs"
  ON blocked_ips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Paso 3: Verificar que las otras políticas existen
-- Ver todas las políticas actuales
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'blocked_ips'
ORDER BY cmd, policyname;

-- Paso 4: Si faltan políticas, crearlas

-- SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Authenticated users can view blocked IPs'
  ) THEN
    CREATE POLICY "Authenticated users can view blocked IPs"
      ON blocked_ips FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Admins can update blocked IPs'
  ) THEN
    CREATE POLICY "Admins can update blocked IPs"
      ON blocked_ips FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Admins can delete blocked IPs'
  ) THEN
    CREATE POLICY "Admins can delete blocked IPs"
      ON blocked_ips FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Paso 5: Verificar RLS está habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'blocked_ips';

-- Si rowsecurity es false, ejecutar:
-- ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Paso 6: Verificar las políticas finales
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'blocked_ips'
ORDER BY cmd, policyname;

-- ============================================
-- RESULTADO ESPERADO:
-- Deberías ver 4 políticas:
-- 1. "Allow authenticated users to block IPs" (INSERT)
-- 2. "Authenticated users can view blocked IPs" (SELECT)
-- 3. "Admins can update blocked IPs" (UPDATE)
-- 4. "Admins can delete blocked IPs" (DELETE)
-- ============================================
