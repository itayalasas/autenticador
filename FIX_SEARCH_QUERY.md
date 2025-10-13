# ✅ CORRECCIÓN DE BÚSQUEDA DE USUARIOS

## 🔧 Mejoras Aplicadas

### **1. Búsqueda Case-Insensitive Mejorada**
```typescript
// Antes:
const searchTerm = `%${query.trim()}%`;
queryBuilder = queryBuilder.or(
  `full_name.ilike.${searchTerm},email.ilike.${searchTerm}`
);

// Ahora (más limpio):
const searchTerm = query.trim().toLowerCase();
queryBuilder = queryBuilder.or(
  `full_name.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*`
);
```

### **2. LEFT JOIN para Roles (Opcional)**
```typescript
// Antes: JOIN normal que falla si no hay role
role:application_roles(id, name, display_name)

// Ahora: LEFT JOIN que no falla
application_roles!left(id, name, display_name)
```

### **3. Mejor Manejo de Errores**
```typescript
// Ahora retorna detalles del error en lugar de solo "Error searching users"
if (usersError) {
  console.error('Error fetching users:', usersError);
  console.error('Error details:', JSON.stringify(usersError, null, 2));
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Error searching users',
      details: usersError.message || 'Unknown error'
    }),
    ...
  );
}
```

### **4. Count Optimizado**
```typescript
// Antes: 2 queries (una para datos, otra para count)
const { data: users, error: usersError } = await queryBuilder;
const { count: totalCount } = await supabase...

// Ahora: 1 query con count incluido
const { data: users, error: usersError, count: totalCount } = await supabase
  .from('app_users')
  .select(`...`, { count: 'exact' })
```

---

## 🚀 Desplegar Cambios

### **Paso 1: Copiar Código Actualizado**

Abre `/supabase/functions/user-search/index.ts` y copia todo el contenido.

### **Paso 2: Desplegar en Supabase**

Ve a: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions

1. Click en la función `user-search`
2. Click en "Edit" o "Deploy"
3. Pega el código actualizado
4. Guarda y despliega

---

## 🧪 Probar Búsqueda

### **1. Búsqueda por Nombre (case-insensitive)**

```json
{
  "application_id": "tu-uuid-aqui",
  "api_key": "tu-key-hash-aqui",
  "query": "juan",
  "limit": 10,
  "offset": 0
}
```

**Encontrará:**
- "Juan Pérez"
- "JUAN GARCIA"
- "juan rodriguez"
- "María Juana"

### **2. Búsqueda por Email**

```json
{
  "application_id": "tu-uuid-aqui",
  "api_key": "tu-key-hash-aqui",
  "query": "gmail",
  "limit": 10
}
```

**Encontrará:**
- "juan@gmail.com"
- "maria@gmail.com"
- "admin@gmail.com"

### **3. Sin Query (Traer Todos)**

```json
{
  "application_id": "tu-uuid-aqui",
  "api_key": "tu-key-hash-aqui",
  "limit": 20,
  "offset": 0
}
```

**Resultado:** Trae todos los usuarios paginados.

### **4. Filtrar por Role**

```json
{
  "application_id": "tu-uuid-aqui",
  "api_key": "tu-key-hash-aqui",
  "query": "juan",
  "role_id": "role-uuid-aqui",
  "limit": 10
}
```

---

## 📊 Respuesta Esperada

### **Success (con usuarios):**
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
        "role": {
          "id": "role-uuid",
          "name": "admin",
          "display_name": "Administrator"
        },
        "is_active": true,
        "created_at": "2025-10-12T00:00:00Z"
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

### **Success (sin usuarios):**
```json
{
  "success": true,
  "data": {
    "users": [],
    "pagination": {
      "total": 0,
      "limit": 10,
      "offset": 0,
      "has_more": false
    }
  }
}
```

### **Error (con detalles):**
```json
{
  "success": false,
  "error": "Error searching users",
  "details": "relation \"app_users\" does not exist"
}
```

---

## 🔍 Características de Búsqueda

✅ **Case-insensitive** - Busca sin importar mayúsculas/minúsculas  
✅ **Partial match** - Busca coincidencias parciales (like `%query%`)  
✅ **Email y nombre** - Busca en ambos campos simultáneamente  
✅ **Sin query** - Trae todos los usuarios si no se pasa `query`  
✅ **Paginación** - Soporta `limit` y `offset`  
✅ **Filtro por role** - Opcional con `role_id`  
✅ **LEFT JOIN roles** - No falla si un usuario no tiene role asignado  

---

## ⚠️ Notas Importantes

1. El parámetro `query` es **opcional**
2. Si no se pasa `query`, trae **todos los usuarios**
3. La búsqueda usa `ilike` (case-insensitive LIKE)
4. Los roles son opcionales (LEFT JOIN)
5. Si hay error, ahora verás los detalles en la respuesta

---

## 🆘 Troubleshooting

### **Error: "relation app_users does not exist"**
- Verifica que la tabla `app_users` existe
- Verifica que tienes permisos en la tabla

### **Error: "column application_id does not exist"**
- Verifica que la tabla `app_users` tiene la columna `application_id`

### **Error: "foreign key violation"**
- Verifica que el `application_id` existe en la tabla `applications`

### **No trae resultados pero debería**
- Verifica que los usuarios tienen el mismo `application_id`
- Verifica que el `query` coincide con algún nombre o email
- Prueba sin `query` para traer todos

---

## 📈 Ejemplo Completo de Uso

```javascript
// Request
const response = await fetch('https://tu-supabase.co/functions/v1/user-search', {
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
console.log('Usuarios encontrados:', result.data.users);
console.log('Total:', result.data.pagination.total);
```

✅ **Búsqueda mejorada y lista para usar!**
