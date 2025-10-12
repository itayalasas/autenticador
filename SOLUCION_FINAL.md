# 🎯 SOLUCIÓN: Asignación Incorrecta de Roles en Registro

## ❌ PROBLEMA IDENTIFICADO

Cuando un usuario selecciona **"Cliente"** en el formulario de registro, el sistema lo crea con el rol **"user"** en lugar de **"cliente"**.

### Flujo del Problema:

```
Formulario de Registro
  ↓
Usuario selecciona: "Cliente"
  ↓
Frontend envía: { role: "Cliente" }
  ↓
Edge Function auth-register
  ↓
❌ IGNORA el campo "role"
  ↓
Busca: WHERE is_default = true
  ↓
Asigna: rol "user"
  ↓
❌ Resultado: Usuario con rol incorrecto
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. **Código Corregido en Edge Function**

**Antes (INCORRECTO):**
```typescript
// Línea 717-725 (VIEJO)
const { data: defaultRole } = await supabase
  .from('application_roles')
  .select('name, permissions')
  .eq('application_id', application.id)
  .eq('is_default', true)  // ← SIEMPRE busca el default
  .maybeSingle();

const roleToAssign = defaultRole || { name: 'user', permissions: ['read'] };
```

**Ahora (CORRECTO):**
```typescript
// Líneas 716-778 (NUEVO)
let roleToAssign: { name: string; permissions: any[] } | null = null;

// 1. Si el usuario seleccionó un rol, buscarlo
if (role) {
  // Buscar por display_name (ej: "Cliente")
  const { data: requestedRole } = await supabase
    .from('application_roles')
    .select('name, permissions')
    .eq('application_id', application.id)
    .eq('display_name', role)
    .maybeSingle();

  if (requestedRole) {
    roleToAssign = requestedRole;
  } else {
    // Buscar por name (ej: "cliente")
    const { data: roleByName } = await supabase
      .from('application_roles')
      .select('name, permissions')
      .eq('application_id', application.id)
      .ilike('name', role)
      .maybeSingle();

    if (roleByName) {
      roleToAssign = roleByName;
    }
  }
}

// 2. Si no se encontró, usar el rol por defecto
if (!roleToAssign) {
  const { data: defaultRole } = await supabase
    .from('application_roles')
    .select('name, permissions')
    .eq('application_id', application.id)
    .eq('is_default', true)
    .maybeSingle();

  roleToAssign = defaultRole || { name: 'user', permissions: ['read'] };
}

// 3. Asignar el rol al usuario
await supabase
  .from('user_roles')
  .insert({
    app_user_id: newUser.id,
    role_name: roleToAssign.name,
    permissions: roleToAssign.permissions || ['read']
  });
```

### 2. **Interface Actualizada**

```typescript
interface RegisterRequest {
  email: string
  password: string
  name: string
  application_id: string
  api_key: string
  role?: string           // ← AGREGADO
  callback_url?: string
  client_ip?: string
  metadata?: Record<string, any>
}
```

### 3. **Flujo Corregido**

```
Formulario de Registro
  ↓
Usuario selecciona: "Cliente"
  ↓
Frontend envía: { role: "Cliente", ... }
  ↓
Edge Function auth-register
  ↓
✅ LEE el campo "role" del payload
  ↓
Busca: WHERE display_name = "Cliente"
  ↓
Encuentra: { name: "cliente", permissions: [...] }
  ↓
Asigna: rol "cliente"
  ↓
✅ Resultado: Usuario con rol "cliente"
```

---

## 🚀 PASOS PARA APLICAR LA SOLUCIÓN

### **Paso 1: Actualizar Edge Function** (2 MINUTOS)

**Opción A - Supabase CLI:**
```bash
cd /tmp/cc-agent/58424341/project
supabase functions deploy auth-register --project-ref sfqtmnncgiqkveaoqckt
```

**Opción B - Dashboard Manual:**
1. Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions
2. Selecciona **"auth-register"**
3. Clic en **"Edit"**
4. Copia el código de: `supabase/functions/auth-register/index.ts`
5. Pega en el editor
6. Clic en **"Deploy"**

---

### **Paso 2: Probar el Registro** (1 MINUTO)

1. Ve al formulario de registro
2. Completa los datos
3. **Selecciona "Cliente"** en "Tipo de Usuario"
4. Haz clic en "Crear Cuenta"
5. Ve al dashboard → **Usuarios**
6. ✅ Verifica que el usuario tenga rol **"cliente"**

---

## 📊 COMPARACIÓN: ANTES vs DESPUÉS

| Campo | Antes | Después |
|-------|-------|---------|
| **Nombre** | Alejandra Londoño | Alejandra Londoño |
| **Email** | ale@gmail.com | ale@gmail.com |
| **Rol Seleccionado** | "Cliente" | "Cliente" |
| **Rol Asignado** | ❌ "user" | ✅ "cliente" |
| **Razón** | Ignoraba el campo `role` | Usa el campo `role` |

---

## 🔍 LOGS DE DEBUG

La función ahora incluye logs detallados:

```
✅ User created successfully, assigning role...
🎭 Role from request: Cliente
✅ Using requested role: Cliente
✅ Role assigned successfully: cliente
✅ Registration successful for user: ale@gmail.com
```

---

## 📝 ARCHIVOS MODIFICADOS

```
/tmp/cc-agent/58424341/project/
└── supabase/
    └── functions/
        └── auth-register/
            └── index.ts  ← ACTUALIZADO (líneas 13-23, 417, 716-778)
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [x] Interface actualizada con campo `role?`
- [x] Payload extrae el campo `role` del request
- [x] Lógica busca rol por `display_name`
- [x] Fallback busca rol por `name` (case-insensitive)
- [x] Fallback final usa rol por defecto
- [x] Logs de debug agregados
- [ ] **Edge Function desplegada** ← PENDIENTE
- [ ] **Prueba de registro realizada** ← PENDIENTE

---

## 🎉 RESULTADO ESPERADO

Después de actualizar la función:

```
┌─────────────────────────────────────────┐
│  Usuario: Nuevo Usuario                 │
├─────────────────────────────────────────┤
│  Email: nuevo@example.com               │
│  Rol Seleccionado: "Cliente"            │
│  Rol Asignado: "cliente" ✅             │
│  Estado: Activo                         │
└─────────────────────────────────────────┘
```

---

**¡Solo falta desplegar la función actualizada!** 🚀
