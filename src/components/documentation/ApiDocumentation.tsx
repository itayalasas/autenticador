import React, { useState } from 'react';
import { Code, Copy, Play, CheckCircle, AlertCircle, Globe, Key, Shield } from 'lucide-react';

export default function ApiDocumentation() {
  const [activeEndpoint, setActiveEndpoint] = useState('auth-login');
  const [activeLanguage, setActiveLanguage] = useState('javascript');
  const [activeEnvironment, setActiveEnvironment] = useState('development');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const environments = [
    { 
      id: 'development', 
      name: 'Development', 
      icon: '⚡', 
      baseUrl: 'http://localhost:3001',
      apiKey: 'ak_developme_93d40f',
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
      baseUrl: 'https://auth.tudominio.com',
      apiKey: 'ak_production_fedcba0987654321fedcba0987654321',
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
      description: 'Autentica un usuario y devuelve un token JWT',
      params: [
        { name: 'email', type: 'string', required: true, description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, description: 'Contraseña del usuario' },
        { name: 'application_id', type: 'string', required: true, description: 'ID único de la aplicación' }
      ],
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
    },
    "callback_url": "${baseUrl}/auth/callback?token=..."
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email o contraseña incorrectos"
  }
}`
      },
      example: (baseUrl: string, apiKey: string) => `curl -X POST ${baseUrl}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "micontraseña123",
    "application_id": "app_mk2k3j4h5k6l"
  }'`,
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Node.js
const response = await fetch('${baseUrl}/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${apiKey}'
  },
  body: JSON.stringify({
    email: 'usuario@ejemplo.com',
    password: 'micontraseña123',
    application_id: 'app_mk2k3j4h5k6l'
  })
});

const data = await response.json();
console.log(data);`,
        python: (baseUrl: string, apiKey: string) => `# Python
import requests

url = '${baseUrl}/api/auth/login'
headers = {'X-API-Key': '${apiKey}'}
data = {
    'email': 'usuario@ejemplo.com',
    'password': 'micontraseña123',
    'application_id': 'app_mk2k3j4h5k6l'
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result)`,
        php: (baseUrl: string, apiKey: string) => `<?php
// PHP
$url = '${baseUrl}/api/auth/login';
$data = array(
    'email' => 'usuario@ejemplo.com',
    'password' => 'micontraseña123',
    'application_id' => 'app_mk2k3j4h5k6l'
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/json\\r\\n" .
                     "X-API-Key: ${apiKey}\\r\\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    )
);

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
$response = json_decode($result, true);
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String json = "{\\"email\\":\\"usuario@ejemplo.com\\",\\"password\\":\\"micontraseña123\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/login"))
    .header("Content-Type", "application/json")
    .header("X-API-Key", "${apiKey}")
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
      description: 'Registra un nuevo usuario en la aplicación',
      params: [
        { name: 'email', type: 'string', required: true, description: 'Email del usuario' },
        { name: 'password', type: 'string', required: true, description: 'Contraseña del usuario' },
        { name: 'name', type: 'string', required: true, description: 'Nombre completo del usuario' },
        { name: 'application_id', type: 'string', required: true, description: 'ID único de la aplicación' },
        { name: 'metadata', type: 'object', required: false, description: 'Datos adicionales del usuario' }
      ],
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
    "callback_url": "${baseUrl}/auth/callback?token=...&state=registered_and_logged_in"
  }
}

/* Si requiere verificación de email:
{
  "success": true,
  "data": {
    "message": "Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.",
    "user_id": "user_456",
    "email_verification_required": true,
    "next_step": "verify_email",
    "callback_url": "${baseUrl}/auth/verify-email?user_id=user_456&email=nuevo@ejemplo.com&state=email_verification_required"
  }
} */`,
        error: (baseUrl: string) => `{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Ya existe un usuario con este email"
  }
}

