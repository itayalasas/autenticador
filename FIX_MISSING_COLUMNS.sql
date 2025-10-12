/*
  Script para agregar columnas faltantes a la tabla applications

  INSTRUCCIONES:
  1. Ve a tu panel de Supabase: https://supabase.com/dashboard
  2. Selecciona tu proyecto
  3. Ve a "SQL Editor" en el menú lateral
  4. Copia y pega este script completo
  5. Haz clic en "Run" para ejecutarlo

  Este script es seguro y NO afectará tus datos existentes.
*/

-- Agregar columnas faltantes si no existen
DO $$
BEGIN
  -- Agregar max_failed_attempts si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications'
    AND column_name = 'max_failed_attempts'
  ) THEN
    ALTER TABLE applications
    ADD COLUMN max_failed_attempts integer DEFAULT 5;

    COMMENT ON COLUMN applications.max_failed_attempts
    IS 'Maximum failed login attempts before auto-blocking IP. NULL = manual only.';

    RAISE NOTICE '✅ Columna max_failed_attempts agregada exitosamente';
  ELSE
    RAISE NOTICE '✓ Columna max_failed_attempts ya existe';
  END IF;

  -- Agregar auto_block_enabled si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications'
    AND column_name = 'auto_block_enabled'
  ) THEN
    ALTER TABLE applications
    ADD COLUMN auto_block_enabled boolean DEFAULT true;

    COMMENT ON COLUMN applications.auto_block_enabled
    IS 'Enable or disable automatic IP blocking feature.';

    RAISE NOTICE '✅ Columna auto_block_enabled agregada exitosamente';
  ELSE
    RAISE NOTICE '✓ Columna auto_block_enabled ya existe';
  END IF;

  -- Agregar email_config si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications'
    AND column_name = 'email_config'
  ) THEN
    ALTER TABLE applications
    ADD COLUMN email_config jsonb DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN applications.email_config
    IS 'Email configuration including SMTP settings and email providers.';

    RAISE NOTICE '✅ Columna email_config agregada exitosamente';
  ELSE
    RAISE NOTICE '✓ Columna email_config ya existe';
  END IF;

  -- Agregar metadata si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE applications
    ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN applications.metadata
    IS 'Additional metadata and configuration for the application.';

    RAISE NOTICE '✅ Columna metadata agregada exitosamente';
  ELSE
    RAISE NOTICE '✓ Columna metadata ya existe';
  END IF;
END $$;

-- Verificar que todas las columnas existen
SELECT
  'applications' as tabla,
  column_name as columna,
  data_type as tipo,
  column_default as valor_por_defecto
FROM information_schema.columns
WHERE table_name = 'applications'
AND column_name IN ('max_failed_attempts', 'auto_block_enabled', 'email_config', 'metadata')
ORDER BY column_name;
