# Flujo de Autenticacion para Clientes

## Resumen

El flujo recomendado ya no entrega tokens directos en el callback.

1. El cliente redirige al usuario a AuthSystem.
2. El usuario completa login, registro o recuperacion.
3. AuthSystem redirige al cliente con un `code` temporal.
4. El cliente intercambia ese `code` por tokens usando `auth-exchange-code`.

---

## Flujo completo

### 1. Redirigir al usuario a AuthSystem

La aplicacion cliente construye la URL de login o registro:

```javascript
const loginUrl = `https://auth-crmpro.netlify.app/login` +
  `?app_id=app_a6f840c5-bd1` +
  `&redirect_uri=${encodeURIComponent('https://tuapp.com/callback')}` +
  `&api_key=ak_production_042a5f866c7e35630a9340bd224cbdda`;

window.location.href = loginUrl;
```

Parametros principales:
- `app_id`: identificador publico de la aplicacion.
- `redirect_uri`: URL de callback de la aplicacion cliente.
- `api_key`: llave publica asociada al ambiente.

---

### 2. El usuario completa el formulario

AuthSystem maneja internamente:
- validacion de credenciales,
- validacion de la API key,
- registro de logs,
- control de seguridad,
- MFA si aplica.

---

### 3. AuthSystem redirige con un `code`

Despues de un login exitoso, el callback queda asi:

```text
https://tuapp.com/callback?code=AUTH_CODE_UUID&state=authenticated
```

Parametros:
- `code`: codigo temporal de un solo uso.
- `state`: valor de control para validar la respuesta.

Importante:
- El cliente no debe esperar `token` ni `refresh_token` en la URL.
- El intercambio de tokens ocurre en el siguiente paso.

---

### 4. Intercambiar el `code` por tokens

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (!code || state !== 'authenticated') {
    window.location.href = '/login';
    return;
  }

  const response = await fetch('https://auth-crmpro.netlify.app/functions/v1/auth-exchange-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code,
      application_id: 'app_a6f840c5-bd1'
    })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('access_token', data.data.access_token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    window.location.href = '/dashboard';
  } else {
    console.error('Error al intercambiar el code:', data.error?.message);
    window.location.href = '/login';
  }
});
```

---

## Datos del token

Una vez intercambiado el `code`, el `access_token` contiene datos del usuario como:

```json
{
  "sub": "user_123",
  "email": "usuario@ejemplo.com",
  "name": "Usuario Ejemplo",
  "app_id": "app_mk2k3j4h5k6l",
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "iat": 1234567890,
  "exp": 1234654290,
  "iss": "AuthSystem",
  "aud": "tuapp.com"
}
```

---

## URLs disponibles

### Login
```text
https://auth-crmpro.netlify.app/login?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

### Registro
```text
https://auth-crmpro.netlify.app/register?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

### Recuperar contrasena
```text
https://auth-crmpro.netlify.app/reset-password?app_id=YOUR_APP_ID&redirect_uri=YOUR_CALLBACK&api_key=YOUR_API_KEY
```

---

## Que hace y que no hace el cliente

### El cliente si hace
- Redirige al usuario a AuthSystem.
- Recibe `code` en el callback.
- Intercambia el `code` por tokens.
- Guarda tokens y datos de sesion.

### El cliente no hace
- No maneja credenciales del usuario.
- No valida passwords.
- No genera tokens.
- No debe depender de tokens directos en la URL.

---

## Resumen operativo

1. Construir URL con `app_id`, `redirect_uri` y `api_key`.
2. Redirigir al usuario a AuthSystem.
3. Esperar callback con `code`.
4. Llamar a `auth-exchange-code`.
5. Guardar tokens y continuar a la aplicacion.

