import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Shield, X, Smartphone, QrCode, CheckCircle2, Copy, Apple } from 'lucide-react';
import {
  AuthSystemBadge,
  BrandedContainer,
  BrandedCard,
  BrandedInput,
  BrandedButton,
  BrandedMessage,
  BrandedHeader
} from '../ui/BrandedComponents';
import { BrandingConfig } from '../../types';
import { getDefaultBrandingConfig } from '../../utils/themePresets';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseRuntime';
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
  const [mfaAutoStartingSession, setMfaAutoStartingSession] = useState(false);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaVerificationNumber, setMfaVerificationNumber] = useState('');
  const [mfaCodeExpiresIn, setMfaCodeExpiresIn] = useState(0);
  const [showMfaManualEntry, setShowMfaManualEntry] = useState(false);
  const [mfaManualCode, setMfaManualCode] = useState('');
  const [mfaVerifyingCode, setMfaVerifyingCode] = useState(false);
  const [mfaPolling, setMfaPolling] = useState(false);
  const [mfaCompletingLogin, setMfaCompletingLogin] = useState(false);

  const activeSetupPollRunRef = React.useRef(0);
  const activeChallengePollRunRef = React.useRef(0);
  const SUPABASE_URL = getSupabaseUrl();
  const SUPABASE_ANON_KEY = getSupabaseAnonKey();
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
      activeChallengePollRunRef.current += 1;
    };
  }, []);

  const beginMfaSetupFlow = (setupData: any) => {
    setMessageStatus('idle');
    setRuntimeErrorText('');
    setMfaSetupStep(1);
    setMfaSetupLinked(false);
    setMfaAutoStartingSession(false);
    setMfaSetupData(setupData || null);

    const pairingToken = setupData?.pairing_token;
    if (pairingToken) {
      activeSetupPollRunRef.current += 1;
      setMfaSetupPolling(false);
      window.setTimeout(() => {
        startMfaSetupPolling(pairingToken);
      }, 0);
    }
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
          setMfaAutoStartingSession(true);
          window.setTimeout(() => {
            if (activeSetupPollRunRef.current !== runId) return;
            const formElement = document.querySelector('form') as HTMLFormElement | null;
            formElement?.requestSubmit();
          }, 900);
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
  };

  const requestFallbackMfaSetup = async () => {
    const params = new URLSearchParams(window.location.search);
    const runtimeApiKey = params.get('api_key') || '';

    if (!runtimeApiKey) {
      throw new Error('No se encontró api_key en la URL para continuar con la configuración MFA.');
    }

    const response = await fetch(`${API_BASE_URL}/mfa-generate-pairing-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'X-Client-Info': 'authsystem-branded-form/1.0'
      },
      body: JSON.stringify({
        application_id: applicationId,
        api_key: runtimeApiKey,
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

  useEffect(() => {
    if (!mfaChallengeId || mfaCodeExpiresIn <= 0) return;

    const timer = window.setInterval(() => {
      setMfaCodeExpiresIn(current => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [mfaChallengeId, mfaCodeExpiresIn]);

  const startMfaChallengePolling = (challengeId: string) => {
    const runId = ++activeChallengePollRunRef.current;
    setMfaPolling(true);

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runPolling = async () => {
      const pollingEndpoint = `${API_BASE_URL}/mfa-check-challenge`;
      const maxAttempts = 60;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (activeChallengePollRunRef.current !== runId) return;
        await wait(2000);

        const checkResponse = await fetch(pollingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'X-Client-Info': 'authsystem-branded-form/1.0'
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
          setMessageStatus('success');
          setRuntimeErrorText('Aprobación recibida. Iniciando sesión...');
          if (onSuccess) {
            onSuccess(checkResult.data);
          }
          if (checkResult?.data?.callback_url) {
            setTimeout(() => {
              window.location.href = checkResult.data.callback_url;
            }, 900);
          }
          return;
        }

        if (challengeStatus === 'rejected') {
          setMessageStatus('error');
          setRuntimeErrorText('Aprobación rechazada desde la app Authenticator.');
          return;
        }

        if (challengeStatus === 'expired') {
          setMessageStatus('error');
          setRuntimeErrorText('El desafío MFA expiró. Inicia sesión nuevamente.');
          return;
        }

        if (challengeStatus === 'approved_consumed') {
          setMessageStatus('error');
          setRuntimeErrorText('El desafío MFA ya fue consumido. Inicia sesión nuevamente.');
          return;
        }
      }

      if (activeChallengePollRunRef.current === runId) {
        setMessageStatus('error');
        setRuntimeErrorText('Tiempo de espera agotado para la aprobación MFA.');
      }
    };

    runPolling().finally(() => {
      if (activeChallengePollRunRef.current === runId) {
        setMfaPolling(false);
      }
    });
  };

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
    setMfaAutoStartingSession(false);
    setMfaSetupPolling(false);
    setMfaChallengeId(null);
    setMfaVerificationNumber('');
    setMfaCodeExpiresIn(0);
    setShowMfaManualEntry(false);
    setMfaManualCode('');
    setMfaPolling(false);
    setMfaCompletingLogin(false);
    activeSetupPollRunRef.current += 1;
    activeChallengePollRunRef.current += 1;

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
      let shouldNotifyError = true;

      if (errorCode === 'MFA_SETUP_REQUIRED') {
        beginMfaSetupFlow(errorData || null);
        shouldNotifyError = false;
      } else if (errorCode === 'MFA_SETUP_ERROR') {
        try {
          const fallbackSetupData = await requestFallbackMfaSetup();
          beginMfaSetupFlow(fallbackSetupData || null);
          shouldNotifyError = false;
          return;
        } catch (fallbackError: any) {
          console.error('MFA setup fallback failed:', fallbackError);
          setRuntimeErrorText(fallbackError?.message || errorMessage);
        }
      } else if (errorCode === 'MFA_REQUIRED') {
        const challengeId = errorData?.challenge_id;
        const verificationNumber = String(errorData?.verification_number || '').padStart(2, '0');

        if (!challengeId) {
          setRuntimeErrorText('Desafío MFA inválido: falta challenge_id');
          if (onError) {
            onError('Desafío MFA inválido: falta challenge_id');
          }
          return;
        }

        setMessageStatus('idle');
        setRuntimeErrorText('');
        setMfaChallengeId(challengeId);
        setMfaVerificationNumber(verificationNumber || '');
        setMfaCodeExpiresIn(Number(errorData?.challenge_code_expires_in_seconds || 60));
        setShowMfaManualEntry(false);
        setMfaManualCode('');
        startMfaChallengePolling(challengeId);
        shouldNotifyError = false;
      } else {
        setRuntimeErrorText(errorMessage);

        if (errorMessage?.includes('Token manual:')) {
          const token = errorMessage.split('Token manual:')[1]?.trim();
          if (token) {
            setMfaSetupData({ pairing_token: token, qr_text: JSON.stringify({ pairing_token: token }) });
          }
        }
      }

      if (shouldNotifyError && onError) {
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

  const handleManualMfaCodeVerification = async () => {
    if (!mfaChallengeId) {
      setMessageStatus('error');
      setRuntimeErrorText('No hay desafío MFA activo.');
      return;
    }

    const manualCode = mfaManualCode.trim();
    if (!manualCode) {
      setMessageStatus('error');
      setRuntimeErrorText('Ingresa el código de verificación.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const runtimeApiKey = params.get('api_key') || '';

    if (!runtimeApiKey) {
      setMessageStatus('error');
      setRuntimeErrorText('No se encontró api_key en la URL para validar el código manual.');
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
          'X-Client-Info': 'authsystem-branded-form/1.0'
        },
        body: JSON.stringify({
          application_id: applicationId,
          api_key: runtimeApiKey,
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

      activeChallengePollRunRef.current += 1;
      setMfaPolling(false);

      const checkResponse = await fetch(`${API_BASE_URL}/mfa-check-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'X-Client-Info': 'authsystem-branded-form/1.0'
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
      setMessageStatus('success');
      setRuntimeErrorText('Aprobación recibida. Iniciando sesión...');

      if (onSuccess) {
        onSuccess(checkResult.data);
      }

      if (checkResult?.data?.callback_url) {
        setTimeout(() => {
          window.location.href = checkResult.data.callback_url;
        }, 900);
      }
    } catch (error: any) {
      setMfaCompletingLogin(false);
      setMessageStatus('error');
      setRuntimeErrorText(error.message || 'No se pudo verificar el código MFA');
    } finally {
      setMfaVerifyingCode(false);
    }
  };

  const handleRequestAnotherMfaCode = async () => {
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleCloseMfaChallengeModal = () => {
    activeChallengePollRunRef.current += 1;
    setMfaPolling(false);
    setMfaVerifyingCode(false);
    setMfaCompletingLogin(false);
    setShowMfaManualEntry(false);
    setMfaManualCode('');
    setMfaChallengeId(null);
    setMfaVerificationNumber('');
    setMfaCodeExpiresIn(0);
    setMessageStatus('idle');
    setRuntimeErrorText('');
  };

  const isMfaSetupFlow = formType === 'login' && !!mfaSetupData;
  const isMfaChallengeFlow = formType === 'login' && !!mfaChallengeId;

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
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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

        {!isMfaChallengeFlow && (
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
        )}
      </BrandedCard>

      {isMfaChallengeFlow && (
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
                  <p className="text-xs text-indigo-700">Código de 6 dígitos (se regenera cada 60 segundos).</p>
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
              <AuthSystemBadge branding={branding} text={getText('security_badge_text', 'AuthSystem')} compact />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center">
        <AuthSystemBadge branding={branding} text={getText('security_badge_text', 'AuthSystem')} compact />
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
