# Configuración de Supabase - AuthSystem

## Variables de Entorno Configuradas

Este proyecto está completamente integrado con Supabase usando las siguientes variables de entorno:

### Frontend (archivo .env)
```
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Edge Functions (Variables automáticas en Supabase)
Las siguientes variables están disponibles automáticamente en todas las Edge Functions:
- `SUPABASE_URL` - URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Key con permisos administrativos
- `SUPABASE_DB_URL` - URL de conexión directa a PostgreSQL

## Componentes que Usan Supabase

### 1. Frontend (Cliente Supabase)

**Archivo principal:** `src/lib/supabase.ts`

Usa las variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Todos los servicios del frontend importan desde aquí:
- `src/services/applicationService.ts`
- `src/services/authLogService.ts`
- `src/services/rolesService.ts`
- `src/services/subscriptionService.ts`
- `src/services/userService.ts`

### 2. Edge Functions (Supabase Functions)

Todas las edge functions usan el Service Role Key para operaciones administrativas:

#### `auth-register` (Registro de usuarios)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

#### `auth-login` (Inicio de sesión)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

#### `auth-reset-password` (Recuperación de contraseña)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

#### `send-email` (Envío de correos)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

#### `check-ip-status` (Verificación de IPs bloqueadas)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

#### `debug-email-config` (Diagnóstico de configuración de email)
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

## Base de Datos

Todas las tablas y migraciones están configuradas en: `supabase/migrations/`

Las tablas principales son:
- `applications` - Aplicaciones registradas (con email_config)
- `app_users` - Usuarios de las aplicaciones
- `auth_logs` - Logs de autenticación
- `email_logs` - Logs de emails enviados
- `email_verification_tokens` - Tokens de verificación
- `blocked_ips` - IPs bloqueadas
- `user_roles` - Roles de usuarios

## Configuración de Email

La configuración de email se guarda en la columna `email_config` de la tabla `applications`:

```json
{
  "email_provider": "system|smtp|resend|sendgrid",
  "from_email": "tu-email@dominio.com",
  "from_name": "Nombre del Remitente",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "usuario",
  "smtp_password": "contraseña",
  "api_key": "key-para-resend-o-sendgrid",
  "require_email_verification": true|false,
  "send_welcome_email": true|false,
  "send_password_reset_email": true|false,
  "notify_admin_new_user": true|false,
  "admin_notification_email": "admin@dominio.com"
}
```

## Cómo Verificar la Configuración

### 1. Verificar variables del frontend
```bash
cat .env
```

### 2. Verificar que las edge functions están desplegadas
Usa la herramienta MCP de Supabase:
```javascript
// En la consola del navegador
const functions = await fetch('TU_SUPABASE_URL/functions/v1/');
```

### 3. Verificar configuración de email de una aplicación
Usa la función de diagnóstico:
```
GET TU_SUPABASE_URL/functions/v1/debug-email-config?application_id=ID_DE_TU_APP
```

## Estado Actual

✅ **Frontend:** Correctamente configurado con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

✅ **Edge Functions:** Todas usan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (disponibles automáticamente en Supabase)

✅ **Base de Datos:** Migraciones aplicadas y tablas creadas

⚠️ **Configuración de Email:** Por defecto usa modo "system" (solo logs). Para enviar emails reales, configura SMTP, Resend o SendGrid en la sección de Autenticación.

## Solución de Problemas

### Los emails no se envían
**Causa:** El proveedor de email está en modo "system"

**Solución:**
1. Ve a la sección "Autenticación" en tu dashboard
2. Cambia el "Proveedor de Email" de "Sistema por Defecto" a SMTP, Resend o SendGrid
3. Configura las credenciales necesarias
4. Guarda la configuración
5. Prueba el envío de emails

### No puedo conectar a la base de datos
**Causa:** Variables de entorno no configuradas

**Solución:**
1. Verifica que el archivo `.env` tenga VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
2. Reinicia el servidor de desarrollo
3. Verifica en la consola del navegador que no haya errores de conexión

### Edge functions no funcionan
**Causa:** Las funciones no están desplegadas o hay errores en el código

**Solución:**
1. Verifica los logs de las edge functions en el dashboard de Supabase
2. Asegúrate de que las funciones estén desplegadas correctamente
3. Verifica que las variables de entorno estén disponibles en el entorno de Supabase

## Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Database](https://supabase.com/docs/guides/database)
