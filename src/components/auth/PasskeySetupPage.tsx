import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import {
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { completePasskeySetup, startPasskeySetup } from '../../services/passkeyService';
import { applyFaviconToDocument } from '../../utils/favicon';

type PasskeySetupState = {
  application?: { application_id?: string; name?: string };
  user?: { name?: string; email?: string };
  options?: any;
  device_name?: string;
  expires_at?: string;
  branding?: any;
};

export default function PasskeySetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const appId = searchParams.get('app_id') || '';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupState, setSetupState] = useState<PasskeySetupState | null>(null);

  const appName = setupState?.application?.name || 'AuthSystem';
  const userName = setupState?.user?.name || setupState?.user?.email || 'usuario';
  const accentColor = setupState?.branding?.primary_color || '#0A78D1';
  const secondaryColor = setupState?.branding?.secondary_color || '#0F3D6E';

  useEffect(() => {
    applyFaviconToDocument(setupState?.branding?.favicon_url || '/images/icon.svg');
  }, [setupState?.branding?.favicon_url]);

  useEffect(() => {
    const loadSetup = async () => {
      if (!token || !appId) {
        setError('El enlace de la clave de paso no tiene token o aplicación.');
        setLoading(false);
        return;
      }

      if (!window.PublicKeyCredential) {
        setError('Tu navegador no soporta claves de paso.');
        setLoading(false);
        return;
      }

      if (!window.isSecureContext) {
        setError('Las claves de paso requieren un contexto seguro. Usa HTTPS o localhost.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result: any = await startPasskeySetup({ token, application_id: appId });

        if (!result || result.success === false) {
          throw new Error(result?.error?.message || result?.message || 'No se pudo preparar la clave de paso.');
        }

        setSetupState(result.data);
      } catch (loadError: any) {
        setError(loadError?.message || 'No se pudo preparar la clave de paso.');
      } finally {
        setLoading(false);
      }
    };

    loadSetup();
  }, [token, appId]);

  const expiresLabel = useMemo(() => {
    if (!setupState?.expires_at) return '';
    return new Date(setupState.expires_at).toLocaleString('es-ES');
  }, [setupState?.expires_at]);

  const handleCreatePasskey = async () => {
    if (!setupState?.options) return;

    try {
      setSubmitting(true);
      setError(null);

      const credential = await startRegistration(setupState.options);
      const result: any = await completePasskeySetup({
        token,
        application_id: appId,
        credential,
      });

      if (!result || result.success === false) {
        throw new Error(result?.error?.message || result?.message || 'No se pudo completar la creación de la clave de paso.');
      }

      setSuccess(true);
    } catch (createError: any) {
      setError(createError?.message || 'No se pudo crear la clave de paso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(10,120,209,0.14),_transparent_42%),linear-gradient(180deg,#f8fbff_0%,#eef5fb_48%,#ffffff_100%)] px-4 py-6 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden px-8 py-10 text-white sm:px-10" style={{ background: `linear-gradient(140deg, ${accentColor}, ${secondaryColor})` }}>
            <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at bottom left, rgba(255,255,255,0.14), transparent 30%)' }} />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                  <Sparkles size={14} />
                  Passkey setup
                </div>
                <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                  Crea una clave de paso para <span className="block">{appName}</span>
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
                  Vamos a registrar una credencial moderna y segura para que este usuario pueda iniciar sesión sin depender de contraseñas.
                </p>
              </div>

              <div className="mt-10 grid gap-3 text-sm text-white/92 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck size={16} />
                    Verificación segura
                  </div>
                  <p className="mt-2 leading-6 text-white/78">
                    La creación se valida contra el token enviado por correo y el origen público de la aplicación.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <Fingerprint size={16} />
                    Credencial del navegador
                  </div>
                  <p className="mt-2 leading-6 text-white/78">
                    Se usa la API nativa de passkeys del dispositivo, sin formularios técnicos innecesarios.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10">
            {loading ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Preparando la clave de paso</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Estamos verificando el enlace y cargando la configuración segura para esta cuenta.
                </p>
              </div>
            ) : error ? (
              <div className="flex min-h-[520px] flex-col justify-center">
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
                    Error
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-slate-900">No se pudo iniciar el registro</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ArrowLeft size={16} />
                    Reintentar
                  </button>
                </div>
              </div>
            ) : success ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={38} />
                </div>
                <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Clave de paso creada</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  La credencial quedó registrada para {userName}. Ya puedes volver al inicio de sesión y usar este método cuando haga falta.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/login?app_id=${encodeURIComponent(appId)}`)}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    Ir al login
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <KeyRound size={28} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Crear clave de paso</p>
                      <h2 className="text-2xl font-bold text-slate-900">{appName}</h2>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usuario</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">{userName}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Correo</p>
                          <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Mail size={16} className="text-slate-500" />
                            <span>{setupState?.user?.email || 'Sin correo'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dispositivo sugerido</p>
                          <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Smartphone size={16} className="text-slate-500" />
                            <span>{setupState?.device_name || 'Este dispositivo'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expira</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">{expiresLabel || 'Pronto'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                        <ShieldCheck size={16} />
                        Paso final
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Presiona el botón para abrir el diálogo nativo del navegador y guardar esta clave de paso en tu cuenta.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate(`/login?app_id=${encodeURIComponent(appId)}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ArrowLeft size={16} />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePasskey}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ backgroundColor: accentColor }}
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                    Crear clave de paso
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
