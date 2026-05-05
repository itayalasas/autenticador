// This file contains the PublicAuthForms component as a template string
// It's used by projectFilesHelper to generate the component file
// IMPORTANT: This must be kept in sync with src/components/auth/PublicAuthForms.tsx

export const PUBLIC_AUTH_FORMS_TEMPLATE = `import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Shield, Smartphone, QrCode, CheckCircle2, Copy, Apple } from 'lucide-react';
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
    favicon_url?: string;
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
  const [mfaSetupData, setMfaSetupData] = useState<any | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<1 | 2 | 3>(1);
  const [mfaSetupPolling, setMfaSetupPolling] = useState(false);
  const [mfaSetupLinked, setMfaSetupLinked] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [allowPublicRegistration, setAllowPublicRegistration] = useState<boolean>(true);
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
  const activeSetupPollRunRef = React.useRef(0);

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
    favicon_url: branding?.favicon_url || '',
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
    const loadAppFlag = async () => {
      if (!applicationId) return;
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://sfqtmnncgiqkveaoqckt.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ'
        );
        const { data: app } = await supabase
          .from('applications')
          .select('metadata')
          .eq('application_id', applicationId)
          .maybeSingle();
        if (app) {
          const meta: any = app.metadata || {};
          setAllowPublicRegistration(meta.allow_public_registration !== false);
        }
      } catch (e) {
        console.error('Error loading app flag:', e);
      }
    };
    loadAppFlag();
  }, [applicationId]);

  useEffect(() => {
    if (!defaultBranding.favicon_url) return;

    const faviconUrl = defaultBranding.favicon_url;
    const isData = faviconUrl.startsWith('data:');
    const href = isData
      ? faviconUrl
      : \`\${faviconUrl}\${faviconUrl.includes('?') ? '&' : '?'}fv=\${Date.now()}\`;

    const detectType = (url: string) => {
      const normalized = url.toLowerCase();
      if (normalized.startsWith('data:image/')) {
        const match = normalized.match(/^data:(image\\/[a-z0-9+.-]+);/i);
        return match?.[1] || 'image/png';
      }
      if (normalized.endsWith('.svg')) return 'image/svg+xml';
      if (normalized.endsWith('.ico')) return 'image/x-icon';
      if (normalized.endsWith('.webp')) return 'image/webp';
      if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
      if (normalized.endsWith('.gif')) return 'image/gif';
      return 'image/png';
    };

    const type = detectType(faviconUrl);
    const upsert = (rel: string) => {
      let link = document.querySelector(\`link[rel='\${rel}']\`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.type = type;
      link.href = href;
    };

    upsert('icon');
    upsert('shortcut icon');
  }, [defaultBranding.favicon_url]);

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

  const startMfaSetupPolling = (pairingToken: string) => {
    const runId = ++activeSetupPollRunRef.current;
    setMfaSetupPolling(true);
    setMfaSetupLinked(false);

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runPolling = async () => {
      const supabaseUrl = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
      const pollingEndpoint = supabaseUrl + '/functions/v1/mfa-check-pairing-token';

      for (let attempt = 0; attempt < 90; attempt += 1) {
        if (activeSetupPollRunRef.current !== runId) return;
        await wait(2000);

        const checkResponse = await fetch(pollingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + supabaseAnonKey,
            'apikey': supabaseAnonKey,
            'X-Client-Info': 'authsystem-public-form/1.0'
          },
          body: JSON.stringify({ pairing_token: pairingToken, application_id: applicationId })
        });

        const checkResult = await checkResponse.json();
        if (!checkResult?.success) continue;

        const pairingStatus = checkResult?.data?.status;
        if (pairingStatus === 'linked') {
          setMfaSetupLinked(true);
          return;
        }

        if (pairingStatus === 'expired') {
          setMessage({ type: 'error', text: 'El código de vinculación expiró. Inicia sesión nuevamente para generar otro.' });
          return;
        }

        if (pairingStatus === 'invalid') {
          setMessage({ type: 'error', text: 'No se pudo validar el token de vinculación.' });
          return;
        }
      }
    };

    runPolling().finally(() => {
      if (activeSetupPollRunRef.current === runId) {
        setMfaSetupPolling(false);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMfaSetupData(null);
    setMfaSetupStep(1);
    setMfaSetupLinked(false);
    setMfaSetupPolling(false);
    activeSetupPollRunRef.current += 1;

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

      // Use Supabase Edge Functions URL (hardcoded for production)
      const supabaseUrl = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
      const apiBaseUrl = \`\${supabaseUrl}/functions/v1\`;

      console.log('🔧 Configuration:', {
        supabaseUrl,
        apiBaseUrl,
        applicationId,
        apiKey: apiKey.substring(0, 20) + '...',
        callbackUrl
      });

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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + supabaseAnonKey.substring(0, 30) + '...',
          'apikey': supabaseAnonKey.substring(0, 30) + '...',
          'X-Client-Info': 'authsystem-public-form/1.0'
        },
        payload: { ...payload, password: '***' }
      });

      // Llamar a la Edge Function de Supabase
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

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
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

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const completeSuccessfulLogin = async (loginData: any) => {
        if (loginData?.callback_url) {
          console.log('🔄 Redirecting to callback URL:', loginData.callback_url);
          setTimeout(() => {
            window.location.href = loginData.callback_url;
          }, 1500);
          return;
        }

        if (loginData?.access_token) {
          localStorage.setItem('auth_token', loginData.access_token);
          localStorage.setItem('refresh_token', loginData.refresh_token);
          if (loginData?.user) {
            localStorage.setItem('user_data', JSON.stringify(loginData.user));
          }
          console.log('💾 Tokens guardados en localStorage');
        }
      };

      if (!result.success) {
        console.log('❌ Authentication failed:', result.error);

        if (formType === 'login' && result.error?.code === 'MFA_REQUIRED') {
          const challengeId = result.data?.challenge_id;
          const challengeCode = result.data?.challenge_code;

          if (!challengeId) {
            throw new Error('Desafío MFA inválido: falta challenge_id');
          }

          setMessage({
            type: 'success',
            text: 'Doble factor requerido. Abre tu app Authenticator y aprueba el acceso. Código: ' + (challengeCode || 'N/A')
          });

          const pollingEndpoint = apiBaseUrl + '/mfa-check-challenge';
          const maxAttempts = 60;

          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await wait(2000);

            const checkResponse = await fetch(pollingEndpoint, {

          (async () => {
            for (let attempt = 0; attempt < 60; attempt += 1) {
              await wait(2000);

              const checkResponse = await fetch(pollingEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + supabaseAnonKey,
                  'apikey': supabaseAnonKey,
                  'X-Client-Info': 'authsystem-public-form/1.0'
                },
                body: JSON.stringify({
                  challenge_id: challengeId,
                  application_id: applicationId
                })
              });

              const checkResult = await checkResponse.json();
              const challengeStatus = checkResult?.data?.status;

              if (!checkResult?.success || challengeStatus === 'pending') {
                continue;
              }

              if (challengeStatus === 'approved') {
                setMessage({ type: 'success', text: 'Aprobación recibida. Iniciando sesión...' });
                await completeSuccessfulLogin(checkResult.data);
                if (onSuccess) {
                  onSuccess(checkResult.data);
                }
                return;
              }

              if (challengeStatus === 'rejected') {
                setMessage({ type: 'error', text: 'Aprobación rechazada desde la app Authenticator.' });
                return;
              }

              if (challengeStatus === 'expired') {
                setMessage({ type: 'error', text: 'El desafío MFA expiró. Inicia sesión nuevamente.' });
                return;
              }

              if (challengeStatus === 'approved_consumed') {
                setMessage({ type: 'error', text: 'El desafío MFA ya fue consumido. Inicia sesión nuevamente.' });
                return;
              }
            }

            setMessage({ type: 'error', text: 'Tiempo de espera agotado para la aprobación MFA.' });
          })();

          return;
          setMessage(null);

          const pairingToken = result.data?.pairing_token;
          if (pairingToken) {
            startMfaSetupPolling(pairingToken);
          }
          return;
        }

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

        await completeSuccessfulLogin(result.data);
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

  const isMfaSetupFlow = formType === 'login' && !!mfaSetupData;

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
          {message && !isMfaSetupFlow && (
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
            {formType === 'login' && mfaSetupData && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 leading-tight">Activa la verificación en dos pasos</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Protege tu cuenta con la app Authenticator</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {[1, 2, 3].map((s) => {
                      const done = mfaSetupStep > s || mfaSetupLinked;
                      const active = mfaSetupStep === s && !mfaSetupLinked;
                      return (
                        <div key={s} className="flex-1 flex items-center gap-2">
                          <div className={\`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors \${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}\`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : s}
                          </div>
                          {s < 3 && <div className={\`flex-1 h-0.5 rounded-full \${done ? 'bg-emerald-500' : 'bg-slate-200'}\`} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    <span className={mfaSetupStep === 1 && !mfaSetupLinked ? 'text-blue-700' : ''}>Instalar</span>
                    <span className={\`text-center \${mfaSetupStep === 2 && !mfaSetupLinked ? 'text-blue-700' : ''}\`}>Descargar</span>
                    <span className={\`text-right \${mfaSetupStep === 3 && !mfaSetupLinked ? 'text-blue-700' : ''}\`}>Vincular</span>
                  </div>
                </div>
                <div className="p-6">

                {!mfaSetupLinked && mfaSetupStep === 1 && (
                  <>
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto mb-4">
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <h5 className="text-center text-slate-900 font-semibold mb-1">Necesitas la app Authenticator</h5>
                    <p className="text-sm text-slate-600 text-center mb-5 leading-relaxed">
                      Para continuar debes vincular tu cuenta con nuestra app oficial Authenticator. Instálala en tu móvil y aprueba el acceso cada vez que inicies sesión.
                    </p>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setMfaSetupStep(2)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                        Siguiente
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {!mfaSetupLinked && mfaSetupStep === 2 && (
                  <>
                    <h5 className="text-slate-900 font-semibold mb-1">Descarga la app en tu móvil</h5>
                    <p className="text-sm text-slate-600 mb-5">Elige tu tienda y descarga la app Authenticator oficial.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      <a href="https://play.google.com/store" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors">
                        <svg viewBox="0 0 512 512" className="w-7 h-7 shrink-0" aria-hidden="true">
                          <path fill="#00D1FF" d="M325.3 234.3L104.5 13.5l255.7 147.6-35 73.2z" />
                          <path fill="#FFD400" d="M393 256L104 92.3v327.4L393 256z" />
                          <path fill="#FF3A44" d="M325.3 277.7l35 73.2L104.5 498.5 325.3 277.7z" />
                          <path fill="#00F076" d="M104.5 13.5L325.3 234.3 104.5 498.5V13.5z" />
                        </svg>
                        <div className="flex-1 leading-tight">
                          <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wide">Descargar en</p>
                          <p className="text-sm font-semibold text-white">Google Play</p>
                        </div>
                      </a>
                      <a href="https://www.apple.com/app-store/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors">
                        <Apple className="w-7 h-7 text-white shrink-0" />
                        <div className="flex-1 leading-tight">
                          <p className="text-[10px] font-medium text-slate-300 uppercase tracking-wide">Descargar en</p>
                          <p className="text-sm font-semibold text-white">App Store</p>
                        </div>
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <button type="button" onClick={() => setMfaSetupStep(1)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                        Atrás
                      </button>
                      <button type="button" onClick={() => setMfaSetupStep(3)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                        Ya la instalé
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {!mfaSetupLinked && mfaSetupStep === 3 && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <QrCode className="w-4 h-4 text-blue-600" />
                      <h5 className="text-slate-900 font-semibold">Escanea el código QR</h5>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Abre la app Authenticator oficial de este sistema y escanea el código para vincular tu cuenta.
                    </p>
                    {mfaSetupData?.qr_text && (
                      <div className="mx-auto mb-4 w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <img src={'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(mfaSetupData.qr_text)} alt="QR de configuración MFA" className="w-44 h-44" />
                      </div>
                    )}
                    {mfaSetupData?.pairing_token && (
                      <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">¿No puedes escanear? Pega este token</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs break-all text-slate-800 font-mono">{mfaSetupData.pairing_token}</code>
                          <button type="button" onClick={() => navigator.clipboard?.writeText(mfaSetupData.pairing_token)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0" title="Copiar token">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    <button type="button" onClick={() => setMfaSetupStep(2)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                      Atrás
                    </button>
                  </>
                )}

                {mfaSetupPolling && !mfaSetupLinked && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Esperando confirmación de vinculación desde el móvil...
                  </div>
                )}

                {mfaSetupLinked && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-emerald-900">Dispositivo vinculado correctamente</p>
                        <button type="button" onClick={async () => { await handleSubmit({ preventDefault: () => {} } as React.FormEvent); }} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                          Continuar
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}

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

            {!isMfaSetupFlow && (
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
            )}

            {!isMfaSetupFlow && formType !== 'reset-password' && (
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

            {!isMfaSetupFlow && (
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
            )}
          </form>
          )}

          {/* Footer Links - Hide if reset-password was successful */}
          {!(formType === 'reset-password' && message?.type === 'success') && !isMfaSetupFlow && (
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
                {allowPublicRegistration && (
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
                )}
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
