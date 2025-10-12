# 🎯 SOLUCIÓN FINAL - Application ID Incorrecto

## ❌ El Problema Real

El `application_id` que estás usando **NO es un UUID válido**:
- **Usado:** `app_a6f840c5-bd1` ❌
- **Formato UUID esperado:** `a6f840c5-bd12-4abc-9def-123456789abc` ✅

---

## ✅ Solución en 2 Pasos

### PASO 1️⃣: Obtener el Application ID Correcto

Ve a Supabase SQL Editor:
https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/editor

Ejecuta:

```sql
-- Ver todas tus aplicaciones
SELECT 
  id as application_id,
  name,
  description,
  created_at
FROM applications
ORDER BY created_at DESC;
```

**Copia el `id` (UUID completo) de tu aplicación.**

---

### PASO 2️⃣: Obtener la API Key Correcta

Una vez que tengas el `application_id` correcto, ejecuta:

```sql
-- Reemplaza 'TU_APPLICATION_ID_AQUI' con el UUID de tu aplicación
SELECT 
  id,
  application_id,
  name,
  key,
  key_preview,
  environment
FROM api_keys
WHERE application_id = 'TU_APPLICATION_ID_AQUI'
ORDER BY created_at DESC;
```

**Copia el valor de la columna `key` o `key_preview`.**

---

## 🧪 Probar en Postman

Usa los valores **reales** obtenidos:

```json
{
  "application_id": "a6f840c5-bd12-4abc-9def-123456789abc",
  "api_key": "ak_production_042a5f866c7e35630a9340bd224cbdda",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

---

## 🔍 Si No Tienes Aplicaciones Creadas

Ejecuta esto para crear una aplicación de prueba:

```sql
-- Crear una aplicación de prueba
INSERT INTO applications (name, description)
VALUES ('Mi Aplicación de Prueba', 'Aplicación para pruebas de API')
RETURNING id, name;

-- Guardar el ID que te devuelve
```

Luego crea una API key para esa aplicación:

```sql
-- Reemplaza 'TU_APPLICATION_ID_AQUI' con el ID de arriba
INSERT INTO api_keys (
  application_id, 
  name, 
  key, 
  key_preview, 
  environment
)
VALUES (
  'TU_APPLICATION_ID_AQUI',
  'Production API Key',
  'ak_production_042a5f866c7e35630a9340bd224cbdda',
  'ak_prod...bdda',
  'production'
)
RETURNING id, application_id, key, environment;
```

---

## ⚠️ Importante

1. Los `application_id` son **UUIDs completos**, no strings con prefijos
2. Asegúrate de usar el `application_id` **exacto** de tu base de datos
3. La columna `key` debe tener la API key completa

---

## 📋 Script de Diagnóstico Completo

```sql
-- 1. Ver todas las aplicaciones
SELECT 'APLICACIONES' as seccion, id, name FROM applications;

-- 2. Ver todas las API keys
SELECT 'API KEYS' as seccion, id, application_id, name, key, environment FROM api_keys;

-- 3. Ver estructura de applications
SELECT 'COLUMNAS DE applications' as seccion, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'applications';

-- 4. Ver estructura de api_keys
SELECT 'COLUMNAS DE api_keys' as seccion, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'api_keys';
```

Ejecuta este script y tendrás toda la información que necesitas.
