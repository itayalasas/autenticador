# Guía de Deployment a Netlify

## Flujo Mejorado para Primer Deploy

Este sistema ahora resuelve el problema del "huevo y gallina" al hacer el primer deploy a Netlify. Ya no necesitas tener un `SITE_ID` antes de comenzar.

## Paso 1: Configurar Access Token

1. Ve a [Netlify Personal Access Tokens](https://app.netlify.com/user/applications/personal)
2. Haz clic en "New access token"
3. Dale un nombre descriptivo (ej: "AuthSystem Deploy")
4. Copia el token generado
5. Agrégalo a tu archivo `.env`:

```env
VITE_NETLIFY_ACCESS_TOKEN=tu_token_aqui
```

6. Reinicia la aplicación

## Paso 2: Primer Deploy (Sin Site ID)

### Opción A: Crear Nuevo Sitio (Recomendado para primer deploy)

1. Ve a **Ambientes** en el sistema
2. Selecciona tu aplicación de producción
3. Haz clic en **"Desplegar"** en el ambiente `production`
4. Cuando intentes hacer deploy a Netlify, el sistema detectará que no tienes `SITE_ID`
5. Se abrirá automáticamente un modal con opciones:
   - **Crear Nuevo Sitio**: Crea un sitio desde la interfaz
   - **Seleccionar Sitio Existente**: Si ya tienes sitios en Netlify

6. Para crear un nuevo sitio:
   - Opcionalmente ingresa un nombre (ej: `mi-auth-system`)
   - Si no ingresas nombre, se genera uno automático
   - Haz clic en **"Crear Sitio"**

7. El sistema creará el sitio y mostrará en la consola:
   ```
   ✅ Sitio creado exitosamente!
      Nombre: mi-auth-system
      URL: https://mi-auth-system.netlify.app
      Site ID: abc123def456

   📝 IMPORTANTE: Copia este Site ID y agrégalo a tu .env:
      VITE_NETLIFY_SITE_ID=abc123def456
   ```

8. El `Site ID` se copia automáticamente al portapapeles
9. Pégalo en tu archivo `.env`:

```env
VITE_NETLIFY_ACCESS_TOKEN=tu_token_aqui
VITE_NETLIFY_SITE_ID=abc123def456
```

10. Reinicia la aplicación

### Opción B: Seleccionar Sitio Existente

Si ya tienes sitios en Netlify:

1. En el modal que se abre, haz clic en **"Recargar"** para ver tus sitios
2. Verás una lista de todos tus sitios con:
   - Nombre del sitio
   - URL
   - Site ID
3. Haz clic en **"Seleccionar"** en el sitio que deseas usar
4. El sistema copiará la línea completa al portapapeles
5. Pégala en tu `.env` y reinicia

## Paso 3: Deploys Subsecuentes

Una vez configurado el `SITE_ID`:

1. Ve a **Ambientes** → Selecciona tu app → Ambiente `production`
2. Haz clic en **"Desplegar"** para ejecutar las pruebas locales
3. Si todas las pruebas pasan, aparecerá el botón **"Deploy to Netlify"**
4. Haz clic y el deploy se ejecutará automáticamente
5. Podrás ver el progreso en tiempo real en la consola
6. Al finalizar, verás:
   - URL del sitio deployado
   - URL del deploy específico
   - URL del admin panel
   - Timestamp de completado

## Características

### Detección Automática

- Si tienes `ACCESS_TOKEN` pero no `SITE_ID`, el sistema te guía para crear/seleccionar uno
- Si tienes ambos, el deploy procede directamente
- Si no tienes ninguno, muestra instrucciones completas

### Gestión de Sitios

Desde la interfaz puedes:
- ✅ Ver todos tus sitios de Netlify
- ✅ Crear nuevos sitios
- ✅ Copiar Site IDs al portapapeles
- ✅ Ver URLs y detalles de cada sitio

### Consola de Deploy

La consola muestra:
- Estado del deploy en tiempo real
- Logs detallados del proceso
- Tiempo estimado
- URLs generadas
- Errores si ocurren

## Estructura del .env

Tu archivo `.env` final debe verse así:

```env
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key

# dLocal (Opcional)
VITE_DLOCAL_API_KEY=tu_api_key
VITE_DLOCAL_SECRET_KEY=tu_secret_key
VITE_DLOCAL_ENVIRONMENT=sandbox

# Netlify (Para deployment automático)
VITE_NETLIFY_ACCESS_TOKEN=nfp_123abc...
VITE_NETLIFY_SITE_ID=abc123-def456-ghi789
```

## Troubleshooting

### "Netlify access token no configurado"
- Verifica que `VITE_NETLIFY_ACCESS_TOKEN` esté en el `.env`
- Verifica que el token no tenga espacios al inicio o final
- Reinicia la aplicación después de agregar el token

### "Site ID no configurado"
- Usa el modal de selección/creación de sitios
- Copia exactamente el Site ID sin espacios
- Reinicia después de agregarlo al `.env`

### "Error 401 Unauthorized"
- Tu token de Netlify puede haber expirado
- Genera un nuevo token en Netlify
- Actualiza el `.env` con el nuevo token

### "No se encontraron sitios"
- Verifica que tengas sitios en tu cuenta de Netlify
- Si no tienes ninguno, usa la opción "Crear Nuevo Sitio"
- Verifica que tu token tenga permisos suficientes

## Ventajas del Nuevo Flujo

1. **Sin configuración manual previa**: Ya no necesitas crear el sitio manualmente en Netlify
2. **Guiado paso a paso**: El sistema te dice exactamente qué hacer en cada momento
3. **Copiado automático**: Los Site IDs se copian al portapapeles automáticamente
4. **Visualización de sitios**: Puedes ver y seleccionar de tus sitios existentes
5. **Feedback en tiempo real**: Todo el proceso se muestra en la consola de deploy

## Notas Importantes

- El `ACCESS_TOKEN` se necesita una sola vez y no expira (a menos que lo revoques)
- El `SITE_ID` es único por sitio y nunca cambia
- Puedes tener múltiples sitios para diferentes ambientes
- Los tokens se guardan en `.env` que está en `.gitignore` (no se suben a Git)
