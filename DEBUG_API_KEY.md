# 🔍 DEBUG: API Key Inválida en Login

## ❌ PROBLEMA:
El login muestra "API Key inválida o inactiva" aunque el frontend SÍ envía el api_key.

## ✅ LO QUE FUNCIONA:
- ✅ Frontend extrae api_key de URL: `ak_production_43d9493...`
- ✅ Frontend envía api_key en el payload
- ✅ Backend recibe el request

## ❌ LO QUE FALLA:
- ❌ Backend NO encuentra el api_key en la tabla `api_keys`

---

## 🔎 PASOS PARA DIAGNOSTICAR:

### 1. Verificar API Key Completo en URL
```
URL actual (cortada): 
celadon-begonia-d7eb0e.netlify.app/login?app_id=3acde27f-74d3-465e-aaec-94ad46faa881&...

Necesitas copiar la URL COMPLETA del navegador y pegar aquí:
- ¿Cuál es el api_key completo?
- ¿Tiene el formato: ak_production_XXXXX?
```

### 2. Verificar API Keys en Base de Datos

**Opción A - Supabase Dashboard:**
```
1. Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt
2. Ve a: SQL Editor
3. Ejecuta esta query:

SELECT 
  ak.name,
  ak.key_hash,
  ak.key_preview,
  ak.is_active,
  ak.environment,
  a.name as app_name
FROM api_keys ak
JOIN applications a ON ak.application_id = a.id
WHERE a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881';

4. Copia el resultado aquí
```

### 3. Comparar API Keys

```
API Key en URL:  ak_production_____________
                                  ^
                                  ¿coincide?
                                  v
API Key en DB:   ak_production_____________
```

---

## 🎯 POSIBLES CAUSAS:

### Causa 1: API Key en URL está incompleto
```
URL cortada: ...&api_key=ak_production_43d9493...
            ❌ Falta parte del key

Solución: Copiar URL completa del navegador
```

### Causa 2: API Key no existe en la base de datos
```
Query retorna: (sin resultados)

Solución: Crear un nuevo API key en el dashboard:
1. Dashboard → API Keys
2. "Nueva API Key"
3. Nombre: "Production Key"
4. Ambiente: "production"
5. Copiar el key generado
6. Usarlo en la URL
```

### Causa 3: API Key existe pero está inactivo
```
Query retorna: is_active = false

Solución: Activar el API key:
1. Dashboard → API Keys
2. Buscar el key
3. Toggle "Activo"
```

### Causa 4: API Key del ambiente incorrecto
```
URL tiene:  api_key=ak_production_XXXX
BD tiene:   key_hash=ak_development_YYYY
                      ^^^^^^^^
                      ambiente diferente

Solución: Usar el API key del ambiente correcto
```

---

## 🚀 SOLUCIÓN RÁPIDA:

Si no quieres investigar, simplemente:

**1. Crear nuevo API Key:**
```
Dashboard → API Keys → Nueva API Key
- Nombre: "Clave de Producción"
- Ambiente: "production"
- Copiar: ak_production_NUEVO_KEY_AQUI
```

**2. Actualizar URL de login:**
```
Antes:
https://celadon-begonia-d7eb0e.netlify.app/login?app_id=3acde27f...&api_key=ak_production_VIEJO

Después:
https://celadon-begonia-d7eb0e.netlify.app/login?app_id=3acde27f...&api_key=ak_production_NUEVO
```

**3. Probar de nuevo**

---

## 📋 INFORMACIÓN NECESARIA:

Por favor proporciona:

1. ✅ **URL completa del navegador** (sin cortar)
2. ✅ **API Keys en la base de datos** (resultado de la query SQL)
3. ✅ **Screenshot del Network tab** mostrando el payload completo

Con esta información podré identificar exactamente cuál es el problema.

---

**¿Puedes copiar la URL completa y ejecutar la query SQL?** 🔍
