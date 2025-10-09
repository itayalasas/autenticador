# 📦 Complete Export Package - Bolt Authentication Platform

Este paquete contiene todo lo necesario para desplegar el sistema completo en una nueva instancia de Supabase.

## 📋 Archivos Incluidos

### 1. Base de Datos

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `complete_database_export.sql` | 48 KB | Script SQL completo con toda la estructura de la base de datos |
| `DATABASE_EXPORT_README.md` | 4.5 KB | Documentación detallada del export de base de datos |
| `database_setup_script.sql` | - | Script combinado con referencias a Edge Functions |

**Contenido del export de base de datos:**
- ✅ 21 tablas con estructura completa
- ✅ 6 funciones PostgreSQL
- ✅ 9 triggers automáticos
- ✅ 50+ políticas RLS
- ✅ 30+ índices para performance
- ✅ Foreign keys y constraints
- ✅ Datos por defecto (plan básico gratuito)

### 2. Edge Functions

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `EDGE_FUNCTIONS_EXPORT.md` | 124 KB | Código completo de todas las Edge Functions (11 funciones) |
| `supabase/functions/` | - | Directorio con todas las funciones listas para desplegar |

**Edge Functions incluidas:**
1. `auth-login` - Autenticación de usuarios
2. `auth-register` - Registro de nuevos usuarios
3. `auth-reset-password` - Solicitud de reseteo de contraseña
4. `auth-reset-password-confirm` - Confirmación de reseteo
5. `check-ip-status` - Verificar IPs bloqueadas
6. `debug-email-config` - Debug de configuración de email
7. `debug-env-vars` - Debug de variables de ambiente
8. `send-email` - Envío de emails
9. `sync-dlocal-plans` - Sincronizar planes de dLocal
10. `sync-dlocal-subscriptions` - Sincronizar suscripciones
11. `test-dlocal-auth` - Probar autenticación dLocal

### 3. Documentación

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `DEPLOYMENT_GUIDE.md` | 8.1 KB | Guía completa de despliegue paso a paso |
| `EXPORT_INDEX.md` | - | Este archivo (índice maestro) |

### 4. Scripts de Automatización

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `deploy-all.sh` | 4.1 KB | Script bash para despliegue automatizado |

## 🚀 Guía Rápida de Despliegue

### Opción 1: Despliegue Manual (Recomendado para principiantes)

1. **Importar Base de Datos**
   ```
   - Abre Supabase Dashboard → SQL Editor
   - Copia el contenido de: complete_database_export.sql
   - Ejecuta el script
   ```

2. **Configurar Variables de Ambiente**
   ```
   - Ve a: Project Settings → Edge Functions → Secrets
   - Agrega:
     * DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
     * DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
     * DLOCAL_API_URL=https://api-sbx.dlocalgo.com
   ```

3. **Desplegar Edge Functions**
   ```bash
   # Para cada función en supabase/functions/
   supabase functions deploy [nombre-funcion]
   ```

### Opción 2: Despliegue Automatizado (Para usuarios avanzados)

```bash
# 1. Ejecutar script de despliegue
./deploy-all.sh

# El script hará:
# - Verificar dependencias
# - Configurar secrets
# - Desplegar todas las Edge Functions
```

### Opción 3: Usando EDGE_FUNCTIONS_EXPORT.md

Si no tienes el directorio `supabase/functions/`:

1. Abre `EDGE_FUNCTIONS_EXPORT.md`
2. Para cada función:
   - Crea: `supabase/functions/[nombre]/index.ts`
   - Copia el código del export
3. Despliega con `supabase functions deploy [nombre]`

## 📊 Estructura del Sistema

### Base de Datos

```
┌─────────────────────────────────────────┐
│         Sistema de Usuarios             │
├─────────────────────────────────────────┤
│ • profiles (perfiles usuarios)          │
│ • applications (apps registradas)       │
│ • app_users (usuarios de apps)          │
│ • user_roles (roles de usuarios)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Autenticación y Seguridad          │
├─────────────────────────────────────────┤
│ • api_keys (claves de API)              │
│ • auth_logs (logs de autenticación)     │
│ • blocked_ips (IPs bloqueadas)          │
│ • email_verification_tokens             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Configuración                  │
├─────────────────────────────────────────┤
│ • environments (dev/test/prod)          │
│ • branding_configs (personalización)    │
│ • application_roles (roles por app)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Notificaciones                 │
├─────────────────────────────────────────┤
│ • notifications (notificaciones)        │
│ • notification_preferences              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Suscripciones y Pagos              │
├─────────────────────────────────────────┤
│ • subscription_plans (planes)           │
│ • subscriptions (suscripciones)         │
│ • payment_methods (métodos de pago)     │
│ • invoices (facturas)                   │
│ • dlocal_plans_cache (caché dLocal)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Logs y Tracking                │
├─────────────────────────────────────────┤
│ • email_logs (logs de emails)           │
│ • deployment_logs (logs despliegues)    │
│ • usage_tracking (uso de API)           │
└─────────────────────────────────────────┘
```

