# Guía Completa de Despliegue - Supabase

Esta guía te ayudará a desplegar completamente el sistema en una nueva instancia de Supabase.

## 📋 Archivos de Exportación

- **`complete_database_export.sql`** (48 KB) - Base de datos completa
- **`EDGE_FUNCTIONS_EXPORT.md`** (124 KB) - Todas las Edge Functions
- **`database_setup_script.sql`** - Script combinado
- **`DATABASE_EXPORT_README.md`** - Documentación de la base de datos

## 🚀 Proceso de Despliegue

### Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Guarda las credenciales:
   - Project URL
   - Anon Key
   - Service Role Key

### Paso 2: Importar Base de Datos

#### Opción A: SQL Editor (Recomendado)

1. Ve a **SQL Editor** en tu proyecto Supabase
2. Crea una nueva query
3. Copia el contenido de `complete_database_export.sql`
4. Pega y ejecuta el script
5. Espera a que complete (puede tomar 1-2 minutos)

#### Opción B: CLI de Supabase

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref YOUR_PROJECT_REF

# Aplicar migraciones
supabase db push
```

### Paso 3: Configurar Variables de Ambiente

Ve a **Project Settings → Edge Functions → Manage secrets** y agrega:

```bash
DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
DLOCAL_API_URL=https://api-sbx.dlocalgo.com
```

**Usando CLI:**
```bash
supabase secrets set DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
supabase secrets set DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
supabase secrets set DLOCAL_API_URL=https://api-sbx.dlocalgo.com
```

### Paso 4: Desplegar Edge Functions

Tienes 2 opciones para desplegar las Edge Functions:

#### Opción A: Usando el archivo `EDGE_FUNCTIONS_EXPORT.md`

1. Abre el archivo `EDGE_FUNCTIONS_EXPORT.md`
2. Para cada función:
   - Crea el directorio: `supabase/functions/[nombre-funcion]/`
   - Crea el archivo: `supabase/functions/[nombre-funcion]/index.ts`
   - Copia el código desde el export

#### Opción B: Copiar directorio completo (Más rápido)

Si ya tienes el proyecto clonado:

```bash
# Navega al proyecto
cd /ruta/al/proyecto

# Las funciones ya están en supabase/functions/
# Solo necesitas desplegarlas

# Desplegar todas las funciones
supabase functions deploy auth-login
supabase functions deploy auth-register
supabase functions deploy auth-reset-password
supabase functions deploy auth-reset-password-confirm
supabase functions deploy check-ip-status
supabase functions deploy debug-email-config
supabase functions deploy debug-env-vars
supabase functions deploy send-email
supabase functions deploy sync-dlocal-plans
supabase functions deploy sync-dlocal-subscriptions
supabase functions deploy test-dlocal-auth
```

#### Script de Despliegue Automatizado

```bash
#!/bin/bash
# deploy-all-functions.sh

FUNCTIONS=(
  "auth-login"
  "auth-register"
  "auth-reset-password"
  "auth-reset-password-confirm"
  "check-ip-status"
  "debug-email-config"
  "debug-env-vars"
  "send-email"
  "sync-dlocal-plans"
  "sync-dlocal-subscriptions"
  "test-dlocal-auth"
)

for func in "${FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  supabase functions deploy "$func"
  if [ $? -eq 0 ]; then
    echo "✅ $func deployed successfully"
  else
    echo "❌ Failed to deploy $func"
  fi
done

echo "Deployment complete!"
```

### Paso 5: Verificar Despliegue

#### Verificar Base de Datos

```sql
-- Ver todas las tablas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verificar funciones
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';

-- Verificar triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Verificar RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
```

#### Verificar Edge Functions

```bash
# Listar funciones desplegadas
supabase functions list

# Probar una función
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/debug-env-vars" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Paso 6: Configurar Frontend

Actualiza tu archivo `.env` en el proyecto frontend:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# DLocal Configuration
VITE_DLOCAL_API_URL=https://api-sbx.dlocalgo.com
VITE_DLOCAL_CHECKOUT_URL=https://checkout-sbx.dlocalgo.com
VITE_DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
VITE_DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
VITE_DLOCAL_PLANS_ENDPOINT=v1/subscription/plan/all
VITE_DLOCAL_MERCHANT_ID=3348
```

## 🧪 Testing

### 1. Test de Autenticación

```bash
# Registro
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "application_id": "app_test123"
  }'

# Login
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "application_id": "app_test123"
  }'
```

### 2. Test de dLocal Integration

```bash
# Test de autenticación
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/test-dlocal-auth" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Sincronizar planes
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-dlocal-plans" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. Test de Variables de Ambiente

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/debug-env-vars" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## 📊 Estructura Desplegada

Después del despliegue tendrás:

### Base de Datos
- ✅ 21 tablas
- ✅ 6 funciones
- ✅ 9 triggers
- ✅ 50+ políticas RLS
- ✅ 30+ índices
- ✅ Plan básico gratuito

### Edge Functions
- ✅ 11 funciones desplegadas
- ✅ Autenticación completa
- ✅ Integración con dLocal
- ✅ Sistema de emails
- ✅ Debugging tools

## 🔧 Troubleshooting

### Error: "Invalid Credentials" en dLocal

**Causa**: Variables de ambiente no configuradas correctamente.

**Solución**:
```bash
# Verificar variables
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/debug-env-vars"

# Reconfigurar si es necesario
supabase secrets set DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
supabase secrets set DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
```

### Error: RLS Policy Violation

**Causa**: Políticas RLS muy restrictivas.

**Solución**:
```sql
-- Verificar políticas para una tabla
SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';

-- Temporalmente deshabilitar RLS (solo para testing)
ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;
```

### Edge Function No Responde

**Causa**: Función no desplegada o error en el código.

**Solución**:
```bash
# Re-desplegar función
supabase functions deploy nombre-funcion

# Ver logs
supabase functions logs nombre-funcion
```

## 📝 Checklist de Despliegue

- [ ] Proyecto Supabase creado
- [ ] Base de datos importada (`complete_database_export.sql`)
- [ ] Variables de ambiente configuradas (dLocal)
- [ ] Edge Functions desplegadas (11 funciones)
- [ ] Tests de autenticación exitosos
- [ ] Tests de dLocal exitosos
- [ ] Frontend configurado con nuevas credenciales
- [ ] RLS verificado
- [ ] Triggers funcionando
- [ ] Plan básico creado automáticamente

## 🎯 Próximos Pasos

1. **Configurar Email**: Si quieres usar email verification
2. **Configurar Dominio**: Agregar dominio personalizado
3. **Configurar CORS**: Ajustar políticas CORS si es necesario
4. **Monitoring**: Configurar alertas y monitoreo
5. **Backups**: Configurar backups automáticos

## 📚 Referencias

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Última actualización**: $(date)
**Versión**: 1.0
