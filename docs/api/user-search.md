# API: User Search

Endpoint para buscar usuarios en tiempo real por nombre o email.

## Endpoint

```
POST /functions/v1/user-search
```

## Autenticación

Requiere `application_id` y `api_key` en el body de la petición.

## Request Body

```typescript
{
  application_id: string;  // ID de tu aplicación (requerido)
  api_key: string;         // Tu API key (requerido)
  query?: string;          // Término de búsqueda (opcional)
  role_id?: string;        // Filtrar por rol (opcional)
  limit?: number;          // Límite de resultados (default: 20)
  offset?: number;         // Offset para paginación (default: 0)
}
```

## Response

```typescript
{
  success: boolean;
  data: {
    users: Array<{
      id: string;
      user_id: string;
      email: string;
      full_name: string;
      role: {
        id: string;
        name: string;
        display_name: string;
      };
      is_active: boolean;
      created_at: string;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}
```

## Ejemplos de Uso

### JavaScript / Vanilla JS

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const APPLICATION_ID = 'your-app-id';
const API_KEY = 'your-api-key';

async function searchUsers(query) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/user-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_id: APPLICATION_ID,
      api_key: API_KEY,
      query: query,
      limit: 10
    })
  });

  const data = await response.json();

  if (data.success) {
    return data.data.users;
  } else {
    throw new Error(data.error);
  }
}

// Uso con autocomplete
const searchInput = document.getElementById('user-search');
let searchTimeout;

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    const query = e.target.value;

    if (query.length >= 2) {
      try {
        const users = await searchUsers(query);
        displayResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    }
  }, 300); // Debounce 300ms
});

function displayResults(users) {
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = users.map(user => `
    <div class="user-result" data-user-id="${user.id}">
      <div class="user-name">${user.full_name}</div>
      <div class="user-email">${user.email}</div>
      <div class="user-role">${user.role.display_name}</div>
    </div>
  `).join('');
}
```

### React / Next.js

```typescript
import { useState, useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APPLICATION_ID = process.env.NEXT_PUBLIC_APPLICATION_ID;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: {
    id: string;
    name: string;
    display_name: string;
  };
  is_active: boolean;
  created_at: string;
}

export default function UserSearchComponent() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setUsers([]);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/user-search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              application_id: APPLICATION_ID,
              api_key: API_KEY,
              query: query,
              limit: 10
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          setUsers(data.data.users);
        } else {
          console.error('Search error:', data.error);
          setUsers([]);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="user-search">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar usuarios por nombre o email..."
        className="search-input"
      />

      {loading && <div>Buscando...</div>}

      {users.length > 0 && (
        <ul className="search-results">
          {users.map((user) => (
            <li key={user.id} className="user-item">
              <div className="user-info">
                <strong>{user.full_name}</strong>
                <span className="user-email">{user.email}</span>
              </div>
              <span className="user-role">
                {user.role.display_name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && !loading && users.length === 0 && (
        <div className="no-results">No se encontraron usuarios</div>
      )}
    </div>
  );
}
```

### Vue.js

```vue
<template>
  <div class="user-search">
    <input
      v-model="query"
      type="text"
      placeholder="Buscar usuarios por nombre o email..."
      class="search-input"
    />

    <div v-if="loading" class="loading">Buscando...</div>

    <ul v-if="users.length > 0" class="search-results">
      <li v-for="user in users" :key="user.id" class="user-item">
        <div class="user-info">
          <strong>{{ user.full_name }}</strong>
          <span class="user-email">{{ user.email }}</span>
        </div>
        <span class="user-role">{{ user.role.display_name }}</span>
      </li>
    </ul>

    <div v-if="query.length >= 2 && !loading && users.length === 0" class="no-results">
      No se encontraron usuarios
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;
const API_KEY = import.meta.env.VITE_API_KEY;

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: {
    id: string;
    name: string;
    display_name: string;
  };
  is_active: boolean;
  created_at: string;
}

const query = ref('');
const users = ref<User[]>([]);
const loading = ref(false);
let searchTimeout: number;

watch(query, async (newQuery) => {
  clearTimeout(searchTimeout);

  if (newQuery.length < 2) {
    users.value = [];
    return;
  }

  searchTimeout = setTimeout(async () => {
    loading.value = true;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/user-search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            application_id: APPLICATION_ID,
            api_key: API_KEY,
            query: newQuery,
            limit: 10
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        users.value = data.data.users;
      } else {
        console.error('Search error:', data.error);
        users.value = [];
      }
    } catch (error) {
      console.error('Error searching users:', error);
      users.value = [];
    } finally {
      loading.value = false;
    }
  }, 300);
});
</script>
```

### PHP (Backend)

```php
<?php
$supabaseUrl = 'https://your-project.supabase.co';
$applicationId = 'your-app-id';
$apiKey = 'your-api-key';

function searchUsers($query, $roleId = null, $limit = 20) {
    global $supabaseUrl, $applicationId, $apiKey;

    $data = [
        'application_id' => $applicationId,
        'api_key' => $apiKey,
        'query' => $query,
        'limit' => $limit
    ];

    if ($roleId) {
        $data['role_id'] = $roleId;
    }

    $ch = curl_init("$supabaseUrl/functions/v1/user-search");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Uso
$searchQuery = $_GET['q'] ?? '';

if (strlen($searchQuery) >= 2) {
    $result = searchUsers($searchQuery);

    if ($result['success']) {
        $users = $result['data']['users'];

        // Retornar como JSON
        header('Content-Type: application/json');
        echo json_encode($users);
    }
}
?>
```

## Filtros Avanzados

### Buscar por rol específico

```javascript
const response = await fetch(`${SUPABASE_URL}/functions/v1/user-search`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    application_id: APPLICATION_ID,
    api_key: API_KEY,
    query: 'Juan',
    role_id: 'role-uuid-here', // Solo usuarios con este rol
    limit: 10
  })
});
```

### Paginación

```javascript
async function loadMoreUsers(offset = 0) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/user-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_id: APPLICATION_ID,
      api_key: API_KEY,
      query: 'Juan',
      limit: 20,
      offset: offset
    })
  });

  const data = await response.json();

  if (data.success) {
    const { users, pagination } = data.data;

    console.log(`Mostrando ${users.length} de ${pagination.total} usuarios`);
    console.log(`¿Hay más?: ${pagination.has_more}`);

    return users;
  }
}

// Cargar primera página
const firstPage = await loadMoreUsers(0);

// Cargar segunda página
const secondPage = await loadMoreUsers(20);
```

## Códigos de Error

| Código | Mensaje | Descripción |
|--------|---------|-------------|
| 400 | `application_id is required` | Falta el ID de aplicación |
| 400 | `api_key is required` | Falta la API key |
| 401 | `Invalid API key or application` | API key inválida o inactiva |
| 500 | `Internal server error` | Error interno del servidor |

## Mejores Prácticas

1. **Debouncing**: Implementa un delay (300-500ms) antes de hacer la búsqueda para evitar demasiadas peticiones

2. **Mínimo de caracteres**: Requiere al menos 2-3 caracteres antes de buscar

3. **Caché**: Considera cachear resultados de búsquedas comunes

4. **Loading states**: Muestra indicadores de carga mientras se busca

5. **Error handling**: Maneja errores de red y muestra mensajes apropiados

6. **Límite de resultados**: No cargues más de 20-50 resultados a la vez

## Seguridad

- ✅ Valida API key en cada petición
- ✅ Solo retorna usuarios de la aplicación especificada
- ✅ La API key debe ser de producción (environment='production')
- ⚠️ No expongas las credenciales en el frontend (usa variables de entorno)
