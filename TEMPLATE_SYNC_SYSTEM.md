# Sistema de Sincronización de Templates

## Problema que Resuelve

Las Edge Functions de Supabase (Deno) **NO pueden importar archivos TypeScript** directamente del proyecto React. Por lo tanto, necesitamos una forma de mantener el código de los componentes sincronizado entre:

1. **Archivos fuente** (`src/components/auth/PublicAuthForms.tsx`, etc.)
2. **Templates** (`src/utils/publicAuthFormsTemplate.ts`, etc.)
3. **Edge Function** (`supabase/functions/collect-source-files-complete/index.ts`)

## Arquitectura

```
┌─────────────────────────────────────┐
│ src/components/auth/                │
│   PublicAuthForms.tsx (FUENTE)      │ ← Editas aquí
└──────────────┬──────────────────────┘
               │
               │ Copias manualmente cuando cambias algo
               ↓
┌─────────────────────────────────────┐
│ src/utils/                          │
│   publicAuthFormsTemplate.ts        │ ← Template exportado
└──────────────┬──────────────────────┘
               │
               │ Script de sincronización automática
               ↓
┌─────────────────────────────────────┐
│ supabase/functions/                 │
│   collect-source-files-complete/    │
│   index.ts (Edge Function)          │ ← Código embebido
└─────────────────────────────────────┘
               │
               │ Edge Function desplegada
               ↓
┌─────────────────────────────────────┐
│ Netlify Deploy                      │
│   (Proyecto React desplegado)       │ ← Sitio final
└─────────────────────────────────────┘
```

## Flujo de Trabajo

### 1. Cuando Editas un Componente

Si modificas un componente como `PublicAuthForms.tsx`:

```bash
# 1. Edita el archivo fuente
vim src/components/auth/PublicAuthForms.tsx

# 2. Copia el contenido al template
# Edita: src/utils/publicAuthFormsTemplate.ts
# Y pega el contenido dentro de la variable exportada

# 3. Sincroniza con la Edge Function
node sync-templates-to-edge-function.cjs

# 4. Despliega la Edge Function actualizada
# (Esto se hace automáticamente en producción)
```

### 2. Templates Disponibles

Los siguientes templates están sincronizados:

- `publicAuthFormsTemplate.ts` → `src/components/auth/PublicAuthForms.tsx`
- `brandedPublicAuthTemplate.ts` → `src/components/auth/BrandedPublicAuth.tsx`
- `brandedComponentsTemplate.ts` → `src/components/ui/BrandedComponents.tsx`
- `themePresetsTemplate.ts` → `src/utils/themePresets.ts`

### 3. Script de Sincronización

El script `sync-templates-to-edge-function.cjs` hace lo siguiente:

1. **Lee** los archivos de template en `src/utils/*Template.ts`
2. **Extrae** el contenido de las constantes exportadas
3. **Inserta** el contenido en la Edge Function entre los marcadores:
   ```typescript
   // === TEMPLATES START ===
   // ... contenido auto-generado ...
   // === TEMPLATES END ===
   ```
4. **Escribe** el archivo actualizado

## Notas Importantes

### NO Editar Directamente en la Edge Function

❌ **MAL**:
```typescript
// supabase/functions/collect-source-files-complete/index.ts
files['src/components/auth/PublicAuthForms.tsx'] = `...código...`;
```

✅ **BIEN**:
1. Editar `src/utils/publicAuthFormsTemplate.ts`
2. Ejecutar `node sync-templates-to-edge-function.cjs`

### Mantener Templates Sincronizados

Cuando cambies un componente:

1. **SIEMPRE** actualiza PRIMERO el archivo fuente en `src/components/`
2. **LUEGO** copia el cambio al template en `src/utils/`
3. **FINALMENTE** ejecuta el script de sincronización

### Variables de Entorno en Templates

Los templates usan estas variables que se reemplazan en deployment:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiKey = new URLSearchParams(window.location.search).get('api_key');
```

Estas se inyectan durante el deployment en el archivo `.env.production`.

## Comandos Rápidos

```bash
# Sincronizar templates con Edge Function
node sync-templates-to-edge-function.cjs

# Verificar que se sincronizó correctamente
grep "=== TEMPLATES START ===" supabase/functions/collect-source-files-complete/index.ts

# Ver cuántos caracteres tiene cada template
node sync-templates-to-edge-function.cjs | grep "chars"
```

## Por Qué Esta Arquitectura

### Alternativas Consideradas

1. **Leer archivos directamente en la Edge Function** ❌
   - Las Edge Functions de Deno no tienen acceso al filesystem del proyecto

2. **Importar módulos TypeScript** ❌
   - Las Edge Functions no pueden importar código TypeScript del proyecto

3. **Almacenar templates en la base de datos** ❌
   - Complicado de mantener y versionar
   - Dificulta el desarrollo local

4. **Leer desde GitHub API** ❌
   - Requiere autenticación
   - Lento
   - Dependencia externa

5. **Sistema de templates con script de sincronización** ✅
   - Simple
   - Versionado con git
   - Desarrollo local fácil
   - Control total del código

## Troubleshooting

### El sitio desplegado sigue usando código viejo

1. Verifica que ejecutaste `sync-templates-to-edge-function.cjs`
2. Verifica que la Edge Function se desplegó correctamente
3. Re-despliega el sitio desde Ambientes en el dashboard

### Error: "Marker not found in Edge Function"

Los marcadores `// === TEMPLATES START ===` y `// === TEMPLATES END ===` no están en la Edge Function.

Solución: Agrega los marcadores manualmente en `collect-source-files-complete/index.ts`.

### Los templates no se actualizan

Verifica que los templates en `src/utils/` tienen el formato correcto:

```typescript
export const TEMPLATE_NAME = `
  // código aquí
`;
```

El script busca este patrón exacto.
