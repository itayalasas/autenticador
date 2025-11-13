-- Script para arreglar los ambientes del Plan Profesional
-- Este script actualiza el plan para incluir acceso a production

-- Primero, verificamos el plan actual
SELECT
  id,
  name,
  limits->>'environments' as environments_actual,
  limits->>'applications' as max_apps
FROM subscription_plans
WHERE name = 'Plan Profesional';

-- Actualizar el Plan Profesional para incluir todos los ambientes
UPDATE subscription_plans
SET
  limits = jsonb_set(
    limits,
    '{environments}',
    '["development", "testing", "production"]'::jsonb
  ),
  updated_at = now()
WHERE name = 'Plan Profesional';

-- Verificar el cambio
SELECT
  id,
  name,
  limits->>'environments' as environments_actualizados,
  limits->>'applications' as max_apps,
  limits->>'users_per_app' as max_users,
  limits->>'api_requests_per_month' as api_requests
FROM subscription_plans
WHERE name = 'Plan Profesional';
