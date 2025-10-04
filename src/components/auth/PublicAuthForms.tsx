import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { rolesService } from '../../services/rolesService';
import { applicationService } from '../../services/applicationService';
import { ipService } from '../../services/ipService';

interface PublicAuthFormsProps {
  applicationId: string;
  internalApplicationId?: string;
  formType: 'login' | 'register' | 'reset-password';
  apiKey: string | null;
  appInfo?: any;
  branding?: {
    primary_color?: string;
    secondary_color?: string;
    background_color?: string;
    text_color?: string;
    font_family?: string;
    logo_url?: string;
    border_radius?: number;
    button_style?: string;
  };
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export default function PublicAuthForms({
  applicationId,
  internalApplicationId,
  formType,
  apiKey,
  branding = {},
  onSuccess,
  onError
}: PublicAuthFormsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingIP, setCheckingIP] = useState(true);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [customTexts, setCustomTexts] = useState<any>({});
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Default branding values
  const defaultBranding = {
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    background_color: '#FFFFFF',
    text_color: '#1F2937',
    font_family: 'Inter',
    logo_url: '',
    border_radius: 8,
    button_style: 'rounded',
    ...branding
  };

  // Get environment from URL parameters or default to development
  const environment = searchParams.get('env') || 'development';
  

  useEffect(() => {
    // Check IP status first
    checkIPStatus();
    // Load application info
    loadApplicationInfo();
    loadCustomTexts();
    if (formType === 'register') {
      loadAvailableRoles();
    }
  }, [applicationId]);

  const checkIPStatus = async () => {
    try {
      setCheckingIP(true);

      const result = await ipService.checkIPStatus();

      if (result.is_blocked) {
        console.log('🚫 IP is blocked:', result);
        setIpBlocked(true);
        setBlockedInfo(result.blocked_info);
      } else {
        console.log('✅ IP is not blocked:', result.ip_address);
      }
    } catch (error) {
      console.error('❌ Error checking IP status:', error);
      // En caso de error, permitimos el acceso para no bloquear usuarios legítimos
      setIpBlocked(false);
    } finally {
      setCheckingIP(false);
    }
  };

  const loadApplicationInfo = async () => {
    try {
      // Mock application data - replace with actual API call
      setAppInfo({
        name: 'Mi Aplicación',
        domain: 'miapp.com',
        description: 'Sistema de autenticación'
      });
    } catch (error) {
      console.error('Error loading application info:', error);
    }
  };

