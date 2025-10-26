# Configuración de Variables de Entorno en Netlify

## Variables Requeridas para Producción

Para que el dashboard funcione correctamente en Netlify, debes configurar las siguientes variables de entorno:

### 1. Accede al Dashboard de Netlify

1. Ve a tu proyecto en Netlify
2. Click en **"Site configuration"** → **"Environment variables"**

### 2. Agrega las Siguientes Variables

```bash
# Supabase Production Environment
VITE_SUPABASE_URL=https://sfqtmnncgiqkveaoqckt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ

# Application IDs (Opcional - para testing)
VITE_APP_ID=app_8cc6bda9-120
VITE_API_KEY=ak_production_fa37c6acc469cad22e958c4f0c0029dc
```

### 3. Configuración de Scopes

**IMPORTANTE**: Las variables que empiezan con `VITE_` deben tener:
- Scope: **"Build time"** ✅
- Esto permite que Vite las inyecte en el código del frontend durante el build

### 4. Redeploy

Después de agregar las variables:
1. Ve a **"Deploys"**
2. Click en **"Trigger deploy"** → **"Clear cache and deploy site"**
3. Espera a que termine el deploy

### 5. Verificación

Una vez desplegado, verifica que las variables están correctamente configuradas:
1. Abre la consola del navegador en tu sitio
2. Ejecuta: `console.log(import.meta.env.VITE_SUPABASE_URL)`
3. Debe mostrar la URL de Supabase, no `undefined`

## Notas Importantes

- ❌ **NO** commits el archivo `.env` al repositorio (ya está en .gitignore)
- ✅ El archivo `.env` solo se usa para desarrollo local
- ✅ En Netlify usa siempre las variables de entorno del dashboard
- ✅ Las variables `VITE_*` se inyectan en tiempo de build, no runtime
- ✅ Si cambias una variable, debes hacer un nuevo deploy para que se aplique

## Solución de Problemas

### Variables aparecen como `undefined`:

1. **Verifica el scope**: Debe ser "Build time"
2. **Limpia caché**: Usa "Clear cache and deploy site"
3. **Verifica el nombre**: Debe empezar con `VITE_`

### El dashboard no se conecta a Supabase:

1. Verifica la URL de Supabase en las variables
2. Verifica la Anon Key de Supabase
3. Revisa la consola del navegador para ver errores de conexión

## Variables para Edge Functions

Las Edge Functions de Supabase tienen sus propias variables:
- `SUPABASE_URL` - Se configura automáticamente
- `SUPABASE_ANON_KEY` - Se configura automáticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Se configura automáticamente

No necesitas configurar estas en Netlify, solo las variables `VITE_*` para el frontend.
