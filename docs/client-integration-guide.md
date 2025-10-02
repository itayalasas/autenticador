# Guía de Integración para Clientes

## 🚀 Cómo integrar AuthSystem en tu aplicación

### 1. Configuración Inicial

#### URLs que debes configurar en tu aplicación:
```
https://tudominio.com/auth/callback     (obligatorio)
https://tudominio.com/auth/error        (opcional)
https://tudominio.com/verify-email      (opcional)
```

#### Datos que recibirás de AuthSystem:
- **API Key**: Para hacer requests a nuestros endpoints
- **Application ID**: Identificador único de tu app
- **URLs de formularios**: Para redirigir usuarios a login/registro

---

## 2. Flujo de Autenticación

### Paso 1: Redirigir usuario a AuthSystem
```javascript
// Redirigir a login
window.location.href = 'https://auth-dev.tudominio.com/login?app_id=app_mk2k3j4h5k6l&callback_url=https://miapp.com/auth/callback';

// Redirigir a registro
window.location.href = 'https://auth-dev.tudominio.com/register?app_id=app_mk2k3j4h5k6l&callback_url=https://miapp.com/auth/callback';
```

### Paso 2: Manejar el callback en tu aplicación

Cuando el usuario se autentica exitosamente, lo redirigimos a tu `callback_url` con estos parámetros:

```
https://miapp.com/auth/callback?token=JWT_TOKEN&refresh_token=REFRESH_TOKEN&user_id=123&state=success&user_email=usuario@ejemplo.com&user_name=Juan%20Perez&expires_in=86400
```

---

## 3. Implementación en el Cliente

### JavaScript/React (Recomendado)

```javascript
// /auth/callback - Página que maneja la respuesta de AuthSystem
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // 1. Extraer datos de la URL
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refresh_token');
      const userId = searchParams.get('user_id');
      const userEmail = searchParams.get('user_email');
      const userName = searchParams.get('user_name');
      const state = searchParams.get('state');
      const expiresIn = searchParams.get('expires_in');

      if (state !== 'success' || !token) {
        throw new Error('Autenticación fallida');
      }

      // 2. Validar el token con AuthSystem (opcional pero recomendado)
      const isValid = await validateToken(token);
      if (!isValid) {
        throw new Error('Token inválido');
      }

      // 3. Decodificar el JWT para obtener datos completos del usuario
      const userData = parseJWT(token);
      
      // 4. Guardar datos de autenticación
      const authData = {
        accessToken: token,
        refreshToken: refreshToken,
        user: {
          id: userId,
          email: userEmail,
          name: decodeURIComponent(userName || ''),
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          metadata: userData.metadata || {}
        },
        expiresAt: new Date(Date.now() + parseInt(expiresIn) * 1000)
      };

      // 5. Guardar en localStorage/sessionStorage
      localStorage.setItem('authData', JSON.stringify(authData));
      
      // 6. Actualizar estado de la aplicación
      setUserAuthenticated(authData.user);
      
      setStatus('success');
      
      // 7. Redirigir a la página principal de tu app
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);

    } catch (error) {
      console.error('Error en callback:', error);
      setStatus('error');
    }
  };

  // Función para validar token con AuthSystem
  const validateToken = async (token) => {
    try {
      const response = await fetch('https://auth-dev.tudominio.com/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'tu_api_key_aqui'
        },
        body: JSON.stringify({
          token: token,
          application_id: 'app_mk2k3j4h5k6l'
        })
      });
      
      const result = await response.json();
      return result.success && result.data.valid;
    } catch (error) {
      return false;
    }
  };

  // Función para decodificar JWT (lado cliente)
  const parseJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      return {};
    }
  };

  if (status === 'loading') {
    return <div>Procesando autenticación...</div>;
  }

  if (status === 'error') {
    return <div>Error en la autenticación. <a href="/login">Intentar de nuevo</a></div>;
  }

  return <div>¡Autenticación exitosa! Redirigiendo...</div>;
}
```

### PHP (Alternativa)

