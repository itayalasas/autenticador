import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';
import { requireSupabaseUrl } from '../../lib/supabaseRuntime';

function extractTokenFromCandidates(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = (candidate || '').trim();
    if (!trimmed) continue;

    const match = trimmed.match(/[a-f0-9]{64}/i);
    if (match?.[0]) {
      return match[0];
    }
  }

  return '';
}

function extractEmailFromCandidates(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = (candidate || '').trim();
    if (!trimmed) continue;

    const match = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match?.[0]) {
      return match[0];
    }
  }

  return '';
}

export default function VerifyEmailForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = extractTokenFromCandidates(
    searchParams.get('token'),
    typeof window !== 'undefined' ? window.location.href : ''
  );
  const email = extractEmailFromCandidates(
    searchParams.get('email'),
    typeof window !== 'undefined' ? window.location.href : ''
  );

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando tu cuenta...');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No se proporcionó un token de verificación.');
        return;
      }

      try {
        const supabaseUrl = requireSupabaseUrl();
        const res = await fetch(`${supabaseUrl}/functions/v1/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setStatus('error');
          setMessage(json?.error?.message || 'No se pudo verificar la cuenta.');
          return;
        }

        setStatus('success');
        setUserName(json.data?.name || '');
        setMessage(json.data?.message || 'Cuenta activada correctamente.');
      } catch {
        setStatus('error');
        setMessage('Error de red al validar el token. Intenta nuevamente.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${status === 'verifying' ? 'bg-sky-50' : status === 'success' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            {status === 'verifying' && <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />}
            {status === 'success' && <CheckCircle className="w-8 h-8 text-emerald-600" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-rose-600" />}
          </div>

          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {status === 'verifying' && 'Verificando email'}
            {status === 'success' && 'Email verificado'}
            {status === 'error' && 'No se pudo verificar'}
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {userName && status === 'success' ? `Bienvenido ${userName}. ` : ''}
            {message}
          </p>

          {email && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 mb-6">
              <Mail className="w-3.5 h-3.5" />
              <span>{email}</span>
            </div>
          )}

          {status === 'success' && (
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ir al inicio de sesión
            </button>
          )}

          {status === 'error' && (
            <div className="w-full space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Reintentar
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
