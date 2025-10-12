# ⚡ SOLUCIÓN INMEDIATA - API Key Mismatch

## 🚨 ERROR ACTUAL:
```
API Key no pertenece a esta aplicación
```

## 🎯 CAUSA:
El `application_id` en la tabla `api_keys` está apuntando al UUID **público** en lugar del UUID **interno**.

## ✅ SOLUCIÓN EN 3 PASOS:

### 📍 PASO 1: Abrir Supabase SQL Editor
```
https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/sql
```

### 📍 PASO 2: Ejecutar este SQL (diagnóstico)
```sql
SELECT 
  ak.application_id as api_key_apunta_a,
  a.id as deberia_apuntar_a,
  CASE
    WHEN ak.application_id = a.id THEN '✅ YA ESTÁ CORRECTO'
    ELSE '❌ NECESITA CORRECCIÓN'
  END as estado
FROM api_keys ak
CROSS JOIN applications a
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def'
  AND a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881';
```

**Si dice "❌ NECESITA CORRECCIÓN", continúa con el Paso 3.**

### 📍 PASO 3: Ejecutar la corrección
```sql
UPDATE api_keys
SET application_id = (
  SELECT id 
  FROM applications 
  WHERE application_id = '3acde27f-74d3-465e-aaec-94ad46faa881'
)
WHERE key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';
```

## 🧪 PROBAR:

Después de ejecutar el SQL, **refresca la página de login** y vuelve a intentar.

**URL:**
```
https://celadon-begonia-d7eb0e.netlify.app/login?app_id=3acde27f-74d3-465e-aaec-94ad46faa881&redirect_uri=https%3A%2F%2Fdashboard.authsystem.local%2Fauth%2Fcallback&api_key=ak_production_2eacaaf5a2d7385d09f7c134ac4c7def
```

**Resultado esperado:** ✅ Login exitoso

---

## 📊 ARCHIVOS CREADOS:

1. **DIAGNOSTICO_RAPIDO.sql** - Para ver qué está mal
2. **FIX_API_KEYS_SCRIPT.sql** - Script completo de corrección
3. **PASOS_PARA_ARREGLAR_API_KEY.md** - Guía detallada paso a paso
4. **Este archivo** - Solución rápida

---

## ⏱️ TIEMPO ESTIMADO: 2 minutos

1. Abrir Supabase SQL Editor (30 seg)
2. Copiar y ejecutar SQL de corrección (30 seg)
3. Probar login (1 min)

**¡Listo!** ✨
