# ⚡ SOLUCIÓN DEFINITIVA - API Key con key_hash

## El Problema

La tabla `api_keys` tiene `key_hash` (API key hasheada) pero la Edge Function busca por columna `key` (API key en texto plano).

## La Solución Correcta

Necesitamos **agregar la columna `key`** para almacenar la API key en texto plano. Esto es estándar para validación de API keys.

---

## 🎯 EJECUTA ESTE SCRIPT (Copy-Paste)

Ve a Supabase SQL Editor: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/editor

```sql
-- =============================================
-- SOLUCIÓN COMPLETA EN 1 SCRIPT
-- =============================================

-- 1. Agregar columna 'key' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN key text;
    RAISE NOTICE '✅ Columna key agregada';
  END IF;
END $$;

-- 2. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- 3. Ver todas tus aplicaciones (para obtener el UUID correcto)
SELECT 
  '🔍 TUS APLICACIONES' as info,
  id as application_id,
  name,
  description
FROM applications
ORDER BY created_at DESC;

-- 4. Ver todas tus API keys actuales
SELECT 
  '🔑 TUS API KEYS' as info,
  id,
  application_id,
  name,
  key,
  key_hash,
  key_preview,
  environment,
  is_active
FROM api_keys
ORDER BY created_at DESC;

-- =============================================
-- IMPORTANTE: Después de ver los resultados:
-- =============================================
-- 1. Copia el 'application_id' (UUID completo) de tu aplicación
-- 2. Copia el 'id' de la API key que quieres actualizar
-- 3. Ejecuta el siguiente UPDATE reemplazando los valores

-- EJEMPLO (REEMPLAZA CON TUS VALORES):
/*
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE id = 'TU_API_KEY_ID_AQUI';
*/

-- 5. Verificar que funcionó
/*
SELECT 
  '✅ VERIFICACIÓN' as info,
  id,
  application_id,
  name,
  key,
  environment
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda';
*/
```

---

## 📋 Pasos Después de Ejecutar

1. **Ejecuta el script** - Verás tus aplicaciones y API keys
2. **Copia el `application_id`** (UUID completo, ejemplo: `e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f`)
3. **Copia el `id` de tu API key**
4. **Ejecuta el UPDATE** (descomenta y reemplaza con tus valores)
5. **Ejecuta la verificación** (descomenta)

---

## 🧪 Probar en Postman

Usa el `application_id` **real** (UUID) que obtuviste:

```json
{
  "application_id": "e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f",
  "api_key": "ak_production_042a5f866c7e35630a9340bd224cbdda",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**URL:** `POST https://auth-systemv1.netlify.app/api/user/search`

---

## ⚠️ Notas Importantes

1. **application_id** debe ser un UUID completo (sin prefijo "app_")
2. La columna `key` almacena la API key en texto plano
3. La columna `key_hash` se mantiene para seguridad adicional
4. Asegúrate de que `is_active` sea `true` en tu API key

---

## 🆘 Si No Tienes Datos

Si no ves aplicaciones ni API keys, crea una aplicación de prueba:

```sql
-- Crear aplicación
INSERT INTO applications (name, description)
VALUES ('Mi Aplicación', 'App de prueba')
RETURNING id, name;

-- Copiar el ID que aparece y usarlo abajo:
-- Crear API key (reemplaza TU_APP_ID_AQUI)
INSERT INTO api_keys (
  application_id,
  name,
  key,
  key_hash,
  key_preview,
  environment,
  is_active
)
VALUES (
  'TU_APP_ID_AQUI',
  'Production Key',
  'ak_production_042a5f866c7e35630a9340bd224cbdda',
  '$2a$10$hash_placeholder',
  'ak_prod...bdda',
  'production',
  true
)
RETURNING id, application_id, key, environment;

-- Crear usuario de prueba
INSERT INTO app_users (
  application_id,
  email,
  full_name,
  password_hash,
  is_active
)
VALUES (
  'TU_APP_ID_AQUI',
  'juan@example.com',
  'Juan Pérez',
  '$2a$10$hash_placeholder',
  true
)
RETURNING id, email, full_name;
```

Ahora ejecuta el primer script de nuevo y verás todo configurado ✅
