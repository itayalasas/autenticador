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

  // src/App.tsx - Router for public forms
  files['src/App.tsx'] = `import React from 'react';
import { Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import PublicAuthForms from './components/PublicAuthForms';

export default function App() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const appId = searchParams.get('app_id') || import.meta.env.VITE_APP_ID || '';
  const apiKey = searchParams.get('api_key') || import.meta.env.VITE_API_KEY || '';
  const redirectUri = searchParams.get('redirect_uri');

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
              /login?app_id=xxx&api_key=yyy&redirect_uri=zzz
            </code>
          </p>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error de Configuración</h1>
          <p className="text-gray-600 mb-4">
            El parámetro <code className="bg-gray-100 px-2 py-1 rounded">api_key</code> es requerido en la URL.
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
          <PublicAuthForms
            applicationId={appId}
            formType="login"
            apiKey={apiKey}
            redirectUri={redirectUri || undefined}
          />
        }
      />
      <Route
        path="/register"
        element={
          <PublicAuthForms
            applicationId={appId}
            formType="register"
            apiKey={apiKey}
            redirectUri={redirectUri || undefined}
          />
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicAuthForms
            applicationId={appId}
            formType="reset-password"
            apiKey={apiKey}
            redirectUri={redirectUri || undefined}
          />
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
`;

  // src/components/PublicAuthForms.tsx - Using the template
  files['src/components/PublicAuthForms.tsx'] = PUBLIC_AUTH_FORMS_TEMPLATE;

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
