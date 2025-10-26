import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CollectFilesRequest {
  applicationId: string;
  apiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  branding?: any;
  internalApplicationId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      applicationId,
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
      branding,
      internalApplicationId
    }: CollectFilesRequest = await req.json();

    console.log('📦 Collecting source files for deployment...');
    console.log('Application ID:', applicationId);

    // Initialize Supabase client to fetch roles
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch available roles
    let rolesData: any[] = [];
    if (internalApplicationId) {
      try {
        const { data, error } = await supabase
          .from('application_roles')
          .select('*')
          .eq('application_id', internalApplicationId)
          .eq('available_for_registration', true)
          .eq('is_active', true)
          .order('role_name');

        if (!error && data) {
          rolesData = data;
          console.log(`✅ Loaded ${rolesData.length} roles for application`);
        }
      } catch (error) {
        console.error('Error loading roles:', error);
      }
    }

    const files: Record<string, string> = {};

    // ============================================
    // ROOT CONFIGURATION FILES
    // ============================================

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
        "@types/react": "^18.3.5",
        "@types/react-dom": "^18.3.0",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1"
      }
    }, null, 2);

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
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noFallthroughCasesInSwitch": true
      },
      "include": ["src"]
    }, null, 2);

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

    files['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

    files['.env.production'] = `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_DEFAULT_APP_ID=${applicationId}
VITE_DEFAULT_API_KEY=${apiKey}
NODE_ENV=production
`;

    files['netlify.toml'] = `[build]
  command = "npm install && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

    files['_redirects'] = `/*    /index.html   200`;

    files['index.html'] = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AuthSystem - Autenticación</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
`;

    // ============================================
    // SOURCE FILES
    // ============================================

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

    files['src/App.tsx'] = `import React from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import PublicAuthRouter from './components/auth/PublicAuthRouter';

export default function App() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('app_id') || import.meta.env.VITE_DEFAULT_APP_ID || '';

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
      <Route path="/login" element={<PublicAuthRouter appId={appId} formType="login" />} />
      <Route path="/register" element={<PublicAuthRouter appId={appId} formType="register" />} />
      <Route path="/reset-password" element={<PublicAuthRouter appId={appId} formType="reset-password" />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
`;

    // Serialize roles data as JSON
    const rolesJSON = JSON.stringify(rolesData);
    const brandingJSON = JSON.stringify(branding || {});

    files['src/components/auth/PublicAuthRouter.tsx'] = `import React, { useEffect, useState } from 'react';
import BrandedPublicAuth from './BrandedPublicAuth';
import { supabase } from '../../lib/supabase';

interface PublicAuthRouterProps {
  appId: string;
  formType: string;
}

export default function PublicAuthRouter({ appId, formType }: PublicAuthRouterProps) {
  const [appData, setAppData] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validFormType = ['login', 'register', 'reset-password'].includes(formType)
    ? formType as 'login' | 'register' | 'reset-password'
    : 'login';

  useEffect(() => {
    const loadApplicationData = async () => {
      try {
        setLoading(true);
        console.log('Loading application data for:', appId);

        const { data: app, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', appId)
          .maybeSingle();

        if (appError || !app) {
          console.error('Application not found:', appId, appError);
          setError('Application not found');
          return;
        }

        const { data: apiKeys } = await supabase
          .from('api_keys')
          .select('*')
          .eq('application_id', app.id)
          .eq('is_active', true)
          .limit(1);

        if (apiKeys && apiKeys.length > 0) {
          setApiKey(apiKeys[0].key_hash);
        }

        const { data: brandingData } = await supabase
          .from('branding_configs')
          .select('*')
          .eq('application_id', app.id)
          .maybeSingle();

        setAppData({
          ...app,
          branding: brandingData || ${brandingJSON}
        });

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
    <BrandedPublicAuth
      applicationId={appId}
      formType={validFormType}
      branding={appData?.branding}
      onSubmit={async (data) => {
        // Handle auth here
        console.log('Auth submit:', data);
      }}
      onSuccess={(data) => console.log('Auth success:', data)}
      onError={(error) => console.error('Auth error:', error)}
    />
  );
}
`;

    files['src/components/auth/BrandedPublicAuth.tsx'] = \`import React from 'react';

interface BrandedPublicAuthProps {
  applicationId: string;
  formType: 'login' | 'register' | 'reset-password';
  branding?: any;
  onSubmit: (data: any) => Promise<void>;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function BrandedPublicAuth({
  applicationId,
  formType,
  branding,
  onSubmit,
  onSuccess,
  onError
}: BrandedPublicAuthProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const apiKey = new URLSearchParams(window.location.search).get('api_key') || import.meta.env.VITE_DEFAULT_API_KEY;

      const apiBaseUrl = \\\`\\\${supabaseUrl}/functions/v1\\\`;

      let endpoint = '';
      let payload: any = {};

      switch (formType) {
        case 'login':
          endpoint = \\\`\\\${apiBaseUrl}/auth-login\\\`;
          payload = {
            email: formData.email,
            password: formData.password,
            application_id: applicationId,
            api_key: apiKey,
          };
          break;
        case 'register':
          endpoint = \\\`\\\${apiBaseUrl}/auth-register\\\`;
          payload = {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            application_id: applicationId,
            api_key: apiKey,
          };
          break;
        case 'reset-password':
          endpoint = \\\`\\\${apiBaseUrl}/auth-reset-password\\\`;
          payload = {
            email: formData.email,
            application_id: applicationId,
            api_key: apiKey,
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \\\`Bearer \\\${supabaseAnonKey}\\\`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        onSuccess?.(result);
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (err: any) {
      const message = err.message || 'An error occurred';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6">
          {formType === 'login' && 'Iniciar Sesión'}
          {formType === 'register' && 'Registro'}
          {formType === 'reset-password' && 'Recuperar Contraseña'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {formType === 'register' && (
            <input
              type="text"
              placeholder="Nombre"
              className="w-full p-3 border rounded mb-4"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 border rounded mb-4"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />

          {formType !== 'reset-password' && (
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full p-3 border rounded mb-4"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          )}

          {formType === 'register' && (
            <input
              type="password"
              placeholder="Confirmar Contraseña"
              className="w-full p-3 border rounded mb-4"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
\`;

    console.log('✅ Source collection complete!');
    console.log(`📦 Total files collected: ${Object.keys(files).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        files,
        summary: {
          totalFiles: Object.keys(files).length,
          applicationId,
          rolesCount: rolesData.length
        },
        message: 'Source files collected successfully with roles and branding'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error collecting source files:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
