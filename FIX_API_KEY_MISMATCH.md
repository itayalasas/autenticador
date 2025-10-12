# 🔧 Solución al Error: "Invalid API key or application"

## 🎯 Problema Identificado

La tabla `api_keys` **NO tiene una columna llamada `key`**, solo tiene:
- `key_hash` (hash de la key)  
- `key_preview` (vista previa)

Pero la Edge Function `user-search` busca por la columna `key` que **no existe**.

---

## ✅ Solución Inmediata (3 Pasos)

### 📋 PASO 1: Verificar el Estado Actual

Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/editor

Ejecuta en **SQL Editor**:

```sql
-- Ver estructura de api_keys
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'api_keys';
```

**Resultado esperado:** NO verás la columna `key` en la lista.

---

### 🛠️ PASO 2: Aplicar la Corrección

En el mismo **SQL Editor**, ejecuta TODO este script:

```sql
-- Agregar columna 'key'
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key text;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- Actualizar tu API key
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE application_id = 'app_a6f840c5-bd1';

-- Verificar
SELECT id, application_id, name, key, environment
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1';
```

**Resultado esperado:** Deberías ver tu API key con la columna `key` llena.

---

### 🧪 PASO 3: Probar en Postman

**URL:**
```
POST https://auth-systemv1.netlify.app/api/user/search
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "application_id": "app_a6f840c5-bd1",
  "api_key": "ak_production_042a5f866c7e35630a9340bd224cbdda",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**Respuesta esperada:**
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

## 📊 Verificación Final

Ejecuta en SQL Editor:

```sql
-- Esta es la misma consulta que hace la Edge Function
SELECT id, application_id, environment
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
  AND application_id = 'app_a6f840c5-bd1';
```

Si ves **1 resultado**, todo está correcto ✅

---

## 📁 Archivos de Ayuda

He creado estos archivos en tu proyecto:

1. **FIX_API_KEYS_SCRIPT.sql** - Script completo con comentarios
2. **DIAGNOSTICO_RAPIDO.sql** - Para verificar tu base de datos
3. **FIX_API_KEY_MISMATCH.md** - Esta guía visual

---

## ⚠️ Notas Importantes

1. La Edge Function `user-search` debe estar desplegada en Supabase
2. La columna `key` almacena la API key en texto plano (necesario para validación)
3. Después de esto, todas tus API keys funcionarán correctamente

---

## 🆘 Si Aún Tienes Problemas

Ejecuta `DIAGNOSTICO_RAPIDO.sql` y envíame los resultados para ayudarte más.
