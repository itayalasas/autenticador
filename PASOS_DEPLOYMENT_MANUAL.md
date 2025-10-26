# Pasos para Deployment Manual

## Problema

El sitio `https://auth-apis-pets.netlify.app` no funciona porque:
- Las Edge Functions tienen código viejo
- El repositorio GitHub solo tiene config.ts
- El sitio está intentando llamar a `/api/auth/login` que NO existe

## Solución

### Opción 1: Actualizar Edge Functions (RECOMENDADO)

1. **Ir a Supabase Dashboard**
   - https://supabase.com/dashboard/project/[tu-proyecto]/functions

2. **Actualizar `collect-source-files-complete`**
   - Click en la función
   - Click en "Edit"
   - Reemplazar TODO el contenido con: `supabase/functions/collect-source-files-complete/index.ts`
   - Save & Deploy

3. **Actualizar `deploy-to-netlify`**
   - Click en la función
   - Click en "Edit"
   - Reemplazar TODO el contenido con: `supabase/functions/deploy-to-netlify/index.ts`
   - Save & Deploy

4. **Hacer un nuevo deployment desde el Dashboard**
   - Ir a tu dashboard AuthSystem
   - Ambientes → Pet Breed Data Management System
   - Click "Deploy to Netlify"
   - Esto generará un sitio nuevo con el código correcto

### Opción 2: Usar CLI de Supabase (Alternativa)

Si tienes el CLI instalado:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Desplegar funciones
supabase functions deploy collect-source-files-complete
supabase functions deploy deploy-to-netlify
```

### Opción 3: Subir Todo a GitHub

Si prefieres usar GitHub:

```bash
# Inicializar git
git init

# Agregar remote
git remote add origin https://github.com/itayalasas/auth-apis-pets.git

# Agregar TODOS los archivos
git add .

# Commit
git commit -m "Add complete project with fixed auth URLs"

# Push
git push -u origin main --force
```

Luego configura Netlify para que despliegue desde el repositorio.

## Verificación

Una vez desplegado, el sitio debería:

1. Cargar correctamente
2. Mostrar formularios de login/registro
3. Llamar a Edge Functions de Supabase:
   - `${SUPABASE_URL}/functions/v1/auth-login`
   - `${SUPABASE_URL}/functions/v1/auth-register`
   - `${SUPABASE_URL}/functions/v1/auth-reset-password`

## Por Qué Falló Antes

El sitio intentaba llamar a:
- ❌ `https://auth-apis-pets.netlify.app/api/auth/login`

Que NO existe. Debería llamar a:
- ✅ `${SUPABASE_URL}/functions/v1/auth-login`

## Sistema de Templates

Para futuros cambios:

1. Edita el componente en `src/components/auth/PublicAuthForms.tsx`
2. Actualiza el template en `src/utils/publicAuthFormsTemplate.ts`
3. Ejecuta: `node sync-templates-to-edge-function.cjs`
4. Despliega la Edge Function actualizada

Ver `TEMPLATE_SYNC_SYSTEM.md` para más detalles.
