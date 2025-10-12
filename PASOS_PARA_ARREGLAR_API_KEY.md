# Pasos para Arreglar el Error 401 - Invalid API key

## Problema Identificado

La tabla `api_keys` NO tiene una columna llamada `key`, por eso la validación falla.

## Solución (3 simples pasos)

### PASO 1: Ejecutar el Diagnóstico Rápido

1. Ve a tu Dashboard de Supabase: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt
2. Ve a **SQL Editor**
3. Ejecuta el archivo `DIAGNOSTICO_RAPIDO.sql`

Esto te mostrará:
- La estructura real de tus tablas
- Si existe tu aplicación
- Si existen API keys
- Cuántos usuarios tienes

### PASO 2: Ejecutar el Script de Corrección

En el mismo **SQL Editor**, ejecuta el archivo `FIX_API_KEYS_SCRIPT.sql`

Este script:
1. ✅ Agrega la columna `key` a la tabla `api_keys`
2. ✅ Crea un índice para búsquedas rápidas
3. ✅ Actualiza tu API key específica con el valor correcto
4. ✅ Verifica que todo esté correcto

### PASO 3: Probar en Postman

Una vez ejecutado el script, prueba nuevamente en Postman:

**URL:**
```
POST https://auth-systemv1.netlify.app/api/user/search
```

**Body (JSON):**
```json
{
  "application_id": "app_a6f840c5-bd1",
  "api_key": "ak_production_042a5f866c7e35630a9340bd224cbdda",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**Debería funcionar correctamente ahora! ✅**

---

## Verificación Adicional

Si después de los pasos anteriores aún tienes problemas, ejecuta esta consulta en SQL Editor:

```sql
-- Verificar que la API key existe y está activa
SELECT 
  id,
  application_id,
  name,
  key,
  key_preview,
  environment
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
  AND application_id = 'app_a6f840c5-bd1';
```

Deberías ver 1 resultado con tus datos.

---

## Archivos Creados

1. **DIAGNOSTICO_RAPIDO.sql** - Para verificar el estado actual
2. **FIX_API_KEYS_SCRIPT.sql** - Para corregir el problema
3. **PASOS_PARA_ARREGLAR_API_KEY.md** - Esta guía
