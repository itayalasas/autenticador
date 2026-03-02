import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
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
import { applyFaviconToDocument } from '../../utils/favicon';

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
  const [runtimeErrorText, setRuntimeErrorText] = useState<string>('');
  const [mfaSetupData, setMfaSetupData] = useState<any | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<1 | 2 | 3>(1);
  const [mfaSetupPolling, setMfaSetupPolling] = useState(false);
  const [mfaSetupLinked, setMfaSetupLinked] = useState(false);

  const activeSetupPollRunRef = React.useRef(0);
  const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
  const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

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

  useEffect(() => {
    applyFaviconToDocument(branding.favicon_url);
  }, [branding.favicon_url]);

  useEffect(() => {
    return () => {
      activeSetupPollRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (formType !== 'login') return;
    const pairingToken = mfaSetupData?.pairing_token;
    if (!pairingToken) return;

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

        const response = await fetch(pollingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-branded-form/1.0'
          },
          body: JSON.stringify({ pairing_token: pairingToken, application_id: applicationId })
        });

        const result = await response.json();
        if (!result?.success) {
          continue;
        }

        const pairingStatus = result?.data?.status;
        if (pairingStatus === 'linked') {
          setMfaSetupLinked(true);
          setMessageStatus('idle');
          setRuntimeErrorText('');
          return;
        }

        if (pairingStatus === 'expired') {
          setMessageStatus('error');
          setRuntimeErrorText('El código de vinculación expiró. Inicia sesión nuevamente para generar otro.');
          return;
        }

        if (pairingStatus === 'invalid') {
          setMessageStatus('error');
          setRuntimeErrorText('No se pudo validar el token de vinculación.');
          return;
        }
      }
    };

    runPolling().finally(() => {
      if (activeSetupPollRunRef.current === runId) {
        setMfaSetupPolling(false);
      }
    });

    return () => {
      activeSetupPollRunRef.current += 1;
      setMfaSetupPolling(false);
    };
  }, [mfaSetupData?.pairing_token, formType, applicationId]);

  // Helper function to get custom text or fallback to default
  const getText = (key: string, defaultText: string): string => {
    const customTexts = (branding as any).custom_texts || {};
    return customTexts[key] || defaultText;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuntimeErrorText('');
    setMfaSetupData(null);
    setMfaSetupStep(1);
    setMfaSetupLinked(false);
    setMfaSetupPolling(false);
    activeSetupPollRunRef.current += 1;

    // Basic validation
    if (!formData.email || !formData.password) {
      setMessageStatus('error');
      return;
    }

    if (formType === 'register') {
      if (!formData.name) {
        setMessageStatus('error');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setMessageStatus('error');
        return;
      }
    }

    try {
      setLoading(true);
      setMessageStatus('loading');

      await onSubmit(formData);

      setMessageStatus('success');

      // Simulate redirect after success
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(formData);
        }
      }, branding.redirect_delay || 2000);

    } catch (error: any) {
      setMessageStatus('error');

      const errorCode = error?.code || error?.error?.code;
      const errorMessage = error?.message || 'Error de autenticación';
      const errorData = error?.data || error?.error?.data || null;

      if (errorCode === 'MFA_SETUP_REQUIRED') {
        setMessageStatus('idle');
        setRuntimeErrorText('');
        setMfaSetupStep(1);
        setMfaSetupData(errorData || null);
      } else {
        setRuntimeErrorText(errorMessage);

        if (errorMessage?.includes('Token manual:')) {
          const token = errorMessage.split('Token manual:')[1]?.trim();
          if (token) {
            setMfaSetupData({ pairing_token: token, qr_text: JSON.stringify({ pairing_token: token }) });
          }
        }
      }

      if (onError) {
        onError(errorMessage);
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
            errorHelpText={runtimeErrorText || getText('message_error_help_text', branding.message_error_help_text || '')}
          />
        )}

        {formType === 'login' && mfaSetupData && (
          <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: '#EEF6FF', borderColor: '#BFDBFE' }}>
            <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Configura tu Authenticator</h4>
            <p className="text-xs mb-2" style={{ color: '#1E3A8A' }}>Paso {mfaSetupStep} de 3</p>

            {!mfaSetupLinked && mfaSetupStep === 1 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>
                  Debes agregar la app Authenticator de este sistema para continuar.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMfaSetupStep(2)}
                    className="px-3 py-2 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: '#2563EB' }}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {!mfaSetupLinked && mfaSetupStep === 2 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>Descarga la aplicación en tu móvil.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <a
                    href="https://play.google.com/store"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 text-sm text-center rounded-lg border"
                    style={{ color: '#1E3A8A', borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' }}
                  >
                    🤖 Google Play
                  </a>
                  <a
                    href="https://www.apple.com/app-store/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 text-sm text-center rounded-lg border"
                    style={{ color: '#1E3A8A', borderColor: '#BFDBFE', backgroundColor: '#FFFFFF' }}
                  >
                     App Store
                  </a>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setMfaSetupStep(1)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border"
                    style={{ color: '#1E3A8A', borderColor: '#93C5FD', backgroundColor: '#FFFFFF' }}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => setMfaSetupStep(3)}
                    className="px-3 py-2 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: '#2563EB' }}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {!mfaSetupLinked && mfaSetupStep === 3 && (
              <>
                <p className="text-sm mb-3" style={{ color: '#1E40AF' }}>
                  Escanea el QR con la app móvil de este sistema (no Google/Microsoft Authenticator).
                </p>
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
                  <p className="text-xs break-all mb-3" style={{ color: '#1E3A8A' }}>
                    Token manual: {mfaSetupData.pairing_token}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setMfaSetupStep(2)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ color: '#1E3A8A', borderColor: '#93C5FD', backgroundColor: '#FFFFFF' }}
                >
                  Atrás
                </button>
              </>
            )}

            {mfaSetupPolling && !mfaSetupLinked && (
              <p className="text-xs mt-3" style={{ color: '#1E40AF' }}>
                Esperando confirmación de vinculación desde el móvil...
              </p>
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

          {!isMfaSetupFlow && (
          <BrandedButton
            type="submit"
            branding={branding}
            disabled={loading}
            loading={loading}
            loadingText={getText('processing_text', 'Procesando...')}
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
                <a href={`/reset-password?app_id=${applicationId}`}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
                </a>
                <a href={`/register?app_id=${applicationId}`}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('? ')[1] || 'Regístrate aquí'}
                </a>
              </>
            )}
            {formType === 'register' && (
              <a href={`/login?app_id=${applicationId}`}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión')}
              </a>
            )}
            {formType === 'reset-password' && (
              <a href={`/login?app_id=${applicationId}`}
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
      <style>{`
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
      `}</style>
    </BrandedContainer>
  );
}
