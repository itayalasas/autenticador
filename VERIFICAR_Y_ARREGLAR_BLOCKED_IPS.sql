-- ============================================
-- VERIFICAR Y ARREGLAR TABLA BLOCKED_IPS
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- Paso 1: Verificar estructura actual de la tabla
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'blocked_ips'
ORDER BY ordinal_position;

-- Paso 2: Si la columna application_id NO existe, agregarla
DO $$
BEGIN
  -- Verificar si la columna existe
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'blocked_ips'
    AND column_name = 'application_id'
  ) THEN
    -- Agregar la columna
    ALTER TABLE blocked_ips
    ADD COLUMN application_id uuid REFERENCES applications(id) ON DELETE CASCADE;

    RAISE NOTICE 'Columna application_id agregada exitosamente';
  ELSE
    RAISE NOTICE 'La columna application_id ya existe';
  END IF;
END $$;

-- Paso 3: Verificar que el constraint de foreign key existe
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'blocked_ips';

-- Paso 4: Crear índice si no existe
CREATE INDEX IF NOT EXISTS idx_blocked_ips_application
ON blocked_ips(application_id)
WHERE is_active = true;

-- Paso 5: Verificar RLS está habilitado
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'blocked_ips';

-- Paso 6: Verificar políticas RLS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'blocked_ips'
ORDER BY cmd, policyname;

-- Paso 7: Asegurar que las políticas correctas existen
-- DROP existing problematic policies
DROP POLICY IF EXISTS "Admins can insert blocked IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can block IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can insert blocked IPs" ON blocked_ips;

-- CREATE simple INSERT policy
CREATE POLICY "Allow authenticated users to block IPs"
  ON blocked_ips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure SELECT policy exists
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

-- Ensure UPDATE policy exists
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

-- Ensure DELETE policy exists
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

-- Paso 8: Verificación final - Mostrar estructura completa
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'blocked_ips'
ORDER BY ordinal_position;

-- Paso 9: Mostrar políticas finales
SELECT
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'blocked_ips'
ORDER BY cmd, policyname;

-- ============================================
-- INSTRUCCIONES:
-- 1. Ejecuta este script completo
-- 2. Revisa los resultados
-- 3. La columna application_id debe aparecer en la lista
-- 4. Deben existir 4 políticas (SELECT, INSERT, UPDATE, DELETE)
-- ============================================
