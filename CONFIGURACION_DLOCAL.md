# Configuración de dLocal

Este documento explica cómo configurar la integración con dLocal para procesar pagos y suscripciones.

## Variables de Entorno

Todas las URLs y credenciales de dLocal se configuran a través de variables de entorno en el archivo `.env`. Esto permite cambiar fácilmente entre sandbox y producción.

### Variables Requeridas

```bash
# URL base de la API de dLocal
VITE_DLOCAL_API_URL=https://api-sbx.dlocalgo.com

# URL base del checkout de dLocal
VITE_DLOCAL_CHECKOUT_URL=https://checkout-sbx.dlocalgo.com

# Credenciales de dLocal
VITE_DLOCAL_API_KEY=tu_api_key_aqui
VITE_DLOCAL_SECRET_KEY=tu_secret_key_aqui

# Endpoint de planes
VITE_DLOCAL_PLANS_ENDPOINT=v1/subscription/plan/all

# ID de comerciante
VITE_DLOCAL_MERCHANT_ID=tu_merchant_id
```

## Ambientes

### Sandbox (Desarrollo/Testing)

```bash
VITE_DLOCAL_API_URL=https://api-sbx.dlocalgo.com
VITE_DLOCAL_CHECKOUT_URL=https://checkout-sbx.dlocalgo.com
```

### Producción

```bash
VITE_DLOCAL_API_URL=https://api.dlocalgo.com
VITE_DLOCAL_CHECKOUT_URL=https://checkout.dlocalgo.com
```

## Flujo de Suscripción

1. **Obtención de Planes**: El servicio `dLocalService` obtiene los planes disponibles desde la API de dLocal usando `VITE_DLOCAL_API_URL`.

2. **Planes Fallback**: Si la API no está disponible, se usan planes locales configurados con las URLs de las variables de entorno.

3. **Checkout**: Cuando un usuario selecciona un plan, se redirige al checkout usando la URL construida con `VITE_DLOCAL_CHECKOUT_URL`.

4. **Confirmación**: Después del pago, dLocal envía un webhook (configurado en el panel de dLocal) para actualizar el estado de la suscripción.

## Configuración en dLocal Panel

1. Accede al panel de dLocal: https://dashboard.dlocalgo.com
2. Crea tus planes de suscripción
3. Copia los tokens de los planes (plan_token)
4. Configura el webhook URL para recibir notificaciones de pago
5. Obtén tus credenciales (API Key y Secret Key)

## Archivos Importantes

- `/src/services/dLocalService.ts` - Servicio principal de integración
- `/src/services/subscriptionService.ts` - Gestión de suscripciones
- `/src/components/subscription/SubscriptionManager.tsx` - UI de gestión de planes

## Notas de Seguridad

- Las claves `VITE_DLOCAL_API_KEY` y `VITE_DLOCAL_SECRET_KEY` son visibles en el frontend
- Para operaciones sensibles, usa Edge Functions o un backend
- Nunca commits las claves reales al repositorio
- Usa variables de entorno diferentes para cada ambiente

## Testing

Para probar la integración en sandbox:

1. Configura las variables con el prefijo `-sbx`
2. Usa tarjetas de prueba de dLocal
3. Verifica los webhooks en el panel de dLocal

## Producción

Antes de ir a producción:

1. Cambia las URLs a las de producción (sin `-sbx`)
2. Actualiza las credenciales con las de producción
3. Configura los webhooks de producción
4. Verifica que los planes estén creados en producción
5. Prueba el flujo completo con una tarjeta real
