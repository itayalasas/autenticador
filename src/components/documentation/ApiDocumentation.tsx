import { useState } from 'react';
import { Copy, CheckCircle, AlertCircle, Globe, Key, Shield } from 'lucide-react';
import ArchitectureOverview from './ArchitectureOverview';

export default function ApiDocumentation() {
  const [activeEndpoint, setActiveEndpoint] = useState('auth-login');
  const [activeLanguage, setActiveLanguage] = useState('javascript');
  const [activeEnvironment, setActiveEnvironment] = useState('production');

  const environments = [
    {
      id: 'development',
      name: 'Development',
      icon: '⚡',
      baseUrl: 'http://localhost:5173',
      apiKey: 'ak_development_ejemplo123456789',
      description: 'Ambiente local para desarrollo'
    },
    {
      id: 'testing',
      name: 'Testing',
      icon: '🧪',
      baseUrl: 'https://auth-test.tudominio.com',
      apiKey: 'ak_testing_abcdef1234567890abcdef1234567890',
      description: 'Ambiente de pruebas'
    },
    {
      id: 'production',
      name: 'Production',
      icon: '🚀',
      baseUrl: 'https://celadon-begonia-d7eb0e.netlify.app',
      apiKey: 'ak_production_042a5f866c7e35630a9340bd224cbdda',
      description: 'Ambiente de producción'
    }
  ];

  const currentEnv = environments.find(env => env.id === activeEnvironment) || environments[0];

  const endpoints = [
    {
      id: 'auth-login',
      title: 'Login de Usuario',
      method: 'POST',
      path: '/functions/v1/auth-login',
      description: `Autentica un usuario y retorna tokens de acceso junto con permisos granulares a nivel de menú.

## Sistema de Permisos

La respuesta incluye un objeto \`permissions\` que mapea cada menú de la aplicación con las acciones permitidas:

- **Estructura**: \`{ "menu_slug": ["action1", "action2", ...] }\`
- **Acciones posibles**: read, create, update, delete
- **Uso**: Controla qué puede ver y hacer el usuario en cada sección

Además, cuando hay submenús, también retorna \`permissions_hierarchy\`:

- **Estructura**: \`{ "menu_slug": { actions: [...], submenus: { "submenu_slug": [...] } } }\`
- **Uso**: Permite evaluar permisos por menú padre y por submenú en forma jerárquica.

### Ejemplo de uso:
\`\`\`javascript
// Verificar si el usuario puede crear en dashboard
if (user.permissions.dashboard?.includes('create')) {
  // Mostrar botón "Crear"
}

// Verificar si el usuario puede ver reportes
if (user.permissions.reports) {
  // Mostrar menú de reportes
}
\`\`\``,
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'API Key de la aplicación (ej: ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, location: 'Body', description: 'Contraseña del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/auth-login`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          api_key: apiKey,
          email: 'usuario@ejemplo.com',
          password: 'micontraseña123',
          application_id: 'app_mk2k3j4h5k6l'
        }
      }),
      response: {
        success: (baseUrl: string) => `{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "60187dc2-a013-40fa-9a00-68701cc92018",
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "role": "administrador",
      "permissions": {
        "dashboard": ["read", "create", "update", "delete"],
        "users": ["read", "create", "update"],
        "reports": ["read"]
      },
      "permissions_hierarchy": {
        "dashboard": {
          "actions": ["read"],
          "submenus": {
            "users": ["read", "create", "update"],
            "reports": ["read"]
          }
        }
      },
      "metadata": {},
      "created_at": "2024-02-20T10:30:00Z"
    },
    "application": {
      "id": "app_mk2k3j4h5k6l",
      "name": "Mi Aplicación",
      "domain": "miapp.com"
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email o contraseña incorrectos"
  }
}

// Otros códigos de error posibles:
{
  "success": false,
  "error": {
    "code": "API_KEY_INVALID",
    "message": "API Key inválida o no encontrada"
  }
}

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Demasiados intentos. Por favor intenta más tarde."
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/functions/v1/auth-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: '${apiKey}',
    email: 'usuario@ejemplo.com',
    password: 'micontraseña123',
    application_id: 'app_mk2k3j4h5k6l'
  })
});

const data = await response.json();

