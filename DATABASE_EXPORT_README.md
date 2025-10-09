# Complete Database Export

Este archivo contiene la exportación completa de la base de datos del sistema de autenticación.

## Contenido del Export

### 📋 Tablas Principales

1. **Sistema de Usuarios y Perfiles**
   - `profiles` - Perfiles de usuarios del sistema
   - `applications` - Aplicaciones registradas
   - `app_users` - Usuarios de las aplicaciones
   - `user_roles` - Roles de usuarios

2. **Autenticación y Seguridad**
   - `api_keys` - Claves de API con ambientes
   - `auth_logs` - Logs de autenticación
   - `blocked_ips` - IPs bloqueadas
   - `email_verification_tokens` - Tokens de verificación

3. **Configuración**
   - `environments` - Ambientes (dev, testing, prod)
   - `branding_configs` - Configuraciones de marca
   - `application_roles` - Roles por aplicación

4. **Notificaciones**
   - `notifications` - Notificaciones del sistema
   - `notification_preferences` - Preferencias de notificaciones

5. **Suscripciones y Pagos**
   - `subscription_plans` - Planes de suscripción
   - `subscriptions` - Suscripciones activas
   - `payment_methods` - Métodos de pago
   - `invoices` - Facturas
   - `dlocal_plans_cache` - Caché de planes de dLocal

6. **Logs y Tracking**
   - `email_logs` - Logs de emails enviados
   - `deployment_logs` - Logs de despliegues
   - `usage_tracking` - Tracking de uso de API

## 🔐 Seguridad (RLS)

- **Todas las tablas** tienen Row Level Security (RLS) habilitado
- **Políticas personalizadas** para cada tabla
- **Acceso restrictivo**: Los usuarios solo pueden ver/editar sus propios datos
- **Service role**: Tiene acceso completo para operaciones del sistema

## ⚡ Características

### Triggers Automáticos
- Actualización automática de `updated_at`
- Creación de perfil al registrarse
- Creación de suscripción básica gratuita
- Creación de notificación de bienvenida
- Contador de usuarios por aplicación

### Funciones
- `update_updated_at_column()` - Actualizar timestamps
- `handle_new_user()` - Crear perfil automáticamente
- `create_welcome_notification()` - Notificación de bienvenida
- `create_basic_subscription_for_new_user()` - Suscripción básica
- `update_application_user_count()` - Contador de usuarios
- `update_dlocal_plans_cache_updated_at()` - Actualizar caché de planes

### Índices para Performance
- Índices en columnas de búsqueda frecuente
- Índices en foreign keys
- Índices en campos de fecha para ordenamiento
- Índices parciales donde corresponde

## 📦 Datos por Defecto

El script incluye:
- **Plan Básico Gratuito**: Suscripción básica para todos los nuevos usuarios
  - 1 aplicación
  - 100 usuarios por app
  - 10,000 requests API/mes
  - Solo ambiente Development

## 🚀 Cómo Usar

### Opción 1: Supabase SQL Editor
1. Ve a tu proyecto en Supabase Dashboard
2. Abre el SQL Editor
3. Copia y pega el contenido de `complete_database_export.sql`
4. Ejecuta el script

### Opción 2: psql Command Line
```bash
psql -h <supabase-host> -U postgres -d postgres -f complete_database_export.sql
```

### Opción 3: Importación Manual
```bash
# Desde Supabase CLI
supabase db push
```

## ⚙️ Variables de Ambiente Requeridas

Después de importar, configura estas variables en Supabase Dashboard → Settings → Edge Functions → Secrets:

```
DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
DLOCAL_API_URL=https://api-sbx.dlocalgo.com
```

## 📊 Estadísticas del Export

- **Total de líneas**: 1,527
- **Tablas**: 21
- **Funciones**: 6
- **Triggers**: 9
- **Políticas RLS**: 50+
- **Índices**: 30+

## 🔄 Estructura de las Migraciones

El export está basado en estas migraciones principales:
- `20251007021509` - Schema base
- `20251007021757` - Sistema de notificaciones
- `20251006024601` - Sistema de suscripciones
- `20251009023157` - Caché de planes dLocal
- `20251007040153` - Ambientes en API keys
- `20251008184336` - Logs de despliegue

## ⚠️ Notas Importantes

1. **Compatibilidad**: Este script usa `CREATE TABLE IF NOT EXISTS` para evitar errores
2. **Datos existentes**: Los datos existentes NO se perderán
3. **Políticas RLS**: Asegúrate de que los usuarios tengan los permisos correctos
4. **Service Role**: Algunas operaciones requieren service role key

## 🆘 Soporte

Si encuentras problemas durante la importación:
1. Verifica que tengas permisos de admin
2. Revisa los logs de error en Supabase Dashboard
3. Asegúrate de que las extensiones estén instaladas (uuid-ossp, pgcrypto)

---

**Fecha de generación**: $(date)
**Versión**: 1.0
