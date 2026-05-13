# Guia de Integracion para Clientes

## Como integrar AuthSystem en tu aplicacion

Esta guia documenta el flujo recomendado actual:

1. Tu app redirige al usuario a AuthSystem.
2. AuthSystem autentica al usuario.
3. AuthSystem devuelve un `code` temporal en el callback.
4. Tu app intercambia ese `code` por tokens usando `auth-exchange-code`.

---

## 1. Configuracion inicial

### URLs que debes definir en tu aplicacion

```text
https://tudominio.com/auth/callback
https://tudominio.com/auth/error
https://tudominio.com/verify-email
```

### Datos que usa la integracion

- `app_id`: identificador publico de la aplicacion.
- `api_key`: llave publica del ambiente.
- `redirect_uri` o `callback_url`: URL de retorno de tu app.

---

## 2. Flujo de autenticacion

### Paso 1: redirigir al usuario

```javascript
const authBaseUrl = 'https://auth-dev.tudominio.com';
const appId = 'app_mk2k3j4h5k6l';
const callbackUrl = 'https://miapp.com/auth/callback';
const apiKey = 'ak_production_042a5f866c7e35630a9340bd224cbdda';

window.location.href =
  `${authBaseUrl}/login?app_id=${appId}` +
  `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
  `&api_key=${apiKey}`;
```

Para registro:

```javascript
window.location.href =
  `${authBaseUrl}/register?app_id=${appId}` +
  `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
  `&api_key=${apiKey}`;
```

---

### Paso 2: recibir el callback

AuthSystem redirige con un `code` temporal:

```text
https://miapp.com/auth/callback?code=AUTH_CODE_UUID&state=authenticated
```

El cliente debe:

- validar que exista `code`,
- validar `state`,
- intercambiar el `code` por tokens,
- guardar la sesion en su propio storage.

---

### Paso 3: intercambiar el code por tokens

```javascript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    void handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (state !== 'authenticated' || !code) {
        throw new Error('Callback invalido');
      }

      const response = await fetch('https://auth-dev.tudominio.com/functions/v1/auth-exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          application_id: 'app_mk2k3j4h5k6l'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'No se pudieron intercambiar los tokens');
      }

      localStorage.setItem('access_token', result.data.access_token);
      localStorage.setItem('refresh_token', result.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));

      setStatus('success');
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error en callback:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return <div>Procesando autenticacion...</div>;
  }

  if (status === 'error') {
    return <div>Error en la autenticacion. <a href="/login">Intentar de nuevo</a></div>;
  }

  return <div>Autenticacion exitosa. Redirigiendo...</div>;
}
```

---

## 3. Ejemplo en PHP

```php
<?php
session_start();

try {
    $code = $_GET['code'] ?? null;
    $state = $_GET['state'] ?? null;

    if ($state !== 'authenticated' || !$code) {
        throw new Exception('Callback invalido');
    }

    $payload = [
        'code' => $code,
        'application_id' => 'app_mk2k3j4h5k6l'
    ];

    $ch = curl_init('https://auth-dev.tudominio.com/functions/v1/auth-exchange-code');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response = curl_exec($ch);
    curl_close($ch);

    $result = json_decode($response, true);

    if (!$result['success']) {
        throw new Exception($result['error']['message'] ?? 'Error de autenticacion');
    }

    $_SESSION['auth_data'] = [
        'access_token' => $result['data']['access_token'],
        'refresh_token' => $result['data']['refresh_token'],
        'user' => $result['data']['user']
    ];

    header('Location: /dashboard');
    exit;
} catch (Exception $e) {
    header('Location: /login?error=' . urlencode($e->getMessage()));
    exit;
}
?>
```

---

## 4. Proteccion de rutas

Si quieres proteger rutas en tu app, usa la sesion local o un middleware propio:

```javascript
export const requireAuth = () => {
  const accessToken = localStorage.getItem('access_token');

  if (!accessToken) {
    const loginUrl = `https://auth-dev.tudominio.com/login?app_id=app_mk2k3j4h5k6l&redirect_uri=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
    return false;
  }

  return true;
};
```

---

## 5. Recomendaciones de seguridad

- Usa siempre HTTPS.
- Registra las `redirect_uri` permitidas por aplicacion. `callback_url` sigue como alias compatible en el backend.
- No expongas la `api_key` en repositorios publicos.
- Trata el `code` como un valor de un solo uso.
- No guardes tokens sensibles en lugares compartidos entre usuarios.
- Valida `state` antes de intercambiar el `code`.

---

## 6. Resumen rapido

- Redirige al usuario a `/login` o `/register`.
- Recibe `code` en el callback.
- Llama a `auth-exchange-code`.
- Guarda `access_token` y `refresh_token`.
- Continua el flujo en tu aplicacion.
