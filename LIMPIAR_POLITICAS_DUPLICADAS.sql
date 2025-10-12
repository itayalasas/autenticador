-- ============================================
-- LIMPIAR POLÍTICAS INSERT DUPLICADAS
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- Paso 1: Ver todas las políticas INSERT actuales (están duplicadas)
SELECT
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'blocked_ips'
AND cmd = 'INSERT'
ORDER BY policyname;

-- Paso 2: ELIMINAR TODAS las políticas INSERT
DROP POLICY IF EXISTS "Allow authenticated users to block IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Users can insert blocked IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can block IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can insert blocked IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Admins can insert blocked IPs" ON blocked_ips;

-- Paso 3: Crear UNA SOLA política INSERT simple
CREATE POLICY "Users can block IPs"
  ON blocked_ips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Paso 4: Verificar que ahora solo hay UNA política INSERT
SELECT
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'blocked_ips'
AND cmd = 'INSERT'
ORDER BY policyname;

-- Paso 5: Ver todas las políticas para asegurar que tenemos las 4 necesarias
SELECT
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'blocked_ips'
ORDER BY cmd, policyname;

-- ============================================
-- RESULTADO ESPERADO:
-- Debe haber SOLO 4 políticas (una por cada operación):
-- 1. "Users can block IPs" (INSERT)
-- 2. Una política SELECT
-- 3. Una política UPDATE
-- 4. Una política DELETE
-- ============================================
