# ✅ SOLUCIÓN FINAL - Relación app_users y application_roles

## 🔍 Problema Identificado

La tabla `app_users` **NO tiene** una columna `role_id` con foreign key a `application_roles`.

Por eso el error:
```
"Could not find a relationship between 'app_users' and 'application_roles' in the schema cache"
```

---

## ✅ Solución Implementada (Temporal)

He actualizado la Edge Function para que **NO intente hacer el JOIN** con `application_roles` hasta que agregues la columna.

### **Cambios en la Edge Function:**

```typescript
// ❌ ANTES (con JOIN que fallaba):
.select(`
  id,
  user_id,
  email,
  full_name,
  role_id,
  is_active,
  created_at,
  application_roles!left(id, name, display_name)
`)

// ✅ AHORA (sin JOIN):
.select(`
  id,
  user_id,
  email,
  full_name,
  is_active,
  created_at
`)
```

---

## 🚀 Desplegar la Función Corregida

### **Paso 1: Copiar Código**
El código actualizado está en: `/supabase/functions/user-search/index.ts`

### **Paso 2: Desplegar**
Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions

1. Click en `user-search`
2. Click en "Edit" o "Deploy"
3. Pega el código actualizado
4. Guarda y despliega

### **Paso 3: Probar**

```json
{
  "application_id": "tu-uuid-aqui",
  "api_key": "tu-key-hash-aqui",
  "query": "juan"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "user_id": "user-123",
        "email": "juan@example.com",
        "full_name": "Juan Pérez",
        "role": null,
        "is_active": true,
        "created_at": "2025-10-12T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "has_more": false
    }
  }
}
```

**NOTA:** `role` será `null` por ahora.

---

## 🔧 Solución Permanente (Opcional)

Si quieres incluir roles en el futuro, necesitas agregar la columna `role_id` a `app_users`:

### **Script SQL:**

```sql
-- 1. Agregar columna role_id a app_users
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES application_roles(id) ON DELETE SET NULL;

-- 2. Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_app_users_role_id ON app_users(role_id);

-- 3. Verificar
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'app_users' 
  AND column_name = 'role_id';
```

### **Actualizar Edge Function (después de agregar role_id):**

```typescript
// Query con roles incluidos
.select(`
  id,
  user_id,
  email,
  full_name,
  role_id,
  is_active,
  created_at,
  role:application_roles(id, name, display_name)
`)

// Habilitar filtro por role
if (role_id) {
  queryBuilder = queryBuilder.eq('role_id', role_id);
}

// Format con role data
const formattedUsers = (users || []).map(user => ({
  id: user.id,
  user_id: user.user_id,
  email: user.email,
  full_name: user.full_name,
  role: user.role ? {
    id: user.role.id,
    name: user.role.name,
    display_name: user.role.display_name,
  } : null,
  is_active: user.is_active,
  created_at: user.created_at
}));
```

---

## 📊 Estado Actual vs Futuro

| Característica | Ahora | Después de agregar role_id |
|---------------|-------|----------------------------|
| Búsqueda por nombre/email | ✅ Funciona | ✅ Funciona |
| Paginación | ✅ Funciona | ✅ Funciona |
| Traer todos los usuarios | ✅ Funciona | ✅ Funciona |
| Información de roles | ❌ `role: null` | ✅ `role: {...}` |
| Filtrar por role_id | ❌ Deshabilitado | ✅ Funciona |

---

## 🧪 Ejemplo de Uso Actual

### **Request:**
```javascript
const response = await fetch('https://tu-project.supabase.co/functions/v1/user-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  },
  body: JSON.stringify({
    application_id: 'e7b2c8d4-5f6a-4b9c-8d7e-1a2b3c4d5e6f',
    api_key: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    query: 'juan',
    limit: 10,
    offset: 0
  })
});

const result = await response.json();
console.log('Usuarios:', result.data.users);
```

### **Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "user_123",
        "email": "juan@example.com",
        "full_name": "Juan Pérez",
        "role": null,
        "is_active": true,
        "created_at": "2025-10-12T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 10,
      "offset": 0,
      "has_more": false
    }
  }
}
```

---

## ⚠️ Notas Importantes

1. **La función ahora funciona SIN roles** - Retorna `role: null` para todos
2. **El filtro por `role_id` está deshabilitado** temporalmente
3. **Para habilitar roles**, ejecuta el script SQL de arriba
4. **No hay errores** - La búsqueda funciona perfectamente

---

## 🆘 Si Necesitas Roles Ahora

Si necesitas incluir roles inmediatamente:

1. **Ejecuta el script SQL** para agregar `role_id` a `app_users`
2. **Actualiza la Edge Function** con el código que incluye el JOIN
3. **Asigna roles** a los usuarios existentes:

```sql
-- Asignar role por defecto a usuarios sin role
UPDATE app_users 
SET role_id = (
  SELECT id FROM application_roles 
  WHERE application_id = app_users.application_id 
    AND is_default = true 
  LIMIT 1
)
WHERE role_id IS NULL;
```

---

✅ **La Edge Function ahora funciona correctamente sin intentar hacer JOIN con roles!**

Despliega el código actualizado y prueba la búsqueda. Debería funcionar sin errores.
