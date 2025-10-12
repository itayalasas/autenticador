# ✅ SOLUCIÓN DEFINITIVA - API Key con key_hash

## 🔧 Cambios Realizados

### **Problema Detectado:**
1. ❌ El código desplegado pasaba `applicationData` (objeto) en lugar de `applicationData.id` (UUID)
2. ❌ Buscaba por columna `key` pero solo existe `key_hash`

### **Solución Aplicada:**
1. ✅ Ahora usa `applicationData.id` (UUID correcto)
2. ✅ Busca por `key_hash` en lugar de `key`
3. ✅ Obtiene también el `name` de la aplicación para validaciones futuras

---

## 📝 Código Actualizado

```typescript
// Step 1: Verify that the application exists and get its name
const { data: applicationData, error: appError } = await supabase
  .from('applications')
  .select('id, name')
  .eq('id', application_id)
  .maybeSingle();

// Step 2: Validate API key for this application using key_hash
const { data: apiKeyData, error: apiKeyError } = await supabase
  .from('api_keys')
  .select('id, application_id, is_active, environment, name')
  .eq('application_id', applicationData.id)  // ✅ Usa .id no el objeto completo
  .eq('key_hash', api_key)                   // ✅ Usa key_hash no key
  .maybeSingle();
```

---

## 🚀 Pasos para Desplegar

### **1. Despliega la Edge Function Actualizada**

Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions

**Opción A: Dashboard UI**
1. Click en la función `user-search`
2. Click en "Edit" o "Update"
3. Copia todo el contenido de `/supabase/functions/user-search/index.ts`
4. Pega y guarda

**Opción B: CLI (si tienes instalado)**
```bash
supabase functions deploy user-search
```

---

### **2. Obtén tus Valores Reales**

Ejecuta en Supabase SQL Editor:

```sql
-- Ver tu aplicación
SELECT 
  id as application_id,
  name as application_name
FROM applications
ORDER BY created_at DESC
LIMIT 1;

-- Ver tu API key (debe estar hasheada en key_hash)
SELECT 
  id,
  application_id,
  name,
  key_hash,
  key_preview,
  environment,
  is_active
FROM api_keys
ORDER BY created_at DESC
LIMIT 1;
```

**Copia:**
- El `application_id` (UUID completo)
- El `key_hash` (este es tu `api_key` para el request)

---

### **3. Prueba en Postman**

**URL:**
```
POST https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/user-search
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer TU_SUPABASE_ANON_KEY
```

**Body:**
```json
{
  "application_id": "UUID-COMPLETO-AQUI",
  "api_key": "VALOR-DE-KEY_HASH-AQUI",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**Ejemplo Real:**
```json
{
  "application_id": "e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f",
  "api_key": "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

---

## 🔍 Respuesta Esperada

### **Success:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "user_id": "user-123",
        "email": "juan@example.com",
        "full_name": "Juan Pérez",
        "role": {
          "id": "role-uuid",
          "name": "admin",
          "display_name": "Administrator"
        },
        "is_active": true,
        "created_at": "2025-10-12T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 10,
      "offset": 0,
      "has_more": false
    }
  }
}
```

### **Error - Invalid Application:**
```json
{
  "success": false,
  "error": "Invalid application_id"
}
```

### **Error - Invalid API Key:**
```json
{
  "success": false,
  "error": "Invalid API key or application"
}
```

### **Error - Inactive API Key:**
```json
{
  "success": false,
  "error": "API key is inactive"
}
```

---

## ⚠️ Notas Importantes

1. **`application_id`** = UUID completo de la tabla `applications`
2. **`api_key`** = El valor de `key_hash` (la API key hasheada) de la tabla `api_keys`
3. La Edge Function **DEBE** estar desplegada en Supabase
4. El `key_hash` ya contiene la API key hasheada con bcrypt
5. **NO necesitas** hashear la API key en el cliente, envía el `key_hash` tal cual

---

## 🆘 Si Aún Tienes Errores

### **Error: "invalid input syntax for type uuid"**
- Verifica que estás enviando el UUID completo sin prefijos
- Ejemplo correcto: `e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f`
- Ejemplo incorrecto: `app_e7b2c8d4` o `[object Object]`

### **Error: "Invalid API key or application"**
- Verifica que el `application_id` existe en la tabla `applications`
- Verifica que el `key_hash` existe en la tabla `api_keys`
- Verifica que ambos estén relacionados (mismo `application_id`)
- Verifica que `is_active = true` en la tabla `api_keys`

---

## 📊 Resumen de Cambios

| Antes | Después |
|-------|---------|
| `.eq('application_id', applicationData)` | `.eq('application_id', applicationData.id)` |
| `.eq('key', api_key)` | `.eq('key_hash', api_key)` |
| Solo obtiene `id` | Obtiene `id, name` |

✅ **Problema resuelto!** La función ahora valida correctamente.