### Edge Functions

```
┌─────────────────────────────────────────┐
│          Autenticación                  │
├─────────────────────────────────────────┤
│ • auth-login                            │
│ • auth-register                         │
│ • auth-reset-password                   │
│ • auth-reset-password-confirm           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Seguridad                      │
├─────────────────────────────────────────┤
│ • check-ip-status                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Comunicaciones                 │
├─────────────────────────────────────────┤
│ • send-email                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Integración dLocal             │
├─────────────────────────────────────────┤
│ • sync-dlocal-plans                     │
│ • sync-dlocal-subscriptions             │
│ • test-dlocal-auth                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Herramientas Debug             │
├─────────────────────────────────────────┤
│ • debug-email-config                    │
│ • debug-env-vars                        │
└─────────────────────────────────────────┘
```

## ✅ Checklist de Verificación

Después del despliegue, verifica:

### Base de Datos
- [ ] 21 tablas creadas correctamente
- [ ] Triggers funcionando (test con registro de usuario)
- [ ] RLS habilitado en todas las tablas
- [ ] Plan básico gratuito existe en `subscription_plans`
- [ ] Funciones PostgreSQL creadas

### Edge Functions
- [ ] 11 funciones desplegadas
- [ ] Variables de ambiente configuradas
- [ ] Test de `debug-env-vars` exitoso
- [ ] Test de `test-dlocal-auth` exitoso
- [ ] Autenticación funciona

### Tests Básicos

```bash
# 1. Test variables de ambiente
curl https://YOUR_PROJECT.supabase.co/functions/v1/debug-env-vars

# 2. Test autenticación dLocal
curl https://YOUR_PROJECT.supabase.co/functions/v1/test-dlocal-auth

# 3. Test registro de usuario
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auth-register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","application_id":"app_test"}'
```

## 🔧 Configuración Post-Despliegue

### Frontend

Actualiza `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Producción de dLocal

Para usar producción en lugar de sandbox:
```bash
supabase secrets set DLOCAL_API_URL=https://api.dlocalgo.com
```

## 📚 Documentación Completa

Para más detalles, consulta:
- **DEPLOYMENT_GUIDE.md** - Guía completa paso a paso
- **DATABASE_EXPORT_README.md** - Documentación de la base de datos
- **EDGE_FUNCTIONS_EXPORT.md** - Código de todas las funciones

## 🆘 Soporte

### Problemas Comunes

1. **"Invalid Credentials" en dLocal**
   - Verifica secrets: `supabase secrets list`
   - Reconfigura con los comandos en DEPLOYMENT_GUIDE.md

2. **Edge Function no responde**
   - Ver logs: `supabase functions logs [nombre]`
   - Re-desplegar: `supabase functions deploy [nombre]`

3. **RLS Policy Violation**
   - Verifica políticas en SQL Editor
   - Consulta DATABASE_EXPORT_README.md

## 📝 Notas Importantes

- **Seguridad**: Todas las tablas tienen RLS habilitado
- **Performance**: Todos los índices están configurados
- **Automatización**: Triggers manejan operaciones comunes
- **Escalabilidad**: Estructura lista para producción
- **Sandbox**: Por defecto usa ambiente sandbox de dLocal

## 🎯 Próximos Pasos

1. **Configurar dominio personalizado**
2. **Setup de email SMTP** (si lo necesitas)
3. **Configurar webhooks de dLocal**
4. **Setup de monitoring y alertas**
5. **Backups automáticos**

---

**Package Version**: 1.0
**Last Updated**: 2025-10-09
**Compatibility**: Supabase PostgreSQL 15+
**Edge Functions Runtime**: Deno 1.x

## 📄 Licencia

Este export contiene el sistema completo de autenticación Bolt.
