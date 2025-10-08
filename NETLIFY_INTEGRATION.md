# Integración con Netlify para Deploy Automático

## Descripción

Esta integración permite deployar automáticamente tu aplicación a Netlify directamente desde la interfaz de Gestión de Ambientes, después de que todas las pruebas locales pasen exitosamente.

## Configuración

### 1. Obtener el Personal Access Token de Netlify

1. Ve a [https://app.netlify.com/user/applications/personal](https://app.netlify.com/user/applications/personal)
2. Haz clic en "New access token"
3. Dale un nombre descriptivo (ej: "AuthSystem Deploy")
4. Copia el token generado (solo se muestra una vez)

### 2. Obtener el Site ID

1. Ve a tu sitio en Netlify
2. Ve a **Settings** → **General** → **Site details**
3. Copia el **Site ID**

### 3. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
VITE_NETLIFY_ACCESS_TOKEN=tu_token_personal_de_netlify
VITE_NETLIFY_SITE_ID=tu_site_id_de_netlify
```

### 4. Reiniciar la Aplicación

Después de agregar las variables de entorno, reinicia la aplicación para que los cambios tomen efecto.

## Uso

### Flujo de Deploy

1. **Deploy Local**
   - Ve a **Gestión de Ambientes**
   - Selecciona tu aplicación
   - Haz clic en **Desplegar** en el ambiente de producción
   - Espera a que todas las pruebas pasen exitosamente

2. **Deploy a Netlify** (solo aparece si el deploy local fue exitoso)
   - Si Netlify está configurado, verás un mensaje en la consola
   - Aparecerá un botón morado con ícono de nube ☁️ junto a los otros botones
   - Haz clic en el botón para iniciar el deploy a Netlify

3. **Monitoreo del Deploy**
   - La consola mostrará el progreso en tiempo real
   - Verás mensajes como:
     - "Disparando build en Netlify..."
     - "Build iniciado exitosamente!"
     - "Esperando a que el deploy se complete..."
     - Estado actual del deploy cada 5 segundos

4. **Deploy Completado**
   - Cuando termine, verás:
     - URL del sitio deployado
     - URL del deploy específico
     - Admin URL de Netlify
     - Hora de completación

## Características

### Validaciones

- ✅ Verifica que Netlify esté configurado antes de intentar el deploy
- ✅ Solo está disponible para el ambiente de **production**
- ✅ Solo aparece después de un deploy local exitoso
- ✅ Muestra instrucciones si no está configurado

### Monitoreo en Tiempo Real

- 📊 Muestra el estado del deploy cada 5 segundos
- ⏱️ Timeout de 10 minutos (configurable)
- 📝 Registra todo en la consola de deploy

### Manejo de Errores

- ❌ Muestra mensajes claros si algo falla
- 💡 Proporciona sugerencias de solución
- 🔧 Verifica problemas de autenticación

## Botón de Configuración

Si Netlify no está configurado, verás un botón **"Configurar Netlify"** en el header de Gestión de Ambientes que:

- 📚 Explica qué es Netlify
- 📝 Muestra instrucciones paso a paso
- 🔗 Tiene un enlace directo para crear el token
- ✨ Se oculta automáticamente cuando Netlify ya está configurado

## API de Netlify Utilizada

El servicio utiliza los siguientes endpoints de la API de Netlify:

- `POST /sites/{site_id}/builds` - Dispara un nuevo build
- `GET /sites/{site_id}/deploys/{deploy_id}` - Obtiene el estado del deploy
- `GET /sites/{site_id}` - Obtiene información del sitio
- `GET /sites` - Lista todos los sitios

## Estructura del Código

### Servicio: `netlifyService.ts`

```typescript
// Funciones principales
- triggerDeploy(options)     // Dispara un nuevo deploy
- waitForDeploy(siteId, deployId, onProgress)  // Espera a que complete
- getDeploy(siteId, deployId)  // Obtiene estado del deploy
- isConfigured()              // Verifica si está configurado
```

### Componente: `EnvironmentsManager.tsx`

```typescript
// Función de deploy
- handleDeployToNetlify(environmentId, environmentName)

// Estados
- isNetlifyDeploying          // Indica si está deployando
- showNetlifyConfig           // Muestra modal de configuración
```

## Seguridad

- 🔐 El token de acceso nunca se expone en el cliente (usa variable de entorno)
- 🔒 Solo usuarios autenticados pueden hacer deploy
- ✅ Requiere que el deploy local pase todas las pruebas primero
- 🛡️ Validaciones de permisos y suscripción antes del deploy

## Troubleshooting

### Error: "Netlify access token no configurado"

**Solución**: Verifica que `VITE_NETLIFY_ACCESS_TOKEN` esté en tu archivo `.env` y reinicia la aplicación.

### Error: "Site ID no configurado"

**Solución**: Verifica que `VITE_NETLIFY_SITE_ID` esté en tu archivo `.env` y reinicia la aplicación.

### El botón de "Deploy to Netlify" no aparece

**Posibles causas**:
1. Netlify no está configurado
2. El deploy local no pasó todas las pruebas
3. No estás en el ambiente de "production"

### Deploy timeout

**Solución**: El timeout por defecto es de 10 minutos. Si tu proyecto tarda más en deployar, puedes ajustar el parámetro `timeout` en la función `waitForDeploy`.

## Beneficios

✨ **Deploy con un clic**: No necesitas salir de la aplicación
📊 **Monitoreo en tiempo real**: Ve el progreso del deploy
🔒 **Seguro**: Solo deploya después de pruebas exitosas
🚀 **Rápido**: Integración directa con Netlify API
📝 **Trazabilidad**: Todos los deploys quedan registrados
⚙️ **Configurable**: Fácil de configurar y usar

## Próximos Pasos

Posibles mejoras futuras:
- [ ] Soporte para múltiples sitios de Netlify
- [ ] Rollback automático si el deploy falla
- [ ] Notificaciones por email cuando termine el deploy
- [ ] Integración con otros servicios (Vercel, GitHub Pages, etc.)
- [ ] Preview deploys para ambientes de testing
