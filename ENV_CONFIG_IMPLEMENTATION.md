# Sistema de Configuración de Variables de Entorno Dinámica

## Descripción

Este proyecto implementa un sistema de carga dinámica de variables de entorno desde una API externa, eliminando la necesidad del archivo `.env`.

## Implementación

### 1. Servicio de Configuración (`envConfigService.ts`)

El servicio `envConfigService` es responsable de:
- Cargar las variables de entorno desde la API externa al inicio de la aplicación
- Almacenar las variables en `window.__ENV__` para acceso global
- Proporcionar funciones helper para acceder a las variables

**API Endpoint:**
```
GET https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
Header: X-Access-Key: 4a63305a316f04fe2acf33b2b63135925bd3a0523c1fd453a42fbf1fc49e6240
```

### 2. Inicialización (`main.tsx`)

La aplicación ahora:
1. Muestra una pantalla de carga mientras obtiene la configuración
2. Carga todas las variables desde la API antes de renderizar la aplicación
3. Muestra una pantalla de error con opción de reintentar si falla la carga

### 3. Acceso a Variables

**En servicios:**
```typescript
import { getEnvVariable } from './services/envConfigService';

const supabaseUrl = getEnvVariable('VITE_SUPABASE_URL');
```

**En componentes (con hook):**
```typescript
import { useSupabaseUrl, useSupabaseAnonKey } from '../hooks/useEnv';

const supabaseUrl = useSupabaseUrl();
const anonKey = useSupabaseAnonKey();
```

### 4. Variables Cargadas

Las siguientes variables se cargan desde la API:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `PORT`
- `VITE_DLOCAL_API_URL`
- `VITE_DLOCAL_API_KEY`
- `VITE_DLOCAL_SECRET_KEY`
- `VITE_DLOCAL_PLANS_ENDPOINT`

## Archivos Modificados

### Nuevos Archivos
- `src/services/envConfigService.ts` - Servicio de carga de configuración
- `src/hooks/useEnv.ts` - Hook para acceso a variables en componentes
- `ENV_CONFIG_IMPLEMENTATION.md` - Esta documentación

### Archivos Actualizados
- `src/main.tsx` - Inicialización con carga de configuración
- `src/lib/supabase.ts` - Uso de `getEnvVariable()` en lugar de `import.meta.env`
- `src/services/*.ts` - Múltiples servicios actualizados para usar el nuevo sistema

## Ventajas

1. **Sin archivos `.env`**: No es necesario mantener archivos de configuración locales
2. **Configuración centralizada**: Todas las variables se obtienen de una fuente única
3. **Actualización sin redeploy**: Cambios en la configuración no requieren reconstruir la aplicación
4. **Manejo de errores**: Interfaz clara cuando la configuración no está disponible
5. **Seguridad**: Las variables sensibles se obtienen de forma segura mediante API key

## Flujo de Inicialización

1. **Carga de Configuración** (`main.tsx`):
   - Muestra pantalla de carga
   - Llama a `envConfigService.loadConfig()`
   - Espera a que se carguen todas las variables
   - Renderiza la aplicación

2. **Inicialización de Supabase** (`lib/supabase.ts`):
   - Usa **lazy initialization** (inicialización perezosa)
   - Se inicializa solo cuando se usa por primera vez
   - Verifica que `envConfigService.isLoaded()` sea true
   - Obtiene las variables de `envConfigService.getVariable()`

3. **Acceso a Variables**:
   - Las variables se almacenan en `window.__ENV__`
   - `getEnvVariable()` lee de `window.__ENV__`
   - Fallback a `import.meta.env` si no existe en `window.__ENV__`

## Solución de Problemas

### Error: "Supabase not configured"

Este error puede ocurrir si:
1. La configuración no se cargó correctamente desde la API
2. El cliente de Supabase se intentó usar antes de cargar la configuración

**Solución implementada:**
- El cliente de Supabase usa **Proxy pattern** para lazy initialization
- Se inicializa solo cuando se accede por primera vez
- Verifica que la configuración esté cargada antes de inicializar

### Logs de Depuración

En la consola del navegador verás:
```
🔄 Fetching environment configuration from API...
✅ Environment configuration loaded successfully
📦 Loaded 9 variables
🔑 Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ...
✅ Supabase client initialized
```

## Consideraciones

- La API debe estar disponible para que la aplicación funcione
- La primera carga puede tardar unos segundos dependiendo de la conexión
- Se recomienda implementar caché local o service workers para aplicaciones offline
- La API key está hardcodeada pero debería considerarse un método más seguro en producción
- **Importante**: El archivo `.env` local es ignorado, todas las variables vienen de la API
