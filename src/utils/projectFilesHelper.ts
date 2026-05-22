// Helper to prepare project files for deployment with real auth components
import { PUBLIC_AUTH_FORMS_TEMPLATE } from './publicAuthFormsTemplate';

// Generate static standalone HTML files (no build required)
export async function getStaticProjectFiles(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  // Generate standalone HTML files for each form type
  const formTypes = ['login', 'register', 'reset'];

  for (const formType of formTypes) {
    files[`${formType}.html`] = generateStandaloneFormHTML(
      formType,
      applicationId,
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
      branding
    );
  }

  // Netlify config - NO BUILD COMMAND (static files only)
  files['netlify.toml'] = `[build]
  publish = "."

[[redirects]]
  from = "/auth"
  to = "/login.html"
  status = 200
  force = false

[[redirects]]
  from = "/login"
  to = "/login.html"
  status = 200
  force = false

[[redirects]]
  from = "/register"
  to = "/register.html"
  status = 200
  force = false

[[redirects]]
  from = "/reset"
  to = "/reset.html"
  status = 200
  force = false

[[redirects]]
  from = "/reset-password"
  to = "/reset.html"
  status = 200
  force = false

[[redirects]]
  from = "/*"
  to = "/login.html"
  status = 200
  force = false`;

  // _redirects for Netlify (estos PRESERVAN query params automáticamente)
  files['_redirects'] = `/auth /login.html 200
/login /login.html 200
/register /register.html 200
/reset /reset.html 200
/reset-password /reset.html 200
/* /login.html 200`;

  return files;
}

