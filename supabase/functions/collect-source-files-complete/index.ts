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

    // === TEMPLATES START ===
    // Auto-generated from TypeScript template files
    // DO NOT EDIT THIS SECTION MANUALLY
    // Run: node sync-templates-to-edge-function.js to update

    files['src/components/auth/PublicAuthForms.tsx'] = `import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { rolesService } from '../../services/rolesService';
import { applicationService } from '../../services/applicationService';
import { ipService } from '../../services/ipService';

interface PublicAuthFormsProps {
  applicationId: string;
  internalApplicationId?: string;
  formType: 'login' | 'register' | 'reset-password';
  apiKey: string | null;
  appInfo?: any;
  branding?: {
    // Basic colors
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    background_color?: string;
    text_color?: string;
    font_family?: string;
    logo_url?: string;
    border_radius?: number;
    button_style?: string;
    // Extended branding
    theme_style?: string;
    card_style?: string;
    card_background?: string;
    card_blur?: number;
    input_style?: string;
    input_background?: string;
    input_border_color?: string;
    input_focus_color?: string;
    button_variant?: string;
    button_size?: string;
    button_hover_transform?: boolean;
    color_success?: string;
    color_error?: string;
    color_warning?: string;
    use_gradient?: boolean;
    gradient_start?: string;
    gradient_end?: string;
    shadow_intensity?: string;
    glassmorphism_enabled?: boolean;
    background_blur_enabled?: boolean;
    animations_enabled?: boolean;
    animation_speed?: string;
    form_width?: string;
    spacing?: string;
    custom_texts?: any;
  };
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

function PublicAuthForms({
  applicationId,
  internalApplicationId,
  formType,
  apiKey,
  appInfo,
  branding = {},
  onSuccess,
  onError
}: PublicAuthFormsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingIP, setCheckingIP] = useState(true);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [customTexts, setCustomTexts] = useState<any>({});
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Use refs to track if initial load is done
  const initialLoadDone = React.useRef(false);

  // Default branding values
  const defaultBranding = {
    // Basic
    primary_color: branding?.primary_color || '#3B82F6',
    secondary_color: branding?.secondary_color || '#1E40AF',
    accent_color: branding?.accent_color || '#F59E0B',
    background_color: branding?.background_color || '#FFFFFF',
    text_color: branding?.text_color || '#1F2937',
    font_family: branding?.font_family || 'Inter',
    logo_url: branding?.logo_url || '',
    border_radius: branding?.border_radius || 8,
    button_style: branding?.button_style || 'rounded',
    // Extended
    theme_style: branding?.theme_style || 'modern',
    card_style: branding?.card_style || 'elevated',
    card_background: branding?.card_background || '#FFFFFF',
    card_blur: branding?.card_blur || 10,
    input_style: branding?.input_style || 'outlined',
    input_background: branding?.input_background || '#FFFFFF',
    input_border_color: branding?.input_border_color || '#D1D5DB',
    input_focus_color: branding?.input_focus_color || '#3B82F6',
    button_variant: branding?.button_variant || 'solid',
    button_size: branding?.button_size || 'medium',
    button_hover_transform: branding?.button_hover_transform !== false,
    color_success: branding?.color_success || '#10B981',
    color_error: branding?.color_error || '#EF4444',
    color_warning: branding?.color_warning || '#F59E0B',
    use_gradient: branding?.use_gradient || false,
    gradient_start: branding?.gradient_start || '#3B82F6',
    gradient_end: branding?.gradient_end || '#8B5CF6',
    shadow_intensity: branding?.shadow_intensity || 'medium',
    glassmorphism_enabled: branding?.glassmorphism_enabled || false,
    background_blur_enabled: branding?.background_blur_enabled || false,
    animations_enabled: branding?.animations_enabled !== false,
    animation_speed: branding?.animation_speed || 'normal',
    form_width: branding?.form_width || 'medium',
    spacing: branding?.spacing || 'normal'
  };

  useEffect(() => {
    // Only run once on mount
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    let isMounted = true;

    const init = async () => {
      // Check IP status
      try {
        setCheckingIP(true);
        const result = await ipService.checkIPStatus();

        if (!isMounted) return;

        if (result.is_blocked) {
          console.log('🚫 IP is blocked:', result);
          setIpBlocked(true);
          setBlockedInfo(result.blocked_info);
        } else {
          console.log('✅ IP is not blocked:', result.ip_address);
        }
      } catch (error) {
        console.error('❌ Error checking IP status:', error);
        if (isMounted) setIpBlocked(false);
      } finally {
        if (isMounted) setCheckingIP(false);
      }

      // Application info comes from props, no need to set it here

      // Load custom texts
      try {
        if (internalApplicationId && isMounted) {
          const brandingConfig = await applicationService.getBranding(internalApplicationId);
          if (brandingConfig && brandingConfig.custom_texts && isMounted) {
            setCustomTexts(brandingConfig.custom_texts);
          }
        }
      } catch (error) {
        console.error('Error loading custom texts:', error);
      }

      // Load roles for register form
      if (formType === 'register' && internalApplicationId && isMounted) {
        try {
          const roles = await rolesService.getAvailableRolesForRegistration(internalApplicationId);
          if (isMounted) {
            setAvailableRoles(roles);
            const defaultRole = roles.find(role => role.is_default);
            if (defaultRole) {
              setSelectedRole(defaultRole.name);
            }
          }
        } catch (error) {
          console.error('Error loading available roles:', error);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []); // Empty deps array - only run once

  // Helper function to build navigation URLs with preserved params
  const buildNavUrl = (path: string) => {
    const params = new URLSearchParams();
    params.set('app_id', applicationId);

    // Use apiKey from props or searchParams
    const currentApiKey = apiKey || searchParams.get('api_key');
    if (currentApiKey) {
      params.set('api_key', currentApiKey);
    }

    // Support both callback_url and redirect_uri
    const callbackUrl = searchParams.get('callback_url') || searchParams.get('redirect_uri');
    if (callbackUrl) {
      params.set('redirect_uri', callbackUrl);
    }

    const url = \`\${path}?\${params.toString()}\`;
    console.log('\\ud83d\\udd17 buildNavUrl:', { path, callbackUrl, url });
    return url;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Obtener parámetros de la URL
      const urlParams = new URLSearchParams(window.location.search);
      const callbackUrl = urlParams.get('callback_url') || urlParams.get('redirect_uri');

      if (!apiKey) {
        throw new Error('API key no disponible para esta aplicación');
      }

      // Get client IP first
      const clientIp = await ipService.getClientIP();
      console.log('📍 Client IP:', clientIp);

      // Use Supabase Edge Functions URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiBaseUrl = \`\${supabaseUrl}/functions/v1\`;

      let endpoint = '';
      let payload: any = {};

      switch (formType) {
        case 'login':
          endpoint = \`\${apiBaseUrl}/auth-login\`;
          payload = {
            email: formData.email,
            password: formData.password,
            application_id: applicationId,
            api_key: apiKey,
            callback_url: callbackUrl,
            client_ip: clientIp
          };
          break;
        case 'register':
          if (formData.password !== formData.confirmPassword) {
            throw new Error('Las contraseñas no coinciden');
          }
          endpoint = \`\${apiBaseUrl}/auth-register\`;
          payload = {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            application_id: applicationId,
            api_key: apiKey,
            callback_url: callbackUrl,
            role: selectedRole || undefined,
            client_ip: clientIp
          };
          break;
        case 'reset-password':
          endpoint = \`\${apiBaseUrl}/auth-reset-password\`;
          payload = {
            email: formData.email,
            application_id: applicationId,
            api_key: apiKey,
            redirect_uri: callbackUrl,
            client_ip: clientIp
          };
          break;
      }

      console.log('🚀 Making API request:', {
        endpoint,
        apiKey: apiKey.substring(0, 20) + '...',
        payload: { ...payload, password: '***' }
      });

      // Llamar a la Edge Function de Supabase
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${supabaseAnonKey}\`,
          'apikey': supabaseAnonKey,
          'X-Client-Info': 'authsystem-public-form/1.0'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('📥 API Response:', {
        success: result.success,
        status: response.status,
        error: result.error?.code,
        message: result.error?.message
      });

      // Log the response status for debugging
      console.log('📊 Response status:', response.status, response.ok);

      if (!result.success) {
        console.log('❌ Authentication failed:', result.error);

        // Show more detailed error for debugging
        if (result.error?.code === 'DATABASE_ERROR' || result.error?.message?.includes('Database error')) {
          console.error('🔍 Database error details:', result.error);
          setMessage({
            type: 'error',
            text: 'Error de base de datos. Por favor contacta al administrador del sistema.'
          });
          return;
        }

        // Manejar caso especial de email no verificado
        if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
          setMessage({
            type: 'error',
            text: result.error.message
          });

          // Si hay callback URL para verificación, redirigir después de un delay
          if (result.error.callback_url) {
            setTimeout(() => {
              window.location.href = result.error.callback_url;
            }, 3000);
          }
          return;
        }

        throw new Error(result.error?.message || 'Error en la autenticación');
      }

      console.log('✅ Authentication successful:', result.data);

      // Manejar diferentes tipos de respuesta
      if (formType === 'register' && result.data?.email_verification_required) {
        setMessage({
          type: 'success',
          text: 'Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta.'
        });

        // Redirigir a página de verificación si hay callback URL
        if (result.data?.callback_url) {
          setTimeout(() => {
            window.location.href = result.data.callback_url;
          }, 3000);
        }
      } else {
        // Determinar mensaje según el tipo de formulario y respuesta
        let successMessage = '¡Bienvenido!';

        if (formType === 'register') {
          successMessage = 'Cuenta creada exitosamente';
        } else if (formType === 'reset-password') {
          // Usar el mensaje que viene del servidor o uno genérico
          successMessage = result.data?.message || 'Si el usuario está registrado, recibirá un correo electrónico con las instrucciones para restablecer su contraseña.';
        }

        setMessage({
          type: 'success',
          text: successMessage
        });

        // Si hay callback URL, redirigir después de un breve delay
        if (result.data?.callback_url) {
          console.log('🔄 Redirecting to callback URL:', result.data.callback_url);
          setTimeout(() => {
            window.location.href = result.data.callback_url;
          }, 2000);
        } else {
          // Si no hay callback, mostrar los datos del usuario para desarrollo
          console.log('Autenticación exitosa:', result.data);

          // Guardar tokens en localStorage para desarrollo
          if (result.data.access_token) {
            localStorage.setItem('auth_token', result.data.access_token);
            localStorage.setItem('refresh_token', result.data.refresh_token);
            localStorage.setItem('user_data', JSON.stringify(result.data.user));

            console.log('💾 Tokens guardados en localStorage:', {
              access_token: result.data.access_token.substring(0, 20) + '...',
              user: result.data.user
            });
          }
        }
      }

      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ha ocurrido un error';
      setMessage({ type: 'error', text: errorMessage });
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get custom text or fallback to default
  const getText = (key: string, defaultText: string) => {
    return customTexts[key] || defaultText;
  };

  const getFormTitle = () => {
    switch (formType) {
      case 'login': return getText('login_title', 'Iniciar Sesión');
      case 'register': return getText('register_title', 'Crear Cuenta');
      case 'reset-password': return getText('reset_title', 'Recuperar Contraseña');
      default: return getText('auth_title', 'Autenticación');
    }
  };

  const getFormSubtitle = () => {
    switch (formType) {
      case 'login': return getText('login_subtitle', 'Ingresa tus credenciales');
      case 'register': return getText('register_subtitle', 'Regístrate para comenzar');
      case 'reset-password': return getText('reset_subtitle', 'Te enviaremos un email para recuperar tu contraseña');
      default: return '';
    }
  };

  // Generate dynamic styles based on extended branding
  const getBackgroundStyle = () => {
    const baseStyle: React.CSSProperties = {
      fontFamily: defaultBranding.font_family
    };

    if (defaultBranding.use_gradient) {
      baseStyle.background = \`linear-gradient(135deg, \${defaultBranding.gradient_start}, \${defaultBranding.gradient_end})\`;
    } else {
      baseStyle.backgroundColor = defaultBranding.background_color;
    }

    return baseStyle;
  };

  const getCardStyle = () => {
    const style: React.CSSProperties = {
      borderRadius: \`\${defaultBranding.border_radius}px\`
    };

    if (defaultBranding.card_style === 'glass') {
      style.background = \`\${defaultBranding.card_background}80\`;
      style.backdropFilter = \`blur(\${defaultBranding.card_blur}px)\`;
      style.border = '1px solid rgba(255, 255, 255, 0.2)';
    } else {
      style.backgroundColor = defaultBranding.card_background;

      if (defaultBranding.card_style === 'elevated') {
        const shadows = {
          light: '0 1px 3px rgba(0, 0, 0, 0.1)',
          medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
          strong: '0 10px 15px rgba(0, 0, 0, 0.2)'
        };
        style.boxShadow = shadows[defaultBranding.shadow_intensity as keyof typeof shadows] || shadows.medium;
      }
    }

    return style;
  };

  const getInputStyle = () => {
    const style: React.CSSProperties = {
      borderRadius: \`\${defaultBranding.border_radius}px\`,
      backgroundColor: defaultBranding.input_background,
      borderColor: defaultBranding.input_border_color,
      transition: 'all 0.2s'
    };

    if (defaultBranding.input_style === 'filled') {
      style.border = 'none';
      style.backgroundColor = \`\${defaultBranding.input_border_color}40\`;
    } else if (defaultBranding.input_style === 'underlined') {
      style.borderTop = 'none';
      style.borderLeft = 'none';
      style.borderRight = 'none';
      style.borderRadius = '0';
      style.backgroundColor = 'transparent';
    }

    return style;
  };

  const getButtonStyle = () => {
    const style: React.CSSProperties = {
      borderRadius: defaultBranding.button_style === 'rounded'
        ? \`\${defaultBranding.border_radius}px\`
        : '4px',
      transition: defaultBranding.animations_enabled ? 'all 0.2s' : 'none'
    };

    if (defaultBranding.button_variant === 'gradient' && defaultBranding.use_gradient) {
      style.background = \`linear-gradient(135deg, \${defaultBranding.gradient_start}, \${defaultBranding.gradient_end})\`;
    } else if (defaultBranding.button_variant === 'outline') {
      style.backgroundColor = 'transparent';
      style.border = \`2px solid \${defaultBranding.primary_color}\`;
      style.color = defaultBranding.primary_color;
    } else if (defaultBranding.button_variant === 'ghost') {
      style.backgroundColor = \`\${defaultBranding.primary_color}20\`;
      style.color = defaultBranding.primary_color;
    } else {
      style.backgroundColor = defaultBranding.primary_color;
    }

    if (defaultBranding.button_hover_transform) {
      style.transform = 'scale(1)';
    }

    return style;
  };

  const getFormWidthClass = () => {
    const widths = {
      narrow: 'max-w-sm',
      medium: 'max-w-md',
      wide: 'max-w-lg'
    };
    return widths[defaultBranding.form_width as keyof typeof widths] || widths.medium;
  };

  const getSpacingClass = () => {
    const spacings = {
      compact: 'space-y-2',
      normal: 'space-y-4',
      relaxed: 'space-y-6'
    };
    return spacings[defaultBranding.spacing as keyof typeof spacings] || spacings.normal;
  };

  // Show loading while checking IP
  if (checkingIP) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Show blocked screen if IP is blocked
  if (ipBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl border border-red-200 p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Acceso Bloqueado
            </h1>
            <p className="text-gray-600 mb-6">
              Tu dirección IP ha sido bloqueada temporalmente por razones de seguridad.
            </p>
            {blockedInfo && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Razón:</strong> {blockedInfo.reason}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Fecha:</strong> {new Date(blockedInfo.blocked_at).toLocaleString()}
                </p>
                {blockedInfo.expires_at && (
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Expira:</strong> {new Date(blockedInfo.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Si crees que esto es un error, por favor contacta al administrador del sistema.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Protegido por AuthSystem</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={getBackgroundStyle()}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ backgroundColor: defaultBranding.primary_color }}
        ></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ backgroundColor: defaultBranding.secondary_color }}
        ></div>
      </div>

      <div className={\`relative w-full \${getFormWidthClass()}\`}>
        {/* Logo and Header */}
        <div className="text-center mb-8">
          {defaultBranding.logo_url ? (
            <img
              src={defaultBranding.logo_url}
              alt="Logo"
              className="h-16 mx-auto mb-4"
            />
          ) : (
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: defaultBranding.primary_color }}
            >
              {appInfo?.name?.charAt(0) || 'A'}
            </div>
          )}
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: defaultBranding.text_color }}
          >
            {getFormTitle()}
          </h1>
          <p
            className="text-gray-600"
            style={{ color: defaultBranding.text_color }}
          >
            {getFormSubtitle()}
          </p>
        </div>

        {/* Auth Card */}
        <div
          className="p-8"
          style={getCardStyle()}
        >
          {/* Message */}
          {message && (
            <div className={\`mb-6 p-4 rounded-lg \${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }\`}>
              <div className="flex items-start space-x-3">
                {message.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={\`text-sm leading-relaxed \${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }\`}>
                    {message.text}
                  </p>
                  {formType === 'reset-password' && message.type === 'success' && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <a
                        href={buildNavUrl('/login')}
                        className="inline-flex items-center text-sm font-medium hover:underline transition-all"
                        style={{ color: defaultBranding.primary_color }}
                      >
                        <ArrowRight className="w-4 h-4 mr-1 rotate-180" />
                        Volver al inicio de sesi\u00f3n
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form - Hide if reset-password was successful */}
          {!(formType === 'reset-password' && message?.type === 'success') && (
          <form onSubmit={handleSubmit} className={getSpacingClass()}>
            {formType === 'register' && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('register_name_label', 'Nombre Completo')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={formType === 'register'}
                    className="w-full pl-10 pr-4 py-3 border focus:ring-2 focus:border-transparent transition-all"
                    style={{
                      ...getInputStyle(),
                      '--tw-ring-color': defaultBranding.input_focus_color
                    } as React.CSSProperties}
                    placeholder={getText('register_name_placeholder', 'Tu nombre completo')}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: defaultBranding.text_color }}
              >
                {formType === 'login' ? getText('login_email_label', 'Email') :
                 formType === 'register' ? getText('register_email_label', 'Email') :
                 getText('reset_email_label', 'Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border focus:ring-2 focus:border-transparent transition-all"
                  style={{
                    ...getInputStyle(),
                    '--tw-ring-color': defaultBranding.input_focus_color
                  } as React.CSSProperties}
                  placeholder={formType === 'login' ? getText('login_email_placeholder', 'tu@email.com') :
                              formType === 'register' ? getText('register_email_placeholder', 'tu@email.com') :
                              getText('reset_email_placeholder', 'tu@email.com')}
                />
              </div>
            </div>

            {formType !== 'reset-password' && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {formType === 'login' ? getText('login_password_label', 'Contraseña') :
                   getText('register_password_label', 'Contraseña')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-12 py-3 border focus:ring-2 focus:border-transparent transition-all"
                    style={{
                      ...getInputStyle(),
                      '--tw-ring-color': defaultBranding.input_focus_color
                    } as React.CSSProperties}
                    placeholder={formType === 'login' ? getText('login_password_placeholder', '••••••••') :
                                getText('register_password_placeholder', '••••••••')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {formType === 'register' && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('register_confirm_password_label', 'Confirmar Contraseña')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={formType === 'register'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                    style={{
                      borderRadius: \`\${defaultBranding.border_radius}px\`,
                      '--tw-ring-color': defaultBranding.primary_color
                    } as React.CSSProperties}
                    placeholder={getText('register_confirm_password_placeholder', '••••••••')}
                  />
                </div>
              </div>
            )}

            {formType === 'register' && availableRoles.length > 0 && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('role_selection_label', 'Tipo de Usuario')}
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border focus:ring-2 focus:border-transparent transition-all"
                  style={{
                    ...getInputStyle(),
                    '--tw-ring-color': defaultBranding.input_focus_color
                  } as React.CSSProperties}
                >
                  <option value="">{getText('role_selection_placeholder', 'Selecciona un rol')}</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.display_name}
                      {role.description && \` - \${role.description}\`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {getText('role_selection_description', 'Selecciona el tipo de acceso que necesitas en la aplicación')}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3 px-4 font-medium hover:opacity-90 hover:scale-105 focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              style={{
                ...getButtonStyle(),
                '--tw-ring-color': defaultBranding.primary_color
              } as React.CSSProperties}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{getFormTitle()}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          )}

          {/* Footer Links - Hide if reset-password was successful */}
          {!(formType === 'reset-password' && message?.type === 'success') && (
          <div className="mt-6 text-center space-y-2">
            {formType === 'login' && (
              <>
                <a
                  href={buildNavUrl('/reset-password')}
                  className="text-sm hover:underline"
                  style={{ color: defaultBranding.accent_color }}
                >
                  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
                </a>
                <p className="text-sm text-gray-600">
                  {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('Regístrate aquí')[0]}
                  <a
                    href={buildNavUrl('/register')}
                    className="hover:underline"
                    style={{ color: defaultBranding.accent_color }}
                  >
                    {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('? ')[1] || 'Regístrate aquí'}
                  </a>
                </p>
              </>
            )}
            {formType === 'register' && (
              <p className="text-sm text-gray-600">
                {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión').split('Inicia sesión')[0]}
                <a
                  href={buildNavUrl('/login')}
                  className="hover:underline"
                  style={{ color: defaultBranding.accent_color }}
                >
                  {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión').split('? ')[1] || 'Inicia sesión'}
                </a>
              </p>
            )}
            {formType === 'reset-password' && (
              <p className="text-sm text-gray-600">
                {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión').split('Inicia sesión')[0]}
                <a
                  href={buildNavUrl('/login')}
                  className="hover:underline"
                  style={{ color: defaultBranding.accent_color }}
                >
                  {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión').split('? ')[1] || 'Inicia sesión'}
                </a>
              </p>
            )}
          </div>
          )}
        </div>

        {/* Security Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>{getText('security_badge_text', 'Protegido por AuthSystem')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicAuthForms;
`;

    files['src/components/auth/BrandedPublicAuth.tsx'] = `import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Shield, AlertTriangle } from 'lucide-react';
import {
  BrandedContainer,
  BrandedCard,
  BrandedInput,
  BrandedButton,
  BrandedMessage,
  BrandedHeader
} from '../ui/BrandedComponents';
import { BrandingConfig } from '../../types';
import { getDefaultBrandingConfig } from '../../utils/themePresets';
import { validateAuthForm, rateLimiter, validatePassword } from '../../utils/securityValidation';

interface BrandedPublicAuthProps {
  applicationId: string;
  formType: 'login' | 'register' | 'reset-password';
  branding?: Partial<BrandingConfig>;
  onSubmit: (data: any) => Promise<void>;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function BrandedPublicAuth({
  applicationId,
  formType,
  branding: customBranding,
  onSubmit,
  onSuccess,
  onError
}: BrandedPublicAuthProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [messageStatus, setMessageStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong'>('weak');
  const [rateLimitInfo, setRateLimitInfo] = useState<{ blocked: boolean; timeLeft: number }>({ blocked: false, timeLeft: 0 });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Merge custom branding with defaults
  const branding: BrandingConfig = {
    ...getDefaultBrandingConfig(),
    ...customBranding
  };

  // Helper function to get custom text or fallback to default
  const getText = (key: string, defaultText: string): string => {
    const customTexts = (branding as any).custom_texts || {};
    return customTexts[key] || defaultText;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate password strength in real-time (only for register)
    if (field === 'password' && formType === 'register') {
      const validation = validatePassword(value);
      setPasswordStrength(validation.strength);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // 1. Rate limiting check (client-side)
    const rateLimitKey = \`auth-\${formType}-\${applicationId}\`;
    if (!rateLimiter.canAttempt(rateLimitKey, 5, 60000)) {
      const timeLeft = rateLimiter.getTimeUntilReset(rateLimitKey, 60000);
      const secondsLeft = Math.ceil(timeLeft / 1000);
      setErrorMessage(\`Demasiados intentos. Por favor espera \${secondsLeft} segundos.\`);
      setMessageStatus('error');
      setRateLimitInfo({ blocked: true, timeLeft });
      return;
    }

    // 2. Validate and sanitize form data
    const validation = validateAuthForm(formData, formType);
    if (!validation.valid) {
      const errorMessages = Object.values(validation.errors);
      setErrorMessage(errorMessages.join('. '));
      setMessageStatus('error');
      return;
    }

    try {
      setLoading(true);
      setMessageStatus('loading');

      // Use sanitized data
      await onSubmit(validation.sanitized);

      setMessageStatus('success');
      rateLimiter.reset(rateLimitKey); // Reset on success

      // Simulate redirect after success
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(validation.sanitized);
        }
      }, branding.redirect_delay || 2000);

    } catch (error: any) {
      setMessageStatus('error');
      setErrorMessage(error.message || 'Error al procesar la solicitud');
      if (onError) {
        onError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getFormTitle = () => {
    switch (formType) {
      case 'login':
        return getText('login_title', 'Iniciar Sesión');
      case 'register':
        return getText('register_title', 'Crear Cuenta');
      case 'reset-password':
        return getText('reset_title', 'Recuperar Contraseña');
      default:
        return 'Authentication';
    }
  };

  const getFormSubtitle = () => {
    switch (formType) {
      case 'login':
        return getText('login_subtitle', 'Ingresa tus credenciales');
      case 'register':
        return getText('register_subtitle', 'Regístrate para comenzar');
      case 'reset-password':
        return getText('reset_subtitle', 'Te enviaremos un email para recuperar tu contraseña');
      default:
        return '';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Procesando...';
    switch (formType) {
      case 'login':
        return getText('login_button_text', 'Iniciar Sesión');
      case 'register':
        return getText('register_button_text', 'Crear Cuenta');
      case 'reset-password':
        return getText('reset_button_text', 'Enviar Email de Recuperación');
      default:
        return 'Enviar';
    }
  };

  return (
    <BrandedContainer branding={branding}>
      <BrandedHeader
        branding={branding}
        logoUrl={branding.logo_url}
        title={getFormTitle()}
        subtitle={getFormSubtitle()}
      />

      <BrandedCard branding={branding}>
        <BrandedMessage
          status={messageStatus}
          branding={branding}
        />

        {/* Security Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-200 font-medium">Error de Seguridad</p>
              <p className="text-xs text-red-300/80 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Rate Limit Warning */}
        {rateLimitInfo.blocked && (
          <div className="mb-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
            <Shield className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-orange-200 font-medium">Límite de Intentos Alcanzado</p>
              <p className="text-xs text-orange-300/80 mt-1">
                Por seguridad, debes esperar antes de intentar nuevamente.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {formType === 'register' && (
            <BrandedInput
              type="text"
              id="name"
              label={getText('register_name_label', 'Nombre Completo')}
              placeholder={getText('register_name_placeholder', 'Tu nombre completo')}
              value={formData.name}
              onChange={handleChange('name')}
              branding={branding}
              icon={<User className="w-5 h-5" />}
            />
          )}

          <BrandedInput
            type="email"
            id="email"
            label={formType === 'login' ? getText('login_email_label', 'Email') :
                   formType === 'register' ? getText('register_email_label', 'Email') :
                   getText('reset_email_label', 'Email')}
            placeholder={formType === 'login' ? getText('login_email_placeholder', 'tu@email.com') :
                         formType === 'register' ? getText('register_email_placeholder', 'tu@email.com') :
                         getText('reset_email_placeholder', 'tu@email.com')}
            value={formData.email}
            onChange={handleChange('email')}
            branding={branding}
            icon={<Mail className="w-5 h-5" />}
          />

          {formType !== 'reset-password' && (
            <>
              <div>
                <BrandedInput
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  label={formType === 'login' ? getText('login_password_label', 'Contraseña') : getText('register_password_label', 'Contraseña')}
                  placeholder={formType === 'login' ? getText('login_password_placeholder', '••••••••') : getText('register_password_placeholder', '••••••••')}
                  value={formData.password}
                  onChange={handleChange('password')}
                  branding={branding}
                  icon={<Lock className="w-5 h-5" />}
                  showPasswordToggle
                  onPasswordToggle={() => setShowPassword(!showPassword)}
                  showPassword={showPassword}
                />

                {/* Password Strength Indicator (only for register) */}
                {formType === 'register' && formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={\`h-full transition-all duration-300 \${
                            passwordStrength === 'weak' ? 'w-1/4 bg-red-500' :
                            passwordStrength === 'medium' ? 'w-2/4 bg-orange-500' :
                            passwordStrength === 'strong' ? 'w-3/4 bg-yellow-500' :
                            'w-full bg-green-500'
                          }\`}
                        />
                      </div>
                      <span className={\`text-xs font-medium \${
                        passwordStrength === 'weak' ? 'text-red-400' :
                        passwordStrength === 'medium' ? 'text-orange-400' :
                        passwordStrength === 'strong' ? 'text-yellow-400' :
                        'text-green-400'
                      }\`}>
                        {passwordStrength === 'weak' ? 'Débil' :
                         passwordStrength === 'medium' ? 'Media' :
                         passwordStrength === 'strong' ? 'Fuerte' :
                         'Muy Fuerte'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Usa al menos 8 caracteres con mayúsculas, minúsculas, números y símbolos
                    </p>
                  </div>
                )}
              </div>

              {formType === 'register' && (
                <BrandedInput
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  label={getText('register_confirm_password_label', 'Confirmar Contraseña')}
                  placeholder={getText('register_confirm_password_placeholder', '••••••••')}
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  branding={branding}
                  icon={<Lock className="w-5 h-5" />}
                />
              )}
            </>
          )}

          <BrandedButton
            type="submit"
            branding={branding}
            disabled={loading}
            loading={loading}
          >
            <span className="flex items-center justify-center gap-2">
              {getButtonText()}
              <ArrowRight className="w-5 h-5" />
            </span>
          </BrandedButton>

          {/* Links */}
          <div className="flex items-center justify-between text-sm">
            {formType === 'login' && (
              <>
                <a href={\`/reset-password?app_id=\${applicationId}\`}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
                </a>
                <a href={\`/register?app_id=\${applicationId}\`}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('? ')[1] || 'Regístrate aquí'}
                </a>
              </>
            )}
            {formType === 'register' && (
              <a href={\`/login?app_id=\${applicationId}\`}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión')}
              </a>
            )}
            {formType === 'reset-password' && (
              <a href={\`/login?app_id=\${applicationId}\`}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión')}
              </a>
            )}
          </div>
        </form>
      </BrandedCard>

      {/* Footer */}
      <div className="mt-6 text-center text-sm" style={{ color: branding.text_color, opacity: 0.6 }}>
        Protected by AuthSystem
      </div>

      {/* Custom Styles */}
      <style>{\`
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes slideIn {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shadow-neumorphic {
          box-shadow: 8px 8px 16px rgba(163, 177, 198, 0.6),
                      -8px -8px 16px rgba(255, 255, 255, 0.5);
        }
        .shadow-neumorphic-inset {
          box-shadow: inset 4px 4px 8px rgba(163, 177, 198, 0.5),
                      inset -4px -4px 8px rgba(255, 255, 255, 0.5);
        }
      \`}</style>
    </BrandedContainer>
  );
}
`;

    files['src/components/ui/BrandedComponents.tsx'] = `import React from 'react';
import { Eye, EyeOff, Mail, Lock, User, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { BrandingConfig } from '../../types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getFormWidthClass(width?: string): string {
  switch (width) {
    case 'narrow': return 'max-w-sm';
    case 'wide': return 'max-w-2xl';
    default: return 'max-w-md';
  }
}

function getSpacingClass(spacing?: string): string {
  switch (spacing) {
    case 'compact': return 'space-y-4';
    case 'relaxed': return 'space-y-8';
    default: return 'space-y-6';
  }
}

function getShadowClass(intensity?: string, style?: string): string {
  if (style === 'neumorphic') {
    return 'shadow-neumorphic';
  }

  switch (intensity) {
    case 'none': return '';
    case 'light': return 'shadow-md';
    case 'strong': return 'shadow-2xl';
    default: return 'shadow-xl';
  }
}

function getAnimationDuration(speed?: string): string {
  switch (speed) {
    case 'slow': return 'duration-500';
    case 'fast': return 'duration-150';
    default: return 'duration-300';
  }
}

// ============================================================================
// BRANDED CONTAINER
// ============================================================================

interface BrandedContainerProps {
  branding: BrandingConfig;
  children: React.ReactNode;
}

export function BrandedContainer({ branding, children }: BrandedContainerProps) {
  const getBackgroundStyle = () => {
    if (branding.use_gradient && branding.gradient_start && branding.gradient_end) {
      return {
        background: \`linear-gradient(135deg, \${branding.gradient_start}, \${branding.gradient_end})\`
      };
    }
    return {
      background: branding.background_color || '#F9FAFB'
    };
  };

  const containerClass = \`min-h-screen flex items-center justify-center p-8 \${
    branding.blur_background ? 'relative overflow-hidden' : ''
  }\`;

  return (
    <div className={containerClass} style={getBackgroundStyle()}>
      {/* Animated Background Blobs for glass/gradient themes */}
      {branding.blur_background && (
        <>
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"
            style={{ backgroundColor: branding.primary_color }}></div>
          <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"
            style={{ backgroundColor: branding.secondary_color, animationDelay: '1000ms' }}></div>
        </>
      )}

      <div className={\`relative w-full \${getFormWidthClass(branding.form_width)}\`}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// BRANDED CARD
// ============================================================================

interface BrandedCardProps {
  branding: BrandingConfig;
  children: React.ReactNode;
}

export function BrandedCard({ branding, children }: BrandedCardProps) {
  const getCardClass = () => {
    const baseClass = \`p-8 \${branding.button_style === 'rounded' ? \`rounded-\${branding.border_radius || 16}px\` : ''}\`;
    const shadowClass = getShadowClass(branding.shadow_intensity, branding.card_style);

    let styleClass = '';
    switch (branding.card_style) {
      case 'glass':
        styleClass = 'backdrop-blur-2xl border';
        break;
      case 'flat':
        styleClass = 'border';
        break;
      case 'neumorphic':
        styleClass = 'shadow-neumorphic';
        break;
      case 'elevated':
      default:
        styleClass = shadowClass;
        break;
    }

    return \`\${baseClass} \${styleClass}\`;
  };

  const getCardStyle = () => {
    const style: React.CSSProperties = {
      borderRadius: \`\${branding.border_radius || 16}px\`
    };

    if (branding.card_style === 'glass') {
      style.background = branding.card_background || 'rgba(255, 255, 255, 0.1)';
      style.borderColor = 'rgba(255, 255, 255, 0.2)';
      if (branding.card_blur) {
        style.backdropFilter = \`blur(\${branding.card_blur}px)\`;
      }
    } else {
      style.background = branding.card_background || '#FFFFFF';
    }

    return style;
  };

  return (
    <div className={getCardClass()} style={getCardStyle()}>
      {children}
    </div>
  );
}

// ============================================================================
// BRANDED INPUT
// ============================================================================

interface BrandedInputProps {
  type: string;
  id?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  branding: BrandingConfig;
  icon?: React.ReactNode;
  label?: string;
  showPasswordToggle?: boolean;
  onPasswordToggle?: () => void;
  showPassword?: boolean;
}

export function BrandedInput({
  type,
  id,
  placeholder,
  value,
  onChange,
  branding,
  icon,
  label,
  showPasswordToggle,
  onPasswordToggle,
  showPassword
}: BrandedInputProps) {
  const getInputClass = () => {
    const baseClass = \`w-full transition-all \${getAnimationDuration(branding.animation_speed)}\`;
    const iconClass = icon ? 'pl-12' : 'pl-4';
    const rightIconClass = showPasswordToggle ? 'pr-12' : 'pr-4';

    switch (branding.input_style) {
      case 'underlined':
        return \`\${baseClass} px-0 py-3 bg-transparent border-0 border-b-2 focus:outline-none peer\`;
      case 'filled':
        return \`\${baseClass} \${iconClass} \${rightIconClass} py-4 border-2 focus:outline-none\`;
      case 'outlined':
      default:
        return \`\${baseClass} \${iconClass} \${rightIconClass} py-3.5 border focus:outline-none focus:ring-2\`;
    }
  };

  const getInputStyle = () => {
    const style: React.CSSProperties = {
      color: branding.text_color || '#1F2937'
    };

    if (branding.input_style === 'underlined') {
      style.borderColor = branding.input_border_color || '#D1D5DB';
    } else {
      style.background = branding.input_background || '#F9FAFB';
      style.borderColor = branding.input_border_color || 'transparent';
      if (branding.button_style === 'rounded') {
        style.borderRadius = \`\${branding.border_radius || 12}px\`;
      }
    }

    return style;
  };

  const labelClass = branding.input_style === 'underlined'
    ? 'absolute left-0 -top-6 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-3 peer-focus:-top-6 peer-focus:text-sm'
    : 'block text-sm font-medium mb-2';

  return (
    <div className="space-y-2">
      {label && branding.input_style !== 'underlined' && (
        <label htmlFor={id} className={labelClass} style={{ color: branding.text_color }}>
          {label}
        </label>
      )}

      <div className="relative group">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <div style={{ color: branding.input_border_color }}>{icon}</div>
          </div>
        )}

        <input
          type={type}
          id={id}
          className={getInputClass()}
          style={getInputStyle()}
          placeholder={branding.input_style === 'underlined' ? ' ' : placeholder}
          value={value}
          onChange={onChange}
        />

        {branding.input_style === 'underlined' && label && (
          <label htmlFor={id} className={labelClass} style={{ color: branding.text_color }}>
            {label}
          </label>
        )}

        {showPasswordToggle && (
          <button
            type="button"
            onClick={onPasswordToggle}
            className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors"
            style={{ color: branding.input_border_color }}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BRANDED BUTTON
// ============================================================================

interface BrandedButtonProps {
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  branding: BrandingConfig;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

export function BrandedButton({
  type = 'button',
  onClick,
  children,
  branding,
  variant = 'primary',
  disabled,
  loading
}: BrandedButtonProps) {
  const getButtonClass = () => {
    const baseClass = \`w-full font-semibold transition-all \${getAnimationDuration(branding.animation_speed)}\`;
    const transformClass = branding.button_hover_transform && branding.enable_animations
      ? 'transform hover:scale-[1.02] active:scale-[0.98]'
      : '';
    const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

    let sizeClass = '';
    switch (branding.button_size) {
      case 'small': sizeClass = 'py-2 text-sm'; break;
      case 'large': sizeClass = 'py-5 text-lg'; break;
      default: sizeClass = 'py-4'; break;
    }

    return \`\${baseClass} \${sizeClass} \${transformClass} \${disabledClass}\`;
  };

  const getButtonStyle = () => {
    const style: React.CSSProperties = {};

    if (branding.button_style === 'rounded') {
      style.borderRadius = \`\${branding.border_radius || 12}px\`;
    }

    if (variant === 'primary') {
      if (branding.button_variant === 'gradient' && branding.gradient_start && branding.gradient_end) {
        style.background = \`linear-gradient(135deg, \${branding.gradient_start}, \${branding.gradient_end})\`;
        style.color = '#FFFFFF';
      } else {
        style.background = branding.primary_color || '#3B82F6';
        style.color = '#FFFFFF';
      }
    } else {
      style.background = branding.secondary_color || '#6B7280';
      style.color = '#FFFFFF';
    }

    if (branding.shadow_intensity && branding.shadow_intensity !== 'none') {
      style.boxShadow = \`0 4px 14px 0 \${branding.primary_color}30\`;
    }

    return style;
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={getButtonClass()}
      style={getButtonStyle()}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ============================================================================
// BRANDED MESSAGE
// ============================================================================

type MessageStatus = 'idle' | 'loading' | 'success' | 'error';

interface BrandedMessageProps {
  status: MessageStatus;
  branding: BrandingConfig;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  errorHelpText?: string;
}

export function BrandedMessage({
  status,
  branding,
  loadingText,
  successText,
  errorText,
  errorHelpText
}: BrandedMessageProps) {
  if (status === 'idle') return null;

  const getMessage = () => {
    switch (status) {
      case 'loading':
        return loadingText || branding.message_loading_text || 'Processing...';
      case 'success':
        return successText || branding.message_success_text || 'Success!';
      case 'error':
        return errorText || branding.message_error_text || 'An error occurred';
      default:
        return '';
    }
  };

  const getHelpText = () => {
    if (status === 'error') {
      return errorHelpText || branding.message_error_help_text;
    }
    return null;
  };

  const getMessageClass = () => {
    let baseClass = \`mb-6 p-4 transition-all duration-500 \${
      branding.button_style === 'rounded' ? \`rounded-\${branding.border_radius || 16}px\` : 'rounded-lg'
    }\`;

    if (branding.card_style === 'glass') {
      baseClass += ' backdrop-blur-xl border';
    }

    const animClass = status === 'loading' ? 'animate-pulse'
      : status === 'success' ? 'animate-slideIn'
      : 'animate-shake';

    return \`\${baseClass} \${animClass}\`;
  };

  const getMessageStyle = (): React.CSSProperties => {
    let backgroundColor = '';
    let borderColor = '';

    switch (status) {
      case 'loading':
        backgroundColor = branding.message_loading_bg || '#DBEAFE';
        borderColor = 'rgba(59, 130, 246, 0.3)';
        break;
      case 'success':
        backgroundColor = branding.message_success_bg || '#D1FAE5';
        borderColor = 'rgba(16, 185, 129, 0.3)';
        break;
      case 'error':
        backgroundColor = branding.message_error_bg || '#FEE2E2';
        borderColor = 'rgba(239, 68, 68, 0.3)';
        break;
    }

    return {
      backgroundColor,
      borderColor,
      color: branding.text_color
    };
  };

  const getIcon = () => {
    const iconClass = "w-6 h-6";
    const iconStyle = { color: branding.text_color };

    switch (status) {
      case 'loading':
        return <Loader2 className={\`\${iconClass} animate-spin\`} style={iconStyle} />;
      case 'success':
        return <CheckCircle className={iconClass} style={iconStyle} />;
      case 'error':
        return <XCircle className={iconClass} style={iconStyle} />;
      default:
        return null;
    }
  };

  return (
    <div className={getMessageClass()} style={getMessageStyle()}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1">
          <p className="font-medium">{getMessage()}</p>
          {getHelpText() && (
            <p className="text-sm mt-1 opacity-80">{getHelpText()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BRANDED HEADER
// ============================================================================

interface BrandedHeaderProps {
  branding: BrandingConfig;
  logoUrl?: string;
  title: string;
  subtitle?: string;
}

export function BrandedHeader({ branding, logoUrl, title, subtitle }: BrandedHeaderProps) {
  return (
    <div className="text-center mb-8">
      {logoUrl && (
        <div className="inline-flex items-center justify-center w-20 h-20 mb-6"
          style={{
            borderRadius: branding.button_style === 'rounded' ? \`\${branding.border_radius || 16}px\` : '4px'
          }}>
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
        </div>
      )}
      <h1 className="text-3xl font-bold mb-2" style={{
        color: branding.text_color,
        fontFamily: branding.heading_font_family || branding.font_family
      }}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-lg opacity-80" style={{ color: branding.text_color }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
`;

    files['src/utils/themePresets.ts'] = `import { ThemePreset, BrandingConfig } from '../types';

export const themePresets: ThemePreset[] = [
  {
    name: 'modern-glass',
    label: 'Modern Glass',
    description: 'Glassmorphism effect with blur and transparencies',
    config: {
      theme_style: 'modern-glass',
      primary_color: '#3B82F6',
      secondary_color: '#8B5CF6',
      accent_color: '#EC4899',
      background_color: '#FFFFFF',
      text_color: '#FFFFFF',
      gradient_start: '#3B82F6',
      gradient_end: '#EC4899',
      error_color: '#EF4444',
      success_color: '#10B981',
      warning_color: '#F59E0B',
      font_family: 'Inter',
      heading_font_family: 'Inter',
      font_size_scale: 'medium',
      card_style: 'glass',
      card_background: 'rgba(255, 255, 255, 0.1)',
      card_blur: 20,
      input_style: 'outlined',
      input_background: 'rgba(255, 255, 255, 0.1)',
      input_border_color: 'rgba(255, 255, 255, 0.2)',
      input_focus_color: 'rgba(255, 255, 255, 0.4)',
      button_style: 'rounded',
      button_variant: 'solid',
      button_size: 'medium',
      button_hover_transform: true,
      border_radius: 16,
      shadow_intensity: 'strong',
      use_gradient: true,
      glass_effect: true,
      blur_background: true,
      enable_animations: true,
      animation_speed: 'normal',
      form_width: 'medium',
      spacing: 'normal',
      message_loading_text: 'Authenticating...',
      message_success_text: 'Welcome back! Redirecting to your dashboard...',
      message_error_text: 'Invalid credentials. Please check your email and password.',
      message_error_help_text: 'Please try again or reset your password',
      redirect_delay: 2000,
      message_loading_bg: 'rgba(59, 130, 246, 0.2)',
      message_success_bg: 'rgba(16, 185, 129, 0.2)',
      message_error_bg: 'rgba(239, 68, 68, 0.2)'
    }
  },
  {
    name: 'minimal-clean',
    label: 'Minimal Clean',
    description: 'Minimalist design with clean lines',
    config: {
      theme_style: 'minimal-clean',
      primary_color: '#1F2937',
      secondary_color: '#6B7280',
      accent_color: '#1F2937',
      background_color: '#F9FAFB',
      text_color: '#1F2937',
      error_color: '#DC2626',
      success_color: '#059669',
      warning_color: '#D97706',
      font_family: 'Inter',
      heading_font_family: 'Inter',
      font_size_scale: 'medium',
      card_style: 'flat',
      card_background: '#FFFFFF',
      card_blur: 0,
      input_style: 'underlined',
      input_background: 'transparent',
      input_border_color: '#D1D5DB',
      input_focus_color: '#1F2937',
      button_style: 'square',
      button_variant: 'solid',
      button_size: 'medium',
      button_hover_transform: false,
      border_radius: 0,
      shadow_intensity: 'none',
      use_gradient: false,
      glass_effect: false,
      blur_background: false,
      enable_animations: true,
      animation_speed: 'normal',
      form_width: 'medium',
      spacing: 'relaxed',
      message_loading_text: 'Authenticating...',
      message_success_text: 'Welcome back! Redirecting to your dashboard...',
      message_error_text: 'Invalid credentials. Please check your email and password.',
      message_error_help_text: 'Double-check your credentials and try again',
      redirect_delay: 2000,
      message_loading_bg: '#DBEAFE',
      message_success_bg: '#D1FAE5',
      message_error_bg: '#FEE2E2'
    }
  },
  {
    name: 'corporate',
    label: 'Corporate Professional',
    description: 'Professional corporate style with pronounced shadows',
    config: {
      theme_style: 'corporate',
      primary_color: '#2563EB',
      secondary_color: '#1E40AF',
      accent_color: '#3B82F6',
      background_color: '#F1F5F9',
      text_color: '#1E293B',
      error_color: '#DC2626',
      success_color: '#16A34A',
      warning_color: '#EA580C',
      font_family: 'Inter',
      heading_font_family: 'Inter',
      font_size_scale: 'medium',
      card_style: 'elevated',
      card_background: '#FFFFFF',
      card_blur: 0,
      input_style: 'filled',
      input_background: '#F8FAFC',
      input_border_color: 'transparent',
      input_focus_color: '#2563EB',
      button_style: 'rounded',
      button_variant: 'solid',
      button_size: 'medium',
      button_hover_transform: false,
      border_radius: 12,
      shadow_intensity: 'strong',
      use_gradient: false,
      glass_effect: false,
      blur_background: false,
      enable_animations: true,
      animation_speed: 'normal',
      form_width: 'medium',
      spacing: 'normal',
      message_loading_text: 'Authenticating...',
      message_success_text: 'Welcome back! Redirecting to your dashboard...',
      message_error_text: 'Invalid credentials. Please check your email and password.',
      message_error_help_text: 'Please verify your credentials and try again',
      redirect_delay: 2000,
      message_loading_bg: '#DBEAFE',
      message_success_bg: '#DCFCE7',
      message_error_bg: '#FEE2E2'
    }
  },
  {
    name: 'gradient-bold',
    label: 'Gradient Bold',
    description: 'Vibrant gradients with modern effects',
    config: {
      theme_style: 'gradient-bold',
      primary_color: '#06B6D4',
      secondary_color: '#3B82F6',
      accent_color: '#8B5CF6',
      background_color: '#0F172A',
      text_color: '#FFFFFF',
      gradient_start: '#06B6D4',
      gradient_end: '#8B5CF6',
      error_color: '#EF4444',
      success_color: '#10B981',
      warning_color: '#F59E0B',
      font_family: 'Inter',
      heading_font_family: 'Inter',
      font_size_scale: 'medium',
      card_style: 'glass',
      card_background: 'rgba(15, 23, 42, 0.5)',
      card_blur: 20,
      input_style: 'outlined',
      input_background: 'rgba(15, 23, 42, 0.5)',
      input_border_color: '#334155',
      input_focus_color: '#06B6D4',
      button_style: 'rounded',
      button_variant: 'gradient',
      button_size: 'medium',
      button_hover_transform: true,
      border_radius: 16,
      shadow_intensity: 'strong',
      use_gradient: true,
      glass_effect: true,
      blur_background: true,
      enable_animations: true,
      animation_speed: 'normal',
      form_width: 'medium',
      spacing: 'normal',
      message_loading_text: 'Authenticating...',
      message_success_text: 'Welcome back! Redirecting to your dashboard...',
      message_error_text: 'Invalid credentials. Please check your email and password.',
      message_error_help_text: 'Verify your information and try again',
      redirect_delay: 2000,
      message_loading_bg: 'linear-gradient(to right, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
      message_success_bg: 'linear-gradient(to right, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
      message_error_bg: 'linear-gradient(to right, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))'
    }
  },
  {
    name: 'neumorphic',
    label: 'Neumorphic Soft',
    description: 'Soft UI with subtle shadows',
    config: {
      theme_style: 'neumorphic',
      primary_color: '#3B82F6',
      secondary_color: '#60A5FA',
      accent_color: '#2563EB',
      background_color: '#E5E7EB',
      text_color: '#1F2937',
      error_color: '#EF4444',
      success_color: '#10B981',
      warning_color: '#F59E0B',
      font_family: 'Inter',
      heading_font_family: 'Inter',
      font_size_scale: 'medium',
      card_style: 'neumorphic',
      card_background: 'linear-gradient(145deg, #E5E7EB, #D1D5DB)',
      card_blur: 0,
      input_style: 'filled',
      input_background: 'linear-gradient(145deg, #E5E7EB, #D1D5DB)',
      input_border_color: 'transparent',
      input_focus_color: '#3B82F6',
      button_style: 'rounded',
      button_variant: 'solid',
      button_size: 'medium',
      button_hover_transform: true,
      border_radius: 16,
      shadow_intensity: 'medium',
      use_gradient: false,
      glass_effect: false,
      blur_background: false,
      enable_animations: true,
      animation_speed: 'normal',
      form_width: 'medium',
      spacing: 'normal',
      message_loading_text: 'Authenticating...',
      message_success_text: 'Welcome back! Redirecting to your dashboard...',
      message_error_text: 'Invalid credentials. Please check your email and password.',
      message_error_help_text: 'Please check your credentials and try again',
      redirect_delay: 2000,
      message_loading_bg: '#DBEAFE',
      message_success_bg: '#D1FAE5',
      message_error_bg: '#FEE2E2'
    }
  }
];

export function getThemePreset(name: string): ThemePreset | undefined {
  return themePresets.find(theme => theme.name === name);
}

export function applyThemePreset(name: string, currentConfig: Partial<BrandingConfig>): BrandingConfig {
  const preset = getThemePreset(name);
  if (!preset) {
    return currentConfig as BrandingConfig;
  }

  return {
    ...currentConfig,
    ...preset.config
  } as BrandingConfig;
}

export function getDefaultBrandingConfig(): BrandingConfig {
  return {
    theme_style: 'corporate',
    primary_color: '#2563EB',
    secondary_color: '#1E40AF',
    accent_color: '#3B82F6',
    background_color: '#F1F5F9',
    text_color: '#1E293B',
    error_color: '#DC2626',
    success_color: '#16A34A',
    warning_color: '#EA580C',
    font_family: 'Inter',
    heading_font_family: 'Inter',
    font_size_scale: 'medium',
    card_style: 'elevated',
    card_background: '#FFFFFF',
    card_blur: 0,
    input_style: 'filled',
    input_background: '#F8FAFC',
    input_border_color: 'transparent',
    input_focus_color: '#2563EB',
    button_style: 'rounded',
    button_variant: 'solid',
    button_size: 'medium',
    button_hover_transform: false,
    border_radius: 12,
    shadow_intensity: 'medium',
    use_gradient: false,
    glass_effect: false,
    blur_background: false,
    enable_animations: true,
    animation_speed: 'normal',
    form_width: 'medium',
    spacing: 'normal',
    message_loading_text: 'Authenticating...',
    message_success_text: 'Welcome back! Redirecting to your dashboard...',
    message_error_text: 'Invalid credentials. Please check your email and password.',
    message_error_help_text: 'Please verify your credentials and try again',
    redirect_delay: 2000,
    message_loading_bg: '#DBEAFE',
    message_success_bg: '#DCFCE7',
    message_error_bg: '#FEE2E2'
  };
}
`;
    // === TEMPLATES END ===
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
