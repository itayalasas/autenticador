import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Shield, X, Smartphone, QrCode, CheckCircle2, Copy, Apple } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { rolesService } from '../../services/rolesService';
import { applicationService } from '../../services/applicationService';
import { ipService } from '../../services/ipService';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseRuntime';
import { applyFaviconToDocument } from '../../utils/favicon';
import { getTrustedCallbackUrl, type PublicAuthChannel } from '../../utils/publicCallbackUrl';
import { storeTokenResponseAuthData } from '../../utils/authHelpers';
import { AuthSystemBadge } from '../ui/BrandedComponents';

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
  const usesCustomRedirectScheme = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return false;
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !/^https?:/i.test(raw);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingIP, setCheckingIP] = useState(true);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [mfaSetupData, setMfaSetupData] = useState<any | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<1 | 2 | 3>(1);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaVerificationNumber, setMfaVerificationNumber] = useState<string>('');
  const [mfaCodeExpiresIn, setMfaCodeExpiresIn] = useState<number>(0);
  const [showMfaManualEntry, setShowMfaManualEntry] = useState(false);
  const [mfaManualCode, setMfaManualCode] = useState('');
  const [mfaPolling, setMfaPolling] = useState(false);
  const [mfaSetupPolling, setMfaSetupPolling] = useState(false);
  const [mfaSetupLinked, setMfaSetupLinked] = useState(false);
  const [mfaAutoStartingSession, setMfaAutoStartingSession] = useState(false);
  const [mfaVerifyingCode, setMfaVerifyingCode] = useState(false);
  const [mfaCompletingLogin, setMfaCompletingLogin] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [customTexts, setCustomTexts] = useState<any>({});
  const [searchParams] = useSearchParams();
  const preferredEnvironment = (searchParams.get('env') || 'development').toLowerCase();
  const requestedCallbackUrl = searchParams.get('callback_url') || searchParams.get('redirect_uri');
  const authChannel: PublicAuthChannel = searchParams.get('channel') === 'mobile' || usesCustomRedirectScheme(requestedCallbackUrl)
    ? 'mobile'
    : 'web';
  const authState = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const trustedCallbackUrl = getTrustedCallbackUrl(
    appInfo?.metadata?.environment_urls || null,
    requestedCallbackUrl,
    preferredEnvironment,
    appInfo?.metadata?.cors_origins || null,
    authChannel,
  );
  
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

  const isTenantApp = appInfo?.auth_mode === 'tenant';
  const allowPublicRegistration =
    !isTenantApp && (appInfo?.metadata?.allow_public_registration ?? true);
  const showRegisterOnLogin = allowPublicRegistration;
  const registrationBlocked = formType === 'register' && !allowPublicRegistration;

  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_ANON_KEY = getSupabaseAnonKey();
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
          setIpBlocked(true);
          setBlockedInfo(result.blocked_info);
        } else {
        }
      } catch (error) {
        if (isMounted) setIpBlocked(false);
      } finally {
        if (isMounted) setCheckingIP(false);
      }

      // Application info comes from props, no need to set it here

      // Load custom texts
      try {
        if (branding?.custom_texts && isMounted) {
          setCustomTexts(branding.custom_texts);
        } else if (internalApplicationId && isMounted) {
          const brandingConfig = await applicationService.getPublicBranding(internalApplicationId, {
            environmentName: preferredEnvironment,
            host: window.location.hostname
          });
          if (brandingConfig && brandingConfig.custom_texts && isMounted) {
            setCustomTexts(brandingConfig.custom_texts);
          }
        }
      } catch (error) {
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
            } else {
            }
          }
        } catch (error) {
        }
      } else {
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

    const env = searchParams.get('env');
    if (env) {
      params.set('env', env);
    }

    if (authChannel === 'mobile') {
      params.set('channel', 'mobile');
    }

    if (trustedCallbackUrl) {
      params.set('redirect_uri', trustedCallbackUrl);
    }

    if (authState) {
      params.set('state', authState);
    }

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
    }

    if (codeChallengeMethod) {
      params.set('code_challenge_method', codeChallengeMethod);
    }

    const url = `${path}?${params.toString()}`;
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
          setMfaAutoStartingSession(true);
          window.setTimeout(async () => {
            if (activeSetupPollRunRef.current !== runId) return;
            await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
          }, 900);
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
    setMfaAutoStartingSession(false);
    setMfaSetupPolling(false);
    setMfaChallengeId(null);
    setMfaVerificationNumber('');
    setMfaCodeExpiresIn(0);
    setShowMfaManualEntry(false);
    setMfaManualCode('');
    setMfaCompletingLogin(false);
    activePollRunRef.current += 1;
    activeSetupPollRunRef.current += 1;

    try {
      // Obtener parámetros de la URL
      if (!apiKey) {
        throw new Error('API key no disponible para esta aplicación');
      }

      // Get client IP first
      const clientIp = await ipService.getClientIP();

      // Use Supabase Edge Functions URL (hardcoded for production)

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
            callback_url: authChannel === 'web' ? trustedCallbackUrl || undefined : undefined,
            redirect_uri: trustedCallbackUrl || undefined,
            channel: authChannel,
            state: authState || undefined,
            code_challenge: authChannel === 'mobile' ? codeChallenge || undefined : undefined,
            code_challenge_method: authChannel === 'mobile' ? codeChallengeMethod || undefined : undefined,
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
            callback_url: authChannel === 'web' ? trustedCallbackUrl || undefined : undefined,
            redirect_uri: trustedCallbackUrl || undefined,
            channel: authChannel,
            state: authState || undefined,
            code_challenge: authChannel === 'mobile' ? codeChallenge || undefined : undefined,
            code_challenge_method: authChannel === 'mobile' ? codeChallengeMethod || undefined : undefined,
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
            redirect_uri: trustedCallbackUrl || undefined,
            client_ip: clientIp
          };
          break;
      }


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


      const result = await response.json();

      // Log the response status for debugging

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const completeSuccessfulLogin = async (loginData: any) => {
        if (loginData?.callback_url) {
          setTimeout(() => {
            window.location.href = loginData.callback_url;
          }, 1500);
          return;
        }

        if (loginData?.access_token) {
          storeTokenResponseAuthData(loginData, applicationId);
        }
      };
      
      if (!result.success) {

        if (formType === 'login' && result.error?.code === 'MFA_REQUIRED') {
          const challengeId = result.data?.challenge_id;
          const verificationNumber = String(result.data?.verification_number || '').padStart(2, '0');

          if (!challengeId) {
            throw new Error('Desafío MFA inválido: falta challenge_id');
          }

          setMessage({
            type: 'success',
            text: verificationNumber
              ? `Doble factor requerido. En tu móvil valida el número ${verificationNumber} y aprueba el acceso.`
              : `Doble factor requerido. Abre tu app Authenticator y aprueba el acceso.`
          });

          setMfaChallengeId(challengeId);
          setMfaVerificationNumber(verificationNumber || '');
          setMfaCodeExpiresIn(Number(result.data?.challenge_code_expires_in_seconds || 60));
          setShowMfaManualEntry(false);

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

              if (!checkResult?.success) {
                continue;
              }

              if (challengeStatus === 'pending') {
                if (typeof checkResult?.data?.verification_number === 'string') {
                  setMfaVerificationNumber(String(checkResult.data.verification_number).padStart(2, '0'));
                }

                if (typeof checkResult?.data?.challenge_code_expires_in_seconds === 'number') {
                  setMfaCodeExpiresIn(Math.max(0, checkResult.data.challenge_code_expires_in_seconds));
                }

                continue;
              }

              if (challengeStatus === 'approved') {
                setMfaCompletingLogin(true);
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
          beginMfaSetupFlow(result.data || null);
          return;
        }

        if (formType === 'login' && result.error?.code === 'MFA_SETUP_ERROR') {
          try {
            const fallbackSetupData = await requestFallbackMfaSetup();
            beginMfaSetupFlow(fallbackSetupData || null);
            setMessage({
              type: 'success',
              text: 'Reintentamos la configuración MFA y ya puedes vincular tu app Authenticator.'
            });
            return;
          } catch (fallbackError: any) {
          }

          setMessage({
            type: 'error',
            text: result.error?.message || 'No se pudo iniciar la configuración de doble factor'
          });
          return;
        }
        
        // Show more detailed error for debugging
        if (result.error?.code === 'DATABASE_ERROR' || result.error?.message?.includes('Database error')) {
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

      setMfaCompletingLogin(true);
      setMessage({ type: 'success', text: 'Aprobación recibida. Iniciando sesión...' });

      if (checkResult.data?.callback_url) {
        setTimeout(() => {
          window.location.href = checkResult.data.callback_url;
        }, 800);
      } else if (checkResult.data?.access_token) {
        storeTokenResponseAuthData(checkResult.data, applicationId);
      }

      if (onSuccess) {
        onSuccess(checkResult.data);
      }
    } catch (error: any) {
      setMfaCompletingLogin(false);
      setMessage({ type: 'error', text: error.message || 'No se pudo verificar el código MFA' });
    } finally {
      setMfaVerifyingCode(false);
    }
  };

  const handleRequestAnotherMfaCode = async () => {
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleCloseMfaChallengeModal = () => {
    activePollRunRef.current += 1;
    setMfaPolling(false);
    setMfaVerifyingCode(false);
    setMfaCompletingLogin(false);
    setShowMfaManualEntry(false);
    setMfaManualCode('');
    setMfaChallengeId(null);
    setMfaVerificationNumber('');
    setMfaCodeExpiresIn(0);
    setMessage(null);
  };

  useEffect(() => {
    if (!mfaChallengeId || mfaCodeExpiresIn <= 0) return;

    const timer = window.setInterval(() => {
      setMfaCodeExpiresIn((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [mfaChallengeId, mfaCodeExpiresIn]);

  useEffect(() => {
    return () => {
      activePollRunRef.current += 1;
      activeSetupPollRunRef.current += 1;
    };
  }, []);

  const beginMfaSetupFlow = (setupData: any) => {
    setMfaSetupData(setupData || null);
    setMfaSetupStep(1);
    setMessage(null);

    const pairingToken = setupData?.pairing_token;
    if (pairingToken) {
      startMfaSetupPolling(pairingToken);
    }
  };

  const requestFallbackMfaSetup = async () => {
    if (!apiKey) {
      throw new Error('No se encontró api_key para continuar con la configuración MFA.');
    }

    const response = await fetch(`${API_BASE_URL}/mfa-generate-pairing-token`, {
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
        password: formData.password
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error?.message || 'No se pudo iniciar la configuración de doble factor');
    }

    return result.data;
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
  const isMfaChallengeFlow = formType === 'login' && !!mfaChallengeId;

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
            <div className="flex items-center justify-center">
              <AuthSystemBadge branding={defaultBranding as any} text="AuthSystem" compact />
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

          {registrationBlocked && (
            <div className="mb-6 p-5 rounded-lg border border-amber-200 bg-amber-50 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                {isTenantApp ? 'Registro no disponible' : 'Registro deshabilitado'}
              </h3>
              <p className="text-sm text-amber-800">
                {isTenantApp
                  ? 'Esta aplicación requiere registrar primero una empresa. Contacta al administrador para obtener acceso.'
                  : 'El registro público está deshabilitado para esta aplicación. Contacta al administrador.'}
              </p>
              <a
                href={buildNavUrl('/login')}
                className="inline-block mt-4 text-sm font-medium hover:underline"
                style={{ color: defaultBranding.accent_color }}
              >
                Volver al login
              </a>
            </div>
          )}

          {/* Form - Hide if reset-password was successful */}
          {!registrationBlocked && !(formType === 'reset-password' && message?.type === 'success') && !isMfaChallengeFlow && (
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
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : s}
                          </div>
                          {s < 3 && <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    <span className={mfaSetupStep === 1 && !mfaSetupLinked ? 'text-blue-700' : ''}>Instalar</span>
                    <span className={`text-center ${mfaSetupStep === 2 && !mfaSetupLinked ? 'text-blue-700' : ''}`}>Descargar</span>
                    <span className={`text-right ${mfaSetupStep === 3 && !mfaSetupLinked ? 'text-blue-700' : ''}`}>Vincular</span>
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
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mfaSetupData.qr_text)}`} alt="QR de configuración MFA" className="w-44 h-44" />
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
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {mfaAutoStartingSession ? 'Iniciando sesión automáticamente...' : 'Si no avanza, presiona Continuar.'}
                        </p>
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
          {!(formType === 'reset-password' && message?.type === 'success') && !isMfaSetupFlow && !isMfaChallengeFlow && (
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
                {showRegisterOnLogin && (
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
          <AuthSystemBadge branding={defaultBranding as any} text={getText('security_badge_text', 'AuthSystem')} compact />
        </div>
      </div>

      {formType === 'login' && mfaChallengeId && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center px-4">
          <div className="w-full max-w-[700px] overflow-hidden rounded-[22px] bg-white shadow-2xl border border-indigo-100">
            <div className="p-6 md:p-7 space-y-5">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-indigo-500">Verificación MFA</p>
                  <h3 className="text-[38px] font-semibold text-indigo-950 leading-[1.08]">Aprobación en curso</h3>
                  <p className="text-base text-indigo-800 leading-[1.35]">
                    Revisa tu app Authenticator y aprueba el acceso para continuar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseMfaChallengeModal}
                  disabled={mfaCompletingLogin}
                  className="text-indigo-400 hover:text-indigo-600 disabled:opacity-40"
                  aria-label="Cerrar verificación MFA"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-[16px] border border-indigo-200 bg-indigo-50 px-5 py-4">
                <p className="text-base font-medium text-indigo-800">Número de verificación</p>
                <p className="text-[48px] font-bold tracking-[0.12em] text-indigo-900 mt-1">{mfaVerificationNumber || '--'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowMfaManualEntry((current) => !current)}
                  className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-[15px] font-medium hover:bg-indigo-50 disabled:opacity-60"
                  disabled={mfaCompletingLogin}
                >
                  Entrar código manual
                </button>
                <button
                  type="button"
                  onClick={handleRequestAnotherMfaCode}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[15px] font-medium hover:bg-indigo-700 disabled:opacity-60"
                  disabled={loading || mfaCompletingLogin}
                >
                  Solicitar otro código
                </button>
              </div>

              {showMfaManualEntry && (
                <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-3">
                  <p className="text-xs text-indigo-700">
                    Código de 6 dígitos (se regenera cada 60 segundos).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={mfaManualCode}
                      onChange={(e) => setMfaManualCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="Código MFA"
                      className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button
                      type="button"
                      onClick={handleManualMfaCodeVerification}
                      disabled={mfaVerifyingCode || mfaCompletingLogin}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {mfaVerifyingCode ? 'Verificando...' : 'Validar'}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-[14px] px-4 py-3.5 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-indigo-400 border-dashed animate-spin shrink-0" />
                <span>
                  {mfaCompletingLogin
                    ? 'Conectando y autenticando sesión...'
                    : mfaPolling
                    ? 'Esperando aprobación desde la app móvil.'
                    : 'Espera de aprobación detenida.'}
                </span>
              </p>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
              <AuthSystemBadge branding={defaultBranding as any} text={getText('security_badge_text', 'AuthSystem')} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicAuthForms;