// Helper function to generate standalone HTML
// NOTA: Este HTML NO debe contener API Keys ni configuración sensible
// Solo usa: app_id (desde URL), Supabase URL y Anon Key (públicos y seguros)
function generateStandaloneFormHTML(
  formType: string,
  applicationId: string,
  apiKey: string, // NO SE USA - solo para compatibilidad
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): string {
  const primaryColor = branding?.primary_color || '#3b82f6';
  const logoUrl = branding?.logo_url || '';
  const appName = branding?.app_name || 'AuthSystem';
  const firstLetter = appName.charAt(0).toUpperCase();

  const formTitle = {
    'login': 'Iniciar Sesión',
    'register': 'Registrarse',
    'reset': 'Recuperar Contraseña'
  }[formType] || 'Autenticación';

  const formSubtitle = {
    'login': 'Ingresa tus credenciales',
    'register': 'Crea tu cuenta para comenzar',
    'reset': 'Te enviaremos un correo para restablecer tu contraseña'
  }[formType] || '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formTitle} - ${appName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/lucide-static/0.344.0/lucide.min.css">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --primary-color: ${primaryColor};
    }
    .btn-primary {
      background-color: var(--primary-color);
    }
    .btn-primary:hover {
      filter: brightness(0.9);
    }
    @keyframes pulse-bg {
      0%, 100% { opacity: 0.2; }
      50% { opacity: 0.3; }
    }
    .animate-pulse-bg {
      animation: pulse-bg 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .input-with-icon {
      padding-left: 2.5rem;
    }
    .icon-container {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4" style="background-color: #f9fafb;">
  <!-- Animated Background Blobs -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl animate-pulse-bg" style="background-color: ${primaryColor};"></div>
    <div class="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl animate-pulse-bg" style="background-color: #1e40af; animation-delay: 2s;"></div>
  </div>

  <div class="relative w-full max-w-md">
    <!-- Logo / App Initial -->
    <div class="text-center mb-8">
      <div id="app-logo-container">
        ${logoUrl ? `
          <img src="${logoUrl}" alt="${appName}" class="h-16 mx-auto mb-4" />
        ` : `
          <div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-2xl font-bold" style="background-color: ${primaryColor};">
            ${firstLetter}
          </div>
        `}
      </div>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">${formTitle}</h1>
      <p class="text-gray-600">${formSubtitle}</p>
    </div>

    <!-- Form Card -->
    <div class="bg-white/80 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 p-8">
      <!-- Message Area -->
      <div id="message" class="mb-4 p-3 rounded-lg hidden"></div>

      <form id="auth-form" class="space-y-4">
        ${formType === 'register' ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
          <div class="relative">
            <div class="icon-container">
              <i data-lucide="user" class="w-5 h-5 text-gray-400"></i>
            </div>
            <input
              type="text"
              id="name"
              required
              class="w-full input-with-icon pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
              style="--tw-ring-color: ${primaryColor};"
              placeholder="Tu nombre completo"
            />
          </div>
        </div>
        ` : ''}

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <div class="relative">
            <div class="icon-container">
              <i data-lucide="mail" class="w-5 h-5 text-gray-400"></i>
            </div>
            <input
              type="email"
              id="email"
              required
              class="w-full input-with-icon pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
              style="--tw-ring-color: ${primaryColor};"
              placeholder="tu@email.com"
            />
          </div>
        </div>

        ${formType !== 'reset' ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
          <div class="relative">
            <div class="icon-container">
              <i data-lucide="lock" class="w-5 h-5 text-gray-400"></i>
            </div>
            <input
              type="password"
              id="password"
              required
              class="w-full input-with-icon pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
              style="--tw-ring-color: ${primaryColor};"
              placeholder="••••••••"
            />
            <button
              type="button"
              id="toggle-password"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i data-lucide="eye" id="eye-icon" class="w-5 h-5"></i>
            </button>
          </div>
        </div>
        ` : ''}

        ${formType === 'register' ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Confirmar Contraseña</label>
          <div class="relative">
            <div class="icon-container">
              <i data-lucide="lock" class="w-5 h-5 text-gray-400"></i>
            </div>
            <input
              type="password"
              id="confirmPassword"
              required
              class="w-full input-with-icon pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
              style="--tw-ring-color: ${primaryColor};"
              placeholder="••••••••"
            />
            <button
              type="button"
              id="toggle-confirm-password"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i data-lucide="eye" id="eye-confirm-icon" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tipo de Usuario</label>
          <select
            id="role"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all bg-white"
            style="--tw-ring-color: ${primaryColor};"
          >
            <option value="">Selecciona un rol</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">Selecciona el tipo de acceso que necesitas</p>
        </div>
        ` : ''}

        <button
          type="submit"
          class="w-full btn-primary text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          style="--tw-ring-color: ${primaryColor};"
        >
          <span id="button-text">${formTitle}</span>
          <i data-lucide="arrow-right" class="w-5 h-5" id="arrow-icon"></i>
          <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin hidden" id="spinner"></div>
        </button>
      </form>

      <!-- Links -->
      <div class="mt-6 text-center space-y-2 text-sm">
        ${formType === 'login' ? `
          <a href="#" onclick="navigateToForm('reset'); return false;" class="block text-amber-600 hover:underline">¿Olvidaste tu contraseña?</a>
          <p class="text-gray-600">
            ¿No tienes cuenta?
            <a href="#" onclick="navigateToForm('register'); return false;" class="text-amber-600 hover:underline">Regístrate aquí</a>
          </p>
        ` : formType === 'register' ? `
          <p class="text-gray-600">
            ¿Ya tienes cuenta?
            <a href="#" onclick="navigateToForm('login'); return false;" class="text-amber-600 hover:underline">Inicia sesión</a>
          </p>
        ` : `
          <p class="text-gray-600">
            ¿Recordaste tu contraseña?
            <a href="#" onclick="navigateToForm('login'); return false;" class="text-amber-600 hover:underline">Inicia sesión</a>
          </p>
        `}
      </div>
    </div>

    <!-- Footer Badge -->
    <div class="mt-6 text-center">
      <div class="inline-flex items-center space-x-2 text-sm text-gray-500">
        <i data-lucide="shield" class="w-4 h-4"></i>
        <span>Protegido por AuthSystem</span>
      </div>
    </div>
  </div>

  <script>
    // ===================================================================
    // CONFIGURACIÓN SEGURA - Solo usa app_id público
    // NO contiene API Keys ni configuración sensible del sistema
    // ===================================================================

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let APPLICATION_ID = urlParams.get('app_id') || '${applicationId}';
    const API_KEY = urlParams.get('api_key') || '';
    const redirectUri = urlParams.get('redirect_uri') || urlParams.get('callback_url');

    // Limpiar el app_id por si viene con caracteres extra
    APPLICATION_ID = APPLICATION_ID.trim();

    // Configuración pública de Supabase (segura para exponer)
    const SUPABASE_URL = '${supabaseUrl}';
    const SUPABASE_ANON_KEY = '${supabaseAnonKey}';

    // Validar que tenemos el app_id y api_key
    if (!APPLICATION_ID || APPLICATION_ID === 'undefined') {
      document.getElementById('message').innerHTML = \`
        <div class="flex items-center space-x-2 bg-red-50 border border-red-200 p-3 rounded-lg">
          <i data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>
          <span class="text-sm text-red-800">Error: app_id es requerido en la URL</span>
        </div>
      \`;
      document.getElementById('message').classList.remove('hidden');
      document.getElementById('auth-form').style.display = 'none';
    }

    if (!API_KEY) {
      document.getElementById('message').innerHTML = \`
        <div class="flex items-center space-x-2 bg-red-50 border border-red-200 p-3 rounded-lg">
          <i data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>
          <span class="text-sm text-red-800">Error: api_key es requerida en la URL</span>
        </div>
      \`;
      document.getElementById('message').classList.remove('hidden');
      document.getElementById('auth-form').style.display = 'none';
    }

    console.log('🔧 Auth Form Init:', {
      fullUrl: window.location.href,
      searchParams: window.location.search,
      applicationId: APPLICATION_ID,
      hasApiKey: !!API_KEY,
      redirectUri: redirectUri,
      formType: '${formType}',
      supabaseUrl: SUPABASE_URL
    });

    // Initialize Lucide icons
    lucide.createIcons();

    // Function to navigate between forms preserving URL parameters
    function navigateToForm(formType) {
      const params = new URLSearchParams();
      if (APPLICATION_ID) params.append('app_id', APPLICATION_ID);
      if (API_KEY) params.append('api_key', API_KEY);
      if (redirectUri) params.append('redirect_uri', redirectUri);

      const formRoutes = {
        'login': '/login',
        'register': '/register',
        'reset': '/reset-password'
      };

      const targetRoute = formRoutes[formType] || '/login';
      window.location.href = targetRoute + '?' + params.toString();
    }

    // Toggle Password Visibility
    const togglePasswordBtn = document.getElementById('toggle-password');
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        const eyeIcon = document.getElementById('eye-icon');

        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          eyeIcon.setAttribute('data-lucide', 'eye-off');
        } else {
          passwordInput.type = 'password';
          eyeIcon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
      });
    }

    // Toggle Confirm Password Visibility (for register form)
    const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');
    if (toggleConfirmPasswordBtn) {
      toggleConfirmPasswordBtn.addEventListener('click', function() {
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const eyeConfirmIcon = document.getElementById('eye-confirm-icon');

        if (confirmPasswordInput.type === 'password') {
          confirmPasswordInput.type = 'text';
          eyeConfirmIcon.setAttribute('data-lucide', 'eye-off');
        } else {
          confirmPasswordInput.type = 'password';
          eyeConfirmIcon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
      });
    }

    // Load available roles for register form
    async function loadRoles() {
      if ('${formType}' !== 'register') return;

      try {
        console.log('📋 Loading roles for application:', APPLICATION_ID);

        const rolesUrl = SUPABASE_URL + '/rest/v1/roles?application_id=eq.' + APPLICATION_ID + '&is_active=eq.true&select=id,role_name,description';

        const response = await fetch(rolesUrl, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          }
        });

        if (response.ok) {
          const roles = await response.json();
          console.log('✅ Roles loaded:', roles);

          const roleSelect = document.getElementById('role');
          if (roleSelect && roles && roles.length > 0) {
            // Clear existing options except the first one
            roleSelect.innerHTML = '<option value="">Selecciona un rol</option>';

            // Add role options
            roles.forEach(role => {
              const option = document.createElement('option');
              option.value = role.id;
              option.textContent = role.role_name + (role.description ? ' - ' + role.description : '');
              roleSelect.appendChild(option);
            });
          }
        } else {
          console.warn('⚠️ Could not load roles, user will register without role');
        }
      } catch (error) {
        console.error('❌ Error loading roles:', error);
      }
    }

    // Load roles if register form
    loadRoles();

    function showMessage(message, type) {
      const messageEl = document.getElementById('message');
      const iconHtml = type === 'error'
        ? '<i data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>'
        : '<i data-lucide="check-circle" class="w-5 h-5 text-green-500"></i>';

      messageEl.innerHTML = \`
        <div class="flex items-center space-x-2 \${type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'} p-3 rounded-lg">
          \${iconHtml}
          <span class="text-sm \${type === 'error' ? 'text-red-800' : 'text-green-800'}">\${message}</span>
        </div>
      \`;
      messageEl.classList.remove('hidden');
      lucide.createIcons();
    }

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      console.log('📋 Form submit triggered - preventing default');
      console.log('🔍 Current URL before submit:', window.location.href);
      console.log('🔍 Query parameters:', window.location.search);

      const email = document.getElementById('email').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const buttonText = document.getElementById('button-text');
      const arrowIcon = document.getElementById('arrow-icon');
      const spinner = document.getElementById('spinner');

      submitBtn.disabled = true;
      buttonText.textContent = 'Procesando...';
      arrowIcon.classList.add('hidden');
      spinner.classList.remove('hidden');

      try {
        ${formType === 'login' ? `
        const password = document.getElementById('password').value;

        const loginPayload = {
          application_id: APPLICATION_ID,
          email: email,
          password: password,
          api_key: API_KEY,
          callback_url: redirectUri
        };

        console.log('🚀 Sending login request to:', SUPABASE_URL + '/functions/v1/auth-login');
        console.log('📦 Payload:', {
          ...loginPayload,
          password: '***hidden***',
          api_key: API_KEY ? API_KEY.substring(0, 15) + '...' : 'MISSING'
        });

        const response = await fetch(SUPABASE_URL + '/functions/v1/auth-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-static-form/1.0'
          },
          body: JSON.stringify(loginPayload)
        });

        console.log('📊 Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('📥 Login response:', data);

        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const completeSuccessfulLogin = async (loginData) => {
          const targetUrl = loginData?.callback_url || redirectUri || loginData?.redirect_url || '/dashboard';

          if (targetUrl) {
            console.log('🔄 Redirecting to:', targetUrl);
            setTimeout(() => {
              window.location.href = targetUrl;
            }, 1500);
            return;
          }

          if (loginData?.access_token) {
            sessionStorage.setItem('auth_token', loginData.access_token);
            sessionStorage.setItem('refresh_token', loginData.refresh_token);
            if (loginData?.user) {
              sessionStorage.setItem('user_data', JSON.stringify(loginData.user));
            }
          }
        };

        if (data.success) {
          showMessage('¡Inicio de sesión exitoso!', 'success');

          await completeSuccessfulLogin(data.data || {});
        } else if (data.error?.code === 'MFA_REQUIRED') {
          const challengeId = data.data?.challenge_id;
          const challengeCode = data.data?.challenge_code;

          if (!challengeId) {
            showMessage('Desafío MFA inválido. Intenta nuevamente.', 'error');
            return;
          }

          showMessage('Doble factor requerido. Aprueba en tu app Authenticator. Código: ' + (challengeCode || 'N/A'), 'success');

          (async () => {
            for (let attempt = 0; attempt < 60; attempt += 1) {
              await wait(2000);

              const checkResponse = await fetch(SUPABASE_URL + '/functions/v1/mfa-check-challenge', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                  'apikey': SUPABASE_ANON_KEY,
                  'X-Client-Info': 'authsystem-static-form/1.0'
                },
                body: JSON.stringify({
                  challenge_id: challengeId,
                  application_id: APPLICATION_ID
                })
              });

              const checkData = await checkResponse.json();
              const status = checkData?.data?.status;

              if (!checkData?.success || status === 'pending') {
                continue;
              }

              if (status === 'approved') {
                showMessage('¡Inicio de sesión aprobado!', 'success');
                await completeSuccessfulLogin(checkData.data || {});
                return;
              }

              if (status === 'rejected') {
                showMessage('Aprobación rechazada desde la app Authenticator.', 'error');
                return;
              }

              if (status === 'expired') {
                showMessage('El desafío MFA expiró. Inicia sesión nuevamente.', 'error');
                return;
              }

              if (status === 'approved_consumed') {
                showMessage('El desafío MFA ya fue consumido. Inicia sesión nuevamente.', 'error');
                return;
              }
            }

            showMessage('Tiempo de espera agotado para la aprobación MFA.', 'error');
          })();
        } else if (data.error?.code === 'MFA_SETUP_REQUIRED') {
          const setupData = data.data || {};
          const setupMessage = setupData?.pairing_token
            ? 'Configura Authenticator. Token manual: ' + setupData.pairing_token
            : 'Configura Authenticator escaneando el QR y vuelve a iniciar sesión.';
          showMessage(setupMessage, 'error');
        } else {
          console.error('❌ Login failed:', data.error);
          showMessage(data.error?.message || data.error || 'Error al iniciar sesión', 'error');
        }
        ` : formType === 'register' ? `
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const name = document.getElementById('name').value;
        const roleSelect = document.getElementById('role');
        const selectedRole = roleSelect ? roleSelect.value : '';

        // Validate passwords match
        if (password !== confirmPassword) {
          showMessage('Las contraseñas no coinciden', 'error');
          throw new Error('Las contraseñas no coinciden');
        }

        const registerPayload = {
          application_id: APPLICATION_ID,
          email: email,
          password: password,
          name: name,
          role: selectedRole || undefined,
          api_key: API_KEY,
          callback_url: redirectUri
        };

        console.log('🚀 Sending register request to:', SUPABASE_URL + '/functions/v1/auth-register');
        console.log('📦 Payload:', {
          ...registerPayload,
          password: '***hidden***',
          api_key: API_KEY ? API_KEY.substring(0, 15) + '...' : 'MISSING'
        });

        const response = await fetch(SUPABASE_URL + '/functions/v1/auth-register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-static-form/1.0'
          },
          body: JSON.stringify(registerPayload)
        });

        console.log('📊 Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('📥 Register response:', data);

        if (data.success) {
          showMessage('¡Registro exitoso! Redirigiendo...', 'success');

          const targetUrl = data.data?.callback_url || redirectUri || data.data?.redirect_url || '/dashboard';
          console.log('🔄 Redirecting to:', targetUrl);

          setTimeout(() => {
            window.location.href = targetUrl;
          }, 1500);
        } else {
          console.error('❌ Register failed:', data.error);
          showMessage(data.error?.message || data.error || 'Error al registrarse', 'error');
        }
        ` : `
        const resetPayload = {
          application_id: APPLICATION_ID,
          email: email,
          api_key: API_KEY,
          callback_url: redirectUri
        };

        console.log('🚀 Sending reset password request to:', SUPABASE_URL + '/functions/v1/auth-reset-password');
        console.log('📦 Payload:', {
          ...resetPayload,
          api_key: API_KEY ? API_KEY.substring(0, 15) + '...' : 'MISSING'
        });

        const response = await fetch(SUPABASE_URL + '/functions/v1/auth-reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-static-form/1.0'
          },
          body: JSON.stringify(resetPayload)
        });

        console.log('📊 Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('📥 Reset password response:', data);

        if (data.success) {
          showMessage('Email de recuperación enviado. Revisa tu correo.', 'success');
        } else {
          console.error('❌ Reset password failed:', data.error);
          showMessage(data.error?.message || data.error || 'Error al enviar email', 'error');
        }
        `}
      } catch (error) {
        console.error('Error:', error);
        showMessage('Error de conexión', 'error');
      } finally {
        submitBtn.disabled = false;
        buttonText.textContent = '${formTitle}';
        spinner.classList.add('hidden');
        arrowIcon.classList.remove('hidden');
      }
    });

    // ===================================================================
    // CARGA DINÁMICA DE BRANDING
    // ===================================================================
    // Cargar branding dinámicamente desde la base de datos
    async function loadBranding() {
      try {
        console.log('🎨 Loading branding for app:', APPLICATION_ID);

        // PASO 1: Obtener la aplicación para conseguir el UUID
        const appUrl = SUPABASE_URL + '/rest/v1/applications?application_id=eq.' + encodeURIComponent(APPLICATION_ID) + '&select=id,name';
        console.log('📡 Fetching app:', appUrl);

        const appResponse = await fetch(appUrl, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          }
        });

        if (!appResponse.ok) {
          const errorText = await appResponse.text();
          console.error('❌ App fetch error:', errorText);
          return; // Usar branding por defecto
        }

        const apps = await appResponse.json();
        console.log('📦 App data:', apps);

        if (!apps || apps.length === 0) {
          console.warn('⚠️ App not found');
          return;
        }

        const app = apps[0];

        // PASO 2: Obtener el branding usando el UUID
        const brandingUrl = SUPABASE_URL + '/rest/v1/branding_configs?application_id=eq.' + app.id + '&select=primary_color,logo_url,secondary_color,accent_color';
        console.log('📡 Fetching branding:', brandingUrl);

        const brandingResponse = await fetch(brandingUrl, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          }
        });

        if (!brandingResponse.ok) {
          console.warn('⚠️ Branding fetch failed, using defaults');
          return;
        }

        const brandings = await brandingResponse.json();
        console.log('📦 Branding data:', brandings);

        if (!brandings || brandings.length === 0) {
          console.warn('⚠️ No branding config found');
          return;
        }

        const branding = brandings[0];
        console.log('✅ Branding loaded:', branding);

          // Aplicar colores
          if (branding.primary_color) {
            document.documentElement.style.setProperty('--primary-color', branding.primary_color);
            const blobs = document.querySelectorAll('.animate-pulse-bg');
            if (blobs[0]) blobs[0].style.backgroundColor = branding.primary_color;

            // Actualizar botón
            const btn = document.querySelector('.btn-primary');
            if (btn) btn.style.backgroundColor = branding.primary_color;
          }

          // Aplicar logo
          const logoContainer = document.getElementById('app-logo-container');
          if (logoContainer && branding.logo_url) {
            logoContainer.innerHTML = '<img src="' + branding.logo_url + '" alt="' + app.name + '" class="h-16 mx-auto mb-4" />';
          } else if (logoContainer && app.name) {
            // Actualizar la inicial con el nombre real de la app
            const firstLetter = (app.name || 'A').charAt(0).toUpperCase();
            const bgColor = branding.primary_color || '${primaryColor}';
            logoContainer.innerHTML = '<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-2xl font-bold" style="background-color: ' + bgColor + ';">' + firstLetter + '</div>';
          }

          // Actualizar el título con el nombre de la app
          if (app.name) {
            document.title = '${formTitle} - ' + app.name;
          }
        }
      } catch (error) {
        console.error('❌ Error loading branding:', error);
        // No hacer nada, usar el branding por defecto
      }
    }

    // Cargar branding al iniciar
    loadBranding();
  </script>
</body>
</html>`;
}

