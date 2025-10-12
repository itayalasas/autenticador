// Helper to prepare a standalone React app for Netlify deployment
// This uses the actual PublicAuthForms component instead of static HTML

import { PUBLIC_AUTH_FORMS_TEMPLATE } from './publicAuthFormsTemplate';

export async function getReactProjectFiles(
  applicationId: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  branding?: any
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  // package.json for the standalone app
  files['package.json'] = JSON.stringify({
    "name": "authsystem-public-forms",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^7.9.3",
      "@supabase/supabase-js": "^2.57.4",
      "lucide-react": "^0.344.0"
    },
    "devDependencies": {
      "@vitejs/plugin-react": "^4.3.1",
      "vite": "^5.4.2",
      "typescript": "^5.5.3",
      "autoprefixer": "^10.4.18",
      "postcss": "^8.4.35",
      "tailwindcss": "^3.4.1"
    }
  }, null, 2);

  // vite.config.ts
  files['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
`;

  // tailwind.config.js
  files['tailwind.config.js'] = `export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

  // postcss.config.js
  files['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

  // .env file with configuration
  files['.env'] = `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_APP_ID=${applicationId}
VITE_API_KEY=${apiKey}
`;

  // index.html
  files['index.html'] = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AuthSystem - Autenticación</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  // src/main.tsx
  files['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`;

  // src/index.css
  files['src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;

  // src/App.tsx - Router for public forms using PublicAuthRouter
  files['src/App.tsx'] = `import React from 'react';
import { Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import PublicAuthRouter from './components/auth/PublicAuthRouter';

export default function App() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const appId = searchParams.get('app_id') || import.meta.env.VITE_APP_ID || '';

  // Map path to form type
  const getFormType = (): 'login' | 'register' | 'reset-password' => {
    if (location.pathname.includes('register')) return 'register';
    if (location.pathname.includes('reset')) return 'reset-password';
    return 'login';
  };

  if (!appId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error de Configuración</h1>
          <p className="text-gray-600 mb-4">
            El parámetro <code className="bg-gray-100 px-2 py-1 rounded">app_id</code> es requerido en la URL.
          </p>
          <p className="text-sm text-gray-500">
            Ejemplo: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              /login?app_id=xxx
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicAuthRouter
            appId={appId}
            formType="login"
          />
        }
      />
      <Route
        path="/register"
        element={
          <PublicAuthRouter
            appId={appId}
            formType="register"
          />
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicAuthRouter
            appId={appId}
            formType="reset-password"
          />
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
`;

  // src/components/auth/PublicAuthRouter.tsx - Component that loads branding from DB
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
    const loadApplicationData = async () => {
      try {
        setLoading(true);
        console.log('Loading application data for:', appId);

        try {
          const { data: app, error: appError } = await supabase
            .from('applications')
            .select('*')
            .eq('application_id', appId)
            .single();

          if (appError || !app) {
            console.error('Application not found:', appId, appError);
            setError('Application not found');
            return;
          }

          const { data: apiKeys, error: apiKeyError } = await supabase
            .from('api_keys')
            .select('*')
            .eq('application_id', app.id)
            .eq('is_active', true)
            .limit(1);

          if (apiKeyError || !apiKeys || apiKeys.length === 0) {
            console.warn('No active API keys found');
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
          setError('Failed to connect to database');
        }

      } catch (error) {
        console.error('Error loading application:', error);
        setError('Failed to load application');
      } finally {
        setLoading(false);
      }
    };

    loadApplicationData();
  }, [appId]);

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
      applicationId={appId}
      internalApplicationId={appData?.id}
      formType={validFormType}
      apiKey={apiKey}
      branding={appData?.branding}
      appInfo={appData}
      onSuccess={(data) => console.log('Auth success:', data)}
      onError={(error) => console.error('Auth error:', error)}
    />
  );
}
`;

  // src/components/auth/PublicAuthForms.tsx - Using the template
  files['src/components/auth/PublicAuthForms.tsx'] = PUBLIC_AUTH_FORMS_TEMPLATE;

  // ============================================
  // SERVICE FILES - Required by PublicAuthForms
  // ============================================

  // src/services/rolesService.ts
  files['src/services/rolesService.ts'] = `import { supabase } from '../lib/supabase';

export const rolesService = {
  async getRolesByApplication(internalAppId: string) {
    try {
      const { data, error } = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', internalAppId)
        .order('display_name');

      if (error) {
        console.error('Error fetching roles from DB:', error);
        throw error;
      }

      console.log('✅ Roles loaded:', data);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching roles:', error);
      return [];
    }
  },

  async getAvailableRolesForRegistration(internalAppId: string) {
    try {
      const { data, error } = await supabase
        .from('application_roles')
        .select('*')
        .eq('application_id', internalAppId)
        .eq('available_for_registration', true)
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        console.error('Error fetching roles for registration:', error);
        throw error;
      }

      console.log('✅ Roles for registration loaded:', data);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching roles for registration:', error);
      return [];
    }
  }
};
`;

  // src/services/applicationService.ts
  files['src/services/applicationService.ts'] = `import { supabase } from '../lib/supabase';

export const applicationService = {
  async getApplicationByApplicationId(applicationId: string) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching application:', error);
      return null;
    }
  },

  async verifyApiKey(appId: string, apiKey: string) {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('application_id', appId)
        .eq('key', apiKey)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error verifying API key:', error);
      return false;
    }
  },

  async getBranding(internalAppId: string) {
    try {
      const { data, error } = await supabase
        .from('branding_configs')
        .select('*')
        .eq('application_id', internalAppId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching branding:', error);
      return null;
    }
  },

  async getBrandingByApplicationId(internalAppId: string) {
    try {
      const { data, error } = await supabase
        .from('branding_configs')
        .select('*')
        .eq('application_id', internalAppId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching branding:', error);
      return null;
    }
  }
};
`;

  // src/services/ipService.ts
  files['src/services/ipService.ts'] = `export const ipService = {
  async getClientIP() {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();
      console.log('Detected client IP:', ip);
      return ip;
    } catch (error) {
      console.error('Error getting client IP:', error);
      return '0.0.0.0';
    }
  },

  async checkIPStatus(clientIp) {
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
};
`;

  // src/lib/supabase.ts
  files['src/lib/supabase.ts'] = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;

  // netlify.toml for deployment configuration
  files['netlify.toml'] = `[build]
  command = "npm install && npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

  // _redirects file (backup for netlify.toml)
  files['_redirects'] = `/*    /index.html   200`;

  // README.md
  files['README.md'] = `# AuthSystem Public Forms

Este es un proyecto standalone de formularios públicos para AuthSystem.

## Deployment

Este proyecto está configurado para deployarse automáticamente en Netlify.

## Variables de Entorno

Las siguientes variables están pre-configuradas en el archivo .env:

- VITE_SUPABASE_URL: URL de tu proyecto Supabase
- VITE_SUPABASE_ANON_KEY: Anon key de Supabase
- VITE_APP_ID: ID de la aplicación
- VITE_API_KEY: API key de la aplicación

## Rutas

- \`/login\` - Formulario de inicio de sesión
- \`/register\` - Formulario de registro
- \`/reset-password\` - Formulario de recuperación de contraseña

Todas las rutas requieren los parámetros \`app_id\` y \`api_key\` en la URL.
`;

  return files;
}
