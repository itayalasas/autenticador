import React, { useState, useEffect } from 'react';
import { Building2, User, Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { applyFaviconToDocument } from '../../utils/favicon';

const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcXRtbm5jZ2lxa3ZlYW9xY2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MDEyNDMsImV4cCI6MjA3NTM3NzI0M30.n2yaYrfHDLAFePP1tA3-250P6bgKmf696fYJFHfRZaQ';
const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

interface Step {
  id: number;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { id: 1, title: 'Datos de la Empresa', subtitle: 'Información de tu organización' },
  { id: 2, title: 'Cuenta de Administrador', subtitle: 'Crea el usuario administrador' },
];

export default function RegisterTenantForm() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('app_id');
  const apiKey = searchParams.get('api_key');
  const redirectUri = searchParams.get('redirect_uri') || searchParams.get('callback_url');

  const [appData, setAppData] = useState<any>(null);
  const [branding, setBranding] = useState<any>({});
  const [loadingApp, setLoadingApp] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [resolvedApiKey, setResolvedApiKey] = useState<string | null>(apiKey);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

  const [tenantData, setTenantData] = useState({
    name: '',
    slug: '',
    domain: '',
  });

  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    const loadApp = async () => {
      if (!appId) {
        setAppError('Falta el parámetro app_id en la URL');
        setLoadingApp(false);
        return;
      }

      try {
        const { data: app, error } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', appId)
          .maybeSingle();

        if (error || !app) {
          setAppError('Aplicación no encontrada');
          setLoadingApp(false);
          return;
        }

        if (app.auth_mode !== 'tenant') {
          setAppError('Esta aplicación no tiene habilitada la autenticación por tenant');
          setLoadingApp(false);
          return;
        }

        // Resolve API key
        if (!apiKey) {
          const { data: keys } = await supabase
            .from('api_keys')
            .select('key_hash')
            .eq('application_id', app.id)
            .eq('is_active', true)
            .limit(1);
          if (keys && keys.length > 0) {
            setResolvedApiKey(keys[0].key_hash);
          }
        }

        try {
          const b = await applicationService.getBranding(app.id);
          setBranding(b || {});
          if (b?.favicon_url) applyFaviconToDocument(b.favicon_url);
        } catch {
          // ignore branding errors
        }

        setAppData(app);
      } catch (err) {
        setAppError('Error al cargar la aplicación');
      } finally {
        setLoadingApp(false);
      }
    };

    applyFaviconToDocument('/images/icon.svg');
    loadApp();
  }, [appId]);

  // Auto-generate slug from tenant name
  useEffect(() => {
    if (!slugManuallyEdited && tenantData.name) {
      const slug = tenantData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
      setTenantData(prev => ({ ...prev, slug }));
    }
  }, [tenantData.name, slugManuallyEdited]);

  const primaryColor = branding?.primary_color || '#3B82F6';
  const bgColor = branding?.background_color || '#F9FAFB';
  const textColor = branding?.text_color || '#111827';
  const fontFamily = branding?.font_family || 'Inter, system-ui, sans-serif';
  const borderRadius = branding?.border_radius || 8;
  const logoUrl = branding?.logo_url || '';
  const appName = appData?.name || 'Aplicación';

  const validateStep1 = () => {
    if (!tenantData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la empresa es requerido' });
      return false;
    }
    if (!tenantData.slug.trim()) {
      setMessage({ type: 'error', text: 'El identificador es requerido' });
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(tenantData.slug)) {
      setMessage({ type: 'error', text: 'El identificador solo puede contener letras minúsculas, números y guiones' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!adminData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es requerido' });
      return false;
    }
    if (!adminData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
      setMessage({ type: 'error', text: 'Ingresa un email válido' });
      return false;
    }
    if (adminData.password.length < 8) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' });
      return false;
    }
    if (adminData.password !== adminData.confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setMessage(null);
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!validateStep2()) return;
    if (!resolvedApiKey) {
      setMessage({ type: 'error', text: 'No se encontró una API Key válida para esta aplicación' });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Register tenant
      const tenantRes = await fetch(`${API_BASE_URL}/register-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          application_id: appId,
          api_key: resolvedApiKey,
          name: tenantData.name,
          slug: tenantData.slug,
          domain: tenantData.domain || undefined,
        }),
      });

      const tenantResult = await tenantRes.json();
      if (!tenantRes.ok || !tenantResult.success) {
        throw new Error(tenantResult?.error?.message || 'Error al registrar la empresa');
      }

      const tenantId = tenantResult.data.tenant_id;
      setCreatedTenantId(tenantId);

      // Step 2: Register admin user for this tenant
      const registerRes = await fetch(`${API_BASE_URL}/auth-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          application_id: appId,
          api_key: resolvedApiKey,
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
          tenant_id: tenantId,
          redirect_uri: redirectUri || undefined,
        }),
      });

      const registerResult = await registerRes.json();
      if (!registerRes.ok || !registerResult.success) {
        throw new Error(registerResult?.error?.message || 'Error al crear el usuario administrador');
      }

      setSuccess(true);
      setMessage({ type: 'success', text: '¡Empresa registrada exitosamente! Redirigiendo al login...' });

      // Redirect to login
      setTimeout(() => {
        const params = new URLSearchParams();
        params.set('app_id', appId!);
        if (resolvedApiKey) params.set('api_key', resolvedApiKey);
        if (redirectUri) params.set('redirect_uri', redirectUri);
        window.location.href = `/login?${params.toString()}`;
      }, 2000);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error inesperado' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: borderRadius,
    borderColor: '#D1D5DB',
    fontFamily,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: primaryColor,
    borderRadius: borderRadius,
    fontFamily,
    color: '#fff',
  };

  if (loadingApp) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, fontFamily }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor }} />
      </div>
    );
  }

  if (appError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, fontFamily }}>
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-sm w-full mx-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error de configuración</h2>
          <p className="text-gray-500 text-sm">{appError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: bgColor, fontFamily, color: textColor }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-12 mx-auto mb-4 object-contain" />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: primaryColor }}
            >
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>{appName}</h1>
          <p className="text-gray-500 text-sm mt-1">Registrar nueva empresa</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: currentStep >= step.id ? primaryColor : '#E5E7EB',
                    color: currentStep >= step.id ? '#fff' : '#6B7280',
                  }}
                >
                  {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p className="text-xs font-medium" style={{ color: currentStep >= step.id ? textColor : '#6B7280' }}>
                    {step.title}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-3 transition-all"
                  style={{ backgroundColor: currentStep > step.id ? primaryColor : '#E5E7EB' }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-sm text-gray-500">{STEPS[currentStep - 1].subtitle}</p>
          </div>

          {message && (
            <div
              className={`flex items-start space-x-2 p-3 rounded-lg mb-5 text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Company name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Nombre de la empresa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={tenantData.name}
                    onChange={e => {
                      setTenantData(prev => ({ ...prev, name: e.target.value }));
                      setMessage(null);
                    }}
                    placeholder="Acme Corp"
                    className="w-full pl-10 pr-4 py-2.5 border text-sm focus:outline-none focus:ring-2 transition-colors"
                    style={{ ...inputStyle, focusBorderColor: primaryColor }}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Identificador (slug) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tenantData.slug}
                  onChange={e => {
                    setSlugManuallyEdited(true);
                    setTenantData(prev => ({
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    }));
                    setMessage(null);
                  }}
                  placeholder="acme-corp"
                  className="w-full px-4 py-2.5 border text-sm focus:outline-none transition-colors font-mono"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = primaryColor)}
                  onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                />
                <p className="text-xs text-gray-400 mt-1">Solo letras minúsculas, números y guiones</p>
              </div>

              {/* Domain (optional) */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Dominio <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={tenantData.domain}
                  onChange={e => {
                    setTenantData(prev => ({ ...prev, domain: e.target.value }));
                    setMessage(null);
                  }}
                  placeholder="empresa.com"
                  className="w-full px-4 py-2.5 border text-sm focus:outline-none transition-colors"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = primaryColor)}
                  onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                />
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2 transition-all hover:opacity-90 mt-2"
                style={buttonStyle}
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Admin name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={adminData.name}
                    onChange={e => {
                      setAdminData(prev => ({ ...prev, name: e.target.value }));
                      setMessage(null);
                    }}
                    placeholder="Juan Pérez"
                    className="w-full pl-10 pr-4 py-2.5 border text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={adminData.email}
                    onChange={e => {
                      setAdminData(prev => ({ ...prev, email: e.target.value }));
                      setMessage(null);
                    }}
                    placeholder="admin@empresa.com"
                    className="w-full pl-10 pr-4 py-2.5 border text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminData.password}
                    onChange={e => {
                      setAdminData(prev => ({ ...prev, password: e.target.value }));
                      setMessage(null);
                    }}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-10 py-2.5 border text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textColor }}>
                  Confirmar contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminData.confirmPassword}
                    onChange={e => {
                      setAdminData(prev => ({ ...prev, confirmPassword: e.target.value }));
                      setMessage(null);
                    }}
                    placeholder="Repite tu contraseña"
                    className="w-full pl-10 pr-4 py-2.5 border text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = primaryColor)}
                    onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    setMessage(null);
                  }}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ borderRadius }}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading || success}
                  className="flex-2 flex-grow py-2.5 text-sm font-semibold flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-60"
                  style={buttonStyle}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Registrado</span>
                    </>
                  ) : (
                    <span>Registrar Empresa</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer link to login */}
        {!success && (
          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <a
              href={`/login?app_id=${appId}${resolvedApiKey ? `&api_key=${resolvedApiKey}` : ''}${redirectUri ? `&redirect_uri=${redirectUri}` : ''}`}
              className="font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Inicia sesión
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