// Error de email no verificado en login:
{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Debes verificar tu email antes de iniciar sesión",
    "user_id": "user_123",
    "email": "usuario@ejemplo.com",
    "next_step": "verify_email",
    "callback_url": "${baseUrl}/auth/verify-email?user_id=user_123&email=usuario@ejemplo.com&state=email_verification_required"
  }
}`
      },
      example: (baseUrl: string, apiKey: string) => `curl -X POST ${baseUrl}/api/auth/register \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "email": "nuevo@ejemplo.com",
    "password": "contraseña123",
    "name": "Nuevo Usuario",
    "application_id": "app_mk2k3j4h5k6l",
    "metadata": {
      "plan": "premium",
      "source": "web"
    }
  }'`,
      examples: {
        javascript: (baseUrl: string, apiKey: string) => `// JavaScript/Node.js
const response = await fetch('${baseUrl}/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${apiKey}'
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
});`,
        python: (baseUrl: string, apiKey: string) => `# Python
import requests

headers = {'X-API-Key': '${apiKey}'}
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

response = requests.post('${baseUrl}/api/auth/register', json=data, headers=headers)`,
        php: (baseUrl: string, apiKey: string) => `<?php
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

$result = file_get_contents('${baseUrl}/api/auth/register', false, 
    stream_context_create(array(
        'http' => array(
            'method' => 'POST',
            'header' => "Content-type: application/json\\r\\n" .
                       "X-API-Key: ${apiKey}",
            'content' => json_encode($data)
        )
    ))
);
?>`,
        java: (baseUrl: string, apiKey: string) => `// Java
String json = "{\\"email\\":\\"nuevo@ejemplo.com\\",\\"password\\":\\"contraseña123\\",\\"name\\":\\"Nuevo Usuario\\",\\"application_id\\":\\"app_mk2k3j4h5k6l\\"}";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}/api/auth/register"))
    .header("Content-Type", "application/json")
    .header("X-API-Key", "${apiKey}")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();`
      }
    },
    {
      id: 'auth-verify',
      title: 'Verificar Token',
      method: 'POST',
      path: '/api/auth/verify',
      description: 'Verifica la validez de un token JWT',
      params: [
        { name: 'token', type: 'string', required: true, description: 'Token JWT a verificar' },
        { name: 'application_id', type: 'string', required: true, description: 'ID único de la aplicación' }
      ],
      response: {
        success: `{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "user_123",
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "roles": ["user"]
    },
    "expires_at": "2024-02-20T14:30:00Z"
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
      example: (baseUrl: string, apiKey: string) => `curl -X POST ${baseUrl}/api/auth/verify \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "application_id": "app_mk2k3j4h5k6l"
  }'`
    },
    {
      id: 'users-list',
      title: 'Listar Usuarios',
      method: 'GET',
      path: '/api/users',
      description: 'Obtiene la lista de usuarios de una aplicación',
      params: [
        { name: 'application_id', type: 'string', required: true, description: 'ID único de la aplicación' },
        { name: 'page', type: 'integer', required: false, description: 'Número de página (default: 1)' },
        { name: 'limit', type: 'integer', required: false, description: 'Límite por página (default: 50)' },
        { name: 'search', type: 'string', required: false, description: 'Filtrar por email o nombre' }
      ],
      response: {
        success: `{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "usuario1@ejemplo.com",
        "name": "Usuario Uno",
        "status": "active",
        "roles": ["user"],
        "last_login": "2024-02-20T09:15:00Z",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1245,
      "pages": 25
    }
  }
}`,
        error: `{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key inválida o sin permisos"
  }
}`
      },
      example: (baseUrl: string, apiKey: string) => `curl -X GET "${baseUrl}/api/users?application_id=app_mk2k3j4h5k6l&page=1&limit=50" \\
  -H "X-API-Key: ${apiKey}"`
    }
  ];

  const currentEndpoint = endpoints.find(ep => ep.id === activeEndpoint);
  const languages = [
    { id: 'javascript', name: 'JavaScript', icon: '🟨' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'php', name: 'PHP', icon: '🐘' },
    { id: 'java', name: 'Java', icon: '☕' }
  ];

  const handleTestApi = () => {
    // Simulate API test
    setTestResult('success');
    setTimeout(() => setTestResult(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documentación de APIs</h2>
        <p className="text-gray-600">
          Guías completas, ejemplos y herramientas de prueba para integrar con nuestras APIs por ambiente
        </p>
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
                <code className="text-xs font-mono text-gray-800">{env.apiKey}</code>
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
          <p>• <strong>API Key de ejemplo:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{currentEnv.apiKey}</code></p>
          <p>• Todas las requests requieren el header <code className="bg-blue-100 px-2 py-1 rounded">X-API-Key</code></p>
          <p>• Cada ambiente tiene su propia API Key y URL base</p>
          <p>• Formato de respuesta: JSON</p>
          <p>• Rate limiting: 10 requests por 15 minutos por IP</p>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>⚠️ Importante: Obtener tu API Key Real</span>
          </h4>
          <div className="space-y-1 text-sm text-yellow-800">
            <p>1. Ve a la sección <strong>API Keys</strong> en el dashboard</p>
            <p>2. Selecciona tu aplicación y ambiente</p>
            <p>3. Crea una nueva API Key o copia una existente</p>
            <p>4. Reemplaza la API Key de ejemplo con tu clave real</p>
            <p>5. Las API Keys tienen formato: <code className="bg-yellow-200 px-1 rounded">ak_&lbrace;ambiente&rbrace;_&lbrace;32_caracteres&rbrace;</code></p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>Configuración de Headers</span>
          </h4>
          <div className="space-y-1 text-sm">
            <p><code className="bg-white px-2 py-1 rounded">Content-Type: application/json</code></p>
            <p><code className="bg-white px-2 py-1 rounded">X-API-Key: {currentEnv.apiKey}</code></p>
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
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
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
                  <span className={`px-3 py-1 rounded text-sm font-mono ${
                    currentEndpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                    currentEndpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
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

              {/* Example Request */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Ejemplo de Request</h4>
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
                    onClick={() => copyToClipboard(typeof currentEndpoint.examples?.[activeLanguage] === 'function' ? currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey) : currentEndpoint.example)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleTestApi}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Probar</span>
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>
                    {typeof currentEndpoint.examples?.[activeLanguage] === 'function' 
                      ? currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey)
                      : currentEndpoint.example}
                  </code>
                </pre>
              </div>

              {/* cURL Example */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">cURL</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(typeof currentEndpoint.example === 'function' ? currentEndpoint.example(currentEnv.baseUrl, currentEnv.apiKey) : currentEndpoint.example)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>
                    {typeof currentEndpoint.example === 'function' 
                      ? currentEndpoint.example(currentEnv.baseUrl, currentEnv.apiKey)
                      : currentEndpoint.example}
                  </code>
                </pre>
              </div>

              {/* Response Examples */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Ejemplos de Respuesta</h4>
                
                <div className="space-y-4">
                  {/* Success Response */}
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

                  {/* Error Response */}
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

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {testResult === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`font-medium ${
                      testResult === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResult === 'success' ? 'API test exitoso!' : 'Error en el test de API'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}