if (data.success) {
  // Guardar tokens
  localStorage.setItem('access_token', data.data.access_token);
  localStorage.setItem('refresh_token', data.data.refresh_token);

  const claims = JSON.parse(atob(data.data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

  localStorage.setItem('user', JSON.stringify({
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    role: claims.role,
    permissions: claims.permissions,
    permissions_hierarchy: claims.permissions_hierarchy
  }));

  console.log('Login exitoso:', claims.email);
  console.log('Rol del usuario:', claims.role);
  console.log('Permisos:', claims.permissions);

  if (claims.permissions?.dashboard?.includes('create')) {
    console.log('Usuario puede crear en dashboard');
  }
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/functions/v1/auth-login'
headers = {'Content-Type': 'application/json'}
data = {
    'api_key': '${apiKey}',
    'email': 'usuario@ejemplo.com',
    'password': 'micontraseña123',
    'application_id': 'app_mk2k3j4h5k6l'
}

response = requests.post(url, json=data, headers=headers)
result = response.json()

if result['success']:
    access_token = result['data']['access_token']
    refresh_token = result['data']['refresh_token']
    user = result['data']['user']

    print(f"Login exitoso: {user['name']}")
    print(f"Rol: {user['role']}")
    print(f"Permisos: {user['permissions']}")

    # Verificar permisos específicos
    if 'create' in user['permissions'].get('dashboard', []):
        print('Usuario puede crear en dashboard')
else:
    print(f"Error: {result['error']['message']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
// PHP/cURL
$url = '${baseUrl}/functions/v1/auth-login';
$data = array(
  'api_key' => '${apiKey}',
    'email' => 'usuario@ejemplo.com',
    'password' => 'micontraseña123',
    'application_id' => 'app_mk2k3j4h5k6l'
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);

if ($result['success']) {
    $_SESSION['access_token'] = $result['data']['access_token'];
    $_SESSION['refresh_token'] = $result['data']['refresh_token'];
    $_SESSION['user'] = $result['data']['user'];

    echo "Login exitoso: " . $result['data']['user']['name'];
    echo "\\nRol: " . $result['data']['user']['role'];

    // Verificar permisos
    $permissions = $result['data']['user']['permissions'];
    if (isset($permissions['dashboard']) && in_array('create', $permissions['dashboard'])) {
        echo "\\nUsuario puede crear en dashboard";
    }
} else {
    echo "Error: " . $result['error']['message'];
}
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String json = "{\\"api_key\\":\\"${apiKey}\\",\\"email\\":\\"usuario@ejemplo.com\\",\\"password\\":\\"micontraseña123\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/functions/v1/auth-login"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-exchange-code',
      title: 'Intercambio de Código de Acceso',
      method: 'POST',
      path: '/functions/v1/auth-exchange-code',
      description: 'Intercambia el código temporal devuelto por el login con callback por tokens de acceso y datos del usuario.',
      params: [
        { name: 'code', type: 'string', required: true, location: 'Body', description: 'Código temporal recibido en el callback (query param code)' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID público de la aplicación (application_id)' }
      ],
      requestExample: (baseUrl: string) => ({
        url: `${baseUrl}/functions/v1/auth-exchange-code`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          code: 'e83e749d-2376-43c3-b6ff-f65448515f47',
          application_id: 'app_51ecb9e2-6b3'
        }
      }),
      response: {
        success: `{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "60187dc2-a013-40fa-9a00-68701cc92018",
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "role": "administrador",
      "permissions": {
        "dashboard": ["read", "create"]
      }
    },
    "application": {
      "id": "app_51ecb9e2-6b3"
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "Invalid or expired authorization code"
  }
}

// Otros errores posibles:
{
  "success": false,
  "error": {
    "code": "CODE_ALREADY_USED",
    "message": "Authorization code has already been used"
  }
}

{
  "success": false,
  "error": {
    "code": "APPLICATION_MISMATCH",
    "message": "Application ID does not match"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/functions/v1/auth-exchange-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'e83e749d-2376-43c3-b6ff-f65448515f47',
    application_id: 'app_51ecb9e2-6b3'
  })
});

const data = await response.json();

if (data.success) {
  localStorage.setItem('access_token', data.data.access_token);
  localStorage.setItem('refresh_token', data.data.refresh_token);
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string) => `# Python/Requests
import requests

url = '${baseUrl}/functions/v1/auth-exchange-code'
payload = {
    'code': 'e83e749d-2376-43c3-b6ff-f65448515f47',
    'application_id': 'app_51ecb9e2-6b3'
}

response = requests.post(url, json=payload)
result = response.json()

if result['success']:
    print('Code exchanged successfully')
else:
    print(f"Error: {result['error']['message']}")`,
        php: (baseUrl: string) => `<?php
$url = '${baseUrl}/functions/v1/auth-exchange-code';
$data = array(
    'code' => 'e83e749d-2376-43c3-b6ff-f65448515f47',
    'application_id' => 'app_51ecb9e2-6b3'
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?>`,
        java: (baseUrl: string) => `// Java/HttpClient
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String json = "{\\"code\\":\\"e83e749d-2376-43c3-b6ff-f65448515f47\\",\\"application_id\\":\\"app_51ecb9e2-6b3\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/functions/v1/auth-exchange-code"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-generate-test-code',
      title: 'Generar Código de Prueba',
      method: 'POST',
      path: '/functions/v1/auth-generate-test-code',
      description: 'Endpoint de testing para generar un code temporal compatible con auth-exchange-code. Solo funciona si ALLOW_TEST_AUTH_CODE_API=true en la función.',
      params: [
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID público de la aplicación (application_id)' },
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'API Key activa de la aplicación' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email de un usuario activo de la aplicación' },
        { name: 'callback_url', type: 'string', required: false, location: 'Body', description: 'Si se envía, retorna callback_url con code+state' },
        { name: 'ttl_seconds', type: 'number', required: false, location: 'Body', description: 'TTL del code en segundos (60-900, default 300)' },
        { name: 'x-test-secret', type: 'string', required: false, location: 'Header', description: 'Requerido si TEST_AUTH_CODE_SECRET está configurado' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/auth-generate-test-code`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-secret': 'opcional-si-configurado'
        },
        body: {
          application_id: 'app_51ecb9e2-6b3',
          api_key: apiKey,
          email: 'usuario@ejemplo.com',
          callback_url: 'https://test.clavecrm.com/callback',
          ttl_seconds: 300
        }
      }),
      response: {
        success: `{
  "success": true,
  "data": {
    "code": "44059454-9b4b-45f8-85f6-3a6b9ef5e128",
    "state": "authenticated",
    "expires_at": "2026-03-02T18:00:00.000Z",
    "callback_url": "https://test.clavecrm.com/callback?code=44059454-9b4b-45f8-85f6-3a6b9ef5e128&state=authenticated",
    "exchange_endpoint": "/functions/v1/auth-exchange-code",
    "exchange_payload": {
      "code": "44059454-9b4b-45f8-85f6-3a6b9ef5e128",
      "application_id": "app_51ecb9e2-6b3"
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "FEATURE_DISABLED",
    "message": "Test code API is disabled. Set ALLOW_TEST_AUTH_CODE_API=true to enable it."
  }
}

// Otros errores posibles:
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key inválida o inactiva"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const createCodeResponse = await fetch('${baseUrl}/functions/v1/auth-generate-test-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-test-secret': 'opcional-si-configurado'
  },
  body: JSON.stringify({
    application_id: 'app_51ecb9e2-6b3',
    api_key: '${apiKey}',
    email: 'usuario@ejemplo.com',
    callback_url: 'https://test.clavecrm.com/callback'
  })
});

const createCodeResult = await createCodeResponse.json();
console.log('Code generado:', createCodeResult.data?.code);

// Intercambiar code por tokens
const exchangeResponse = await fetch('${baseUrl}/functions/v1/auth-exchange-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: createCodeResult.data.code,
    application_id: 'app_51ecb9e2-6b3'
  })
});

console.log(await exchangeResponse.json());`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

generate_url = '${baseUrl}/functions/v1/auth-generate-test-code'
exchange_url = '${baseUrl}/functions/v1/auth-exchange-code'

generate_payload = {
    'application_id': 'app_51ecb9e2-6b3',
    'api_key': '${apiKey}',
    'email': 'usuario@ejemplo.com',
    'callback_url': 'https://test.clavecrm.com/callback'
}

generate_result = requests.post(generate_url, json=generate_payload).json()
code = generate_result['data']['code']

exchange_result = requests.post(exchange_url, json={
    'code': code,
    'application_id': 'app_51ecb9e2-6b3'
}).json()

print(exchange_result)`,
        php: (baseUrl: string, apiKey: string) => `<?php
$generateUrl = '${baseUrl}/functions/v1/auth-generate-test-code';
$exchangeUrl = '${baseUrl}/functions/v1/auth-exchange-code';

$generatePayload = array(
    'application_id' => 'app_51ecb9e2-6b3',
    'api_key' => '${apiKey}',
    'email' => 'usuario@ejemplo.com',
    'callback_url' => 'https://test.clavecrm.com/callback'
);

$ch = curl_init($generateUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($generatePayload));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
$generateResponse = curl_exec($ch);
curl_close($ch);

$generateResult = json_decode($generateResponse, true);
$code = $generateResult['data']['code'];

$exchangePayload = array(
    'code' => $code,
    'application_id' => 'app_51ecb9e2-6b3'
);

$ch2 = curl_init($exchangeUrl);
curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch2, CURLOPT_POST, true);
curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($exchangePayload));
curl_setopt($ch2, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
$exchangeResponse = curl_exec($ch2);
curl_close($ch2);

echo $exchangeResponse;
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();

String generateJson = "{\\"application_id\\":\\"app_51ecb9e2-6b3\\",\\"api_key\\":\\"${apiKey}\\",\\"email\\":\\"usuario@ejemplo.com\\",\\"callback_url\\":\\"https://test.clavecrm.com/callback\\"}";

HttpRequest generateRequest = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/functions/v1/auth-generate-test-code"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(generateJson))
    .build();

HttpResponse<String> generateResponse = client.send(generateRequest, HttpResponse.BodyHandlers.ofString());
System.out.println(generateResponse.body());

// Luego toma el code del response y llama auth-exchange-code
`
      }
    },
    {
      id: 'auth-register',
      title: 'Registro de Usuario',
      method: 'POST',
      path: '/functions/v1/auth-register',
      description: 'Registra un nuevo usuario en la aplicación usando la Edge Function. El api_key se envía en el body.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'API Key de la aplicación (ej: ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, location: 'Body', description: 'Contraseña del usuario' },
        { name: 'name', type: 'string', required: true, location: 'Body', description: 'Nombre completo del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' },
        { name: 'metadata', type: 'object', required: false, location: 'Body', description: 'Datos adicionales del usuario (opcional)' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/auth-register`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          api_key: apiKey,
          email: 'nuevo@ejemplo.com',
          password: 'contraseña123',
          name: 'Nuevo Usuario',
          application_id: 'app_mk2k3j4h5k6l',
          metadata: {
            plan: 'premium',
            source: 'web'
          }
        }
      }),
      response: {
        success: (baseUrl: string) => `{
  "success": true,
  "data": {
    "user": {
      "id": "user_456",
      "email": "nuevo@ejemplo.com",
      "name": "Nuevo Usuario",
      "status": "active",
      "created_at": "2024-02-20T10:30:00Z"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "Usuario registrado exitosamente"
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Ya existe un usuario con este email"
  }
}

// Otros errores posibles:
{
  "success": false,
  "error": {
    "code": "WEAK_PASSWORD",
    "message": "La contraseña debe tener al menos 8 caracteres"
  }
}

{
  "success": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "El formato del email es inválido"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/functions/v1/auth-register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: '${apiKey}',
    email: 'nuevo@ejemplo.com',
    password: 'contraseña123',
    name: 'Nuevo Usuario',
    application_id: 'app_mk2k3j4h5k6l',
    metadata: {
      plan: 'premium',
      source: 'web'
    }
  })
});

const data = await response.json();

if (data.success) {
  localStorage.setItem('access_token', data.data.access_token);
  localStorage.setItem('refresh_token', data.data.refresh_token);
  const claims = JSON.parse(atob(data.data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  console.log('Registro exitoso:', claims.email);
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/functions/v1/auth-register'
data = {
    'api_key': '${apiKey}',
    'email': 'nuevo@ejemplo.com',
    'password': 'contraseña123',
    'name': 'Nuevo Usuario',
    'application_id': 'app_mk2k3j4h5k6l',
    'metadata': {
        'plan': 'premium',
        'source': 'web'
    }
}

response = requests.post(url, json=data)
result = response.json()

if result['success']:
    print(f"Registro exitoso: {result['data']['user']}")
else:
    print(f"Error: {result['error']['message']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
$url = '${baseUrl}/functions/v1/auth-register';
$data = array(
  'api_key' => '${apiKey}',
    'email' => 'nuevo@ejemplo.com',
    'password' => 'contraseña123',
    'name' => 'Nuevo Usuario',
    'application_id' => 'app_mk2k3j4h5k6l',
    'metadata' => array(
        'plan' => 'premium',
        'source' => 'web'
    )
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

$response = curl_exec($ch);
$result = json_decode($response, true);

if ($result['success']) {
    echo "Registro exitoso";
} else {
    echo "Error: " . $result['error']['message'];
}
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
String json = "{\\"api_key\\":\\"${apiKey}\\",\\"email\\":\\"nuevo@ejemplo.com\\",\\"password\\":\\"contraseña123\\",\\"name\\":\\"Nuevo Usuario\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create("${baseUrl}/functions/v1/auth-register"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-reset-password',
      title: 'Recuperar Contraseña',
      method: 'POST',
      path: '/functions/v1/auth-reset-password',
      description: 'Solicita un restablecimiento de contraseña. Se enviará un email al usuario con instrucciones.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'API Key de la aplicación (ej: ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/auth-reset-password`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          api_key: apiKey,
          email: 'usuario@ejemplo.com',
          application_id: 'app_mk2k3j4h5k6l'
        }
      }),
      response: {
        success: `{
  "success": true,
  "data": {
    "message": "Se ha enviado un email con instrucciones para restablecer tu contraseña",
    "email": "usuario@ejemplo.com"
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No existe un usuario con este email"
  }
}

// Otros errores:
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_CONFIGURED",
    "message": "El servicio de email no está configurado"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/functions/v1/auth-reset-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: '${apiKey}',
    email: 'usuario@ejemplo.com',
    application_id: 'app_mk2k3j4h5k6l'
  })
});

const data = await response.json();

if (data.success) {
  console.log(data.data.message);
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
url = '${baseUrl}/functions/v1/auth-reset-password'
data = {
    'api_key': '${apiKey}',
    'email': 'usuario@ejemplo.com',
    'application_id': 'app_mk2k3j4h5k6l'
}

response = requests.post(url, json=data)
result = response.json()

if result['success']:
    print(result['data']['message'])
else:
    print(f"Error: {result['error']['message']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
$url = '${baseUrl}/functions/v1/auth-reset-password';
$data = array(
  'api_key' => '${apiKey}',
    'email' => 'usuario@ejemplo.com',
    'application_id' => 'app_mk2k3j4h5k6l'
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

$response = curl_exec($ch);
$result = json_decode($response, true);

if ($result['success']) {
    echo $result['data']['message'];
}
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
String json = "{\\"api_key\\":\\"${apiKey}\\",\\"email\\":\\"usuario@ejemplo.com\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create("${baseUrl}/functions/v1/auth-reset-password"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-reset-password-confirm',
      title: 'Confirmar Nueva Contraseña',
      method: 'POST',
      path: '/functions/v1/auth-reset-password-confirm',
      description: 'Confirma el cambio de contraseña con token de recuperación y genera tokens de sesión automáticos cuando aplica.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'API Key de la aplicación' },
        { name: 'token', type: 'string', required: true, location: 'Body', description: 'Token de recuperación enviado por email' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'new_password', type: 'string', required: true, location: 'Body', description: 'Nueva contraseña' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/auth-reset-password-confirm`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          api_key: apiKey,
          token: 'reset_token_abc123',
          email: 'usuario@ejemplo.com',
          new_password: 'MiNuevaPass123!'
        }
      }),
      response: {
        success: `{
  "success": true,
  "message": "Contraseña actualizada exitosamente",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "60187dc2-a013-40fa-9a00-68701cc92018",
      "email": "usuario@ejemplo.com"
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token inválido o expirado"
  }
}

// Otros errores posibles:
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "El token ha expirado. Por favor solicita uno nuevo."
  }
}

{
  "success": false,
  "error": {
    "code": "PASSWORD_POLICY_VIOLATION",
    "message": "La contraseña debe cumplir con la política configurada"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/functions/v1/auth-reset-password-confirm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: '${apiKey}',
    token: 'reset_token_abc123',
    email: 'usuario@ejemplo.com',
    new_password: 'MiNuevaPass123!'
  })
});

const data = await response.json();
console.log(data);`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/functions/v1/auth-reset-password-confirm'
payload = {
    'api_key': '${apiKey}',
    'token': 'reset_token_abc123',
    'email': 'usuario@ejemplo.com',
    'new_password': 'MiNuevaPass123!'
}

response = requests.post(url, json=payload)
print(response.json())`,
        php: (baseUrl: string, apiKey: string) => `<?php
$url = '${baseUrl}/functions/v1/auth-reset-password-confirm';
$data = array(
    'api_key' => '${apiKey}',
    'token' => 'reset_token_abc123',
    'email' => 'usuario@ejemplo.com',
    'new_password' => 'MiNuevaPass123!'
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String json = "{\\"api_key\\":\\"${apiKey}\\",\\"token\\":\\"reset_token_abc123\\",\\"email\\":\\"usuario@ejemplo.com\\",\\"new_password\\":\\"MiNuevaPass123!\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/functions/v1/auth-reset-password-confirm"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-verify',
      title: 'Verificar Token (Legacy API)',
      method: 'POST',
      path: '/api/auth/verify',
      description: 'Endpoint legacy del servidor Node para validar token JWT de sesión. Requiere X-API-Key en header.',
      params: [
        { name: 'X-API-Key', type: 'string', required: true, location: 'Header', description: 'API Key asociada a la aplicación' },
        { name: 'token', type: 'string', required: true, location: 'Body', description: 'JWT access token a validar' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'application_id de la aplicación' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/api/auth/verify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          application_id: 'app_mk2k3j4h5k6l'
        }
      }),
      response: {
        success: `{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "60187dc2-a013-40fa-9a00-68701cc92018",
      "email": "usuario@ejemplo.com"
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token inválido o expirado"
  }
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch
const response = await fetch('${baseUrl}/api/auth/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${apiKey}'
  },
  body: JSON.stringify({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    application_id: 'app_mk2k3j4h5k6l'
  })
});

console.log(await response.json());`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/api/auth/verify'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': '${apiKey}'
}
payload = {
    'token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'application_id': 'app_mk2k3j4h5k6l'
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
        php: (baseUrl: string, apiKey: string) => `<?php
$url = '${baseUrl}/api/auth/verify';
$data = array(
    'token' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'application_id' => 'app_mk2k3j4h5k6l'
);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
  'Content-Type: application/json',
  'X-API-Key: ${apiKey}'
));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String json = "{\\"token\\":\\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/verify"))
    .header("Content-Type", "application/json")
    .header("X-API-Key", "${apiKey}")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'application-info',
      title: 'Lista de Aplicaciones',
      method: 'GET',
      path: '/functions/v1/application-info',
      description: 'Obtiene la lista completa de aplicaciones activas asociadas al API Key externo. Requiere enviar el API key por header X-API-Key.',
      params: [
        { name: 'X-API-Key', type: 'string', required: true, location: 'Header', description: 'API Key externa con permiso para application-info' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/application-info`,
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        }
      }),
      response: {
        success: (baseUrl: string) => `{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Mi Aplicación Web",
        "application_id": "app_mk2k3j4h5k6l",
        "status": "active",
        "url": "https://miapp.com",
        "environment_urls": {
          "development": "http://localhost:3000",
          "testing": "https://test.miapp.com",
          "production": "https://miapp.com"
        },
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-02-20T14:25:00Z"
      },
      {
        "id": "987f6543-a21b-34c5-d678-901234567890",
        "name": "Mi App Mobile",
        "application_id": "app_xyz789abc",
        "status": "active",
        "url": "https://mobileapp.com",
        "environment_urls": {
          "development": "http://localhost:4000",
          "testing": "https://test.mobileapp.com",
          "production": "https://mobileapp.com"
        },
        "created_at": "2024-02-01T08:15:00Z",
        "updated_at": "2024-02-18T16:45:00Z"
      }
    ],
    "total": 2
  }
}`,
        error: `{
  "success": false,
  "error": "Invalid API key"
}