export async function getProjectFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  // Package.json - minimal version for deployed projects
  files['package.json'] = JSON.stringify({
    "name": "authsystem-client",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "@supabase/supabase-js": "^2.57.4",
      "lucide-react": "^0.344.0",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^7.9.3"
    },
    "devDependencies": {
      "@types/react": "^18.3.5",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      "autoprefixer": "^10.4.18",
      "postcss": "^8.4.35",
      "tailwindcss": "^3.4.1",
      "typescript": "^5.5.3",
      "vite": "^5.4.2"
    }
  }, null, 2);

  // Vite config
  files['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});`;

  // TypeScript config
  files['tsconfig.json'] = JSON.stringify({
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }, null, 2);

  files['tsconfig.node.json'] = JSON.stringify({
    "compilerOptions": {
      "composite": true,
      "skipLibCheck": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true
    },
    "include": ["vite.config.ts"]
  }, null, 2);

  // Tailwind config
  files['tailwind.config.js'] = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

  // PostCSS config
  files['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

  // Index HTML
  files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/images/icon.svg" />
    <link rel="shortcut icon" type="image/svg+xml" href="/images/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AuthSystem</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

  // Main entry point
  files['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { envConfigService } from './services/envConfigService';

async function bootstrap() {
  try {
    await envConfigService.loadConfig();
  } catch (error) {
    console.warn('No se pudo cargar /get-env. Continuamos con fallback público.', error);
  }

  const { default: App } = await import('./App');

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();`;

  // Main CSS
  files['src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`;

  // Main App component with routing
  files['src/App.tsx'] = `import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PublicAuthRouter from './components/auth/PublicAuthRouter';
import CallbackHandler from './components/auth/CallbackHandler';

function PreserveSearchLoginRedirect() {
  const location = useLocation();
  const target = '/login' + (location.search || '');
  return <Navigate to={target} replace />;
}

function App() {
  // Get app_id from environment variable
  const appId = import.meta.env.VITE_APP_ID || 'demo-app';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicAuthRouter appId={appId} formType="login" />} />
        <Route path="/register" element={<PublicAuthRouter appId={appId} formType="register" />} />
        <Route path="/reset-password" element={<PublicAuthRouter appId={appId} formType="reset-password" />} />
        <Route path="/callback" element={<CallbackHandler />} />
        <Route path="/auth/callback" element={<CallbackHandler />} />
        <Route path="/" element={<PreserveSearchLoginRedirect />} />
        <Route path="*" element={<PreserveSearchLoginRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;`;

  files['src/components/auth/CallbackHandler.tsx'] = `import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Shield, ArrowRight } from 'lucide-react';
import { requireSupabaseAnonKey, requireSupabaseUrl } from '../../lib/supabaseRuntime';

const CALLBACK_PROCESSING_PREFIX = 'auth_callback_processing';
const CALLBACK_PROCESSED_PREFIX = 'auth_callback_processed';

function buildCallbackStorageKey(prefix: string, applicationId: string, code: string) {
  return prefix + ':' + (applicationId || 'unknown') + ':' + code;
}

export default function CallbackHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación...');
  useEffect(() => {
    const run = async () => {
      try {
        const code = searchParams.get('code');
        const applicationId = searchParams.get('application_id') || searchParams.get('app_id') || '';
        const supabaseUrl = requireSupabaseUrl();
        const supabaseAnonKey = requireSupabaseAnonKey();

        if (!code) {
          throw new Error('No se encontró un código de autenticación válido en la URL');
        }

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase no está configurado');
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        const storageApplicationId = applicationId || 'unknown';
        const processingKey = buildCallbackStorageKey(CALLBACK_PROCESSING_PREFIX, storageApplicationId, code);
        const processedKey = buildCallbackStorageKey(CALLBACK_PROCESSED_PREFIX, storageApplicationId, code);

        if (sessionStorage.getItem(processedKey) === '1') {
          setStatus('success');
          setMessage('Esta autenticaciÃ³n ya fue procesada. Redirigiendo...');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 1200);
          return;
        }

        if (sessionStorage.getItem(processingKey) === '1') {
          setStatus('loading');
          setMessage('Procesando autenticaciÃ³n...');
          return;
        }

        sessionStorage.setItem(processingKey, '1');

        const response = await fetch(supabaseUrl + '/functions/v1/auth-exchange-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + supabaseAnonKey,
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify(applicationId ? { code, application_id: applicationId } : { code })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result?.error?.message || 'No se pudo completar el intercambio de código');
        }

        const data = result.data || {};
        sessionStorage.setItem('auth_token', data.access_token || '');
        sessionStorage.setItem('refresh_token', data.refresh_token || '');
        if (data.user) {
          sessionStorage.setItem('user_data', JSON.stringify(data.user));
        }
        if (data.application) {
          sessionStorage.setItem('application_data', JSON.stringify(data.application));
        }

        sessionStorage.setItem(processedKey, '1');
        sessionStorage.removeItem(processingKey);

        setStatus('success');
        setMessage('Autenticación exitosa. Redirigiendo...');

        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1500);
      } catch (error: any) {
        const code = searchParams.get('code');
        const applicationId = searchParams.get('application_id') || searchParams.get('app_id');
        if (code && applicationId) {
          const processingKey = buildCallbackStorageKey(CALLBACK_PROCESSING_PREFIX, applicationId || 'unknown', code);
          sessionStorage.removeItem(processingKey);
        }

        setStatus('error');
        setMessage(error.message || 'Error procesando la autenticación');
      }
    };

    run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Procesando autenticación...</h2>
            <p className="text-gray-600">Por favor espera mientras validamos tu sesión</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">¡Autenticación Exitosa!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Sesión segura establecida</span>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error de Autenticación</h2>
            <p className="text-gray-600 mb-6">{message}</p>

            <button
              onClick={() => navigate('/login', { replace: true })}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
            >
              <span>Intentar de nuevo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}`;

  files['src/services/envConfigService.ts'] = `declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

const DEFAULT_ENV_CONFIG_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const DEFAULT_ENV_CONFIG_ACCESS_KEY = '4a63305a316f04fe2acf33b2b63135925bd3a0523c1fd453a42fbf1fc49e6240';
const DEFAULT_SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';

class EnvConfigService {
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  async loadConfig(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.fetchConfig().finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  private getFallbackVariables(): Record<string, string> {
    return {
      VITE_SUPABASE_URL: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY,
      ...(window.__ENV__ || {})
    };
  }

  private applyVariables(variables: Record<string, string>) {
    window.__ENV__ = {
      ...this.getFallbackVariables(),
      ...variables
    };
    this.loaded = true;
  }

  private async fetchConfig(): Promise<void> {
    const configuredUrl = (import.meta.env.VITE_ENV_CONFIG_URL as string | undefined)?.trim();
    const configuredAccessKey = (import.meta.env.VITE_ENV_CONFIG_ACCESS_KEY as string | undefined)?.trim()
      || DEFAULT_ENV_CONFIG_ACCESS_KEY;

    const candidates = [
      '/get-env',
      configuredUrl,
      DEFAULT_ENV_CONFIG_URL
    ].filter((value, index, array): value is string => !!value && array.indexOf(value) === index);

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: configuredAccessKey
            ? {
                'X-Access-Key': configuredAccessKey,
                'Content-Type': 'application/json'
              }
            : {
                'Content-Type': 'application/json'
              }
        });

        if (!response.ok) {
          throw new Error('Config response ' + response.status);
        }

        const payload = await response.json();
        const variables = payload?.variables && typeof payload.variables === 'object'
          ? payload.variables
          : payload;

        if (!variables || typeof variables !== 'object' || !Object.keys(variables).length) {
          throw new Error('No variables returned by ' + url);
        }

        this.applyVariables(variables as Record<string, string>);
        return;
      } catch (error) {
        console.warn('No se pudo cargar configuración desde', url, error);
      }
    }

    this.applyVariables({});
  }

  getVariable(key: string): string {
    return (window.__ENV__?.[key] || (import.meta.env[key] as string | undefined) || '').trim();
  }
}

export const envConfigService = new EnvConfigService();

export function getEnvVariable(key: string): string {
  return envConfigService.getVariable(key);
}`;

  files['src/lib/supabaseRuntime.ts'] = `import { getEnvVariable } from '../services/envConfigService';

function resolveEnvValue(key: string): string {
  return (getEnvVariable(key) || (import.meta.env[key] as string | undefined) || '').trim();
}

export function getSupabaseUrl(): string {
  return resolveEnvValue('VITE_SUPABASE_URL').replace(/\\/+$/, '');
}

export function getSupabaseAnonKey(): string {
  return resolveEnvValue('VITE_SUPABASE_ANON_KEY');
}

export function requireSupabaseUrl(): string {
  const value = getSupabaseUrl();
  if (!value || !/^https?:\\/\\//i.test(value)) {
    throw new Error('VITE_SUPABASE_URL no está configurada correctamente');
  }
  return value;
}

export function requireSupabaseAnonKey(): string {
  const value = getSupabaseAnonKey();
  if (!value) {
    throw new Error('VITE_SUPABASE_ANON_KEY no está configurada correctamente');
  }
  return value;
}`;

  // Supabase client
  files['src/lib/supabase.ts'] = `import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAnonKey, requireSupabaseUrl } from './supabaseRuntime';

const supabaseUrl = requireSupabaseUrl();
const supabaseAnonKey = requireSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});`;

  // IP Service
  files['src/services/ipService.ts'] = `import { getSupabaseAnonKey, getSupabaseUrl } from '../lib/supabaseRuntime';

export const ipService = {
  async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Detected client IP:', data.ip);
        return data.ip;
      }
    } catch (error) {
      console.error('Error detecting client IP:', error);
    }

    return '0.0.0.0';
  },

  async checkIPStatus(clientIp?: string): Promise<{
    is_blocked: boolean;
    blocked_info: any;
    ip_address: string;
  }> {
    try {
      const ipToCheck = clientIp || await this.getClientIP();

      const supabaseUrl = getSupabaseUrl();
      const supabaseAnonKey = getSupabaseAnonKey();
      const apiUrl = \`\${supabaseUrl}/functions/v1/check-ip-status\`;

      console.log('🔍 Checking IP status for:', ipToCheck);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${supabaseAnonKey}\`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ client_ip: ipToCheck })
      });

      console.log('📡 Response status:', response.status);

      const result = await response.json();
      console.log('📦 Response data:', result);

      if (result.success) {
        return {
          is_blocked: result.data.is_blocked,
          blocked_info: result.data.blocked_info,
          ip_address: result.data.ip_address
        };
      }

      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: ipToCheck
      };
    } catch (error) {
      console.error('❌ Error checking IP status:', error);
      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: '0.0.0.0'
      };
    }
  }
};`;

  // Application Service
  files['src/services/applicationService.ts'] = `import { supabase } from '../lib/supabase';

export const applicationService = {
  async getBranding(applicationId: string) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('metadata')
        .eq('id', applicationId)
        .single();

      if (error) throw error;

      return data?.metadata?.branding || null;
    } catch (error) {
      console.error('Error loading branding:', error);
      return null;
    }
  }
};`;

  // Roles Service
  files['src/services/rolesService.ts'] = `import { supabase } from '../lib/supabase';

export const rolesService = {
  async getRolesByApplication(applicationId: string) {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('application_id', applicationId)
        .eq('is_active', true);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error loading roles:', error);
      return [];
    }
  },

  async getAvailableRolesForRegistration(applicationId: string) {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('application_id', applicationId)
        .eq('is_active', true)
        .eq('is_available_for_registration', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error loading roles for registration:', error);
      return [];
    }
  }
};`;

  // Public Auth Router Component
  files['src/components/auth/PublicAuthRouter.tsx'] = `import React, { useEffect, useState } from 'react';
import PublicAuthForms from './PublicAuthForms';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseRuntime';
import { useSearchParams } from 'react-router-dom';

interface PublicAuthRouterProps {
  appId: string;
  formType: string;
}

export default function PublicAuthRouter({ appId, formType }: PublicAuthRouterProps) {
  const [appData, setAppData] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const validFormType = ['login', 'register', 'reset-password'].includes(formType)
    ? formType as 'login' | 'register' | 'reset-password'
    : 'login';

  useEffect(() => {
    loadApplicationData();
  }, [appId]);

  const loadApplicationData = async () => {
    try {
      setLoading(true);
      console.log('Loading application data for:', appId);

      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = getSupabaseAnonKey();

      if (!supabaseUrl || !supabaseKey ||
          supabaseUrl === 'https://your-project-id.supabase.co' ||
          supabaseKey === 'your_supabase_anon_key_here') {

        console.warn('⚠️ Supabase not configured, using mock data');

        const mockApp = {
          id: appId,
          application_id: appId,
          name: 'Demo Application',
          domain: 'demo.com',
          description: 'Demo application for testing',
          status: 'active',
          created_at: new Date().toISOString(),
          metadata: {
            environment_urls: {
              development: {
                base_url: 'http://localhost:5173',
                callback_url: window.location.origin + '/callback'
              }
            }
          }
        };

        setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');

        const mockBranding = {
          primary_color: '#3B82F6',
          secondary_color: '#1E40AF',
          background_color: '#FFFFFF',
          text_color: '#1F2937',
          font_family: 'Inter',
          border_radius: 8,
          button_style: 'rounded'
        };

        setAppData({
          ...mockApp,
          branding: mockBranding
        });

        console.log('✅ Mock application data loaded:', mockApp);
        return;
      }

      try {
        const { data: app, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', appId)
          .single();

        if (appError || !app) {
          console.error('Application not found:', appId, appError);

          console.warn('⚠️ Application not found in database, using mock data for development');

          const mockApp = {
            id: appId,
            application_id: appId,
            name: 'Demo Application',
            domain: 'demo.com',
            description: 'Demo application for testing',
            status: 'active',
            created_at: new Date().toISOString(),
            metadata: {
              environment_urls: {
              development: {
                base_url: 'http://localhost:5173',
                callback_url: window.location.origin + '/callback'
              }
              }
            }
          };

          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');

          const mockBranding = {
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            background_color: '#FFFFFF',
            text_color: '#1F2937',
            font_family: 'Inter',
            border_radius: 8,
            button_style: 'rounded'
          };

          setAppData({
            ...mockApp,
            branding: mockBranding
          });

          console.log('✅ Mock application data loaded for development');
          return;
        }

        const environment = searchParams.get('env') || 'development';

        const { data: apiKeys, error: apiKeyError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('application_id', app.id)
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .limit(1);

        if (apiKeyError) {
          console.error('Error loading API keys:', apiKeyError);
          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
        } else if (!apiKeys || apiKeys.length === 0) {
          console.warn('No active API keys found for application, using mock key');
          setApiKey('ak_development_cd9bac61b17b0a09f307afe54e93d40f');
        } else {
          setApiKey(apiKeys[0].key_hash);
        }

        try {
          const branding = await applicationService.getBranding(app.id);
          setAppData({
            ...app,
            branding: branding || {}
          });
        } catch (brandingError) {
          console.warn('Could not load branding, using defaults:', brandingError);
          setAppData({
            ...app,
            branding: {}
          });
        }

        console.log('Application loaded:', app);

      } catch (supabaseError) {
        console.error('Supabase connection error:', supabaseError);
        setError('Failed to connect to database. Please check Supabase configuration.');
      }

    } catch (error) {
      console.error('Error loading application:', error);
      setError('Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <PublicAuthForms
      applicationId={appId!}
      internalApplicationId={appData?.id}
      formType={validFormType}
      apiKey={apiKey}
      branding={appData?.branding}
      appInfo={appData}
      onSuccess={(data) => {
        console.log('Auth success:', data);
      }}
      onError={(error) => {
        console.error('Auth error:', error);
      }}
    />
  );
}`;

  // PublicAuthForms Component - Use the template
  files['src/components/auth/PublicAuthForms.tsx'] = PUBLIC_AUTH_FORMS_TEMPLATE;

  // Netlify config
  files['netlify.toml'] = `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`;

  // Redirects for Netlify
  files['_redirects'] = `/*  /index.html  200`;

  // .gitignore
  files['.gitignore'] = `# Environment variables
.env
.env.local

# Dependencies
node_modules/

# Build output
dist/
build/

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Editor directories
.vscode/
.idea/`;

  // .env.example
  files['.env.example'] = `# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Application Configuration
VITE_APP_ID=your_application_id_here

# Branding (Optional - these will override database settings)
VITE_BRAND_NAME=My Application
VITE_PRIMARY_COLOR=#3B82F6
VITE_SECONDARY_COLOR=#1E40AF
VITE_BACKGROUND_COLOR=#FFFFFF
VITE_TEXT_COLOR=#1F2937
VITE_LOGO_URL=
VITE_FONT_FAMILY=Inter`;

  return files;
}
