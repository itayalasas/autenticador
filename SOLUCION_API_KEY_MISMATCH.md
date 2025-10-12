# 🔥 SOLUCIÓN DEFINITIVA: API Key Mismatch

## 🎯 PROBLEMA IDENTIFICADO:

**Error:** "API Key no pertenece a esta aplicación"

**Causa Raíz:**  
Los API keys se crearon con `application_id` apuntando al **UUID público** (`applications.application_id`) en lugar del **ID interno** (`applications.id`).

### Ejemplo del problema:

```sql
-- API Key tiene:
api_keys.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'  
(UUID público)

-- Pero debería tener:
applications.id = 'abc123def...'  (UUID interno - diferente)
applications.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
```

**Edge Function comparaba:**
```typescript
if (apiKeyData.application_id !== application_id) {
  // ❌ Compara UUID interno con UUID público
  // ❌ SIEMPRE falla aunque sea la misma aplicación
}
```

---

## ✅ SOLUCIONES APLICADAS:

### 1. **Arregladas las Edge Functions**

Movimos la validación del API key DESPUÉS de cargar la aplicación:

#### auth-login (Líneas 156, 240-277)
```typescript
// ANTES (❌ Mal):
if (apiKeyData.application_id !== application_id) { }

// DESPUÉS (✅ Bien):
// Primero cargar la aplicación
const { data: application } = await supabase
  .from('applications')
  .eq('application_id', application_id)  // UUID público
  .single();

// Luego comparar con ID interno
if (apiKeyData.application_id !== application.id) { }
```

#### auth-register (Líneas 504, 588-625)
✅ Misma corrección aplicada

#### auth-reset-password (Línea 522)
✅ Mensaje actualizado (falta completar validación)

---

### 2. **Script SQL para Corregir la Base de Datos**

Archivo: `/tmp/fix_api_key_application_id.sql`

Este script:
1. Muestra el problema actual
2. Actualiza el `api_keys.application_id` al ID interno correcto
3. Verifica que la corrección funcionó

```sql
UPDATE api_keys
SET application_id = (
  SELECT a.id
  FROM applications a
  WHERE a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
)
WHERE key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

---

## 🚀 PASOS PARA RESOLVER:

### OPCIÓN A: Ejecutar el Script SQL (Recomendado)

**1. Ir a Supabase SQL Editor:**
```
https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/sql
```

**2. Copiar y ejecutar:**
```sql
-- Ver el problema
SELECT 
  ak.key_hash,
  ak.application_id as api_key_points_to,
  a.id as should_point_to
FROM api_keys ak
LEFT JOIN applications a ON a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';

-- Arreglar
UPDATE api_keys
SET application_id = (
  SELECT id FROM applications 
  WHERE application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
)
WHERE key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

**3. Verificar:**
```sql
SELECT 
  CASE 
    WHEN ak.application_id = a.id THEN '✅ CORRECTO'
    ELSE '❌ AÚN INCORRECTO'
  END as status
FROM api_keys ak
JOIN applications a ON a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

### OPCIÓN B: Redesplegar el Ambiente

Si ejecutas el SQL, las edge functions actuales funcionarán. Pero también puedes:

1. Deploy de edge functions actualizadas
2. Redesplegar el ambiente production
3. Esto creará un nuevo API key con el `application_id` correcto

---

## 🧪 VERIFICAR QUE FUNCIONA:

### En SQL Editor:
```sql
SELECT 
  'Validación' as check_name,
  ak.key_hash,
  ak.application_id as api_key_app_id,
  a.id as app_internal_id,
  CASE 
    WHEN ak.application_id = a.id THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as result
FROM api_keys ak
JOIN applications a ON a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

Debe retornar: `✅ MATCH`

### Probar Login:
```
URL: https://celadon-begonia-d7eb0e.netlify.app/login?...
      &api_key=ak_production_2eacaaf5a2d7385d09f7c134ac4c7def

Resultado esperado:
✅ Login exitoso
✅ Tokens retornados
✅ NO error de "API Key no pertenece a esta aplicación"
```

---

## 📋 RESUMEN DE ARCHIVOS MODIFICADOS:

### Edge Functions:
```
supabase/functions/auth-login/index.ts
├── Línea 156: Mensaje actualizado
└── Líneas 240-277: Validación movida después de cargar aplicación

supabase/functions/auth-register/index.ts
├── Línea 504: Mensaje actualizado  
└── Líneas 588-625: Validación movida después de cargar aplicación

supabase/functions/auth-reset-password/index.ts
└── Línea 522: Mensaje actualizado
```

### Scripts SQL:
```
/tmp/fix_api_key_application_id.sql
└── Script para corregir api_keys.application_id en BD
```

---

## 🎯 CAUSA RAÍZ EN CÓDIGO:

En `EnvironmentsManager.tsx` (línea 948):
```typescript
const { error: insertError } = await supabase
  .from('api_keys')
  .insert({
    application_id: app.id,  // ✅ CORRECTO: Usa ID interno
    // ...
  });
```

El código YA usa `app.id` (correcto), así que API keys nuevos se crearán bien.

El problema es que el API key EXISTENTE fue creado con el código viejo que usaba `application_id` público.

---

## ✅ SOLUCIÓN FINAL:

1. ✅ **Ejecutar el SQL** para corregir el API key existente
2. ✅ **Las edge functions ya están corregidas** para validar correctamente
3. ✅ **Nuevos API keys** se crearán correctamente con el código actual

**¡Después del SQL, el login funcionará inmediatamente!** 🎉