// Otros errores posibles:
{
  "success": false,
  "error": "api_key is required"
}

{
  "success": false,
  "error": "Error fetching applications"
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch - Listar todas las aplicaciones
const response = await fetch('${baseUrl}/functions/v1/application-info', {
  method: 'GET',
  headers: {
    'X-API-Key': '${apiKey}'
  }
});

const data = await response.json();

if (data.success) {
  console.log(\`Total de aplicaciones: \${data.data.total}\`);

  data.data.applications.forEach(app => {
    console.log('---');
    console.log('Application ID:', app.application_id);
    console.log('Name:', app.name);
    console.log('Status:', app.status);
    console.log('URL:', app.url);
    console.log('Environments:', app.environment_urls);
  });
} else {
  console.error('Error:', data.error);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests - Listar todas las aplicaciones
import requests

url = '${baseUrl}/functions/v1/application-info'
headers = {'X-API-Key': '${apiKey}'}

response = requests.get(url, headers=headers)
result = response.json()

if result['success']:
    applications = result['data']['applications']
    total = result['data']['total']

    print(f"Total de aplicaciones: {total}\\n")

    for app in applications:
        print("---")
        print(f"Application ID: {app['application_id']}")
        print(f"Name: {app['name']}")
        print(f"Status: {app['status']}")
        print(f"URL: {app['url']}")
        print(f"Created: {app['created_at']}")
        print(f"Environments: {app['environment_urls']}")
else:
    print(f"Error: {result['error']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
// PHP/cURL - Listar todas las aplicaciones
$url = '${baseUrl}/functions/v1/application-info';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('X-API-Key: ${apiKey}'));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);

if ($result['success']) {
    $applications = $result['data']['applications'];
    $total = $result['data']['total'];

    echo "Total de aplicaciones: " . $total . PHP_EOL . PHP_EOL;

    foreach ($applications as $app) {
        echo "---" . PHP_EOL;
        echo "Application ID: " . $app['application_id'] . PHP_EOL;
        echo "Name: " . $app['name'] . PHP_EOL;
        echo "Status: " . $app['status'] . PHP_EOL;
        echo "URL: " . $app['url'] . PHP_EOL;
        echo "Created: " . $app['created_at'] . PHP_EOL;
    }
} else {
    echo "Error: " . $result['error'];
}
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient - Listar todas las aplicaciones
import java.net.http.*;
import java.net.URI;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;

public class ApplicationsList {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        Gson gson = new Gson();

        Map<String, Object> data = new HashMap<>();
        data.put("api_key", "${apiKey}");

        String json = gson.toJson(data);

        HttpRequest request = HttpRequest.newBuilder()
          .uri(URI.create("${baseUrl}/functions/v1/application-info"))
          .header("X-API-Key", "${apiKey}")
          .GET()
            .build();

        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}`
      }
    },
    {
      id: 'user-search',
      title: 'Búsqueda de Usuarios',
      method: 'POST',
      path: '/functions/v1/user-search',
      description: 'Busca usuarios por nombre o email en tiempo real. Ideal para implementar autocomplete. Soporta paginación.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'Body', description: 'Tu API Key de producción' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' },
        { name: 'query', type: 'string', required: false, location: 'Body', description: 'Término de búsqueda (nombre o email)' },
        { name: 'limit', type: 'number', required: false, location: 'Body', description: 'Número de resultados (default: 20, max: 100)' },
        { name: 'offset', type: 'number', required: false, location: 'Body', description: 'Offset para paginación (default: 0)' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/functions/v1/user-search`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          api_key: apiKey,
          application_id: 'app_mk2k3j4h5k6l',
          query: 'juan',
          limit: 10,
          offset: 0
        }
      }),
      response: {
        success: (baseUrl: string) => `{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_789",
        "email": "juan.perez@ejemplo.com",
        "name": "Juan Pérez",
        "status": "active",
        "role": null,
        "created_at": "2024-02-15T10:30:00Z"
      },
      {
        "id": "user_790",
        "email": "juana.garcia@ejemplo.com",
        "name": "Juana García",
        "status": "active",
        "role": null,
        "created_at": "2024-02-16T14:20:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}`,
        error: `{
  "success": false,
  "error": "Invalid API key or application"
}

// Otros errores posibles:
{
  "success": false,
  "error": "application_id is required"
}

{
  "success": false,
  "error": "api_key is required"
}`
      },
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Fetch - Autocomplete
const searchInput = document.getElementById('user-search');
let searchTimeout;

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) return;

  // Debounce: esperar 300ms después de que el usuario deje de escribir
  searchTimeout = setTimeout(async () => {
    const response = await fetch('${baseUrl}/functions/v1/user-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: '${apiKey}',
        application_id: 'app_mk2k3j4h5k6l',
        query: query,
        limit: 10
      })
    });

    const data = await response.json();

    if (data.success) {
      displayResults(data.data.users);
      console.log(\`Total: \${data.data.pagination.total} usuarios\`);
    } else {
      console.error('Error:', data.error);
    }
  }, 300);
});

function displayResults(users) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = users.map(user => \`
    <div class="user-item">
      <strong>${user.name}</strong>
      <span>\${user.email}</span>
      <span class="role">${user.status}</span>
    </div>
  \`).join('');
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests - Búsqueda paginada
import requests

url = '${baseUrl}/functions/v1/user-search'
headers = {'Content-Type': 'application/json'}
data = {
    'api_key': '${apiKey}',
    'application_id': 'app_mk2k3j4h5k6l',
    'query': 'juan',
    'limit': 20,
    'offset': 0
}

response = requests.post(url, json=data, headers=headers)
result = response.json()

if result['success']:
    users = result['data']['users']
    pagination = result['data']['pagination']

    for user in users:
      print(f"{user['name']} ({user['email']}) - {user['status']}")

    print(f"\\nMostrando {len(users)} de {pagination['total']} usuarios")
    print(f"¿Hay más?: {pagination['has_more']}")
else:
    print(f"Error: {result['error']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
// PHP/cURL - Búsqueda con paginación
function searchUsers($query, $offset = 0, $limit = 20) {
  $url = '${baseUrl}/functions/v1/user-search';
    $data = array(
        'api_key' => '${apiKey}',
        'application_id' => 'app_mk2k3j4h5k6l',
        'query' => $query,
        'limit' => $limit,
        'offset' => $offset
    );

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Uso
$result = searchUsers('juan', 0, 10);

if ($result['success']) {
    $users = $result['data']['users'];
    $pagination = $result['data']['pagination'];

    foreach ($users as $user) {
    echo $user['name'] . ' (' . $user['email'] . ')' . PHP_EOL;
    }

    echo "Total: " . $pagination['total'] . " usuarios" . PHP_EOL;

    // Cargar más resultados si hay
    if ($pagination['has_more']) {
        $nextPage = searchUsers('juan', 10, 10);
    }
} else {
    echo "Error: " . $result['error'];
}
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java/HttpClient - Búsqueda de usuarios
import java.net.http.*;
import java.net.URI;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;

public class UserSearch {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        Gson gson = new Gson();

        Map<String, Object> data = new HashMap<>();
        data.put("api_key", "${apiKey}");
        data.put("application_id", "app_mk2k3j4h5k6l");
        data.put("query", "juan");
        data.put("limit", 10);
        data.put("offset", 0);

        String json = gson.toJson(data);

        HttpRequest request = HttpRequest.newBuilder()
          .uri(URI.create("${baseUrl}/functions/v1/user-search"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}`
      }
    }
  ];

  const currentEndpoint = endpoints.find(ep => ep.id === activeEndpoint);
  const languages = [
    { id: 'javascript', name: 'JavaScript', icon: '🟨' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'php', name: 'PHP', icon: '🐘' },
    { id: 'java', name: 'Java', icon: '☕' }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documentación de APIs</h2>
        <p className="text-gray-600">
          Guías completas, ejemplos y formato de requests/responses para integrar con nuestras APIs
        </p>
      </div>

      <ArchitectureOverview />

      {/* Web Integration Flow - RECOMMENDED */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">✓</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Integración Web Recomendada (Flujo de Redirección)</h3>
            <p className="text-gray-700 mb-4">
              <strong>Este es el método recomendado para la mayoría de aplicaciones web.</strong> Tu aplicación redirige al usuario a AuthSystem,
              el usuario se autentica, y AuthSystem lo redirige de vuelta con un <code>code</code> temporal que luego se intercambia por tokens.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              <span>Redirigir al usuario a AuthSystem</span>
            </h4>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Tu aplicación construye una URL y redirige:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// Login
window.location.href = '${currentEnv.baseUrl}/login' +
  '?app_id=app_mk2k3j4h5k6l' +
  '&redirect_uri=' + encodeURIComponent('https://tuapp.com/callback') +
  '&api_key=${currentEnv.apiKey}';

// Registro
window.location.href = '${currentEnv.baseUrl}/register' +
  '?app_id=app_mk2k3j4h5k6l' +
  '&redirect_uri=' + encodeURIComponent('https://tuapp.com/callback') +
  '&api_key=${currentEnv.apiKey}';`}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              <span>Usuario completa el formulario</span>
            </h4>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600">
                El usuario ve el formulario de login/registro con tu branding personalizado.
                AuthSystem valida las credenciales, verifica la API key, y maneja toda la lógica de seguridad internamente.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              <span>AuthSystem redirige de vuelta a tu aplicación</span>
            </h4>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Después de un login exitoso, AuthSystem redirige a:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto mb-3">
{`https://tuapp.com/callback?code=AUTH_CODE_UUID&state=authenticated`}
              </pre>
              <p className="text-sm text-gray-600">Tu aplicación procesa el callback:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// En tu página /callback
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

if (code && state === 'authenticated') {
  // Intercambiar code por tokens
  const response = await fetch('${currentEnv.baseUrl}/functions/v1/auth-exchange-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      application_id: 'app_mk2k3j4h5k6l'
    })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('access_token', data.data.access_token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
    window.location.href = '/dashboard';
  } else {
    window.location.href = '/login';
  }
} else {
  // Callback inválido
  window.location.href = '/login';
}`}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
              <span>Intercambiar código por tokens</span>
            </h4>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">El código es de un solo uso y expira rápido. El parámetro <strong>state</strong> actualmente es fijo con valor <code>authenticated</code>. Debe validarse con:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`POST ${currentEnv.baseUrl}/functions/v1/auth-exchange-code
{
  "code": "AUTH_CODE_UUID",
  "application_id": "app_mk2k3j4h5k6l"
}`}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">✓</span>
              <span>Datos en el Token JWT</span>
            </h4>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Una vez intercambiado el code, el access token contiene la información del usuario:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "sub": "user_123",              // ID del usuario
  "email": "usuario@ejemplo.com",
  "name": "Usuario Ejemplo",
  "app_id": "app_mk2k3j4h5k6l",
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "iat": 1234567890,              // Fecha de emisión
  "exp": 1234654290,              // Expiración
  "iss": "AuthSystem",
  "aud": "tuapp.com"
}`}
              </pre>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Ventajas del Flujo de Redirección</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>✓ No manejas credenciales de usuario directamente</li>
              <li>✓ Branding personalizado automático</li>
              <li>✓ Seguridad gestionada por AuthSystem (rate limiting, IP blocking, logs)</li>
              <li>✓ Más simple de implementar</li>
              <li>✓ No necesitas construir formularios de login/registro</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Integration - Advanced */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className="bg-gray-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">⚡</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Integración API Directa (Avanzado)</h3>
            <p className="text-gray-700">
              <strong>Solo para casos avanzados:</strong> Apps móviles nativas, CLIs, o servicios backend-to-backend.
              Si estás construyendo una aplicación web, usa el flujo de redirección arriba.
            </p>
          </div>
        </div>
      </div>

      {/* Environment Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Globe className="w-5 h-5" />
          <span>Seleccionar Ambiente</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setActiveEnvironment(env.id)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                activeEnvironment === env.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{env.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-900">{env.name}</h4>
                  <p className="text-sm text-gray-600">{env.baseUrl}</p>
                  <p className="text-xs text-gray-500">{env.description}</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded p-2 mt-2">
                <p className="text-xs text-gray-600 mb-1">API Key:</p>
                <code className="text-xs font-mono text-gray-800 break-all">{env.apiKey}</code>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Comenzando - Ambiente {currentEnv.name}</span>
        </h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Base URL:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{currentEnv.baseUrl}</code></p>
          <p>• <strong>API Key:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{currentEnv.apiKey}</code></p>
          <p>• <strong>Importante:</strong> En Edge Functions, el API Key se envía en el <code className="bg-blue-100 px-2 py-1 rounded">body.api_key</code> o en <code className="bg-blue-100 px-2 py-1 rounded">header X-API-Key</code> (según endpoint)</p>
          <p>• Formato de respuesta: JSON</p>
          <p>• Rate limiting: 10 requests por 15 minutos por IP</p>
        </div>

        <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>Obtener tu API Key Real</span>
          </h4>
          <div className="space-y-1 text-sm text-yellow-800">
            <p>1. Ve a la sección <strong>API Keys</strong> en el dashboard</p>
            <p>2. Selecciona tu aplicación y ambiente</p>
            <p>3. Crea una nueva API Key o copia una existente</p>
            <p>4. Reemplaza la API Key de ejemplo con tu clave real</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-4">Endpoints</h4>
            <nav className="space-y-2">
              {endpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  onClick={() => setActiveEndpoint(endpoint.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeEndpoint === endpoint.id
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-100 text-blue-800">
                      {endpoint.method}
                    </span>
                  </div>
                  <div className="mt-1">{endpoint.title}</div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {currentEndpoint && (
            <div className="space-y-6">
              {/* Endpoint Header */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="px-3 py-1 rounded text-sm font-mono bg-blue-100 text-blue-800">
                    {currentEndpoint.method}
                  </span>
                  <code className="text-lg font-mono text-gray-900">{currentEndpoint.path}</code>
                </div>
                <p className="text-gray-600">{currentEndpoint.description}</p>
              </div>

              {/* Parameters */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Parámetros</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-900">Nombre</th>
                        <th className="text-left py-2 font-medium text-gray-900">Ubicación</th>
                        <th className="text-left py-2 font-medium text-gray-900">Tipo</th>
                        <th className="text-left py-2 font-medium text-gray-900">Requerido</th>
                        <th className="text-left py-2 font-medium text-gray-900">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEndpoint.params.map((param, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">{param.name}</code>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              param.location === 'URL' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {param.location}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-600">{param.type}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              param.required
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {param.required ? 'Sí' : 'No'}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-600">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Request Example */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Ejemplo de Request</h4>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(currentEndpoint.requestExample(currentEnv.baseUrl, currentEnv.apiKey), null, 2))}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{JSON.stringify(currentEndpoint.requestExample(currentEnv.baseUrl, currentEnv.apiKey), null, 2)}</code>
                </pre>
              </div>

              {/* Code Examples */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Ejemplos de Código</h4>
                  <div className="flex items-center space-x-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setActiveLanguage(lang.id)}
                        className={`px-3 py-1.5 rounded text-sm flex items-center space-x-1 ${
                          activeLanguage === lang.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{lang.icon}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 mb-2">
                  <button
                    onClick={() => copyToClipboard(currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey))}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey)}</code>
                </pre>
              </div>

              {/* Response Examples */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Ejemplos de Respuesta</h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-800">Respuesta Exitosa (200)</span>
                    </div>
                    <pre className="bg-green-50 border border-green-200 p-4 rounded-lg overflow-x-auto text-sm">
                      <code className="text-green-900">
                        {typeof currentEndpoint.response.success === 'function'
                          ? currentEndpoint.response.success(currentEnv.baseUrl)
                          : currentEndpoint.response.success}
                      </code>
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <span className="font-medium text-red-800">Respuesta de Error (400/401/500)</span>
                    </div>
                    <pre className="bg-red-50 border border-red-200 p-4 rounded-lg overflow-x-auto text-sm">
                      <code className="text-red-900">
                        {typeof currentEndpoint.response.error === 'function'
                          ? currentEndpoint.response.error(currentEnv.baseUrl)
                          : currentEndpoint.response.error}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
