import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { rolesService } from '../../services/rolesService';
import { applicationService } from '../../services/applicationService';
import { ipService } from '../../services/ipService';
import { applyFaviconToDocument } from '../../utils/favicon';

interface PublicAuthFormsProps {
  applicationId: string;
  internalApplicationId?: string;
  formType: 'login' | 'register' | 'reset-password' | 'reset-password-confirm';
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
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaChallengeCode, setMfaChallengeCode] = useState<string>('');
  const [mfaManualCode, setMfaManualCode] = useState('');
  const [mfaPolling, setMfaPolling] = useState(false);
  const [mfaSetupPolling, setMfaSetupPolling] = useState(false);
  const [mfaSetupLinked, setMfaSetupLinked] = useState(false);
  const [mfaVerifyingCode, setMfaVerifyingCode] = useState(false);
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
  const activePollRunRef = React.useRef(0);
  const activeSetupPollRunRef = React.useRef(0);

  const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
  const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

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
    applyFaviconToDocument(defaultBranding.favicon_url);
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
      console.log('🔍 Checking roles loading:', {
        formType,
        internalApplicationId,
        shouldLoadRoles: formType === 'register' && !!internalApplicationId
      });

      if (formType === 'register' && internalApplicationId && isMounted) {
        try {
          console.log('📋 Loading roles for application:', internalApplicationId);
          const roles = await rolesService.getAvailableRolesForRegistration(internalApplicationId);
          console.log('✅ Roles loaded:', roles);

          if (isMounted) {
            setAvailableRoles(roles);
            const defaultRole = roles.find(role => role.is_default);
            if (defaultRole) {
              console.log('✅ Default role set:', defaultRole.name);
              setSelectedRole(defaultRole.name);
            } else {
              console.log('⚠️ No default role found');
            }
          }
        } catch (error) {
          console.error('❌ Error loading available roles:', error);
        }
      } else {
        console.log('⚠️ Not loading roles because:', {
          isRegisterForm: formType === 'register',
          hasInternalAppId: !!internalApplicationId
        });
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

    const url = `${path}?${params.toString()}`;
    console.log('🔗 buildNavUrl:', { path, callbackUrl, url });
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
      const pollingEndpoint = `${API_BASE_URL}/mfa-check-pairing-token`;
      const maxAttempts = 90;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (activeSetupPollRunRef.current !== runId) return;
        await wait(2000);

        const checkResponse = await fetch(pollingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-public-form/1.0'
          },
          body: JSON.stringify({
            pairing_token: pairingToken,
            application_id: applicationId
          })
        });

        const checkResult = await checkResponse.json();
        if (!checkResult?.success) {
          continue;
        }

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
    setMfaChallengeId(null);
    setMfaChallengeCode('');
    setMfaManualCode('');
    activePollRunRef.current += 1;
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
      console.log('🔧 Configuration:', {
        supabaseUrl: SUPABASE_URL,
        apiBaseUrl: API_BASE_URL,
        applicationId,
        apiKey: apiKey.substring(0, 20) + '...',
        callbackUrl
      });

      let endpoint = '';
      let payload: any = {};

      switch (formType) {
        case 'login':
          endpoint = `${API_BASE_URL}/auth-login`;
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
          endpoint = `${API_BASE_URL}/auth-register`;
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
          endpoint = `${API_BASE_URL}/auth-reset-password`;
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
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY.substring(0, 30) + '...',
          'apikey': SUPABASE_ANON_KEY.substring(0, 30) + '...',
          'X-Client-Info': 'authsystem-public-form/1.0'
        },
        payload: { ...payload, password: '***' }
      });

      // Llamar a la Edge Function de Supabase
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
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
            text: `Doble factor requerido. Abre tu app Authenticator y aprueba el acceso. Código: ${challengeCode || 'N/A'}`
          });

          setMfaChallengeId(challengeId);
          setMfaChallengeCode(challengeCode || '');

          const runId = ++activePollRunRef.current;
          setMfaPolling(true);

          const runPolling = async () => {
            const pollingEndpoint = `${API_BASE_URL}/mfa-check-challenge`;
            const maxAttempts = 60;

            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
              if (activePollRunRef.current !== runId) return;
              await wait(2000);

              const checkResponse = await fetch(pollingEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'apikey': SUPABASE_ANON_KEY,
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

            if (activePollRunRef.current === runId) {
              setMessage({ type: 'error', text: 'Tiempo de espera agotado para la aprobación MFA.' });
            }
          };

          runPolling().finally(() => {
            if (activePollRunRef.current === runId) {
              setMfaPolling(false);
            }
          });

          return;
        }

        if (formType === 'login' && result.error?.code === 'MFA_SETUP_REQUIRED') {
          setMfaSetupData(result.data || null);
          setMfaSetupStep(1);
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
          successMessage = getText('register_success_message', 'Cuenta creada exitosamente');
        } else if (formType === 'reset-password') {
          // Usar el mensaje que viene del servidor o uno genérico personalizable
          successMessage = result.data?.message || getText('reset_success_message', 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.');
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

  const handleManualMfaCodeVerification = async () => {
    if (!mfaChallengeId) {
      setMessage({ type: 'error', text: 'No hay desafío MFA activo.' });
      return;
    }

    const manualCode = mfaManualCode.trim();
    if (!manualCode) {
      setMessage({ type: 'error', text: 'Ingresa el código de verificación.' });
      return;
    }

    try {
      setMfaVerifyingCode(true);

      const approveResponse = await fetch(`${API_BASE_URL}/mfa-approve-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'X-Client-Info': 'authsystem-public-form/1.0'
        },
        body: JSON.stringify({
          application_id: applicationId,
          api_key: apiKey,
          email: formData.email,
          password: formData.password,
          challenge_id: mfaChallengeId,
          challenge_code: manualCode,
          action: 'approve'
        })
      });

      const approveResult = await approveResponse.json();
      if (!approveResponse.ok || !approveResult?.success) {
        throw new Error(approveResult?.error?.message || 'Código inválido o expirado');
      }

      activePollRunRef.current += 1;
      setMfaPolling(false);

      const checkResponse = await fetch(`${API_BASE_URL}/mfa-check-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'X-Client-Info': 'authsystem-public-form/1.0'
        },
        body: JSON.stringify({
          challenge_id: mfaChallengeId,
          application_id: applicationId
        })
      });

      const checkResult = await checkResponse.json();
      if (!checkResult?.success || checkResult?.data?.status !== 'approved') {
        throw new Error('No se pudo completar el login con código MFA.');
      }

      if (checkResult.data?.callback_url) {
        setTimeout(() => {
          window.location.href = checkResult.data.callback_url;
        }, 800);
      } else if (checkResult.data?.access_token) {
        localStorage.setItem('auth_token', checkResult.data.access_token);
        localStorage.setItem('refresh_token', checkResult.data.refresh_token);
      }

      if (onSuccess) {
        onSuccess(checkResult.data);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'No se pudo verificar el código MFA' });
    } finally {
      setMfaVerifyingCode(false);
    }
  };

  useEffect(() => {
    return () => {
      activePollRunRef.current += 1;
      activeSetupPollRunRef.current += 1;
    };
  }, []);

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

  const getButtonText = () => {
    if (loading) {
      return getText('processing_text', 'Procesando...');
    }

    switch (formType) {
      case 'login':
        return getText('login_button_text', 'Iniciar Sesión');
      case 'register':
        return getText('register_button_text', 'Crear Cuenta');
      case 'reset-password':
        return getText('reset_button_text', 'Enviar Email de Recuperación');
      default:
        return getText('submit_button_text', 'Enviar');
    }
  };

  const isMfaSetupFlow = formType === 'login' && !!mfaSetupData;

  // Generate dynamic styles based on extended branding
  const getBackgroundStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      fontFamily: defaultBranding.font_family
    };

    if (defaultBranding.use_gradient) {
      baseStyle.background = `linear-gradient(135deg, ${defaultBranding.gradient_start}, ${defaultBranding.gradient_end})`;
    } else {
      baseStyle.backgroundColor = defaultBranding.background_color;
    }

    return baseStyle;
  };

  const getCardStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      borderRadius: `${defaultBranding.border_radius}px`
    };

    if (defaultBranding.card_style === 'glass') {
      style.background = `${defaultBranding.card_background}80`;
      style.backdropFilter = `blur(${defaultBranding.card_blur}px)`;
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

  const getInputStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      borderRadius: `${defaultBranding.border_radius}px`,
      backgroundColor: defaultBranding.input_background,
      borderColor: defaultBranding.input_border_color,
      transition: 'all 0.2s'
    };

    if (defaultBranding.input_style === 'filled') {
      style.border = 'none';
      style.backgroundColor = `${defaultBranding.input_border_color}40`;
    } else if (defaultBranding.input_style === 'underlined') {
      style.borderTop = 'none';
      style.borderLeft = 'none';
      style.borderRight = 'none';
      style.borderRadius = '0';
      style.backgroundColor = 'transparent';
    }

    return style;
  };

  const getButtonStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      borderRadius: defaultBranding.button_style === 'rounded'
        ? `${defaultBranding.border_radius}px`
        : '4px',
      transition: defaultBranding.animations_enabled ? 'all 0.2s' : 'none'
    };

    if (defaultBranding.button_variant === 'gradient' && defaultBranding.use_gradient) {
      style.background = `linear-gradient(135deg, ${defaultBranding.gradient_start}, ${defaultBranding.gradient_end})`;
    } else if (defaultBranding.button_variant === 'outline') {
      style.backgroundColor = 'transparent';
      style.border = `2px solid ${defaultBranding.primary_color}`;
      style.color = defaultBranding.primary_color;
    } else if (defaultBranding.button_variant === 'ghost') {
      style.backgroundColor = `${defaultBranding.primary_color}20`;
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

      <div className={`relative w-full ${getFormWidthClass()}`}>
        {/* Logo and Header */}
        <div className="text-center mb-8">
          {defaultBranding.logo_url ? (
            <div className="w-24 h-20 mx-auto mb-4 rounded-xl border border-gray-200 bg-white/80 p-2 flex items-center justify-center overflow-hidden">
              <img 
                src={defaultBranding.logo_url} 
                alt="Logo" 
                className="w-full h-full object-contain"
              />
            </div>
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
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {message.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm leading-relaxed ${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
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
                        {getText('reset_back_to_login', 'Volver al inicio de sesión')}
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
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-900">Configura tu Authenticator para continuar</h3>
                <p className="text-xs text-blue-700">Paso {mfaSetupStep} de 3</p>

                {!mfaSetupLinked && mfaSetupStep === 1 && (
                  <>
                    <p className="text-sm text-blue-800">
                      Debes agregar la app Authenticator de este sistema para poder continuar con el inicio de sesión.
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMfaSetupStep(2)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        Siguiente
                      </button>
                    </div>
                  </>
                )}

                {!mfaSetupLinked && mfaSetupStep === 2 && (
                  <>
                    <p className="text-sm text-blue-800">Descarga la aplicación en tu móvil.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href="https://play.google.com/store"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-blue-900 text-center"
                      >
                        🤖 Google Play
                      </a>
                      <a
                        href="https://www.apple.com/app-store/"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-blue-900 text-center"
                      >
                         App Store
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setMfaSetupStep(1)}
                        className="px-3 py-2 bg-white border border-blue-300 text-blue-900 rounded-lg text-sm"
                      >
                        Atrás
                      </button>
                      <button
                        type="button"
                        onClick={() => setMfaSetupStep(3)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        Siguiente
                      </button>
                    </div>
                  </>
                )}

                {!mfaSetupLinked && mfaSetupStep === 3 && (
                  <>
                    <p className="text-sm text-blue-800">
                      Escanea el QR con la app móvil de este sistema (no Google/Microsoft Authenticator).
                    </p>
                    {mfaSetupData?.qr_text && (
                      <div className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mfaSetupData.qr_text)}`}
                          alt="QR de configuración MFA"
                          className="w-44 h-44"
                        />
                      </div>
                    )}
                    {mfaSetupData?.pairing_token && (
                      <div className="text-xs text-blue-900 bg-white border border-blue-100 rounded px-3 py-2 break-all">
                        Token manual: {mfaSetupData.pairing_token}
                      </div>
                    )}
                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setMfaSetupStep(2)}
                        className="px-3 py-2 bg-white border border-blue-300 text-blue-900 rounded-lg text-sm"
                      >
                        Atrás
                      </button>
                    </div>
                  </>
                )}

                {mfaSetupPolling && !mfaSetupLinked && (
                  <p className="text-xs text-blue-700">Esperando confirmación de vinculación desde el móvil...</p>
                )}

                {mfaSetupLinked && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                    <p className="text-sm text-green-800">✅ Dispositivo vinculado correctamente.</p>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}

            {formType === 'login' && mfaChallengeId && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-indigo-900">Método alternativo: ingresar código</h3>
                <p className="text-xs text-indigo-800">
                  También puedes escribir el código que aparece en tu app Authenticator para completar el login.
                </p>
                {mfaChallengeCode && (
                  <p className="text-xs text-indigo-700">Código de desafío: {mfaChallengeCode}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mfaManualCode}
                    onChange={(e) => setMfaManualCode(e.target.value)}
                    placeholder="Código MFA"
                    className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleManualMfaCodeVerification}
                    disabled={mfaVerifyingCode}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {mfaVerifyingCode ? 'Verificando...' : 'Validar'}
                  </button>
                </div>
                <p className="text-xs text-indigo-700">{mfaPolling ? 'Seguimos esperando aprobación push en paralelo.' : 'Polling de aprobación detenido.'}</p>
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                    style={{ 
                      borderRadius: `${defaultBranding.border_radius}px`,
                      '--tw-ring-color': defaultBranding.primary_color
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
                      borderRadius: `${defaultBranding.border_radius}px`,
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
                    <option key={role.id} value={role.display_name || role.name}>
                      {role.display_name}
                      {role.description && ` - ${role.description}`}
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
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{getButtonText()}</span>
                </>
              ) : (
                <>
                  <span>{getButtonText()}</span>
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