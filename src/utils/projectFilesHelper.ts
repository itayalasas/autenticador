// Helper to prepare project files for deployment with real auth components

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

  // PublicAuthForms Component - Import the actual source code
  // We import this dynamically to avoid embedding 700+ lines inline
  const PublicAuthFormsModule = await import('../components/auth/PublicAuthForms.tsx?raw');
  files['src/components/auth/PublicAuthForms.tsx'] = PublicAuthFormsModule.default;

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
