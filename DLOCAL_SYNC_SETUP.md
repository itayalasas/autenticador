# Sincronización de Suscripciones con dLocal API

## Problema Resuelto

El popup de dLocal no cierra automáticamente ni envía respuesta al completar el pago. La solución implementada **consulta directamente la API de dLocal** para sincronizar las suscripciones con la base de datos.

## Arquitectura de la Solución

### 1. Edge Function de Sincronización

**`sync-dlocal-subscriptions`** - Consulta la API de dLocal y sincroniza suscripciones

#### Qué hace:

1. Obtiene todos los planes de la BD con `provider='dlocal'`
2. Para cada plan, consulta `/v1/subscription/plan/{plan_id}/subscription/all`
3. Filtra solo suscripciones `CONFIRMED` y `active=true`
4. Busca usuarios por email
5. Inserta o actualiza suscripciones en la BD

#### Endpoint:
```
POST https://[TU_PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions
```

### 2. Validación en Login

El endpoint de login (`auth-login`) valida que el usuario tenga:
- ✅ Suscripción existente
- ✅ Status = 'active'
- ✅ Plan válido

Si no tiene suscripción activa, el login falla con:
```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_SUBSCRIPTION",
    "message": "No tienes una suscripción activa. Por favor suscríbete para acceder."
  }
}
```

### 3. Sincronización Automática

La sincronización ocurre en dos momentos:

#### a) Inmediatamente después del pago
Cuando el usuario completa el pago:
1. Espera 3 segundos
2. Llama al endpoint de sincronización
3. Actualiza la UI automáticamente

#### b) Periódicamente (Cron Job)
Configura un cron job para sincronizar cada 5-15 minutos:
- Mantiene suscripciones actualizadas
- Detecta cancelaciones
- Actualiza estados

## Configuración

### Paso 1: Vincular Planes con dLocal

Actualiza tus planes en la BD para incluir el `provider_plan_id`:

```sql
-- Para el Plan Profesional
UPDATE subscription_plans
SET
  provider = 'dlocal',
  provider_plan_id = '4631'  -- ID del plan en dLocal
WHERE name = 'Plan Profesional';

-- Para el Plan Empresarial
UPDATE subscription_plans
SET
  provider = 'dlocal',
  provider_plan_id = '4632'  -- ID del plan en dLocal
WHERE name = 'Plan Empresarial';
```

### Paso 2: Configurar Cron Job

Puedes usar varios métodos para ejecutar la sincronización periódicamente:

#### Opción A: GitHub Actions (Recomendado)

Crea `.github/workflows/sync-subscriptions.yml`:

```yaml
name: Sync dLocal Subscriptions

on:
  schedule:
    # Ejecutar cada 15 minutos
    - cron: '*/15 * * * *'
  workflow_dispatch: # Permite ejecución manual

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Subscriptions
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://[TU_PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions
```

#### Opción B: Cron Job en Servidor

Si tienes un servidor con cron:

```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar cada 15 minutos)
*/15 * * * * curl -X POST -H "Authorization: Bearer TU_ANON_KEY" https://[TU_PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions
```

#### Opción C: Servicio de Cron Externo

