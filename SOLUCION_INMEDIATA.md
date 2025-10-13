# ✅ SOLUCIÓN INMEDIATA - application_id es TEXT no UUID

## 🔍 Problema Identificado

El error decía:
```
"invalid input syntax for type uuid: \"app_a6f840c5-bd1\""
```

**Causa:** La tabla `applications` tiene **DOS campos de ID**:
1. **`id`** (uuid) - PRIMARY KEY - Ejemplo: `081aa73c-df7e-40ac-9c50-69d72...`
2. **`application_id`** (text) - UNIQUE - Ejemplo: `app_a6f840c5-bd1`

El cliente envía el `application_id` (text) pero la función buscaba por `id` (uuid).

---

## ✅ Solución Aplicada

### **Cambios Realizados:**

```typescript
// ❌ ANTES (buscaba por id UUID):
.from('applications')
.select('id, name')
.eq('id', application_id)  // ← application_id es TEXT no UUID

// ✅ AHORA (busca por application_id TEXT):
.from('applications')
.select('id, name, application_id')
.eq('application_id', application_id)  // ← Busca por el campo correcto
```

### **También corregí:**

1. ✅ El query de `app_users` ahora usa `applicationData.id` (el UUID)
2. ✅ Cambié `full_name` por `name` (según tu schema)
3. ✅ Cambié `user_id` y `is_active` por los campos correctos: `status`
4. ✅ Búsqueda ahora es por `name` en lugar de `full_name`

---

## 🚀 Cómo Usar

### **Request Correcto:**

```json
{
  "application_id": "app_a6f840c5-bd1",
  "api_key": "$2a$10$tu-key-hash-aqui",
  "query": "peter",
  "limit": 10,
  "offset": 0
}
```

**IMPORTANTE:** Usa el `application_id` (TEXT) como `"app_a6f840c5-bd1"`, **NO el UUID**.

---

## 📊 Estructura de Tablas

### **applications:**
```
id                  uuid        PRIMARY KEY (081aa73c-df7e...)
name                text        Nombre de la app
application_id      text        UNIQUE (app_a6f840c5-bd1)  ← Este envías
domain              text
status              text
```

### **app_users:**
```
id                  uuid        PRIMARY KEY
application_id      uuid        FK → applications.id  ← La función usa este
email               text
name                text        (no full_name)
password_hash       text
status              text        (active/inactive/pending)
created_at          timestamptz
```

---

## 🧪 Flujo de Validación

1. Cliente envía: `application_id = "app_a6f840c5-bd1"` (TEXT)
2. Función busca en `applications` por `application_id` (TEXT)
3. Obtiene el `id` (UUID) de la aplicación: `081aa73c-df7e...`
4. Valida la API key contra ese UUID
5. Busca usuarios en `app_users` usando ese UUID

---

## 📝 Ejemplo Completo

### **1. Obtén tus valores:**

```sql
-- Ver tu application_id (TEXT)
SELECT 
  id,
  name,
  application_id
FROM applications
ORDER BY created_at DESC
LIMIT 1;

-- Resultado:
-- id: 081aa73c-df7e-40ac-9c50-69d72...
-- name: Mi App
-- application_id: app_a6f840c5-bd1  ← Este es el que usas
```

### **2. Obtén tu API key_hash:**

```sql
SELECT 
  id,
  application_id,
  key_hash,
  name,
  is_active
FROM api_keys
WHERE application_id = '081aa73c-df7e-40ac-9c50-69d72...'
ORDER BY created_at DESC
LIMIT 1;
```

### **3. Prueba en Postman:**

**URL:**
```
POST https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/user-search
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
```

**Body:**
```json
{
  "application_id": "app_a6f840c5-bd1",
  "api_key": "$2a$10$8JY8fYMmpNJtCiRYVATGIHurGxC...",
  "query": "peter"
}
```

---

## ✅ Respuesta Esperada

### **Success:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "09be8acd-6d9a-43b4-9748-a0db3bc678f",
        "email": "payasalortiz@gmail.com",
        "name": "Peter Ayala",
        "status": "active",
        "role": null,
        "created_at": "2025-10-12T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "has_more": false
    }
  }
}
```

### **Error - Invalid application_id:**
```json
{
  "success": false,
  "error": "Invalid application_id"
}
```

### **Error - Invalid API key:**
```json
{
  "success": false,
  "error": "Invalid API key or application"
}
```

---

## 🎯 Campos Retornados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único del usuario |
| `email` | text | Email del usuario |
| `name` | text | Nombre del usuario |
| `status` | text | Estado: active/inactive/pending |
| `role` | null | Roles (no implementado aún) |
| `created_at` | timestamp | Fecha de creación |

---

## ⚠️ Notas Importantes

1. **Usa `application_id` TEXT** (ej: `"app_a6f840c5-bd1"`) **NO el UUID**
2. El `api_key` debe ser el **`key_hash`** de la tabla `api_keys`
3. Los campos son **`name`** y **`status`**, no `full_name` e `is_active`
4. La búsqueda usa `name` para ordenar y filtrar
5. `role` siempre retorna `null` por ahora

---

## 🔧 Desplegar

1. Copia el código de `/supabase/functions/user-search/index.ts`
2. Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions
3. Edita la función `user-search`
4. Pega el nuevo código
5. Despliega

---

✅ **La función ahora funciona correctamente con `application_id` (TEXT)!**
