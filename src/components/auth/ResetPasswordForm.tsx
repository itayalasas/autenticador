import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BrandingConfig {
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
  custom_texts?: {
    reset_password_title?: string;
    reset_password_subtitle?: string;
  };
}

interface Application {
  id: string;
  name: string;
  application_id: string;
  domain: string;
}

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [application, setApplication] = useState<Application | null>(null);
  const [branding, setBranding] = useState<BrandingConfig>({
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
  });

  useEffect(() => {
    if (!token || !email) {
      setError('Link de recuperación inválido. Faltan parámetros.');
      setValidating(false);
      setLoading(false);
      return;
    }

    validateToken();
  }, [token, email]);

  const validateToken = async () => {
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('email_verification_tokens')
        .select(`
          *,
          app_users (
            id,
            email,
            application_id,
            applications (
              id,
              name,
              application_id,
              domain
            )
          )
        `)
        .eq('token', token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        setError('Token de recuperación inválido o expirado.');
        setValidating(false);
        setLoading(false);
        return;
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        setError('Este link de recuperación ha expirado. Por favor solicita uno nuevo.');
        setValidating(false);
        setLoading(false);
        return;
      }

      if (tokenData.used_at) {
        setError('Este link de recuperación ya ha sido utilizado.');
        setValidating(false);
        setLoading(false);
        return;
      }

      const appUser = tokenData.app_users;
      if (!appUser || appUser.email !== email) {
        setError('Email no coincide con el token.');
        setValidating(false);
        setLoading(false);
        return;
      }

      const app = appUser.applications;
      if (app) {
        setApplication({
          id: app.id,
          name: app.name,
          application_id: app.application_id,
          domain: app.domain,
        });

        const { data: brandingData } = await supabase
          .from('branding_configs')
          .select('*')
          .eq('application_id', app.id)
          .maybeSingle();

        if (brandingData) {
          setBranding(brandingData);
        }
      }

      setValidating(false);
      setLoading(false);
    } catch (err: any) {
      setError('Error al validar el token. Por favor intenta nuevamente.');
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-reset-password-confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            token,
            email,
            new_password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Error al restablecer la contraseña');
      }

      setSuccess(true);

      setTimeout(() => {
        if (application) {
          window.location.href = `https://${application.domain}/login?app_id=${application.application_id}`;
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña. Por favor intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Validando token...</p>
        </div>
      </div>
    );
  }

  if (error && !validating && !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contraseña Actualizada</h2>
          <p className="text-gray-600 mb-4">
            Tu contraseña ha sido actualizada exitosamente.
          </p>
          <p className="text-sm text-gray-500">
            Serás redirigido a la página de inicio de sesión...
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = branding.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {branding.logo_url && (
            <div className="text-center mb-6">
              <img
                src={branding.logo_url}
                alt={application?.name || 'Logo'}
                className="h-12 mx-auto"
              />
            </div>
          )}

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {branding.custom_texts?.reset_password_title || 'Restablecer Contraseña'}
            </h2>
            <p className="text-gray-600">
              {branding.custom_texts?.reset_password_subtitle ||
                `Ingresa tu nueva contraseña para ${application?.name || 'tu cuenta'}`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email || ''}
                disabled
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent"
                  style={{
                    focusRing: `2px solid ${primaryColor}40`,
                  }}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent"
                  style={{
                    focusRing: `2px solid ${primaryColor}40`,
                  }}
                  placeholder="Repite tu contraseña"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Actualizando...
                </span>
              ) : (
                'Restablecer Contraseña'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Powered by AuthSystem
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
