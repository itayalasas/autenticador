import React, { useState } from 'react';
import { Code, Copy, Play, CheckCircle, AlertCircle, Globe, Key, Shield, ExternalLink } from 'lucide-react';

export default function ApiDocumentation() {
  const [activeEndpoint, setActiveEndpoint] = useState('web-login');
  const [activeLanguage, setActiveLanguage] = useState('javascript');
  const [activeEnvironment, setActiveEnvironment] = useState('production');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const environments = [
    {
      id: 'development',
      name: 'Development',
      icon: '⚡',
      baseUrl: 'http://localhost:5173',
      apiKey: 'ak_development_ejemplo123456789',
      appId: 'app_dev_123456',
      description: 'Ambiente local para desarrollo'
    },
    {
      id: 'testing',
      name: 'Testing',
      icon: '🧪',
      baseUrl: 'https://auth-test.yourdomain.com',
      apiKey: 'ak_testing_abcdef1234567890',
      appId: 'app_test_654321',
      description: 'Ambiente de pruebas'
    },
    {
      id: 'production',
      name: 'Production',
      icon: '🚀',
      baseUrl: 'https://celadon-begonia-d7eb0e.netlify.app',
      apiKey: 'ak_production_042a5f866c7e35630a9340bd224cbdda',
      appId: 'app_a6f840c5-bd1',
      description: 'Ambiente de producción'
    }
  ];

  const currentEnv = environments.find(env => env.id === activeEnvironment) || environments[0];

  const endpoints = [
    {
      id: 'web-login',
      title: 'Login Web (Flujo de Redirección)',
      method: 'GET',
      path: '/login',
      description: 'Redirige al usuario a la página de login. El usuario ingresa sus credenciales y al completar con éxito, es redirigido al callback especificado con los tokens.',
      params: [
        { name: 'app_id', type: 'string', required: true, description: 'ID público de la aplicación' },
        { name: 'redirect_uri', type: 'string', required: true, description: 'URL de callback (debe estar URL encoded)' },
        { name: 'api_key', type: 'string', required: true, description: 'API Key de producción/testing' }
      ],
      response: {
        success: (baseUrl: string) => `// Después del login exitoso, el usuario es redirigido a:
${baseUrl.replace('/login', '')}/auth/callback?token=ACCESS_TOKEN&refresh_token=REFRESH_TOKEN&state=success

// En tu callback, recibirás:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "state": "success",
  "user": {
    "id": "user_123",
    "email": "usuario@ejemplo.com",
    "name": "Usuario Ejemplo"
  }
}`,
        error: `// En caso de error, el usuario ve un mensaje en la página
// y puede reintentar el login`
      },
      example: (baseUrl: string, apiKey: string, appId: string) => `# Ejemplo de URL completa
${baseUrl}/login?app_id=${appId}&redirect_uri=${encodeURIComponent('https://tuapp.com/auth/callback')}&api_key=${apiKey}

# URL decodificada para visualización:
${baseUrl}/login
  ?app_id=${appId}
  &redirect_uri=https://tuapp.com/auth/callback
  &api_key=${apiKey}`,
      examples: {
        javascript: (baseUrl: string, apiKey: string, appId: string) => `// JavaScript - Redirigir al usuario al login
const redirectUri = 'https://tuapp.com/auth/callback';
const loginUrl = \`${baseUrl}/login\` +
  \`?app_id=${appId}\` +
  \`&redirect_uri=\${encodeURIComponent(redirectUri)}\` +
  \`&api_key=${apiKey}\`;

// Redirigir
window.location.href = loginUrl;

// ========================================
// En tu página de callback (/auth/callback):
// ========================================
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('token');
const refreshToken = urlParams.get('refresh_token');
const state = urlParams.get('state');

if (accessToken) {
  // Guardar tokens
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);

  // Redirigir al dashboard
  window.location.href = '/dashboard';
}`,
        python: (baseUrl: string, apiKey: string, appId: string) => `# Python/Flask - Generar URL de login
from urllib.parse import urlencode

redirect_uri = 'https://tuapp.com/auth/callback'
params = {
    'app_id': '${appId}',
    'redirect_uri': redirect_uri,
    'api_key': '${apiKey}'
}

login_url = f"${baseUrl}/login?{urlencode(params)}"

# Redirigir al usuario
return redirect(login_url)

# ========================================
# En tu ruta de callback:
# ========================================
@app.route('/auth/callback')
def auth_callback():
    access_token = request.args.get('token')
    refresh_token = request.args.get('refresh_token')
    state = request.args.get('state')

    if access_token:
        # Guardar tokens en sesión
        session['access_token'] = access_token
        session['refresh_token'] = refresh_token
        return redirect('/dashboard')

    return redirect('/login')`,
        php: (baseUrl: string, apiKey: string, appId: string) => `<?php
// PHP - Generar URL de login
$redirectUri = 'https://tuapp.com/auth/callback';
$params = http_build_query([
    'app_id' => '${appId}',
    'redirect_uri' => $redirectUri,
    'api_key' => '${apiKey}'
]);

$loginUrl = "${baseUrl}/login?" . $params;

// Redirigir
header("Location: " . $loginUrl);
exit;

// ========================================
// En tu página de callback:
// ========================================
<?php
$accessToken = $_GET['token'] ?? null;
$refreshToken = $_GET['refresh_token'] ?? null;
$state = $_GET['state'] ?? null;

if ($accessToken) {
    // Guardar tokens en sesión
    $_SESSION['access_token'] = $accessToken;
    $_SESSION['refresh_token'] = $refreshToken;

    header("Location: /dashboard");
    exit;
}
?>`,
        java: (baseUrl: string, apiKey: string, appId: string) => `// Java/Spring Boot - Redirigir al login
import org.springframework.web.util.UriComponentsBuilder;

@GetMapping("/login")
public String redirectToLogin() {
    String redirectUri = "https://tuapp.com/auth/callback";

    String loginUrl = UriComponentsBuilder
        .fromHttpUrl("${baseUrl}/login")
        .queryParam("app_id", "${appId}")
        .queryParam("redirect_uri", redirectUri)
        .queryParam("api_key", "${apiKey}")
        .toUriString();

    return "redirect:" + loginUrl;
}

// ========================================
// Callback endpoint:
// ========================================
@GetMapping("/auth/callback")
public String authCallback(
    @RequestParam("token") String accessToken,
    @RequestParam("refresh_token") String refreshToken,
    HttpSession session
) {
    // Guardar tokens en sesión
    session.setAttribute("access_token", accessToken);
    session.setAttribute("refresh_token", refreshToken);

    return "redirect:/dashboard";
}`
      }
    },
    {
      id: 'web-register',
      title: 'Registro Web (Flujo de Redirección)',
      method: 'GET',
      path: '/register',
      description: 'Redirige al usuario a la página de registro. El usuario completa el formulario y al registrarse exitosamente, es redirigido al callback.',
      params: [
        { name: 'app_id', type: 'string', required: true, description: 'ID público de la aplicación' },
        { name: 'redirect_uri', type: 'string', required: true, description: 'URL de callback (debe estar URL encoded)' },
        { name: 'api_key', type: 'string', required: true, description: 'API Key de producción/testing' }
      ],
      response: {
        success: (baseUrl: string) => `// Después del registro exitoso:
${baseUrl.replace('/register', '')}/auth/callback?token=ACCESS_TOKEN&refresh_token=REFRESH_TOKEN&state=registered_and_logged_in`,
        error: `// Error de email duplicado u otro:
// Se muestra en la página de registro`
      },
      example: (baseUrl: string, apiKey: string, appId: string) => `# URL de registro
${baseUrl.replace('/login', '/register')}?app_id=${appId}&redirect_uri=${encodeURIComponent('https://tuapp.com/auth/callback')}&api_key=${apiKey}`,
      examples: {
        javascript: (baseUrl: string, apiKey: string, appId: string) => `// JavaScript - Redirigir al registro
const redirectUri = 'https://tuapp.com/auth/callback';
const registerUrl = \`${baseUrl.replace('/login', '/register')}\` +
  \`?app_id=${appId}\` +
  \`&redirect_uri=\${encodeURIComponent(redirectUri)}\` +
  \`&api_key=${apiKey}\`;

window.location.href = registerUrl;`,
        python: (baseUrl: string, apiKey: string, appId: string) => `# Python - Redirigir al registro
from urllib.parse import urlencode

register_url = f"${baseUrl.replace('/login', '/register')}?{urlencode({
    'app_id': '${appId}',
    'redirect_uri': 'https://tuapp.com/auth/callback',
    'api_key': '${apiKey}'
})}

return redirect(register_url)`,
        php: (baseUrl: string, apiKey: string, appId: string) => `<?php
// PHP - Redirigir al registro
$registerUrl = "${baseUrl.replace('/login', '/register')}?" . http_build_query([
    'app_id' => '${appId}',
    'redirect_uri' => 'https://tuapp.com/auth/callback',
    'api_key' => '${apiKey}'
]);

header("Location: " . $registerUrl);
?>`,
        java: (baseUrl: string, apiKey: string, appId: string) => `// Java - Redirigir al registro
String registerUrl = UriComponentsBuilder
    .fromHttpUrl("${baseUrl.replace('/login', '/register')}")
    .queryParam("app_id", "${appId}")
    .queryParam("redirect_uri", "https://tuapp.com/auth/callback")
    .queryParam("api_key", "${apiKey}")
    .toUriString();

return "redirect:" + registerUrl;`
      }
    },
    {
      id: 'web-reset-password',
      title: 'Recuperar Contraseña Web',
      method: 'GET',
      path: '/reset-password',
      description: 'Redirige al usuario a la página de recuperación de contraseña. El usuario ingresa su email y recibe instrucciones.',
      params: [
        { name: 'app_id', type: 'string', required: true, description: 'ID público de la aplicación' },
        { name: 'redirect_uri', type: 'string', required: true, description: 'URL de callback (debe estar URL encoded)' },
        { name: 'api_key', type: 'string', required: true, description: 'API Key de producción/testing' }
      ],
      response: {
        success: (baseUrl: string) => `// El usuario recibe un email con un link de recuperación
// Al completar el proceso, es redirigido al callback`,
        error: `// Error de usuario no encontrado u otro:
// Se muestra en la página de reset`
      },
      example: (baseUrl: string, apiKey: string, appId: string) => `# URL de reset password
${baseUrl.replace('/login', '/reset-password')}?app_id=${appId}&redirect_uri=${encodeURIComponent('https://tuapp.com/auth/callback')}&api_key=${apiKey}`,
      examples: {
        javascript: (baseUrl: string, apiKey: string, appId: string) => `// JavaScript - Redirigir a reset password
const redirectUri = 'https://tuapp.com/auth/callback';
const resetUrl = \`${baseUrl.replace('/login', '/reset-password')}\` +
  \`?app_id=${appId}\` +
  \`&redirect_uri=\${encodeURIComponent(redirectUri)}\` +
  \`&api_key=${apiKey}\`;

window.location.href = resetUrl;`,
        python: (baseUrl: string, apiKey: string, appId: string) => `# Python
reset_url = f"${baseUrl.replace('/login', '/reset-password')}?{urlencode({
    'app_id': '${appId}',
    'redirect_uri': 'https://tuapp.com/auth/callback',
    'api_key': '${apiKey}'
})}

return redirect(reset_url)`,
        php: (baseUrl: string, apiKey: string, appId: string) => `<?php
$resetUrl = "${baseUrl.replace('/login', '/reset-password')}?" . http_build_query([
    'app_id' => '${appId}',
    'redirect_uri' => 'https://tuapp.com/auth/callback',
    'api_key' => '${apiKey}'
]);

header("Location: " . $resetUrl);
?>`,
        java: (baseUrl: string, apiKey: string, appId: string) => `String resetUrl = UriComponentsBuilder
    .fromHttpUrl("${baseUrl.replace('/login', '/reset-password')}")
    .queryParam("app_id", "${appId}")
    .queryParam("redirect_uri", "https://tuapp.com/auth/callback")
    .queryParam("api_key", "${apiKey}")
    .toUriString();

return "redirect:" + resetUrl;`
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

  const handleTestApi = () => {
    setTestResult('success');
    setTimeout(() => setTestResult(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documentación de APIs</h2>
        <p className="text-gray-600">
          Guías completas y ejemplos para integrar autenticación en tu aplicación
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
                <code className="text-xs font-mono text-gray-800 break-all">{env.apiKey}</code>
              </div>
              <div className="bg-gray-100 rounded p-2 mt-2">
                <p className="text-xs text-gray-600 mb-1">App ID:</p>
                <code className="text-xs font-mono text-gray-800">{env.appId}</code>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Flujo de Autenticación Web - Ambiente {currentEnv.name}</span>
        </h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Base URL:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{currentEnv.baseUrl}</code></p>
          <p>• <strong>Parámetros requeridos en URL:</strong></p>
          <ul className="ml-6 space-y-1">
            <li>- <code className="bg-blue-100 px-2 py-1 rounded">app_id</code>: ID público de tu aplicación</li>
            <li>- <code className="bg-blue-100 px-2 py-1 rounded">redirect_uri</code>: URL de callback (debe estar URL encoded)</li>
            <li>- <code className="bg-blue-100 px-2 py-1 rounded">api_key</code>: Tu API Key de producción/testing</li>
          </ul>
          <p className="mt-3">• <strong>Flujo:</strong></p>
          <ol className="ml-6 space-y-1">
            <li>1. Redirige al usuario a la página de login/registro con los parámetros</li>
            <li>2. El usuario completa el formulario</li>
            <li>3. Al completar, es redirigido a tu <code className="bg-blue-100 px-1 rounded">redirect_uri</code></li>
            <li>4. Los tokens vienen en los query params del callback</li>
          </ol>
        </div>

        <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>⚠️ Obtener tus credenciales reales</span>
          </h4>
          <div className="space-y-1 text-sm text-yellow-800">
            <p>1. Ve a <strong>API Keys</strong> en el dashboard</p>
            <p>2. Selecciona tu aplicación y ambiente</p>
            <p>3. Copia el <strong>App ID</strong> y la <strong>API Key</strong></p>
            <p>4. Reemplaza los valores de ejemplo con tus credenciales reales</p>
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
                      'bg-blue-100 text-blue-800'
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
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {currentEndpoint.method}
                  </span>
                  <code className="text-lg font-mono text-gray-900">{currentEndpoint.path}</code>
                </div>
                <p className="text-gray-600">{currentEndpoint.description}</p>
              </div>

              {/* Parameters */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Parámetros (Query String)</h4>
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

              {/* Example URL */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">URL de Ejemplo</h4>
                  <button
                    onClick={() => copyToClipboard(typeof currentEndpoint.example === 'function' ? currentEndpoint.example(currentEnv.baseUrl, currentEnv.apiKey, currentEnv.appId) : currentEndpoint.example)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>
                    {typeof currentEndpoint.example === 'function'
                      ? currentEndpoint.example(currentEnv.baseUrl, currentEnv.apiKey, currentEnv.appId)
                      : currentEndpoint.example}
                  </code>
                </pre>
                <div className="mt-4">
                  <a
                    href={typeof currentEndpoint.example === 'function' ? currentEndpoint.example(currentEnv.baseUrl, currentEnv.apiKey, currentEnv.appId).split('\n')[1].trim() : currentEndpoint.example}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir en nueva pestaña</span>
                  </a>
                </div>
              </div>

              {/* Code Examples */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Ejemplos de Integración</h4>
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
                    onClick={() => copyToClipboard(typeof currentEndpoint.examples?.[activeLanguage] === 'function' ? currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey, currentEnv.appId) : '')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>
                    {typeof currentEndpoint.examples?.[activeLanguage] === 'function'
                      ? currentEndpoint.examples[activeLanguage](currentEnv.baseUrl, currentEnv.apiKey, currentEnv.appId)
                      : 'No disponible'}
                  </code>
                </pre>
              </div>

              {/* Response Examples */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Después del Login/Registro</h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-800">Callback con tokens</span>
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
                      <span className="font-medium text-red-800">En caso de error</span>
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

              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-800">
                      URL copiada al portapapeles
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
