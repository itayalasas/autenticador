import React, { useState } from 'react';
import { Copy, CheckCircle, AlertCircle, Globe, Key, Shield } from 'lucide-react';

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
      path: '/api/auth/login',
      description: 'Autentica un usuario mediante formulario web. El API key debe incluirse en la URL como parámetro.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'URL', description: 'API Key en la URL (ej: ?api_key=ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, location: 'Body', description: 'Contraseña del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/api/auth/login?api_key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
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
      "id": "user_123",
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "roles": ["user"],
      "permissions": ["read"],
      "metadata": {},
      "last_login": "2024-02-20T10:30:00Z"
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
const response = await fetch('${baseUrl}/api/auth/login?api_key=${apiKey}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
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

  console.log('Login exitoso:', data.data.user);
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/api/auth/login?api_key=${apiKey}'
headers = {'Content-Type': 'application/json'}
data = {
    'email': 'usuario@ejemplo.com',
    'password': 'micontraseña123',
    'application_id': 'app_mk2k3j4h5k6l'
}

response = requests.post(url, json=data, headers=headers)
result = response.json()

if result['success']:
    access_token = result['data']['access_token']
    refresh_token = result['data']['refresh_token']
    print(f"Login exitoso: {result['data']['user']}")
else:
    print(f"Error: {result['error']['message']}")`,
        php: (baseUrl: string, apiKey: string) => `<?php
// PHP/cURL
$url = '${baseUrl}/api/auth/login?api_key=${apiKey}';
$data = array(
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
    echo "Login exitoso";
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
String json = "{\\"email\\":\\"usuario@ejemplo.com\\",\\"password\\":\\"micontraseña123\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/login?api_key=${apiKey}"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
      }
    },
    {
      id: 'auth-register',
      title: 'Registro de Usuario',
      method: 'POST',
      path: '/api/auth/register',
      description: 'Registra un nuevo usuario en la aplicación. El API key debe incluirse en la URL como parámetro.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'URL', description: 'API Key en la URL (ej: ?api_key=ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, location: 'Body', description: 'Contraseña del usuario' },
        { name: 'name', type: 'string', required: true, location: 'Body', description: 'Nombre completo del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' },
        { name: 'metadata', type: 'object', required: false, location: 'Body', description: 'Datos adicionales del usuario (opcional)' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/api/auth/register?api_key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
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
const response = await fetch('${baseUrl}/api/auth/register?api_key=${apiKey}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
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
  console.log('Registro exitoso:', data.data.user);
  localStorage.setItem('access_token', data.data.access_token);
} else {
  console.error('Error:', data.error.message);
}`,
        python: (baseUrl: string, apiKey: string) => `# Python/Requests
import requests

url = '${baseUrl}/api/auth/register?api_key=${apiKey}'
data = {
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
$url = '${baseUrl}/api/auth/register?api_key=${apiKey}';
$data = array(
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
String json = "{\\"email\\":\\"nuevo@ejemplo.com\\",\\"password\\":\\"contraseña123\\",\\"name\\":\\"Nuevo Usuario\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/register?api_key=${apiKey}"))
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
      path: '/api/auth/reset-password',
      description: 'Solicita un restablecimiento de contraseña. Se enviará un email al usuario con instrucciones.',
      params: [
        { name: 'api_key', type: 'string', required: true, location: 'URL', description: 'API Key en la URL (ej: ?api_key=ak_production_xxx)' },
        { name: 'email', type: 'string', required: true, location: 'Body', description: 'Email del usuario' },
        { name: 'application_id', type: 'string', required: true, location: 'Body', description: 'ID único de la aplicación' }
      ],
      requestExample: (baseUrl: string, apiKey: string) => ({
        url: `${baseUrl}/api/auth/reset-password?api_key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
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
const response = await fetch('${baseUrl}/api/auth/reset-password?api_key=${apiKey}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
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
url = '${baseUrl}/api/auth/reset-password?api_key=${apiKey}'
data = {
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
$url = '${baseUrl}/api/auth/reset-password?api_key=${apiKey}';
$data = array(
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
String json = "{\\"email\\":\\"usuario@ejemplo.com\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/reset-password?api_key=${apiKey}"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
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

      {/* Web Integration Flow - RECOMMENDED */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">✓</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Integración Web Recomendada (Flujo de Redirección)</h3>
            <p className="text-gray-700 mb-4">
              <strong>Este es el método recomendado para la mayoría de aplicaciones web.</strong> Tu aplicación redirige al usuario a AuthSystem,
              el usuario se autentica, y AuthSystem lo redirige de vuelta con los tokens.
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
{`https://tuapp.com/callback?token=ACCESS_TOKEN&refresh_token=REFRESH_TOKEN&user_id=USER_ID&state=authenticated`}
              </pre>
              <p className="text-sm text-gray-600">Tu aplicación procesa el callback:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// En tu página /callback
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('token');
const refreshToken = params.get('refresh_token');
const userId = params.get('user_id');

if (accessToken) {
  // Guardar tokens
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);

  // Decodificar token para obtener datos del usuario
  const payload = JSON.parse(atob(accessToken.split('.')[1]));
  console.log('Usuario:', payload);

  // Redirigir al dashboard
  window.location.href = '/dashboard';
} else {
  // Error en autenticación
  window.location.href = '/login';
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
              <p className="text-sm text-gray-600 mb-2">El access token contiene toda la información del usuario:</p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "sub": "user_123",              // ID del usuario
  "email": "usuario@ejemplo.com",
  "name": "Usuario Ejemplo",
  "app_id": "app_mk2k3j4h5k6l",
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "iat": 1234567890,              // Fecha de emisión
  "exp": 1234654290,              // Expiración (24h)
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
          <p>• <strong>Importante:</strong> El API Key debe enviarse como parámetro en la URL: <code className="bg-blue-100 px-2 py-1 rounded">?api_key=YOUR_API_KEY</code></p>
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
