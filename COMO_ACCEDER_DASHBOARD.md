# 🔐 Cómo Acceder al Dashboard Administrativo

## Usuario Administrador Existente

Ya existe un usuario administrador en el sistema:

```
Email: pedro86cu@gmail.com
Rol: admin
Creado: 2025-10-07
```

## ¿Olvidaste tu Contraseña?

### Opción 1: Resetear desde Supabase Dashboard

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Users**
4. Busca el usuario `pedro86cu@gmail.com`
5. Click en los 3 puntos (...) → **Send Password Reset Email**
6. Revisa tu email y sigue las instrucciones

### Opción 2: Cambiar Contraseña Manualmente (SQL)

Ejecuta este SQL en Supabase SQL Editor para cambiar la contraseña:

```sql
-- Cambiar contraseña a: NuevaPassword123!
-- IMPORTANTE: Reemplaza 'TU_NUEVA_CONTRASEÑA' con la que quieras usar

UPDATE auth.users
SET
  encrypted_password = crypt('TU_NUEVA_CONTRASEÑA', gen_salt('bf')),
  updated_at = now()
WHERE email = 'pedro86cu@gmail.com';
```

**Ejemplo con contraseña específica:**
```sql
UPDATE auth.users
SET
  encrypted_password = crypt('Admin123!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'pedro86cu@gmail.com';
```

Después de ejecutar, podrás hacer login con:
- Email: `pedro86cu@gmail.com`
- Password: `Admin123!` (o la que hayas puesto)

### Opción 3: Crear Nuevo Usuario Administrador

Si quieres crear un nuevo usuario administrador:

```sql
-- Crear nuevo usuario admin
-- Email: admin@tudominio.com
-- Password: TuPassword123!

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@tudominio.com',
  crypt('TuPassword123!', gen_salt('bf')),
  now(),
  '{"name": "Admin User", "role": "admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);
```

## Error: "Invalid login credentials"

Este error significa que:
1. El email no existe en `auth.users`
2. La contraseña es incorrecta

### Verificar qué usuarios existen:

```sql
SELECT
  email,
  created_at,
  email_confirmed_at,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'role' as role
FROM auth.users
ORDER BY created_at DESC;
```

## Error: "Row violates row-level security policy"

Este error en `auth_logs` ya fue solucionado con la migración `fix_auth_logs_insert_policy.sql`.

Si aún persiste, verifica que la política fue aplicada:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'auth_logs';
```

Deberías ver:
- `Authenticated users can read all auth logs` (SELECT)
- `Allow insert auth logs for authenticated and anon` (INSERT)

## 🚀 Acceso Rápido

### Desarrollo Local
```
URL: http://localhost:5173
Email: pedro86cu@gmail.com
Password: [Tu contraseña]
```

### Producción (Netlify)
```
URL: https://tu-app.netlify.app
Email: pedro86cu@gmail.com
Password: [Tu contraseña]
```

## 📝 Notas Importantes

1. **Este es el dashboard administrativo**, no la autenticación de las aplicaciones cliente
2. Los usuarios del dashboard se crean en `auth.users` (Supabase Auth)
3. Los usuarios de las aplicaciones cliente se crean en `app_users` (custom)
4. Son sistemas de autenticación separados e independientes

## 🔧 Troubleshooting

### No puedo hacer login después de cambiar la contraseña

1. Limpia el caché del navegador
2. Intenta en modo incógnito
3. Verifica que el email sea exactamente el mismo (sin espacios)
4. Verifica que la contraseña tenga al menos 6 caracteres

### Sigo viendo errores de RLS

Ejecuta esta migración manualmente en Supabase SQL Editor:

```sql
-- Drop existing policy if exists
DROP POLICY IF EXISTS "Allow insert auth logs for authenticated and anon" ON auth_logs;

-- Allow authenticated users and service role to insert auth logs
CREATE POLICY "Allow insert auth logs for authenticated and anon"
  ON auth_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
```

### ¿Cómo sé si mi contraseña funciona?

Prueba hacer login directamente con la API de Supabase:

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'pedro86cu@gmail.com',
  password: 'TuPassword'
});

console.log('Success:', data);
console.log('Error:', error);
```

---

## 🎯 Resumen de Acceso

| Componente | Email | Tabla | Método |
|------------|-------|-------|--------|
| **Dashboard Admin** | pedro86cu@gmail.com | auth.users | Supabase Auth |
| **Aplicaciones Cliente** | cualquier@email.com | app_users | Edge Functions |

El error que tienes es en el **Dashboard Admin**, usa: `pedro86cu@gmail.com` con tu contraseña.
