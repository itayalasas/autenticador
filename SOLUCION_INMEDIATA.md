# ⚡ SOLUCIÓN INMEDIATA - Copia y Pega

## El Problema
La tabla `api_keys` no tiene la columna `key`, por eso falla la validación.

## La Solución (1 minuto)

### 1️⃣ Ve a Supabase SQL Editor
https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/editor

### 2️⃣ Copia y Pega ESTE código completo:

```sql
-- Agregar columna key
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key text;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- Actualizar tu API key
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE application_id = 'app_a6f840c5-bd1';

-- Verificar que funcionó
SELECT 
  'API Key actualizada correctamente ✅' as resultado,
  id, 
  application_id, 
  name, 
  key, 
  environment
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1';
```

### 3️⃣ Click en "Run"

Deberías ver: **"API Key actualizada correctamente ✅"**

### 4️⃣ Prueba en Postman

Ya debería funcionar! 🎉

---

## ¿Sigues teniendo problemas?

Ejecuta esto para verificar:

```sql
-- Verificar que la columna existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
  AND column_name = 'key';
```

Si ves la columna `key`, todo está bien ✅
