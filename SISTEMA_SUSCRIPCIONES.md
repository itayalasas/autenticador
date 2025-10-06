# Sistema de Suscripciones

## Descripción General

El sistema de suscripciones maneja dos tipos de planes:

1. **Plan Básico (Gratuito)**: Manejado internamente en la aplicación, no requiere DLocal
2. **Planes de Pago**: Integrados con DLocal para procesamiento de pagos

## Plan Básico (Gratuito)

### Características
- **ID Fijo**: `00000000-0000-0000-0000-000000000000`
- **Precio**: $0 USD
- **Sin procesamiento de pagos**: Se maneja completamente en la base de datos interna
- **Creación automática**: Se asigna automáticamente a nuevos usuarios

### Límites del Plan Básico
```json
{
  "applications": 1,
  "users_per_app": 100,
  "api_requests_per_month": 10000,
  "environments": ["development"],
  "support_level": "basic"
}
```

### Flujo de Activación

1. Usuario hace clic en "Comenzar Gratis" o "Activar Plan Básico"
2. El sistema:
   - Cancela cualquier suscripción activa anterior
   - Crea una nueva suscripción en la tabla `subscriptions`
   - Estado: `active`
   - Período: 1 año (renovación automática)
   - NO se comunica con DLocal

3. Respuesta inmediata al usuario

## Planes de Pago

### Características
- **Precio**: > $0
- **Procesamiento**: A través de DLocal
- **Plan Token**: Requerido para identificar el plan en DLocal
- **Subscribe URL**: URL del checkout de DLocal

### Flujo de Activación

1. Usuario selecciona un plan de pago
2. El sistema:
   - Guarda información del plan en `localStorage`
   - Abre popup con el checkout de DLocal
   - Espera a que el usuario complete el pago

3. Después del pago:
   - El popup se cierra
   - El sistema verifica el estado del pago con DLocal
   - Si el pago es exitoso:
     - Cancela suscripciones anteriores
     - Crea nueva suscripción activa
     - Actualiza la UI

## Estructura de Base de Datos

### Tabla: `subscription_plans`
```sql
- id (uuid)
- name (text)
- price (decimal)
- currency (text)
- interval (month/year)
- features (jsonb array)
- limits (jsonb object)
- plan_token (text, nullable) - Para DLocal
- subscribe_url (text, nullable) - Para DLocal
```

### Tabla: `subscriptions`
```sql
- id (uuid)
- user_id (uuid) -> auth.users
- plan_id (uuid) -> subscription_plans
- status (pending/active/trialing/cancelled/expired)
- current_period_start (timestamptz)
- current_period_end (timestamptz)
- dlocal_subscription_id (text, nullable)
- metadata (jsonb)
```

## Integración con DLocal

### Planes en DLocal
Los planes de pago deben estar configurados en DLocal con:
- Plan Token
- Subscribe URL (URL del checkout)
- Monto y moneda
- Intervalo (mensual/anual)

### Verificación de Pagos
El sistema verifica el estado del pago después de que el usuario cierra el popup del checkout.

## Código de Ejemplo

### Crear Suscripción Básica
```typescript
const subscription = await subscriptionService.createSubscription(
  '00000000-0000-0000-0000-000000000000'
);
```

### Obtener Suscripción Actual
```typescript
const subscription = await subscriptionService.getCurrentSubscription();
```

### Verificar Permisos
```typescript
// Verificar si puede crear aplicación
const { allowed, current, limit } = await subscriptionService.canCreateApplication();

// Verificar acceso a ambiente
const canAccess = await subscriptionService.canAccessEnvironment('production');
```

## Trigger Automático

Se ha creado un trigger que asigna automáticamente el plan básico a nuevos usuarios:

```sql
CREATE TRIGGER create_basic_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_basic_subscription_for_new_user();
```

## Manejo de Errores

El sistema está diseñado con múltiples fallbacks:

1. **DLocal no disponible**: Retorna solo el plan básico y planes fallback
2. **Error en base de datos**: Retorna plan básico hardcodeado
3. **Error al crear suscripción**: Muestra mensaje de error al usuario

## Seguridad (RLS)

- **Planes**: Todos los usuarios autenticados pueden ver planes activos
- **Suscripciones**: Los usuarios solo pueden ver/editar sus propias suscripciones

## Notas Importantes

1. El plan básico NUNCA debe tener `plan_token` o `subscribe_url`
2. Los planes gratuitos ($0) siempre se manejan internamente
3. Los planes de pago SIEMPRE requieren DLocal
4. La suscripción básica se renueva automáticamente cada año