```php
<?php
// /auth/callback.php
session_start();

try {
    // 1. Extraer datos de la URL
    $token = $_GET['token'] ?? null;
    $refreshToken = $_GET['refresh_token'] ?? null;
    $userId = $_GET['user_id'] ?? null;
    $userEmail = $_GET['user_email'] ?? null;
    $userName = $_GET['user_name'] ?? null;
    $state = $_GET['state'] ?? null;
    $expiresIn = $_GET['expires_in'] ?? 86400;

    if ($state !== 'success' || !$token) {
        throw new Exception('Autenticación fallida');
    }

    // 2. Validar token con AuthSystem
    $isValid = validateToken($token);
    if (!$isValid) {
        throw new Exception('Token inválido');
    }

    // 3. Decodificar JWT
    $userData = parseJWT($token);
    
    // 4. Guardar en sesión
    $_SESSION['auth_data'] = [
        'access_token' => $token,
        'refresh_token' => $refreshToken,
        'user' => [
            'id' => $userId,
            'email' => $userEmail,
            'name' => urldecode($userName),
            'roles' => $userData['roles'] ?? [],
            'permissions' => $userData['permissions'] ?? []
        ],
        'expires_at' => date('Y-m-d H:i:s', time() + $expiresIn)
    ];

    // 5. Redirigir a dashboard
    header('Location: /dashboard');
    exit;

} catch (Exception $e) {
    // Manejar error
    header('Location: /login?error=' . urlencode($e->getMessage()));
    exit;
}

function validateToken($token) {
    $data = [
        'token' => $token,
        'application_id' => 'app_mk2k3j4h5k6l'
    ];
    
    $options = [
        'http' => [
            'header' => "Content-type: application/json\r\n" .
                       "X-API-Key: tu_api_key_aqui\r\n",
            'method' => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $result = file_get_contents('https://auth-dev.tudominio.com/api/auth/verify', false, $context);
    $response = json_decode($result, true);
    
    return $response['success'] && $response['data']['valid'];
}

function parseJWT($token) {
    $parts = explode('.', $token);
    $payload = json_decode(base64_decode($parts[1]), true);
    return $payload;
}
?>
```

---

## 4. Middleware de Autenticación

### Para proteger rutas en tu aplicación:

```javascript
// middleware/auth.js
export const requireAuth = (req, res, next) => {
  const authData = getStoredAuthData();
  
  if (!authData || !isAuthenticated()) {
    // Redirigir a login con callback
    const loginUrl = `https://auth-dev.tudominio.com/login?app_id=app_mk2k3j4h5k6l&callback_url=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
    return;
  }
  
  // Usuario autenticado, continuar
  req.user = authData.user;
  next();
};

// Verificar permisos específicos
export const requirePermission = (permission) => {
  return (req, res, next) => {
    const authData = getStoredAuthData();
    
    if (!authData.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Sin permisos suficientes' });
    }
    
    next();
  };
};
```

---

## 5. Ejemplo de Uso Completo

```javascript
// App.js - Ejemplo completo
import { useEffect, useState } from 'react';
import { getStoredAuthData, isAuthenticated, clearAuthData } from './utils/authHelpers';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    if (isAuthenticated()) {
      const authData = getStoredAuthData();
      setUser(authData.user);
    }
    setLoading(false);
  };

  const handleLogin = () => {
    const loginUrl = `https://auth-dev.tudominio.com/login?app_id=app_mk2k3j4h5k6l&callback_url=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
    window.location.href = loginUrl;
  };

  const handleLogout = () => {
    clearAuthData();
    setUser(null);
    // Opcional: notificar logout a AuthSystem
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return (
      <div>
        <h1>Mi Aplicación</h1>
        <button onClick={handleLogin}>Iniciar Sesión</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Bienvenido, {user.name}!</h1>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(', ')}</p>
      <p>Permisos: {user.permissions.join(', ')}</p>
      <button onClick={handleLogout}>Cerrar Sesión</button>
      
      {/* Contenido protegido basado en roles */}
      {user.roles.includes('admin') && (
        <div>
          <h2>Panel de Administración</h2>
          <p>Solo visible para administradores</p>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Resumen para el Cliente

**El cliente debe implementar:**

1. **Página de callback** (`/auth/callback`) que procese los parámetros de la URL
2. **Validación del token** (opcional pero recomendado)
3. **Almacenamiento de la sesión** (localStorage, sessionStorage, cookies)
4. **Middleware de autenticación** para proteger rutas
5. **Manejo de expiración** y refresh de tokens

**Lo que nosotros proporcionamos:**
- URLs de formularios de login/registro personalizados
- API REST para validar tokens
- Redirección automática con todos los datos del usuario
- Documentación completa con ejemplos de código

¿Te parece claro este flujo? ¿Quieres que ajuste algo específico?