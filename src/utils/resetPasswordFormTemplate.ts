// Template for ResetPasswordForm - deployed as part of the Netlify auth project

export const RESET_PASSWORD_FORM_TEMPLATE = `import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, Mail, ArrowLeft } from 'lucide-react';

const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
const API_BASE = \`\${SUPABASE_URL}/functions/v1\`;
const REST_BASE = \`\${SUPABASE_URL}/rest/v1\`;
const REST_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  const appId = searchParams.get('app_id');
  const apiKey = searchParams.get('api_key');
  const callbackUrl = searchParams.get('callback_url') || searchParams.get('redirect_uri');

  const [mode, setMode] = useState<'request' | 'confirm'>('request');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [branding, setBranding] = useState<any>({});

  useEffect(() => {
    const run = async () => {
      try {
        if (token && emailFromUrl) {
          setMode('confirm');
          setEmail(emailFromUrl);
          // Validate token
          const res = await fetch(\`\${REST_BASE}/email_verification_tokens?token=eq.\${token}&select=*,app_users(id,email,application_id,applications(id,name,application_id,domain,email_config))\`, { headers: REST_HEADERS });
          const tokens = await res.json();
          const tokenData = tokens?.[0];
          if (!tokenData) { setError('Token de recuperación inválido o expirado.'); setLoading(false); return; }
          if (new Date(tokenData.expires_at) < new Date()) { setError('Este link ha expirado. Solicita uno nuevo.'); setLoading(false); return; }
          if (tokenData.used_at) { setError('Este link ya ha sido utilizado.'); setLoading(false); return; }
          const appUser = tokenData.app_users;
          if (!appUser || appUser.email !== emailFromUrl) { setError('Email no coincide con el token.'); setLoading(false); return; }
          const app = appUser.applications;
          if (app) {
            setApplication(app);
            const bRes = await fetch(\`\${REST_BASE}/branding_configs?application_id=eq.\${app.id}&select=*&limit=1\`, { headers: REST_HEADERS });
            const bArr = await bRes.json();
            if (bArr?.[0]) setBranding(bArr[0]);
          }
        } else if (appId) {
          setMode('request');
          const res = await fetch(\`\${REST_BASE}/applications?application_id=eq.\${appId}&select=*\`, { headers: REST_HEADERS });
          const apps = await res.json();
          const app = apps?.[0];
          if (!app) { setError('Aplicación no encontrada'); setLoading(false); return; }
          setApplication(app);
          const bRes = await fetch(\`\${REST_BASE}/branding_configs?application_id=eq.\${app.id}&select=*&limit=1\`, { headers: REST_HEADERS });
          const bArr = await bRes.json();
          if (bArr?.[0]) setBranding(bArr[0]);
        } else {
          setError('Parámetros inválidos');
        }
      } catch {
        setError('Error al cargar la aplicación');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token, emailFromUrl, appId]);

  const primaryColor = branding?.primary_color || '#3B82F6';
  const bgColor = branding?.background_color || '#F9FAFB';
  const textColor = branding?.text_color || '#111827';
  const fontFamily = branding?.font_family || 'Inter, system-ui, sans-serif';
  const borderRadius = branding?.border_radius || 8;
  const logoUrl = branding?.logo_url || '';
  const appName = application?.name || 'Aplicación';

  const inputStyle: React.CSSProperties = { borderRadius, borderColor: '#D1D5DB', fontFamily };
  const buttonStyle: React.CSSProperties = { backgroundColor: primaryColor, borderRadius, fontFamily, color: '#fff' };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(\`\${API_BASE}/auth-reset-password\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ application_id: appId, email, callback_url: callbackUrl || window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Error al solicitar recuperación');
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al solicitar recuperación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cfg = application?.email_config || {};
    const minLen = cfg.password_min_length || 8;
    const errs: string[] = [];
    if (password.length < minLen) errs.push(\`Mínimo \${minLen} caracteres\`);
    if (cfg.password_require_uppercase !== false && !/[A-Z]/.test(password)) errs.push('Una mayúscula');
    if (cfg.password_require_lowercase !== false && !/[a-z]/.test(password)) errs.push('Una minúscula');
    if (cfg.password_require_numbers !== false && !/[0-9]/.test(password)) errs.push('Un número');
    if (cfg.password_require_symbols && !/[@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?]/.test(password)) errs.push('Un símbolo');
    if (errs.length) { setError(errs.join('. ')); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(\`\${API_BASE}/auth-reset-password-confirm\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ token, email: emailFromUrl, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Error al restablecer la contraseña');
      setSuccess(true);
      setTimeout(() => {
        const params = new URLSearchParams();
        if (appId) params.set('app_id', appId);
        if (apiKey) params.set('api_key', apiKey);
        if (callbackUrl) params.set('callback_url', callbackUrl);
        window.location.href = \`/login?\${params.toString()}\`;
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, fontFamily }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor, fontFamily, color: textColor }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-12 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: primaryColor }}>
              <Lock className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>{appName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'confirm' ? 'Crea una nueva contraseña' : 'Recuperar contraseña'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="flex items-start space-x-2 p-3 rounded-lg mb-5 text-sm bg-red-50 text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start space-x-2 p-3 rounded-lg mb-5 text-sm bg-green-50 text-green-700">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Contraseña actualizada. Redirigiendo al login...</span>
            </div>
          )}

          {emailSent && !error && (
            <div className="flex items-start space-x-2 p-3 rounded-lg mb-5 text-sm bg-green-50 text-green-700">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Si el email existe, te hemos enviado instrucciones para restablecer tu contraseña.</span>
            </div>
          )}

          {mode === 'request' && !emailSent && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full pl-10 pr-4 py-2.5 border text-sm focus:outline-none transition-colors" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')} />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={buttonStyle}>
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Enviando...</span></>
                ) : <span>Enviar instrucciones</span>}
              </button>
              <a href={\`/login?app_id=\${appId || ''}\${apiKey ? \`&api_key=\${apiKey}\` : ''}\${callbackUrl ? \`&callback_url=\${callbackUrl}\` : ''}\`}
                className="flex items-center justify-center space-x-1 text-sm hover:underline mt-2" style={{ color: primaryColor }}>
                <ArrowLeft className="w-3 h-3" />
                <span>Volver a iniciar sesión</span>
              </a>
            </form>
          )}

          {mode === 'confirm' && !success && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-10 py-2.5 border text-sm focus:outline-none transition-colors" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full pl-10 pr-10 py-2.5 border text-sm focus:outline-none transition-colors" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={buttonStyle}>
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Actualizando...</span></>
                ) : <span>Actualizar contraseña</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
`;
