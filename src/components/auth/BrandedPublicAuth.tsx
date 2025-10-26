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
        return 'Welcome Back';
      case 'register':
        return 'Create Account';
      case 'reset-password':
        return 'Reset Password';
      default:
        return 'Authentication';
    }
  };

  const getFormSubtitle = () => {
    switch (formType) {
      case 'login':
        return 'Sign in to continue';
      case 'register':
        return 'Sign up to get started';
      case 'reset-password':
        return 'Enter your email to reset your password';
      default:
        return '';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Processing...';
    switch (formType) {
      case 'login':
        return 'Sign In';
      case 'register':
        return 'Create Account';
      case 'reset-password':
        return 'Send Reset Link';
      default:
        return 'Submit';
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
              label="Full Name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange('name')}
              branding={branding}
              icon={<User className="w-5 h-5" />}
            />
          )}

          <BrandedInput
            type="email"
            id="email"
            label="Email Address"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange('email')}
            branding={branding}
            icon={<Mail className="w-5 h-5" />}
          />

          {formType !== 'reset-password' && (
            <>
              <BrandedInput
                type={showPassword ? 'text' : 'password'}
                id="password"
                label="Password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange('password')}
                branding={branding}
                icon={<Lock className="w-5 h-5" />}
                showPasswordToggle
                onPasswordToggle={() => setShowPassword(!showPassword)}
                showPassword={showPassword}
              />

              {formType === 'register' && (
                <BrandedInput
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  label="Confirm Password"
                  placeholder="••••••••"
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
                  Forgot password?
                </a>
                <a href={`/register?app_id=${applicationId}`}
                   className="transition-colors hover:opacity-80"
                   style={{ color: branding.primary_color }}>
                  Create account
                </a>
              </>
            )}
            {formType === 'register' && (
              <a href={`/login?app_id=${applicationId}`}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                Already have an account? Sign in
              </a>
            )}
            {formType === 'reset-password' && (
              <a href={`/login?app_id=${applicationId}`}
                 className="transition-colors hover:opacity-80 mx-auto"
                 style={{ color: branding.primary_color }}>
                Back to sign in
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
