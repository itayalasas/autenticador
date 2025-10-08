# Configuración de Webhooks de dLocal

## Problema Resuelto

El popup de dLocal para pagos no cierra automáticamente ni envía respuesta al completar el pago. Para capturar automáticamente cuando un pago se completa y activar las suscripciones, implementamos **webhooks de dLocal**.

## Solución Implementada

### 1. Edge Function de Webhook

Se creó un Supabase Edge Function en `/supabase/functions/dlocal-webhook/index.ts` que:

- ✅ Recibe notificaciones de dLocal cuando ocurren eventos
- ✅ Verifica la firma del webhook para seguridad
- ✅ Almacena todos los eventos en la base de datos
- ✅ Activa automáticamente las suscripciones cuando el pago es exitoso
- ✅ Maneja múltiples tipos de eventos (pago, suscripción, etc.)

### 2. Base de Datos

Se crearon 3 migraciones:

**`20251008235054_create_webhook_events_table.sql`**
- Tabla para almacenar todos los eventos de webhook
- Permite auditoría y debugging

**`20251008235200_add_provider_fields_to_subscriptions.sql`**
- Agrega campos genéricos para cualquier proveedor de pagos
- `provider`, `provider_subscription_id`, `provider_plan_id`

**`20251008235300_add_provider_fields_to_subscription_plans.sql`**
- Vincula planes internos con planes externos de dLocal

### 3. Sistema de Polling

El frontend implementa polling para detectar cuando la suscripción se activa:

- ⏱️ Verifica cada 5 segundos durante 2 minutos
- 🔄 Recarga automáticamente la UI cuando detecta activación
- 💬 Muestra mensajes de progreso al usuario

## Configuración en dLocal

### Paso 1: Deploy del Webhook

1. Deploy del Edge Function a Supabase:

```bash
# El edge function ya está en: supabase/functions/dlocal-webhook/index.ts
# Se deployará automáticamente con el sistema
```

2. La URL del webhook será:
```
https://[TU_PROYECTO].supabase.co/functions/v1/dlocal-webhook
```

### Paso 2: Configurar Webhook en dLocal

