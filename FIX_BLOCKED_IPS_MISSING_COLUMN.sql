-- ============================================
-- AGREGAR COLUMNA blocked_at A blocked_ips
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- Paso 1: Ver estructura actual de la tabla
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'blocked_ips'
ORDER BY ordinal_position;

-- Paso 2: Agregar columna blocked_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'blocked_ips' AND column_name = 'blocked_at'
    ) THEN
        ALTER TABLE blocked_ips
        ADD COLUMN blocked_at timestamptz DEFAULT now();

        RAISE NOTICE 'Columna blocked_at agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna blocked_at ya existe';
    END IF;
END $$;

-- Paso 3: Actualizar registros existentes que tengan blocked_at como NULL
UPDATE blocked_ips
SET blocked_at = created_at
WHERE blocked_at IS NULL AND created_at IS NOT NULL;

UPDATE blocked_ips
SET blocked_at = now()
WHERE blocked_at IS NULL;

-- Paso 4: Hacer la columna NOT NULL (opcional, recomendado)
ALTER TABLE blocked_ips
ALTER COLUMN blocked_at SET NOT NULL;

-- Paso 5: Verificar la estructura final
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'blocked_ips'
ORDER BY ordinal_position;

-- Paso 6: Verificar los datos
SELECT
    id,
    ip_address,
    reason,
    is_active,
    blocked_at,
    created_at
FROM blocked_ips
ORDER BY blocked_at DESC
LIMIT 5;

-- ============================================
-- RESULTADO ESPERADO:
-- La tabla blocked_ips debe tener ahora:
-- - id (uuid)
-- - ip_address (text)
-- - reason (text)
-- - blocked_by (uuid)
-- - is_active (boolean)
-- - blocked_at (timestamptz) <- NUEVA COLUMNA
-- - created_at (timestamptz)
-- - unblocked_at (timestamptz, nullable)
-- - application_id (uuid, nullable)
-- ============================================
