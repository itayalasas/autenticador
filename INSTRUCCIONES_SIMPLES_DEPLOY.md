# ⚡ SOLUCIÓN FINAL SIMPLE - 3 Pasos

## 📋 Resumen del Problema

1. ✅ La tabla `api_keys` tiene `key_hash` pero la Edge Function busca por `key`
2. ✅ El `application_id` debe ser un UUID válido (sin prefijo "app_")
3. ✅ La Edge Function ahora valida correctamente la aplicación primero

---

## 🎯 SOLUCIÓN (3 Pasos Simples)

### PASO 1: Ejecutar Script SQL

Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/editor

Copia y ejecuta este script completo:

```sql
-- Agregar columna 'key' para API keys en texto plano
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key text;

-- Crear índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_unique 
ON api_keys(key) WHERE key IS NOT NULL;

-- Ver tus aplicaciones (COPIA EL UUID)
SELECT 
  '📱 TUS APLICACIONES' as paso,
  id as application_id_uuid,
  name,
  description
FROM applications
ORDER BY created_at DESC;

-- Ver tus API keys (COPIA EL ID)
SELECT 
  '🔑 TUS API KEYS' as paso,
  id as api_key_id,
  application_id,
  name,
  key,
  key_preview,
  environment,
  is_active
FROM api_keys
ORDER BY created_at DESC;
```

**Resultado:**
- Verás el UUID completo de tu aplicación (ejemplo: `e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f`)
- Verás el ID de tu API key

---

### PASO 2: Actualizar tu API Key

Ejecuta esto reemplazando con TU api_key_id:

```sql
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE id = 'TU_API_KEY_ID_AQUI';

-- Verificar
SELECT 
  '✅ VERIFICACIÓN' as resultado,
  id,
  application_id,
  name,
  key,
  environment
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda';
```

Deberías ver tu API key con todos los datos correctos.

---

### PASO 3: Desplegar la Edge Function Actualizada

La Edge Function ha sido actualizada en tu código local. Ahora necesitas desplegarla:

**Opción A: Usando Supabase Dashboard**

1. Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions
2. Busca la función `user-search`
3. Click en "Deploy" o "Update"
4. Copia el contenido de: `/supabase/functions/user-search/index.ts`
5. Pégalo y despliega

**Opción B: Usando CLI (si tienes instalado Supabase CLI)**

```bash
supabase functions deploy user-search
```

---

## 🧪 PASO 4: Probar en Postman

**URL:**
```
POST https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/user-search
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer TU_SUPABASE_ANON_KEY
```

**Body (usa el UUID real del PASO 1):**
```json
{
  "application_id": "e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f",
  "api_key": "ak_production_042a5f866c7e35630a9340bd224cbdda",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

---

## 🔍 Lo Que Cambió en la Edge Function

1. ✅ Primero valida que el `application_id` existe en la tabla `applications`
2. ✅ Luego busca la API key por la columna `key` (texto plano)
3. ✅ Verifica que la API key pertenece a esa aplicación
4. ✅ Verifica que la API key está activa

---

## ⚠️ Notas Importantes

1. **application_id** debe ser el UUID completo (no uses `app_a6f840c5-bd1`)
2. La columna `key` almacena la API key en texto plano para validación directa
3. La columna `key_hash` se puede usar como respaldo de seguridad
4. La Edge Function debe estar desplegada en Supabase para que funcione

---

## 🆘 Si No Tienes Datos de Prueba

Si no ves aplicaciones ni API keys, ejecuta esto:

```sql
-- Crear aplicación de prueba
INSERT INTO applications (name, description)
VALUES ('App de Prueba', 'Aplicación para testing')
RETURNING id, name;

-- COPIA EL ID y úsalo abajo reemplazando TU_APP_ID

-- Crear API key
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
  'TU_APP_ID',
  'Production Key',
  'ak_production_042a5f866c7e35630a9340bd224cbdda',
  '$2a$10$placeholder_hash_value_here',
  'ak_prod...bdda',
  'production',
  true
)
RETURNING id, application_id, key;

-- Crear usuario de prueba
INSERT INTO app_users (
  application_id,
  email,
  full_name,
  password_hash,
  is_active
)
VALUES (
  'TU_APP_ID',
  'juan@example.com',
  'Juan Pérez',
  '$2a$10$placeholder_hash',
  true
)
RETURNING id, email, full_name;
```

Ahora ejecuta el PASO 1 de nuevo y verás todo configurado ✅
