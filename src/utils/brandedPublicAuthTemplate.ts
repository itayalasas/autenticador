// Template for Branded Public Auth
// Auto-generated

export const BRANDED_PUBLIC_AUTH_TEMPLATE = `import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
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
  formType: 'login' | 'register' | 'reset-password' | 'reset-password-confirm';
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
  const [mfaSetupData, setMfaSetupData] = useState<any | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<1 | 2 | 3>(1);
  const [mfaSetupPolling, setMfaSetupPolling] = useState(false);
  const [mfaSetupLinked, setMfaSetupLinked] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong'>('weak');
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const activeSetupPollRunRef = React.useRef(0);
  const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
  const API_BASE_URL = SUPABASE_URL + '/functions/v1';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Load available roles for registration
  useEffect(() => {
    const loadRoles = async () => {
      if (formType === 'register' && applicationId) {
        try {
          console.log('📋 Loading roles for application:', applicationId);

          // Get internal app ID first
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            'https://sfqtmnncgiqkveaoqckt.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ'
          );

          // Get internal ID from application_id
          const { data: app, error: appError } = await supabase
            .from('applications')
            .select('id')
            .eq('application_id', applicationId)
            .maybeSingle();

          if (appError || !app) {
            console.warn('⚠️ Could not find application:', applicationId);
            return;
          }

          const internalAppId = app.id;
          console.log('📋 Internal app ID:', internalAppId);

          // Load roles
          const { data: roles, error: rolesError } = await supabase
            .from('application_roles')
            .select('*')
            .eq('application_id', internalAppId)
            .order('display_name');

          if (rolesError) {
            console.error('❌ Error loading roles:', rolesError);
            return;
          }

          console.log('✅ Roles loaded:', roles);
          setAvailableRoles(roles || []);

          // Set default role if exists
          const defaultRole = roles?.find((r: any) => r.is_default);
          if (defaultRole) {
            setSelectedRole(defaultRole.name);
            console.log('✅ Default role set:', defaultRole.name);
          }
        } catch (error) {
          console.error('❌ Error in loadRoles:', error);
        }
      }
    };

    loadRoles();
  }, [formType, applicationId]);

  // Merge custom branding with defaults
  const branding: BrandingConfig = {
    ...getDefaultBrandingConfig(),
    ...customBranding
  };

  useEffect(() => {
    if (!branding.favicon_url) return;

    const faviconUrl = branding.favicon_url;
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
  }, [branding.favicon_url]);

  // Helper function to get custom text or fallback to default
  const getText = (key: string, defaultText: string): string => {
    const customTexts = (branding as any).custom_texts || {};
    return customTexts[key] || defaultText;
  };

  // Helper function to build navigation URLs with all required params
  const buildNavUrl = (path: string): string => {
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get('redirect_uri');
    const apiKey = params.get('api_key');

    const newParams = new URLSearchParams();
    newParams.set('app_id', applicationId);

    if (redirectUri) {
      newParams.set('redirect_uri', redirectUri);
    }

    if (apiKey) {
      newParams.set('api_key', apiKey);
    }

    return \`\${path}?\${newParams.toString()}\`;
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

  useEffect(() => {
    return () => {
      activeSetupPollRunRef.current += 1;
    };
  }, []);

  const startMfaSetupPolling = (pairingToken: string) => {
    const runId = ++activeSetupPollRunRef.current;
    setMfaSetupPolling(true);
    setMfaSetupLinked(false);

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runPolling = async () => {
      const pollingEndpoint = API_BASE_URL + '/mfa-check-pairing-token';

      for (let attempt = 0; attempt < 90; attempt += 1) {
        if (activeSetupPollRunRef.current !== runId) return;
        await wait(2000);

        const response = await fetch(pollingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-branded-form/1.0'
          },
          body: JSON.stringify({ pairing_token: pairingToken, application_id: applicationId })
        });

        const result = await response.json();
        if (!result?.success) continue;

        const pairingStatus = result?.data?.status;
        if (pairingStatus === 'linked') {
          setMfaSetupLinked(true);
          setMessageStatus('idle');
          setErrorMessage('');
          return;
        }

        if (pairingStatus === 'expired') {
          setMessageStatus('error');
          setErrorMessage('El código de vinculación expiró. Inicia sesión nuevamente para generar otro.');
          return;
        }

        if (pairingStatus === 'invalid') {
          setMessageStatus('error');
          setErrorMessage('No se pudo validar el token de vinculación.');
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
    setErrorMessage('');
    setMfaSetupData(null);
    setMfaSetupStep(1);
    setMfaSetupLinked(false);
    setMfaSetupPolling(false);
    activeSetupPollRunRef.current += 1;

    // 1. Rate limiting check (client-side)
    const rateLimitKey = \`auth-\${formType}-\${applicationId}\`;
    if (!rateLimiter.canAttempt(rateLimitKey, 5, 60000)) {
      const timeLeft = rateLimiter.getTimeUntilReset(rateLimitKey, 60000);
      const secondsLeft = Math.ceil(timeLeft / 1000);
      setErrorMessage(\`Demasiados intentos. Por favor espera \${secondsLeft} segundos.\`);
      setMessageStatus('error');
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

      // Use sanitized data and add role if selected
      const dataToSubmit = {
        ...validation.sanitized,
        ...(selectedRole && { role: selectedRole })
      };
      await onSubmit(dataToSubmit);

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
      const errorCode = error?.code || error?.error?.code;
      const errorData = error?.data || error?.error?.data || null;
      const errorText = error?.message || 'Error al procesar la solicitud';

      if (errorCode === 'MFA_SETUP_REQUIRED') {
        setMessageStatus('idle');
        setErrorMessage('');
        setMfaSetupStep(1);
        setMfaSetupData(errorData || null);

        const pairingToken = errorData?.pairing_token;
        if (pairingToken) {
          startMfaSetupPolling(pairingToken);
        }
      } else {
        setErrorMessage(errorText);

        if (errorText?.includes('Token manual:')) {
          const token = errorText.split('Token manual:')[1]?.trim();
          if (token) {
            setMfaSetupData({ pairing_token: token, qr_text: JSON.stringify({ pairing_token: token }) });
          }
        }
      }

      if (onError) {
        onError(errorText);
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
      case 'reset-password-confirm':
        return getText('confirm_reset_title', 'Nueva Contraseña');
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
      case 'reset-password-confirm':
        return getText('confirm_reset_subtitle', 'Ingresa tu nueva contraseña');
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
      case 'reset-password-confirm':
        return getText('confirm_reset_button_text', 'Cambiar Contraseña');
      default:
        return 'Enviar';
    }
  };

  const isMfaSetupFlow = formType === 'login' && !!mfaSetupData;

  return (
    <BrandedContainer branding={branding}>
      <BrandedHeader
        branding={branding}
        logoUrl={branding.logo_url}
        title={getFormTitle()}
        subtitle={getFormSubtitle()}
      />

      <BrandedCard branding={branding}>
        {!isMfaSetupFlow && (
          <BrandedMessage
            status={messageStatus}
            branding={branding}
            loadingText={getText('message_loading_text', branding.message_loading_text || 'Processing...')}
            successText={getText('message_success_text', branding.message_success_text || 'Success!')}
            errorText={getText('message_error_text', branding.message_error_text || 'An error occurred')}
            errorHelpText={messageStatus === 'error'
              ? (errorMessage || getText('message_error_help_text', branding.message_error_help_text || ''))
              : getText('message_error_help_text', branding.message_error_help_text || '')}
          />
        )}

        {formType === 'login' && mfaSetupData && (
          <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: '#EEF6FF', borderColor: '#BFDBFE' }}>
            <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Configura tu Authenticator</h4>
            <p className="text-xs mb-2" style={{ color: '#1E3A8A' }}>Paso {mfaSetupStep} de 3</p>

            {!mfaSetupLinked && mfaSetupStep === 1 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>Debes agregar la app Authenticator de este sistema para continuar.</p>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setMfaSetupStep(2)} className="px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: '#2563EB' }}>Siguiente</button>
                </div>
              </>
            )}

            {!mfaSetupLinked && mfaSetupStep === 2 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>Descarga la aplicación en tu móvil.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <a href="https://play.google.com/store" target="_blank" rel="noreferrer" className="px-3 py-2 text-sm text-center rounded-lg border" style={{ color: '#1E3A8A', borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' }}>🤖 Google Play</a>
                  <a href="https://www.apple.com/app-store/" target="_blank" rel="noreferrer" className="px-3 py-2 text-sm text-center rounded-lg border" style={{ color: '#1E3A8A', borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' }}> App Store</a>
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setMfaSetupStep(1)} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ color: '#1E3A8A', borderColor: '#93C5FD', backgroundColor: '#FFFFFF' }}>Atrás</button>
                  <button type="button" onClick={() => setMfaSetupStep(3)} className="px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: '#2563EB' }}>Siguiente</button>
                </div>
              </>
            )}

            {!mfaSetupLinked && mfaSetupStep === 3 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>Escanea el QR con la app móvil de este sistema (no Google/Microsoft Authenticator).</p>
                {mfaSetupData?.qr_text && (
                  <div className="bg-white rounded-lg border p-3 w-fit mx-auto mb-3" style={{ borderColor: '#DBEAFE' }}>
                    <img
                      src={
                        'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
                        encodeURIComponent(mfaSetupData.qr_text)
                      }
                      alt="QR de configuración MFA"
                      className="w-44 h-44"
                    />
                  </div>
                )}

                {mfaSetupData?.pairing_token && (
                  <p className="text-xs break-all mb-3" style={{ color: '#1E3A8A' }}>Token manual: {mfaSetupData.pairing_token}</p>
                )}

                <button type="button" onClick={() => setMfaSetupStep(2)} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ color: '#1E3A8A', borderColor: '#93C5FD', backgroundColor: '#FFFFFF' }}>Atrás</button>
              </>
            )}

            {mfaSetupPolling && !mfaSetupLinked && (
              <p className="text-xs mt-3" style={{ color: '#1E40AF' }}>Esperando confirmación de vinculación desde el móvil...</p>
            )}

            {mfaSetupLinked && (
              <div className="mt-3 p-3 rounded-lg border" style={{ backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' }}>
                <p className="text-sm mb-2" style={{ color: '#166534' }}>✅ Dispositivo vinculado correctamente.</p>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  className="px-3 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reset Password Success Message */}
        {messageStatus === 'success' && formType === 'reset-password' && (
          <div className="mb-6 p-6 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {getText('reset_success_message', 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.')}
                </p>
              </div>
            </div>
            <a
              href={buildNavUrl('/login')}
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: branding.primary_color }}
            >
              <ArrowLeft className="w-4 h-4" />
              {getText('reset_back_to_login', 'Volver al inicio de sesión')}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" style={{ display: messageStatus === 'success' && formType === 'reset-password' ? 'none' : 'block' }}>
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

          {!isMfaSetupFlow && formType !== 'reset-password-confirm' && (
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
          )}

          {!isMfaSetupFlow && (formType === 'login' || formType === 'register' || formType === 'reset-password-confirm') && (
            <>
              <div>
                <BrandedInput
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  label={
                    formType === 'login' ? getText('login_password_label', 'Contraseña') :
                    formType === 'register' ? getText('register_password_label', 'Contraseña') :
                    getText('confirm_reset_password_label', 'Nueva Contraseña')
                  }
                  placeholder={
                    formType === 'login' ? getText('login_password_placeholder', '••••••••') :
                    formType === 'register' ? getText('register_password_placeholder', '••••••••') :
                    getText('confirm_reset_password_placeholder', '••••••••')
                  }
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

              {(formType === 'register' || formType === 'reset-password-confirm') && (
                <BrandedInput
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  label={
                    formType === 'register' ?
                    getText('register_confirm_password_label', 'Confirmar Contraseña') :
                    getText('confirm_reset_confirm_password_label', 'Confirmar Nueva Contraseña')
                  }
                  placeholder={
                    formType === 'register' ?
                    getText('register_confirm_password_placeholder', '••••••••') :
                    getText('confirm_reset_confirm_password_placeholder', '••••••••')
                  }
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  branding={branding}
                  icon={<Lock className="w-5 h-5" />}
                />
              )}
            </>
          )}

          {/* Role Selection (only for register) */}
          {formType === 'register' && availableRoles.length > 0 && (
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium mb-2"
                style={{ color: branding.text_color }}
              >
                {getText('role_selection_label', 'Tipo de Usuario')}
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all"
                style={{
                  borderColor: branding.input_border_color,
                  backgroundColor: branding.input_background,
                  color: branding.text_color,
                  borderRadius: \`\${branding.border_radius}px\`
                }}
              >
                <option value="">{getText('role_selection_placeholder', 'Selecciona un rol')}</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.display_name}
                    {role.description ? \` - \${role.description}\` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {getText('role_selection_description', 'Selecciona el tipo de acceso que necesitas en la aplicación')}
              </p>
            </div>
          )}

          {!isMfaSetupFlow && (
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
          )}

          {/* Links */}
          {!isMfaSetupFlow && (
          <div className="flex items-center justify-between text-sm">
            {formType === 'login' && (
              <>
                <a href={buildNavUrl('/reset-password')}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
                </a>
                <a href={buildNavUrl('/register')}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('? ')[1] || 'Regístrate aquí'}
                </a>
              </>
            )}
            {formType === 'register' && (
              <a href={buildNavUrl('/login')}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión')}
              </a>
            )}
            {formType === 'reset-password' && (
              <a href={buildNavUrl('/login')}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión')}
              </a>
            )}
          </div>
          )}
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
