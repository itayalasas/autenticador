# 🔧 PASOS PARA ARREGLAR EL ERROR "API Key no pertenece a esta aplicación"

## 🎯 PROBLEMA:
El error ocurre porque el `application_id` en la tabla `api_keys` apunta al UUID público en lugar del UUID interno.

## ✅ SOLUCIÓN RÁPIDA (5 minutos):

### Paso 1: Abrir Supabase SQL Editor
1. Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/sql
2. Crea una nueva query

### Paso 2: Copiar y Ejecutar este SQL

```sql
-- Ver el problema actual
SELECT
  '🔍 DIAGNÓSTICO' as paso,
  ak.key_hash,
  ak.application_id as apunta_a_este_uuid,
  a.id as deberia_apuntar_a_este_uuid,
  a.name as aplicacion,
  CASE
    WHEN ak.application_id = a.id THEN '✅ CORRECTO'
    ELSE '❌ INCORRECTO'
  END as estado
FROM api_keys ak
LEFT JOIN applications a ON a.application_id::text = ak.application_id::text;
```

**Si ves "❌ INCORRECTO", continúa con el siguiente paso.**

### Paso 3: Ejecutar la Corrección

```sql
-- ARREGLAR todos los API keys
UPDATE api_keys ak
SET application_id = a.id
FROM applications a
WHERE a.application_id::text = ak.application_id::text
  AND ak.application_id != a.id;
```

### Paso 4: Verificar que Funcionó

```sql
-- Verificar la corrección
SELECT
  '✅ VERIFICACIÓN' as paso,
  ak.key_hash,
  ak.application_id,
  a.id as app_internal_id,
  a.name,
  CASE
    WHEN ak.application_id = a.id THEN '✅ CORRECTO'
    ELSE '❌ AÚN INCORRECTO'
  END as estado
FROM api_keys ak
JOIN applications a ON ak.application_id = a.id;
```

**Debes ver "✅ CORRECTO" en todos los registros.**

---

## 🧪 PROBAR EL LOGIN:

Después de ejecutar el SQL:

1. Refresca la página de login:
   ```
   https://celadon-begonia-d7eb0e.netlify.app/login?app_id=3acde27f-74d3-465e-aaec-94ad46faa881&...
   ```

2. Ingresa credenciales:
   - Email: ale@gmail.com
   - Password: tu contraseña

3. Resultado esperado:
   - ✅ Login exitoso
   - ✅ Redirección al callback
   - ✅ NO error de "API Key no pertenece a esta aplicación"

---

## 📊 SI EL ERROR PERSISTE:

### Opción A: Verificar el API key en uso

```sql
-- Ver QUÉ API key está intentando usar
SELECT
  ak.key_hash,
  ak.key_preview,
  ak.is_active,
  ak.environment,
  a.name as aplicacion,
  a.application_id as app_public_id
FROM api_keys ak
JOIN applications a ON ak.application_id = a.id
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

### Opción B: Ver los logs de auth

```sql
-- Ver últimos intentos de login
SELECT
  created_at,
  event_type,
  success,
  error_message,
  metadata->>'email' as email,
  metadata->>'error_type' as error_type
FROM auth_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔄 SI NADA FUNCIONA:

### Regenerar API Key:

1. Ve al Dashboard: https://celadon-begonia-d7eb0e.netlify.app
2. Ve a: **API Keys** → **Production Environment**
3. Click en **Regenerar Key**
4. Copia el nuevo API key
5. Actualiza la URL de login con el nuevo API key

---

## 📝 NOTAS TÉCNICAS:

**¿Por qué pasó esto?**
- Las API keys se crearon antes de que se corrigiera el código
- El código viejo guardaba el UUID público en `application_id`
- El código correcto guarda el UUID interno (PK de la tabla)

**¿Cómo prevenir esto?**
- El código actual ya está corregido
- Nuevos API keys se crearán correctamente
- Este script SQL arregla los API keys existentes

---

## ✅ RESUMEN:

1. ✅ Ejecutar el SQL de corrección en Supabase
2. ✅ Verificar que muestra "✅ CORRECTO"
3. ✅ Probar el login nuevamente
4. ✅ Si no funciona, revisar logs con las queries de diagnóstico

**Tiempo estimado: 5 minutos** ⏱️
