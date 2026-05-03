# API de Invitaciones

Todos los endpoints reciben `application_id` y `api_key` en el body/query (nunca en headers).
Base URL: `https://<SUPABASE_URL>/functions/v1`

## 1. Listar roles disponibles

`GET /list-roles?application_id=...&api_key=...`

```bash
curl -G "https://<SUPABASE_URL>/functions/v1/list-roles" \
  --data-urlencode "application_id=my-app" \
  --data-urlencode "api_key=pk_xxx"
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "application_id": "my-app",
    "application_name": "Mi App",
    "roles": [
      { "id": "uuid", "name": "admin", "display_name": "Administrador", "is_default": false }
    ]
  }
}
```

## 2. Crear (o reenviar) invitación

`POST /invitations-create`

Si ya existe una invitación `pending` para el mismo email se regenera el token y se reenvía el email (`resent: true`).

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/invitations-create" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "my-app",
    "api_key": "pk_xxx",
    "invited_by_email": "admin@tenant.com",
    "email": "nuevo@tenant.com",
    "role_id": "uuid-del-rol",
    "name": "Juan Pérez"
  }'
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "invitation_id": "uuid",
    "email": "nuevo@tenant.com",
    "role": { "id": "uuid", "name": "Administrador" },
    "tenant_id": "uuid",
    "expires_at": "2026-05-10T...",
    "accept_url": "https://app.tenant.com/accept-invitation?token=...&email=...",
    "resent": false
  }
}
```

Errores posibles: `APPLICATION_NOT_FOUND`, `INVALID_API_KEY`, `INVITER_NOT_FOUND`, `ROLE_NOT_FOUND`, `USER_ALREADY_EXISTS`, `NO_AUTH_URL`.

## 3. Listar invitaciones del tenant

`POST /invitations-list`

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/invitations-list" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "my-app",
    "api_key": "pk_xxx",
    "invited_by_email": "admin@tenant.com",
    "status": "pending"
  }'
```

El campo `status` es opcional (`pending` | `accepted` | `revoked` | `expired`).

## 4. Revocar invitación

`POST /invitations-revoke`

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/invitations-revoke" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "my-app",
    "api_key": "pk_xxx",
    "invited_by_email": "admin@tenant.com",
    "invitation_id": "uuid"
  }'
```

## 5. Validar token (público)

Lo llama el formulario de aceptación para mostrar tenant/rol/inviter antes de pedir datos.

`POST /invitations-validate` o `GET /invitations-validate?application_id=...&api_key=...&token=...`

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/invitations-validate" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "my-app",
    "api_key": "pk_xxx",
    "token": "token-de-la-invitacion"
  }'
```

## 6. Aceptar invitación

`POST /invitations-accept`

Crea el `app_users` con `tenant_id` y `role_id` asignados. Devuelve el `api_key` público para que el frontend redirija al login.

```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/invitations-accept" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "my-app",
    "api_key": "pk_xxx",
    "token": "token-de-la-invitacion",
    "name": "Juan Pérez",
    "password": "password-seguro-8chars"
  }'
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email": "nuevo@tenant.com",
    "name": "Juan Pérez",
    "application_id": "my-app",
    "api_key": "pk_public_xxx"
  }
}
```

El frontend debe redirigir a `/?app_id=<application_id>&api_key=<api_key>` para que el usuario pueda iniciar sesión inmediatamente.

## Flujo recomendado en la aplicación del tenant

1. **Admin** (pantalla de administración):
   - GET `/list-roles` al cargar la pantalla.
   - POST `/invitations-list` para mostrar el estado.
   - POST `/invitations-create` con el rol elegido.
   - POST `/invitations-revoke` para cancelar pendientes.
2. **Invitado** recibe email con link `https://<tu-app>/accept-invitation?token=...&email=...`:
   - POST `/invitations-validate` para mostrar contexto (tenant, rol, quien invita).
   - Formulario con nombre + contraseña.
   - POST `/invitations-accept`.
   - Redirige a `/?app_id=...&api_key=...` para login.

## Notas

- El tenant de la invitación se deriva automáticamente del `invited_by_email` (un admin solo puede invitar a su propio tenant).
- La URL de aceptación se construye con `environments.auth_url` configurado en la aplicación; opcionalmente puede sobreescribirse enviando `redirect_url` en `invitations-create`.
- Los tokens expiran a los 7 días; se pueden re-emitir reenviando la invitación.
- El template del email es `invitacion_usuario` y se configura por aplicación en el sistema de branding.