Usa servicios como:
- [EasyCron](https://www.easycron.com/)
- [Cron-job.org](https://cron-job.org/)
- [UptimeRobot](https://uptimerobot.com/)

Configura para llamar a:
```
POST https://[TU_PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions
Header: Authorization: Bearer [TU_ANON_KEY]
```

### Paso 3: Testing Manual

Puedes probar la sincronización manualmente:

```bash
curl -X POST \
  -H "Authorization: Bearer [TU_SUPABASE_ANON_KEY]" \
  -H "Content-Type: application/json" \
  https://[TU_PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Subscription sync completed",
  "stats": {
    "total_synced": 5,
    "created": 2,
    "updated": 3,
    "errors": 0
  },
  "timestamp": "2025-10-09T12:00:00.000Z"
}
```

## Flujo Completo

### Para el Usuario

```
1. Usuario selecciona plan
   ↓
2. Popup de dLocal abre
   ↓
3. Usuario completa pago
   ↓
4. Sistema espera 3 segundos
   ↓
5. Sincronización automática se ejecuta
   ↓
6. Usuario ve mensaje: "¡Suscripción activada!"
   ↓
7. Usuario puede hacer login con su plan activo
```

### Diagrama Técnico

```
┌─────────────────┐
│  Usuario paga   │
│   en dLocal     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   dLocal API    │
│  almacena sub   │
└────────┬────────┘
         │
         │ (espera 3s)
         v
┌─────────────────┐
│ Edge Function   │
│  sync-dlocal-   │
│  subscriptions  │
└────────┬────────┘
         │
         │ GET /v1/subscription/plan/{id}/subscription/all
         v
┌─────────────────┐
│  dLocal API     │
│ retorna lista   │
│ suscripciones   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Filtra solo    │
│   CONFIRMED     │
│   & active      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Busca usuario  │
│   por email     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ INSERT o UPDATE │
│  subscriptions  │
│   tabla en BD   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Usuario intenta │
│     login       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   Valida que    │
│   tenga sub     │
│     activa      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Login exitoso  │
│   con acceso    │
└─────────────────┘
```

## Estructura de Datos de dLocal

### Respuesta de API

```json
{
  "data": [
    {
      "@id": "e4cab586-5b63-4adf-9121-9d92d9f1c3c6",
      "id": 6560,
      "plan": {
        "id": 4632,
        "merchant_id": 3348,
        "name": "Plan Empresarial",
        "plan_token": "pHmMNr9nB6jqz9kHnD77MGYK2mtC6YB1",
        "amount": 4059.00,
        "currency": "UYU"
      },
      "subscription_token": "FgoKh3IbH6zV6V0V5rAIIK30awVW45mv",
      "status": "CONFIRMED",
      "client_email": "usuario@example.com",
      "active": true,
      "created_at": "2025-10-09T00:21:25",
      "updated_at": "2025-10-09T00:37:39"
    }
  ],
  "total_elements": 1
}
```

### Mapeo de Status

| dLocal Status | Internal Status |
|---------------|-----------------|
| CONFIRMED     | active          |
| PENDING       | pending         |
| CANCELLED     | cancelled       |
| EXPIRED       | expired         |
| FAILED        | payment_failed  |

### Datos Guardados en BD

```javascript
{
  user_id: "uuid-del-usuario",
  plan_id: "uuid-del-plan",
  status: "active",
  provider: "dlocal",
  provider_subscription_id: "FgoKh3IbH6zV6V0V5rAIIK30awVW45mv",
  provider_plan_id: "4632",
  current_period_start: "2025-10-09T00:21:25",
  current_period_end: "2025-11-09T00:21:26",
  metadata: {
    dlocal_id: 6560,
    client_id: "33489922460055498",
    payment_method_code: "VD",
    synced_from_api: true,
    last_synced: "2025-10-09T12:00:00"
  }
}
```

## Ventajas de esta Solución

### ✅ Confiable
- Consulta directamente la fuente de verdad (dLocal)
- No depende de webhooks que pueden fallar
- Sincronización garantizada

### ✅ Simple
- No requiere configuración de webhooks
- No requiere verificación de firmas
- Fácil de mantener y depurar

### ✅ Flexible
- Sincroniza múltiples planes automáticamente
- Detecta cambios de estado
- Maneja cancelaciones

### ✅ Auditable
- Todos los datos quedan en la BD
- Metadata incluye información completa
- Logs en Edge Function

### ✅ Escalable
- Soporta miles de suscripciones
- Consultas eficientes
- Procesa en lotes

## Monitoreo

### Ver Suscripciones Sincronizadas

```sql
SELECT
  u.email,
  sp.name as plan_name,
  s.status,
  s.provider_subscription_id,
  s.current_period_end,
  s.metadata->>'last_synced' as last_sync,
  s.created_at
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.provider = 'dlocal'
ORDER BY s.created_at DESC;
```

### Ver Suscripciones Activas

```sql
SELECT COUNT(*) as total_active
FROM subscriptions
WHERE status = 'active'
AND provider = 'dlocal';
```

### Ver Última Sincronización

```sql
SELECT MAX(metadata->>'last_synced') as last_sync_time
FROM subscriptions
WHERE provider = 'dlocal';
```

## Troubleshooting

### La sincronización no encuentra suscripciones

**Causas posibles:**
1. `provider_plan_id` no está configurado en los planes
2. No hay suscripciones CONFIRMED en dLocal
3. Credenciales de dLocal incorrectas

**Solución:**
```sql
-- Verificar configuración de planes
SELECT id, name, provider, provider_plan_id
FROM subscription_plans
WHERE provider = 'dlocal';

-- Debe tener provider_plan_id configurado
```

### Usuario no puede hacer login después de pagar

**Causas posibles:**
1. Sincronización aún no se ejecutó
2. Email en dLocal no coincide con email en la BD
3. Suscripción no está CONFIRMED

**Solución:**
1. Ejecutar sincronización manual
2. Verificar emails en ambos sistemas
3. Revisar logs de la Edge Function

### Sincronización demora mucho

**Causas posibles:**
1. Muchos planes con muchas suscripciones
2. API de dLocal lenta
3. Timeout insuficiente

**Solución:**
- Ajustar timeout de la función
- Optimizar el número de planes a sincronizar
- Implementar sincronización en paralelo

## Testing

### Test de Sincronización

```bash
# 1. Ejecutar sincronización
curl -X POST \
  -H "Authorization: Bearer [ANON_KEY]" \
  https://[PROYECTO].supabase.co/functions/v1/sync-dlocal-subscriptions

# 2. Verificar resultado
# Debe retornar stats con created/updated > 0

# 3. Verificar en BD
psql> SELECT * FROM subscriptions WHERE provider = 'dlocal' ORDER BY created_at DESC LIMIT 5;
```

### Test de Login

```bash
# 1. Usuario sin suscripción
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"sin-sub@example.com","password":"pass123","application_id":"app-id"}' \
  https://[PROYECTO].supabase.co/functions/v1/auth-login

# Debe retornar: NO_ACTIVE_SUBSCRIPTION

# 2. Usuario con suscripción
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"con-sub@example.com","password":"pass123","application_id":"app-id"}' \
  https://[PROYECTO].supabase.co/functions/v1/auth-login

# Debe retornar: access_token
```

## Mejoras Futuras

- [ ] Sincronización paralela de múltiples planes
- [ ] Cache de resultados para optimizar performance
- [ ] Notificaciones cuando una suscripción se activa/cancela
- [ ] Dashboard para visualizar sincronizaciones
- [ ] Webhook como alternativa/complemento
- [ ] Soporte para otros proveedores de pago (Stripe, PayPal)

## Referencias

- [API de dLocal - Subscriptions](https://docs.dlocalgo.com/subscriptions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