  const loadCustomTexts = async () => {
    try {
      if (internalApplicationId) {
        const brandingConfig = await applicationService.getBranding(internalApplicationId);
        if (brandingConfig && brandingConfig.custom_texts) {
          setCustomTexts(brandingConfig.custom_texts);
        }
      }
    } catch (error) {
      console.error('Error loading custom texts:', error);
    }
  };
  const loadAvailableRoles = async () => {
    try {
      if (internalApplicationId) {
        const roles = await rolesService.getAvailableRolesForRegistration(internalApplicationId);
        setAvailableRoles(roles);
        
        // Set default role if available
        const defaultRole = roles.find(role => role.is_default);
        if (defaultRole) {
          setSelectedRole(defaultRole.name);
        }
      }
    } catch (error) {
      console.error('Error loading available roles:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Obtener parámetros de la URL
      const urlParams = new URLSearchParams(window.location.search);
      const callbackUrl = urlParams.get('callback_url') || urlParams.get('redirect_uri');
      
      if (!apiKey) {
        throw new Error('API key no disponible para esta aplicación');
      }

      let endpoint = '';
      let payload: any = {};

      switch (formType) {
        case 'login':
          endpoint = `/api/auth/login`;
          payload = {
            email: formData.email,
            password: formData.password,
            application_id: applicationId,
            callback_url: callbackUrl
          };
          break;
        case 'register':
          if (formData.password !== formData.confirmPassword) {
            throw new Error('Las contraseñas no coinciden');
          }
          endpoint = `/api/auth/register`;
          payload = {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            application_id: applicationId,
            callback_url: callbackUrl,
            role: selectedRole || undefined
          };
          break;
        case 'reset-password':
          endpoint = `/api/auth/reset-password`;
          payload = {
            email: formData.email,
            application_id: applicationId
          };
          break;
      }

      console.log('🚀 Making API request:', {
        endpoint,
        apiKey: apiKey.substring(0, 20) + '...',
        payload: { ...payload, password: '***' }
      });

      // Llamar a la API de autenticación
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('📥 API Response:', result);

      if (!result.success) {
        // Manejar caso especial de email no verificado
        if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
          setMessage({ 
            type: 'error', 
            text: result.error.message 
          });
          
          // Si hay callback URL para verificación, redirigir después de un delay
          if (result.error.callback_url) {
            setTimeout(() => {
              window.location.href = result.error.callback_url;
            }, 3000);
          }
          return;
        }
        
        throw new Error(result.error?.message || 'Error en la autenticación');
      }
      
      // Manejar diferentes tipos de respuesta
      if (formType === 'register' && result.data?.email_verification_required) {
        setMessage({ 
          type: 'success', 
          text: 'Cuenta creada exitosamente. Revisa tu email para verificar tu cuenta.' 
        });
        
        // Redirigir a página de verificación si hay callback URL
        if (result.data?.callback_url) {
          setTimeout(() => {
            window.location.href = result.data.callback_url;
          }, 3000);
        }
      } else {
        setMessage({ 
          type: 'success', 
          text: formType === 'login' ? '¡Bienvenido!' : 
                formType === 'register' ? 'Cuenta creada exitosamente' :
                'Email de recuperación enviado'
        });
        
        // Si hay callback URL, redirigir después de un breve delay
        if (result.data?.callback_url) {
          console.log('🔄 Redirecting to callback URL:', result.data.callback_url);
          setTimeout(() => {
            window.location.href = result.data.callback_url;
          }, 2000);
        } else {
          // Si no hay callback, mostrar los datos del usuario para desarrollo
          console.log('Autenticación exitosa:', result.data);
          
          // Guardar tokens en localStorage para desarrollo
          if (result.data.access_token) {
            localStorage.setItem('auth_token', result.data.access_token);
            localStorage.setItem('refresh_token', result.data.refresh_token);
            localStorage.setItem('user_data', JSON.stringify(result.data.user));
            
            console.log('💾 Tokens guardados en localStorage:', {
              access_token: result.data.access_token.substring(0, 20) + '...',
              user: result.data.user
            });
          }
        }
      }
      
      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ha ocurrido un error';
      setMessage({ type: 'error', text: errorMessage });
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get custom text or fallback to default
  const getText = (key: string, defaultText: string) => {
    return customTexts[key] || defaultText;
  };

  const getFormTitle = () => {
    switch (formType) {
      case 'login': return getText('login_title', 'Iniciar Sesión');
      case 'register': return getText('register_title', 'Crear Cuenta');
      case 'reset-password': return getText('reset_title', 'Recuperar Contraseña');
      default: return getText('auth_title', 'Autenticación');
    }
  };

  const getFormSubtitle = () => {
    switch (formType) {
      case 'login': return getText('login_subtitle', 'Ingresa tus credenciales');
      case 'register': return getText('register_subtitle', 'Regístrate para comenzar');
      case 'reset-password': return getText('reset_subtitle', 'Te enviaremos un email para recuperar tu contraseña');
      default: return '';
    }
  };

  const urlParams = new URLSearchParams(window.location.search);

  // Show loading while checking IP
  if (checkingIP) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Show blocked screen if IP is blocked
  if (ipBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl border border-red-200 p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Acceso Bloqueado
            </h1>
            <p className="text-gray-600 mb-6">
              Tu dirección IP ha sido bloqueada temporalmente por razones de seguridad.
            </p>
            {blockedInfo && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Razón:</strong> {blockedInfo.reason}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Fecha:</strong> {new Date(blockedInfo.blocked_at).toLocaleString()}
                </p>
                {blockedInfo.expires_at && (
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Expira:</strong> {new Date(blockedInfo.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Si crees que esto es un error, por favor contacta al administrador del sistema.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Protegido por AuthSystem</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: defaultBranding.background_color,
        fontFamily: defaultBranding.font_family
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ backgroundColor: defaultBranding.primary_color }}
        ></div>
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ backgroundColor: defaultBranding.secondary_color }}
        ></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          {defaultBranding.logo_url ? (
            <img 
              src={defaultBranding.logo_url} 
              alt="Logo" 
              className="h-16 mx-auto mb-4"
            />
          ) : (
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: defaultBranding.primary_color }}
            >
              {appInfo?.name?.charAt(0) || 'A'}
            </div>
          )}
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: defaultBranding.text_color }}
          >
            {getFormTitle()}
          </h1>
          <p 
            className="text-gray-600 mb-4"
            style={{ color: defaultBranding.text_color }}
          >
            {getFormSubtitle()}
          </p>
          {appInfo && (
            <p className="text-sm text-gray-500 mt-2">
              {appInfo.name}
            </p>
          )}
        </div>

