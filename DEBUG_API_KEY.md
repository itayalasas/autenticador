# 🐛 DEBUG: Obtener Application ID y API Key Correctos

## 📋 EJECUTA ESTE SCRIPT

Copia y pega en Supabase SQL Editor:

```sql
-- =============================================
-- OBTENER INFORMACIÓN CORRECTA
-- =============================================

-- 1. Ver todas las aplicaciones (con sus UUIDs reales)
SELECT 
  '1️⃣ APLICACIONES' as paso,
  id as application_id_correcto,
  name,
  description
FROM applications
ORDER BY created_at DESC;

-- 2. Ver todas las API keys (con sus valores reales)
SELECT 
  '2️⃣ API KEYS' as paso,
  id,
  application_id,
  name,
  key as api_key_completa,
  key_preview,
  environment
FROM api_keys
ORDER BY created_at DESC;

-- 3. Si necesitas agregar la columna 'key' primero
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN key text;
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    RAISE NOTICE '✅ Columna "key" agregada';
  END IF;
END $$;

-- 4. Ver usuarios en alguna aplicación (para verificar que hay datos)
SELECT 
  '3️⃣ USUARIOS' as paso,
  application_id,
  COUNT(*) as total_usuarios
FROM app_users
GROUP BY application_id;

-- 5. Ver columnas de api_keys
SELECT 
  '4️⃣ ESTRUCTURA api_keys' as paso,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
```

---

## 📝 QUÉ HACER CON LOS RESULTADOS

### Resultado 1️⃣ - APLICACIONES
Encontrarás algo como:
```
application_id_correcto: a6f840c5-bd12-4abc-9def-123456789abc
name: Mi Aplicación
```
**👉 Copia el UUID completo (sin el prefijo "app_")**

### Resultado 2️⃣ - API KEYS
Encontrarás:
```
application_id: a6f840c5-bd12-4abc-9def-123456789abc
api_key_completa: ak_production_042a5f866c7e35630a9340bd224cbdda
environment: production
```

**Si `api_key_completa` está NULL:**
```sql
-- Actualizar la API key con el valor correcto
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE id = 'TU_API_KEY_ID_AQUI';
```

---

## 🧪 PRUEBA EN POSTMAN

Usa los valores **reales** de los resultados:

```json
{
  "application_id": "UUID-COMPLETO-DE-PASO-1",
  "api_key": "API-KEY-COMPLETA-DE-PASO-2",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

---

## ⚡ SI NO APARECEN DATOS

Significa que no tienes aplicaciones ni API keys creadas. Ejecuta:

```sql
-- Crear aplicación
INSERT INTO applications (name, description)
VALUES ('App de Prueba', 'Aplicación para testing')
RETURNING id as nuevo_application_id, name;

-- COPIA el 'nuevo_application_id' que aparece

-- Crear API key (reemplaza TU_APP_ID con el UUID de arriba)
INSERT INTO api_keys (
  application_id,
  name,
  key,
  key_preview,
  key_hash,
  environment
)
VALUES (
  'TU_APP_ID',
  'Production Key',
  'ak_production_042a5f866c7e35630a9340bd224cbdda',
  'ak_prod...bdda',
  'hash_placeholder',
  'production'
)
RETURNING id, application_id, key, environment;

-- Crear un usuario de prueba en la aplicación
INSERT INTO app_users (
  application_id,
  email,
  full_name,
  password_hash
)
VALUES (
  'TU_APP_ID',
  'juan@example.com',
  'Juan Pérez',
  '$2a$10$hash_placeholder'
)
RETURNING id, email, full_name;
```

Ahora ejecuta el primer script de nuevo y verás tus datos.
