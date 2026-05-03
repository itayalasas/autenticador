// Template for AcceptInvitationForm - deployed as part of the Netlify auth project

export const ACCEPT_INVITATION_FORM_TEMPLATE = `import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Mail, Lock, User, Users, Shield } from 'lucide-react';
const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
const API_BASE = \`\${SUPABASE_URL}/functions/v1\`;

type InvitationInfo = {
  email: string;
  status: string;
  expires_at: string;
  application: { id: string; name: string };
  tenant: { id: string; name: string; slug?: string } | null;
  role: { id: string; name: string; display_name?: string; description?: string } | null;
  inviter: { id: string; name: string; email: string } | null;
};

export default function AcceptInvitationForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [info, setInfo] = useState<InvitationInfo | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const [successAppId, setSuccessAppId] = useState<string | null>(null);
  const [successApiKey, setSuccessApiKey] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);

  const expiresLabel = useMemo(() => {
    if (!info?.expires_at) return '';
    try {
      const date = new Date(info.expires_at);
      return date.toLocaleString();
    } catch {
      return info.expires_at;
    }
  }, [info?.expires_at]);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('No se proporcionó un token de invitación.');
        return;
      }

      try {
        const res = await fetch(\`\${API_BASE}/invitations-validate\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setStatus('error');
          const code = json?.error?.code;
          if (code === 'INVALID_STATE') {
            setErrorMessage(json?.error?.message || 'La invitación ya no es válida.');
          } else {
            setErrorMessage(json?.error?.message || 'No se pudo validar la invitación.');
          }
          return;
        }

        setInfo(json.data as InvitationInfo);
        setStatus('ready');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Error al validar la invitación.');
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (name.trim().length < 2) {
      setFormError('Ingresa tu nombre completo.');
      return;
    }
    if (password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch(\`\${API_BASE}/invitations-accept\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password
        })
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setStatus('ready');
        setFormError(json?.error?.message || 'No se pudo aceptar la invitación.');
        return;
      }

      setSuccessAppId(json.data?.application_id || null);
      setSuccessApiKey(json.data?.api_key || null);
      setStatus('success');
    } catch (err: any) {
      setStatus('ready');
      setFormError(err?.message || 'Error al aceptar la invitación.');
    }
  };

  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      const params = new URLSearchParams();
      if (successAppId) params.set('app_id', successAppId);
      if (successApiKey) params.set('api_key', successApiKey);
      const qs = params.toString();
      navigate(qs ? \`/login?\${qs}\` : '/login', { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, successAppId, successApiKey, navigate]);

  const goLoginNow = () => {
    const params = new URLSearchParams();
    if (successAppId) params.set('app_id', successAppId);
    if (successApiKey) params.set('api_key', successApiKey);
    const qs = params.toString();
    navigate(qs ? \`/login?\${qs}\` : '/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        {status === 'loading' && (
          <div className="text-center py-10">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Validando tu invitación...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Invitación no válida</h1>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition"
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'submitting') && info && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-600 mb-3">
                <Mail className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Te invitaron a {info.application?.name}</h1>
              <p className="text-slate-500 text-sm mt-1">Completa tus datos para unirte al equipo</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-900 font-medium">{info.email}</span>
              </div>
              {info.tenant && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Organización:</span>
                  <span className="text-slate-900 font-medium">{info.tenant.name}</span>
                </div>
              )}
              {info.role && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Rol:</span>
                  <span className="text-slate-900 font-medium">{info.role.display_name || info.role.name}</span>
                </div>
              )}
              {info.inviter && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Invitado por:</span>
                  <span className="text-slate-900 font-medium">{info.inviter.name || info.inviter.email}</span>
                </div>
              )}
              {expiresLabel && (
                <div className="text-xs text-slate-400 pt-1">Expira: {expiresLabel}</div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Tu nombre"
                    required
                    disabled={status === 'submitting'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    disabled={status === 'submitting'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Repite la contraseña"
                    required
                    minLength={8}
                    disabled={status === 'submitting'}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  'Aceptar invitación'
                )}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Cuenta creada</h1>
            <p className="text-slate-600 mb-6">
              Ya formas parte del equipo. Te llevaremos al inicio de sesión en {countdown}s...
            </p>
            <button
              onClick={goLoginNow}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Iniciar sesión ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`;
