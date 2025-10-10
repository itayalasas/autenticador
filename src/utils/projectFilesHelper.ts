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
  from = "/login"
  to = "/login.html"
  status = 200

[[redirects]]
  from = "/register"
  to = "/register.html"
  status = 200

[[redirects]]
  from = "/reset"
  to = "/reset.html"
  status = 200`;

  // _redirects for Netlify
  files['_redirects'] = `/login /login.html 200
/register /register.html 200
/reset /reset.html 200`;

  return files;
}

// Helper function to generate standalone HTML
function generateStandaloneFormHTML(
  formType: string,
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): string {
  const primaryColor = branding?.primary_color || '#3b82f6';
  const logoUrl = branding?.logo_url || '';
  const appName = branding?.app_name || 'AuthSystem';

  const formTitle = {
    'login': 'Iniciar Sesión',
    'register': 'Registrarse',
    'reset': 'Recuperar Contraseña'
  }[formType] || 'Autenticación';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formTitle} - ${appName}</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://cdn.tailwindcss.com"></script>
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
  </style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="bg-white rounded-lg shadow-lg p-8">
      ${logoUrl ? `<div class="text-center mb-6"><img src="${logoUrl}" alt="${appName}" class="h-12 mx-auto" /></div>` : ''}
      <h1 class="text-2xl font-bold text-center mb-6">${formTitle}</h1>

      <form id="auth-form" class="space-y-4">
        ${formType === 'register' ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" id="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        ` : ''}

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" id="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        ${formType !== 'reset' ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input type="password" id="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        ` : ''}

        <button type="submit" class="w-full btn-primary text-white py-2 px-4 rounded-md hover:opacity-90 transition">
          ${formTitle}
        </button>
      </form>

      <div id="message" class="mt-4 p-3 rounded-md hidden"></div>

      <div class="mt-6 text-center text-sm">
        ${formType === 'login' ? `
          <a href="/register" class="text-blue-600 hover:underline">¿No tienes cuenta? Regístrate</a>
          <br />
          <a href="/reset" class="text-blue-600 hover:underline mt-2 inline-block">¿Olvidaste tu contraseña?</a>
        ` : formType === 'register' ? `
          <a href="/login" class="text-blue-600 hover:underline">¿Ya tienes cuenta? Inicia sesión</a>
        ` : `
          <a href="/login" class="text-blue-600 hover:underline">Volver al inicio de sesión</a>
        `}
      </div>
    </div>
  </div>

  <script>
    const AUTHSYSTEM_API_URL = '${supabaseUrl}';
    const AUTHSYSTEM_API_KEY = '${apiKey}';
    const APPLICATION_ID = '${applicationId}';
    const SUPABASE_URL = '${supabaseUrl}';
    const SUPABASE_ANON_KEY = '${supabaseAnonKey}';

    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function showMessage(message, type) {
      const messageEl = document.getElementById('message');
      messageEl.textContent = message;
      messageEl.className = 'mt-4 p-3 rounded-md ' + (type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700');
      messageEl.classList.remove('hidden');
    }

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando...';

      try {
        ${formType === 'login' ? `
        const password = document.getElementById('password').value;

        const response = await fetch(\`\${AUTHSYSTEM_API_URL}/functions/v1/auth-login\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            application_id: APPLICATION_ID,
            api_key: AUTHSYSTEM_API_KEY,
            email,
            password
          })
        });

        const data = await response.json();

        if (data.success) {
          showMessage('Inicio de sesión exitoso', 'success');
          setTimeout(() => {
            window.location.href = data.redirect_url || '/dashboard';
          }, 1500);
        } else {
          showMessage(data.error || 'Error al iniciar sesión', 'error');
        }
        ` : formType === 'register' ? `
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;

        const response = await fetch(\`\${AUTHSYSTEM_API_URL}/functions/v1/auth-register\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            application_id: APPLICATION_ID,
            api_key: AUTHSYSTEM_API_KEY,
            email,
            password,
            metadata: { name }
          })
        });

        const data = await response.json();

        if (data.success) {
          showMessage('Registro exitoso. Redirigiendo...', 'success');
          setTimeout(() => {
            window.location.href = data.redirect_url || '/dashboard';
          }, 1500);
        } else {
          showMessage(data.error || 'Error al registrarse', 'error');
        }
        ` : `
        const response = await fetch(\`\${AUTHSYSTEM_API_URL}/functions/v1/auth-reset-password\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            application_id: APPLICATION_ID,
            api_key: AUTHSYSTEM_API_KEY,
            email
          })
        });

        const data = await response.json();

        if (data.success) {
          showMessage('Email de recuperación enviado. Revisa tu correo.', 'success');
        } else {
          showMessage(data.error || 'Error al enviar email', 'error');
        }
        `}
      } catch (error) {
        console.error('Error:', error);
        showMessage('Error de conexión', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '${formTitle}';
      }
    });
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
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
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
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`;

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
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicAuthRouter from './components/auth/PublicAuthRouter';

function App() {
  // Get app_id from environment variable
  const appId = import.meta.env.VITE_APP_ID || 'demo-app';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicAuthRouter appId={appId} formType="login" />} />
        <Route path="/register" element={<PublicAuthRouter appId={appId} formType="register" />} />
        <Route path="/reset-password" element={<PublicAuthRouter appId={appId} formType="reset-password" />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;`;

  // Supabase client
  files['src/lib/supabase.ts'] = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});`;

  // IP Service
  files['src/services/ipService.ts'] = `export const ipService = {
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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
                callback_url: 'http://localhost:5173/auth/callback'
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
                  callback_url: 'http://localhost:5173/auth/callback'
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
