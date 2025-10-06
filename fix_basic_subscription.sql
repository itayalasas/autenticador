-- ============================================================================
-- SCRIPT PARA CORREGIR PLAN BÁSICO DE SUSCRIPCIÓN
-- ============================================================================
-- Este script asegura que el plan básico gratuito exista en la base de datos
-- con el ID fijo esperado por el sistema.
-- ============================================================================

-- Insertar o actualizar el plan básico con ID fijo
INSERT INTO subscription_plans (
  id,
  name,
  description,
  price,
  currency,
  interval,
  trial_days,
  features,
  limits,
  is_active,
  is_popular
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Básico',
  'Perfecto para comenzar y desarrollo',
  0,
  'USD',
  'month',
  0,
  '["Ambiente Development únicamente", "1 aplicación", "Hasta 100 usuarios", "10,000 requests API por mes", "Soporte comunitario"]'::jsonb,
  '{"applications": 1, "users_per_app": 100, "api_requests_per_month": 10000, "environments": ["development"], "support_level": "basic"}'::jsonb,
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active;

-- Verificar que se haya creado correctamente
SELECT
  id,
  name,
  price,
  currency,
  is_active
FROM subscription_plans
WHERE id = '00000000-0000-0000-0000-000000000000';
