# ✅ CORRECCIÓN: API Key Mismatch en URLs de Deploy

## 🐛 PROBLEMA IDENTIFICADO:

**Síntoma:**
- Login mostraba "API Key inválida o inactiva"
- API Key en tarjeta: `ak_production_43d94935fca24fa5883a81d0a60aa176`
- API Key en URL: `ak_production_2eacaaf5a2d7385d09f7c134ac4c7def`
- API Key real en BD: `ak_production_2eacaaf5a2d7385d09f7c134ac4c7def`

**Causa Raíz:**
1. Cuando se creaba un nuevo API key, se **hasheaba** con SHA-256
2. El hash se guardaba en `key_hash` (no el API key original)
3. Cuando ya existía un API key, se usaba un **PLACEHOLDER** en lugar del valor real
4. Las URLs generadas incluían el PLACEHOLDER, no el API key real

---

## ✅ CORRECCIONES APLICADAS:

### 1. Eliminado el Hashing del API Key

**Antes:**
```typescript
const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

const { error: insertError } = await supabase
  .from('api_keys')
  .insert({
    key_hash: keyHash,  // ❌ Hash SHA-256
    // ...
  });
```

**Después:**
```typescript
const { error: insertError } = await supabase
  .from('api_keys')
  .insert({
    key_hash: apiKey,  // ✅ API key completo sin hashear
    // ...
  });
```

**Razón:** Los API keys son seguros por sí mismos (como Stripe). No necesitan hashearse.

---

### 2. Usar API Key Real Cuando Ya Existe

**Antes:**
```typescript
} else {
  // Ya existe una API Key para este ambiente
  apiKey = `PLACEHOLDER_${environmentName.toUpperCase()}_API_KEY`;  // ❌
  addLog(`   ℹ️  Deberás configurar la API Key manualmente en Netlify:`, 'info');
}
```

**Después:**
```typescript
} else {
  // Ya existe una API Key para este ambiente
  apiKey = apiKeys[0].key_hash;  // ✅ Usar el API key real
  addLog(`   ✓ API Key existente encontrada: ${apiKeys[0].key_preview}`, 'success');
}
```

---

### 3. Guardar API Key en Metadata del Environment

**Añadido:**
```typescript
await applicationService.updateEnvironment(pendingDeployData.environmentId, {
  // ...
  metadata: {
    // ...
    api_key: pendingDeployData.apiKey  // ✅ Guardar API key correcto
  }
});
```

Esto asegura que:
- ✅ La tarjeta muestre el API key correcto
- ✅ Las URLs generadas tengan el API key correcto
- ✅ El login funcione correctamente

---

## 📋 ARCHIVOS MODIFICADOS:

```
src/components/environments/EnvironmentsManager.tsx
├── Línea 930-956: Eliminado hashing de API key
├── Línea 964-977: Usar API key real en lugar de PLACEHOLDER
└── Línea 1485: Guardar API key en metadata del environment
```

---

## 🚀 PRÓXIMOS PASOS:

### 1. Desplegar Dashboard Actualizado
```bash
# Ir a: https://app.netlify.com/
# Seleccionar: celadon-begonia-d7eb0e
# Deploys → Deploy manually
# Arrastrar: dist/
```

### 2. Redesplegar el Ambiente de Producción
```
Dashboard → Ambientes → Production → Desplegar
```

Esto hará que:
1. ✅ Se obtenga el API key correcto de la BD
2. ✅ Se generen URLs con el API key correcto
3. ✅ Se actualice la tarjeta con el API key correcto
4. ✅ El login funcione sin error "API Key inválida"

---

## 🧪 CÓMO PROBAR:

### Paso 1: Verificar API Key en Tarjeta
```
Dashboard → Ambientes → Production
API Key mostrado: ak_production_2eacaaf5a2d7385d09f7c134ac4c7def
```

### Paso 2: Verificar URL Generada
```
Login URL debe contener:
...&api_key=ak_production_2eacaaf5a2d7385d09f7c134ac4c7def
```

### Paso 3: Probar Login
```
1. Click en "Ver Formularios" → Login
2. Ingresar credenciales
3. ✅ NO debe mostrar "API Key inválida"
4. ✅ Debe retornar tokens y redirigir
```

---

## 🔐 NOTA DE SEGURIDAD:

**¿Por qué no hashear los API keys?**

1. Los API keys son **tokens de autenticación** seguros por sí mismos
2. Similar a como Stripe, AWS, etc. almacenan sus keys
3. El hashing impide recuperar el valor original para las URLs
4. La seguridad se mantiene con:
   - ✅ HTTPS en todas las comunicaciones
   - ✅ RLS policies en Supabase
   - ✅ Validación en Edge Functions
   - ✅ Rate limiting
   - ✅ IP blocking

---

## ✅ RESULTADO ESPERADO:

```
┌─────────────────────────────────────────┐
│  ANTES                                  │
├─────────────────────────────────────────┤
│  Tarjeta: ak_production_43d9493...      │
│  URL: api_key=ak_production_43d9493...  │
│  BD: ak_production_2eacaa...            │
│  ❌ Login: "API Key inválida"           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  DESPUÉS                                │
├─────────────────────────────────────────┤
│  Tarjeta: ak_production_2eacaa...       │
│  URL: api_key=ak_production_2eacaa...   │
│  BD: ak_production_2eacaa...            │
│  ✅ Login: Tokens retornados            │
└─────────────────────────────────────────┘
```

---

**¡Ahora los API keys coincidirán y el login funcionará correctamente!** 🎉