        {/* Auth Card */}
        <div 
          className="bg-white/80 backdrop-blur-lg shadow-xl border border-white/20 p-8"
          style={{ 
            borderRadius: `${defaultBranding.border_radius}px`
          }}
        >
          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`text-sm ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {formType === 'register' && (
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('register_name_label', 'Nombre Completo')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={formType === 'register'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                    style={{ 
                      borderRadius: `${defaultBranding.border_radius}px`,
                      '--tw-ring-color': defaultBranding.primary_color
                    } as React.CSSProperties}
                    placeholder={getText('register_name_placeholder', 'Tu nombre completo')}
                  />
                </div>
              </div>
            )}

            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: defaultBranding.text_color }}
              >
                {formType === 'login' ? getText('login_email_label', 'Email') : 
                 formType === 'register' ? getText('register_email_label', 'Email') :
                 getText('reset_email_label', 'Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                  style={{ 
                    borderRadius: `${defaultBranding.border_radius}px`,
                    '--tw-ring-color': defaultBranding.primary_color
                  } as React.CSSProperties}
                  placeholder={formType === 'login' ? getText('login_email_placeholder', 'tu@email.com') : 
                              formType === 'register' ? getText('register_email_placeholder', 'tu@email.com') :
                              getText('reset_email_placeholder', 'tu@email.com')}
                />
              </div>
            </div>

            {formType !== 'reset-password' && (
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {formType === 'login' ? getText('login_password_label', 'Contraseña') : 
                   getText('register_password_label', 'Contraseña')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                    style={{ 
                      borderRadius: `${defaultBranding.border_radius}px`,
                      '--tw-ring-color': defaultBranding.primary_color
                    } as React.CSSProperties}
                    placeholder={formType === 'login' ? getText('login_password_placeholder', '••••••••') : 
                                getText('register_password_placeholder', '••••••••')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {formType === 'register' && (
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('register_confirm_password_label', 'Confirmar Contraseña')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={formType === 'register'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                    style={{ 
                      borderRadius: `${defaultBranding.border_radius}px`,
                      '--tw-ring-color': defaultBranding.primary_color
                    } as React.CSSProperties}
                    placeholder={getText('register_confirm_password_placeholder', '••••••••')}
                  />
                </div>
              </div>
            )}

            {formType === 'register' && availableRoles.length > 0 && (
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: defaultBranding.text_color }}
                >
                  {getText('role_selection_label', 'Tipo de Usuario')}
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent transition-all"
                  style={{ 
                    borderRadius: `${defaultBranding.border_radius}px`,
                    '--tw-ring-color': defaultBranding.primary_color
                  } as React.CSSProperties}
                >
                  <option value="">{getText('role_selection_placeholder', 'Selecciona un rol')}</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.display_name}
                      {role.description && ` - ${role.description}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {getText('role_selection_description', 'Selecciona el tipo de acceso que necesitas en la aplicación')}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3 px-4 font-medium hover:opacity-90 focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              style={{ 
                backgroundColor: defaultBranding.primary_color,
                borderRadius: defaultBranding.button_style === 'rounded' 
                  ? `${defaultBranding.border_radius}px` 
                  : '4px',
                '--tw-ring-color': defaultBranding.primary_color
              } as React.CSSProperties}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{getFormTitle()}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-2">
            {formType === 'login' && (
              <>
                <a 
                  href={`/reset-password?app_id=${applicationId}&api_key=${urlParams.get('api_key') || ''}&callback_url=${encodeURIComponent(urlParams.get('callback_url') || '')}`}
                  className="text-sm hover:underline"
                  style={{ color: defaultBranding.primary_color }}
                >
                  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
                </a>
                <p className="text-sm text-gray-600">
                  {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('Regístrate aquí')[0]}
                  <a 
                    href={`/register?app_id=${applicationId}&api_key=${urlParams.get('api_key') || ''}&callback_url=${encodeURIComponent(urlParams.get('callback_url') || '')}`}
                    className="hover:underline"
                    style={{ color: defaultBranding.primary_color }}
                  >
                    {getText('login_register_link_text', '¿No tienes cuenta? Regístrate aquí').split('? ')[1] || 'Regístrate aquí'}
                  </a>
                </p>
              </>
            )}
            {formType === 'register' && (
              <p className="text-sm text-gray-600">
                {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión').split('Inicia sesión')[0]}
                <a 
                  href={`/login?app_id=${applicationId}&api_key=${urlParams.get('api_key') || ''}&callback_url=${encodeURIComponent(urlParams.get('callback_url') || '')}`}
                  className="hover:underline"
                  style={{ color: defaultBranding.primary_color }}
                >
                  {getText('register_login_link_text', '¿Ya tienes cuenta? Inicia sesión').split('? ')[1] || 'Inicia sesión'}
                </a>
              </p>
            )}
            {formType === 'reset-password' && (
              <p className="text-sm text-gray-600">
                {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión').split('Inicia sesión')[0]}
                <a 
                  href={`/login?app_id=${applicationId}&api_key=${urlParams.get('api_key') || ''}&callback_url=${encodeURIComponent(urlParams.get('callback_url') || '')}`}
                  className="hover:underline"
                  style={{ color: defaultBranding.primary_color }}
                >
                  {getText('reset_login_link_text', '¿Recordaste tu contraseña? Inicia sesión').split('? ')[1] || 'Inicia sesión'}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>{getText('security_badge_text', 'Protegido por AuthSystem')}</span>
          </div>
        </div>

        {/* Development Info */}
        {environment === 'development' && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">🔧 Información de Desarrollo</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Ambiente:</strong> {environment}</p>
              <p><strong>App ID:</strong> {applicationId}</p>
              <p><strong>API Key:</strong> {urlParams.get('api_key')?.substring(0, 20)}...</p>
              <p><strong>Callback URL:</strong> {urlParams.get('callback_url') || 'No configurado'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}