# 🔐 Flujo de Autenticación para Clientes

## 📋 Resumen

El cliente **NO llama a la API directamente**. El flujo funciona así:

1. El cliente **redirige** al usuario a AuthSystem
2. El usuario completa el formulario en AuthSystem
3. AuthSystem **redirige de vuelta** al cliente con los tokens

---

## 🔄 Flujo Completo

### **1. Cliente redirige al usuario a AuthSystem**

El cliente construye una URL y redirige al usuario:

```javascript
// En tu aplicación cliente
const loginUrl = `https://auth-crmpro.netlify.app/login` +
  `?app_id=app_a6f840c5-bd1` +
  `&redirect_uri=${encodeURIComponent('https://tuapp.com/callback')}` +
  `&api_key=ak_production_042a5f866c7e35630a9340bd224cbdda`;

// Redirigir al usuario
window.location.href = loginUrl;
```

**Parámetros requeridos:**
- `app_id`: Tu ID de aplicación público
- `redirect_uri`: URL de tu aplicación donde recibirás la respuesta (debe estar URL encoded)
- `api_key`: Tu API Key de producción

---

### **2. Usuario completa el formulario**

El usuario verá una página de AuthSystem con:
- Campos de email y password
- Branding personalizado de tu aplicación
- Validaciones de seguridad

AuthSystem maneja internamente:
- Validación de credenciales
- Verificación de API Key
- Verificación de IP bloqueada
- Registro de logs
- Generación de tokens

---

### **3. AuthSystem redirige de vuelta al cliente**

**Después de un login exitoso**, AuthSystem redirige automáticamente a:

```
https://tuapp.com/callback?token=ACCESS_TOKEN&refresh_token=REFRESH_TOKEN&user_id=USER_ID&state=authenticated
```

**Parámetros en la URL de callback:**
- `token`: Access token JWT (válido por 24 horas)
- `refresh_token`: Refresh token JWT (válido por 30 días)
- `user_id`: ID del usuario autenticado
- `state`: Estado de la autenticación (`authenticated`)

---

## 💻 Implementación en el Cliente

### **Página de Callback del Cliente**

```javascript
// callback.html o /callback route
window.addEventListener('DOMContentLoaded', () => {
  // Obtener parámetros de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('token');
  const refreshToken = urlParams.get('refresh_token');
  const userId = urlParams.get('user_id');
  const state = urlParams.get('state');

  if (accessToken && state === 'authenticated') {
    // ✅ Login exitoso

    // 1. Guardar tokens
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_id', userId);

    // 2. Decodificar el token para obtener datos del usuario
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));

    console.log('Usuario autenticado:', {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles,
      permissions: payload.permissions
    });

    // 3. Redirigir al dashboard o página principal
    window.location.href = '/dashboard';
  } else {
    // ❌ Error en la autenticación
    console.error('Error en la autenticación');
    window.location.href = '/login';
  }
});
```

---

## 📊 Datos Incluidos en el Token

El **Access Token** es un JWT que contiene:

```json
{
  "sub": "user_123",           // ID del usuario
  "email": "usuario@ejemplo.com",
  "name": "Usuario Ejemplo",
  "app_id": "app_mk2k3j4h5k6l",
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "iat": 1234567890,           // Fecha de emisión
  "exp": 1234654290,           // Fecha de expiración (24h)
  "iss": "AuthSystem",
  "aud": "tuapp.com"           // Tu dominio
}
```

Para decodificar el token en JavaScript:

```javascript
function decodeJWT(token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  return payload;
}

const userData = decodeJWT(accessToken);
console.log('Email:', userData.email);
console.log('Roles:', userData.roles);
```

---

## 🔗 URLs Disponibles

### **Login**
```
https://auth-crmpro.netlify.app/login?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

### **Registro**
```
https://auth-crmpro.netlify.app/register?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

### **Recuperar Contraseña**
```
https://auth-crmpro.netlify.app/reset-password?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

---

## ⚠️ IMPORTANTE

### **¿Qué NO hace el cliente?**
- ❌ NO llama a la API directamente
- ❌ NO maneja las credenciales del usuario
- ❌ NO valida passwords
- ❌ NO genera tokens

### **¿Qué SÍ hace el cliente?**
- ✅ Redirige al usuario a AuthSystem
- ✅ Recibe los tokens en el callback
- ✅ Guarda los tokens
- ✅ Usa los tokens para validar sesiones

---

## 🛡️ Seguridad

1. **API Key**: Valida que la petición viene de tu aplicación
2. **Redirect URI**: Solo redirige a URLs configuradas previamente
3. **Tokens JWT**: Firmados y con expiración
4. **HTTPS**: Todas las comunicaciones deben ser sobre HTTPS en producción

---

## 📝 Ejemplo Completo en HTML/JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mi Aplicación</title>
</head>
<body>
  <h1>Iniciar Sesión</h1>
  <button id="loginBtn">Login con AuthSystem</button>

  <script>
    const APP_ID = 'app_a6f840c5-bd1';
    const API_KEY = 'ak_production_042a5f866c7e35630a9340bd224cbdda';
    const CALLBACK_URL = 'https://tuapp.com/callback.html';
    const AUTH_BASE_URL = 'https://auth-crmpro.netlify.app';

    document.getElementById('loginBtn').addEventListener('click', () => {
      const loginUrl = `${AUTH_BASE_URL}/login` +
        `?app_id=${APP_ID}` +
        `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
        `&api_key=${API_KEY}`;

      window.location.href = loginUrl;
    });
  </script>
</body>
</html>
```

**callback.html:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Procesando...</title>
</head>
<body>
  <h1>Autenticando...</h1>

  <script>
    // Obtener tokens de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');

    if (token) {
      // Guardar tokens
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', refreshToken);

      // Decodificar token
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Usuario:', payload);

      // Redirigir al dashboard
      window.location.href = '/dashboard.html';
    } else {
      alert('Error en la autenticación');
      window.location.href = '/login.html';
    }
  </script>
</body>
</html>
```

---

## 🎯 Resumen

**El cliente simplemente:**

1. Construye una URL con `app_id`, `redirect_uri` y `api_key`
2. Redirige al usuario a AuthSystem
3. Espera que el usuario vuelva con los tokens en la URL
4. Guarda los tokens y los usa para mantener la sesión

**AuthSystem se encarga de todo lo demás internamente.**