1. Ingresa al [Panel de dLocal](https://merchant.dlocalgo.com/)
2. Ve a **Configuración** → **Webhooks**
3. Haz clic en **"Agregar Webhook"**
4. Configura:
   - **URL**: `https://[TU_PROYECTO].supabase.co/functions/v1/dlocal-webhook`
   - **Eventos a escuchar**:
     - `subscription.created`
     - `subscription.activated`
     - `subscription.updated`
     - `subscription.cancelled`
     - `subscription.expired`
     - `payment.succeeded`
     - `invoice.payment_succeeded`
     - `payment.failed`
     - `invoice.payment_failed`
5. Guarda el **Secret** generado

### Paso 3: Agregar Secret al .env

Agrega el secret de dLocal a tu archivo `.env`:

```env
# dLocal Webhook Secret
DLOCAL_WEBHOOK_SECRET=tu_webhook_secret_aqui

# Environment (para testing sin signature verification)
ENVIRONMENT=development  # cambiar a "production" en producción
```

### Paso 4: Deploy de Migraciones

Aplica las migraciones en Supabase:

```bash
# Las migraciones se aplican automáticamente
```

## Flujo Completo

### Para el Usuario

1. **Usuario selecciona plan pago**
   - Click en "Actualizar Plan" en un plan de pago

2. **Se abre popup de dLocal**
   - Usuario completa información de pago
   - dLocal procesa el pago

3. **Sistema inicia polling**
   - Muestra mensaje: "Procesando pago..."
   - Verifica cada 5 segundos si la suscripción se activó

4. **dLocal envía webhook**
   - Cuando el pago se confirma, dLocal envía webhook
   - Edge Function procesa y activa la suscripción

5. **Polling detecta activación**
   - El sistema detecta que la suscripción está activa
   - Muestra: "¡Suscripción activada!"
   - Actualiza la UI automáticamente

6. **Usuario puede usar el plan**
   - Plan activado inmediatamente
   - Todas las features disponibles

### Para el Sistema

```
┌──────────────┐
│   Usuario    │
│ selecciona   │
│     plan     │
└──────┬───────┘
       │
       v
┌──────────────┐
│    dLocal    │
│ Popup Pago   │
└──────┬───────┘
       │
       │ Usuario completa pago
       │
       v
┌──────────────┐         ┌──────────────┐
│   Sistema    │◄────────│   Webhook    │
│   Polling    │         │  from dLocal │
│   (5s cada)  │         └──────────────┘
└──────┬───────┘                │
       │                        │
       │                        v
       │                 ┌──────────────┐
       │                 │Edge Function │
       │                 │  Procesa     │
       │                 │   Webhook    │
       │                 └──────┬───────┘
       │                        │
       │                        v
       │                 ┌──────────────┐
       │                 │   Activa     │
       │                 │ Suscripción  │
       │                 │   en DB      │
       │                 └──────────────┘
       │
       │ Detecta activación
       v
┌──────────────┐
│ Actualiza UI │
│  y muestra   │
│   mensaje    │
└──────────────┘
```

## Tipos de Eventos Manejados

### Eventos de Suscripción

- **`subscription.created`** - Suscripción creada
- **`subscription.activated`** - Suscripción activada (activa el plan)
- **`subscription.updated`** - Suscripción actualizada
- **`subscription.cancelled`** - Suscripción cancelada
- **`subscription.expired`** - Suscripción expirada

### Eventos de Pago

- **`payment.succeeded`** - Pago exitoso
- **`invoice.payment_succeeded`** - Pago de factura exitoso
- **`payment.failed`** - Pago fallido
- **`invoice.payment_failed`** - Pago de factura fallido

## Seguridad

### Verificación de Firma

El webhook verifica la firma enviada por dLocal usando HMAC SHA-256:

```typescript
// En desarrollo, no verifica firma (para testing)
if (isDevelopment) {
  return true;
}

// En producción, verifica firma
const signature = req.headers.get('X-Signature');
// ... verifica usando DLOCAL_WEBHOOK_SECRET
```

**IMPORTANTE**: En producción, SIEMPRE verifica la firma para prevenir webhooks maliciosos.

### Políticas RLS

- ✅ Solo service role puede escribir eventos de webhook
- ✅ Admins pueden ver eventos (read-only)
- ✅ Usuarios regulares no tienen acceso

## Monitoring y Debugging

### Ver Webhooks Recibidos

Puedes consultar todos los webhooks en la tabla `webhook_events`:

```sql
SELECT
  id,
  provider,
  event_type,
  processed,
  received_at,
  processing_result
FROM webhook_events
ORDER BY received_at DESC
LIMIT 20;
```

### Ver Webhooks No Procesados

```sql
SELECT *
FROM webhook_events
WHERE processed = false
ORDER BY received_at DESC;
```

### Logs del Edge Function

En Supabase Dashboard:
1. Ve a **Edge Functions**
2. Selecciona `dlocal-webhook`
3. Ve a la pestaña **Logs**

## Testing

### Test Manual del Webhook

Puedes probar el webhook manualmente usando curl:

```bash
curl -X POST https://[TU_PROYECTO].supabase.co/functions/v1/dlocal-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [SUPABASE_ANON_KEY]" \
  -d '{
    "id": "test_event_001",
    "type": "subscription.activated",
    "created": 1234567890,
    "data": {
      "object": {
        "id": "sub_test123",
        "status": "active",
        "subscription_id": "sub_test123",
        "plan_token": "Dktil5kCQtirHXx1PXWr02JXdPoEzxJU",
        "customer_email": "test@example.com",
        "amount": 1189,
        "currency": "UYU"
      }
    }
  }'
```

### Simular Pago Completo

1. En dLocal Sandbox, usa tarjetas de prueba:
   - **Éxito**: `4111 1111 1111 1111`
   - **Fallo**: `4000 0000 0000 0002`

2. Completa el pago en el popup

3. Verifica en los logs que el webhook fue recibido

4. Verifica en la base de datos que la suscripción se activó

## Troubleshooting

### El webhook no se está recibiendo

1. Verifica que la URL esté correctamente configurada en dLocal
2. Verifica que el Edge Function esté desplegado
3. Revisa los logs en Supabase Dashboard

### El webhook se recibe pero no procesa

1. Verifica los logs del Edge Function
2. Revisa la tabla `webhook_events` para ver errores
3. Verifica que `DLOCAL_WEBHOOK_SECRET` esté configurado

### El polling no detecta la activación

1. Verifica que el webhook haya sido procesado exitosamente
2. Verifica que la suscripción existe en la BD
3. Revisa la consola del navegador para ver los intentos de polling

### La firma del webhook falla

1. Verifica que `DLOCAL_WEBHOOK_SECRET` sea correcto
2. En desarrollo, puedes desactivar la verificación poniendo `ENVIRONMENT=development`
3. En producción, contacta a soporte de dLocal si el problema persiste

## Próximos Pasos

Posibles mejoras futuras:

- [ ] Reintento automático de webhooks fallidos
- [ ] Dashboard para administrar webhooks
- [ ] Notificaciones por email cuando se activa una suscripción
- [ ] Webhook para renovaciones automáticas
- [ ] Integración con otros proveedores de pago (Stripe, PayPal, etc.)

## Referencias

- [Documentación de Webhooks de dLocal](https://docs.dlocalgo.com/webhooks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Verificación de Firmas con HMAC](https://en.wikipedia.org/wiki/HMAC)
