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
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

          {formType !== 'reset-password-confirm' && (
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

          {(formType === 'login' || formType === 'register' || formType === 'reset-password-confirm') && (
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
