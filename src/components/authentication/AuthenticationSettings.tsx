import React, { useState, useEffect } from 'react';
import { Shield, Key, Lock, Users, Settings, AlertTriangle, CheckCircle, Save, RotateCcw, Mail, AlertCircle } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';

export default function AuthenticationSettings() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  
  const [authSettings, setAuthSettings] = useState({
    // Configuración de autenticación
    require_email_verification: true,
    allow_public_registration: true,
    enable_two_factor: false,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_symbols: false,

    // Configuración de sesiones
    session_timeout: 24, // horas
    refresh_token_lifetime: 30, // días
    max_concurrent_sessions: 5,

    // Configuración de seguridad
    enable_rate_limiting: true,
    max_login_attempts: 5,
    lockout_duration: 15, // minutos
    enable_captcha: false,

    // Configuración de bloqueo automático de IP
    auto_block_enabled: true,
    max_failed_attempts: 5, // intentos antes de bloqueo automático

    // Configuración de tokens
    jwt_algorithm: 'HS256',
    token_issuer: 'AuthSystem',
    include_user_metadata: true,

    // Configuración de callbacks
    allowed_callback_urls: '',
    allowed_logout_urls: '',
    allowed_origins: '',

    // Configuración de email
    email_provider: 'system',
    send_welcome_email: false,
    send_password_reset_email: true,
    notify_admin_new_user: false,
    admin_notification_email: '',
    from_name: 'AuthSystem',
    from_email: '',

    // Configuración SMTP
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',

    // API Keys para proveedores externos
    api_key: ''
  });

  const {
    notification,
    showSuccess,
    showError,
    closeNotification
  } = useNotification();

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadAuthSettings();
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);
      if (apps.length > 0) {
        setSelectedApp(apps[0].id);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const loadAuthSettings = async () => {
    try {
      setLoading(true);

      // Get application with metadata, auto_block fields, and email_config
      const { data: app, error } = await supabase
        .from('applications')
        .select('*, max_failed_attempts, auto_block_enabled, email_config')
        .eq('id', selectedApp)
        .single();

      if (error) throw error;

      if (app) {
        // Load settings from application metadata and columns
        const metadata = app.metadata || {};
        const emailConfig = app.email_config || {};
        setAuthSettings(prev => ({
          ...prev,
          require_email_verification: emailConfig.require_email_verification ?? metadata.enable_email_verification ?? true,
          allow_public_registration: metadata.allow_public_registration ?? true,
          enable_two_factor: metadata.enable_two_factor ?? false,
          password_min_length: metadata.password_min_length ?? 8,
          password_require_uppercase: metadata.password_require_uppercase ?? true,
          password_require_lowercase: metadata.password_require_lowercase ?? true,
          password_require_numbers: metadata.password_require_numbers ?? true,
          password_require_symbols: metadata.password_require_symbols ?? false,
          session_timeout: metadata.session_timeout ?? 24,
          refresh_token_lifetime: metadata.refresh_token_lifetime ?? 30,
          max_concurrent_sessions: metadata.max_concurrent_sessions ?? 5,
          enable_rate_limiting: metadata.enable_rate_limiting ?? true,
          max_login_attempts: metadata.max_login_attempts ?? 5,
          lockout_duration: metadata.lockout_duration ?? 15,
          enable_captcha: metadata.enable_captcha ?? false,
          // Load auto-block settings from columns
          auto_block_enabled: app.auto_block_enabled ?? true,
          max_failed_attempts: app.max_failed_attempts ?? 5,
          jwt_algorithm: metadata.jwt_algorithm ?? 'HS256',
          token_issuer: metadata.token_issuer ?? 'AuthSystem',
          include_user_metadata: metadata.include_user_metadata ?? true,
          allowed_callback_urls: Array.isArray(metadata.allowed_callback_urls)
            ? metadata.allowed_callback_urls.join('\n')
            : metadata.allowed_callback_urls || '',
          allowed_logout_urls: Array.isArray(metadata.allowed_logout_urls)
            ? metadata.allowed_logout_urls.join('\n')
            : metadata.allowed_logout_urls || '',
          allowed_origins: Array.isArray(metadata.cors_origins)
            ? metadata.cors_origins.join('\n')
            : metadata.cors_origins || '',
          // Load email configuration
          email_provider: emailConfig.email_provider || 'system',
          send_welcome_email: emailConfig.send_welcome_email ?? false,
          send_password_reset_email: emailConfig.send_password_reset_email ?? true,
          notify_admin_new_user: emailConfig.notify_admin_new_user ?? false,
          admin_notification_email: emailConfig.admin_notification_email || '',
          from_name: emailConfig.from_name || 'AuthSystem',
          from_email: emailConfig.from_email || '',
          // Load SMTP configuration
          smtp_host: emailConfig.smtp_host || '',
          smtp_port: emailConfig.smtp_port || 587,
          smtp_secure: emailConfig.smtp_secure ?? true,
          smtp_user: emailConfig.smtp_user || '',
          smtp_password: emailConfig.smtp_password || '',
          // Load API key
          api_key: emailConfig.api_key || ''
        }));
      }
    } catch (error) {
      console.error('Error loading auth settings:', error);
      showError(
        'Error al cargar configuración',
        'No se pudo cargar la configuración de autenticación. Usando valores por defecto.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaveLoading(true);

      // Prepare metadata object with all auth settings
      const authMetadata = {
        enable_email_verification: authSettings.require_email_verification,
        allow_public_registration: authSettings.allow_public_registration,
        enable_two_factor: authSettings.enable_two_factor,
        password_min_length: authSettings.password_min_length,
        password_require_uppercase: authSettings.password_require_uppercase,
        password_require_lowercase: authSettings.password_require_lowercase,
        password_require_numbers: authSettings.password_require_numbers,
        password_require_symbols: authSettings.password_require_symbols,
        session_timeout: authSettings.session_timeout,
        refresh_token_lifetime: authSettings.refresh_token_lifetime,
        max_concurrent_sessions: authSettings.max_concurrent_sessions,
        enable_rate_limiting: authSettings.enable_rate_limiting,
        max_login_attempts: authSettings.max_login_attempts,
        lockout_duration: authSettings.lockout_duration,
        enable_captcha: authSettings.enable_captcha,
        jwt_algorithm: authSettings.jwt_algorithm,
        token_issuer: authSettings.token_issuer,
        include_user_metadata: authSettings.include_user_metadata,
        allowed_callback_urls: authSettings.allowed_callback_urls.split('\n').filter(url => url.trim()),
        allowed_logout_urls: authSettings.allowed_logout_urls.split('\n').filter(url => url.trim()),
        cors_origins: authSettings.allowed_origins.split('\n').filter(url => url.trim()),
        updated_at: new Date().toISOString()
      };

      // Get current application metadata
      const { data: currentApp, error: getCurrentError } = await supabase
        .from('applications')
        .select('metadata')
        .eq('id', selectedApp)
        .single();

      if (getCurrentError) throw getCurrentError;

      // Merge with existing metadata
      const updatedMetadata = {
        ...currentApp.metadata,
        ...authMetadata
      };

      // Prepare email configuration
      const emailConfig = {
        email_provider: authSettings.email_provider || 'system',
        require_email_verification: authSettings.require_email_verification,
        send_welcome_email: authSettings.send_welcome_email,
        send_password_reset_email: authSettings.send_password_reset_email,
        notify_admin_new_user: authSettings.notify_admin_new_user,
        admin_notification_email: authSettings.admin_notification_email,
        from_name: authSettings.from_name || 'AuthSystem',
        from_email: authSettings.from_email || '',
        // SMTP Configuration
        smtp_host: authSettings.smtp_host || '',
        smtp_port: authSettings.smtp_port || 587,
        smtp_secure: authSettings.smtp_secure ?? true,
        smtp_user: authSettings.smtp_user || '',
        smtp_password: authSettings.smtp_password || '',
        // API Key for external providers
        api_key: authSettings.api_key || ''
      };

      // Update application with new auth settings including auto-block config and email config
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          metadata: updatedMetadata,
          auto_block_enabled: authSettings.auto_block_enabled,
          max_failed_attempts: authSettings.max_failed_attempts,
          email_config: emailConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApp);

      if (updateError) throw updateError;

      showSuccess(
        'Configuración guardada',
        'La configuración de autenticación ha sido guardada exitosamente y se aplicará a todas las nuevas autenticaciones.'
      );

    } catch (error) {
      console.error('Error saving auth settings:', error);
      showError(
        'Error al guardar',
        'Ha ocurrido un error al guardar la configuración de autenticación. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    setAuthSettings({
      require_email_verification: true,
      allow_public_registration: true,
      enable_two_factor: false,
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_lowercase: true,
      password_require_numbers: true,
      password_require_symbols: false,
      session_timeout: 24,
      refresh_token_lifetime: 30,
      max_concurrent_sessions: 5,
      enable_rate_limiting: true,
      max_login_attempts: 5,
      lockout_duration: 15,
      enable_captcha: false,
      auto_block_enabled: true,
      max_failed_attempts: 5,
      jwt_algorithm: 'HS256',
      token_issuer: 'AuthSystem',
      include_user_metadata: true,
      allowed_callback_urls: '',
      allowed_logout_urls: '',
      allowed_origins: '',
      email_provider: 'system',
      send_welcome_email: false,
      send_password_reset_email: true,
      notify_admin_new_user: false,
      admin_notification_email: '',
      from_name: 'AuthSystem',
      from_email: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: true,
      smtp_user: '',
      smtp_password: '',
      api_key: ''
    });
  };

  const handleSettingChange = (key: string, value: any) => {
    setAuthSettings(prev => ({ ...prev, [key]: value }));
  };

  const validatePasswordPolicy = () => {
    const policy = [];
    if (authSettings.password_require_uppercase) policy.push('mayúsculas');
    if (authSettings.password_require_lowercase) policy.push('minúsculas');
    if (authSettings.password_require_numbers) policy.push('números');
    if (authSettings.password_require_symbols) policy.push('símbolos');
    
    return `Mínimo ${authSettings.password_min_length} caracteres${policy.length > 0 ? `, debe incluir: ${policy.join(', ')}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Autenticación</h2>
        <p className="text-gray-600">
          Configura métodos de autenticación, políticas de seguridad y comportamiento de sesiones
        </p>
      </div>

      {/* Application Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Aplicación</h3>
        <select 
          value={selectedApp}
          onChange={(e) => setSelectedApp(e.target.value)}
          disabled={loading}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecciona una aplicación</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name} ({app.domain})
            </option>
          ))}
        </select>
      </div>

      {selectedApp && (
        <div className="space-y-6">
          {/* Authentication Methods */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Métodos de Autenticación</span>
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Verificación de Email</h4>
                  <p className="text-sm text-gray-600">Requiere que los usuarios verifiquen su email antes de acceder</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.require_email_verification}
                    onChange={(e) => handleSettingChange('require_email_verification', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Registro Público</h4>
                  <p className="text-sm text-gray-600">Permite que cualquier persona se registre en tu aplicación</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.allow_public_registration}
                    onChange={(e) => handleSettingChange('allow_public_registration', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Autenticación de Dos Factores</h4>
                  <p className="text-sm text-gray-600">Habilita 2FA para mayor seguridad (próximamente)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.enable_two_factor}
                    onChange={(e) => handleSettingChange('enable_two_factor', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Email Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Mail className="w-5 h-5" />
              <span>Configuración de Correo Electrónico</span>
            </h3>

            <div className="space-y-6">
              {/* Important Notice */}
              {authSettings.email_provider === 'system' && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Correos no se envían físicamente
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Actualmente estás usando el modo "Sistema por Defecto" que solo registra los correos en la base de datos pero NO los envía.
                          Para enviar correos reales de registro y recuperación de contraseña, configura un proveedor de email (SMTP, Resend o SendGrid).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Provider Selection */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Proveedor de Email
                </label>
                <select
                  value={authSettings.email_provider}
                  onChange={(e) => handleSettingChange('email_provider', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="system">Sistema por Defecto (Solo Logs - No envía emails)</option>
                  <option value="smtp">Servidor SMTP Personalizado (Envía emails reales)</option>
                  <option value="resend">Resend (Envía emails reales)</option>
                  <option value="sendgrid">SendGrid (Envía emails reales)</option>
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  {authSettings.email_provider === 'system' && '⚠️ Los emails se registrarán pero NO se enviarán físicamente'}
                  {authSettings.email_provider === 'smtp' && '✅ Configura tu propio servidor SMTP para enviar emails reales'}
                  {authSettings.email_provider === 'resend' && '✅ Usa Resend para enviar emails reales (requiere API key)'}
                  {authSettings.email_provider === 'sendgrid' && '✅ Usa SendGrid para enviar emails reales (requiere API key)'}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Enviar email de bienvenida</h4>
                  <p className="text-sm text-gray-600">Envía un email de bienvenida cuando se registre un nuevo usuario</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.send_welcome_email}
                    onChange={(e) => handleSettingChange('send_welcome_email', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Enviar email de recuperación de contraseña</h4>
                  <p className="text-sm text-gray-600">Envía un email cuando un usuario solicite recuperar su contraseña</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.send_password_reset_email}
                    onChange={(e) => handleSettingChange('send_password_reset_email', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Notificar al administrador de nuevos registros</h4>
                  <p className="text-sm text-gray-600">Envía un email al administrador cuando se registre un nuevo usuario</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.notify_admin_new_user}
                    onChange={(e) => handleSettingChange('notify_admin_new_user', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {authSettings.notify_admin_new_user && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Email del administrador
                  </label>
                  <input
                    type="email"
                    value={authSettings.admin_notification_email}
                    onChange={(e) => handleSettingChange('admin_notification_email', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="admin@tudominio.com"
                  />
                  <p className="text-xs text-blue-700 mt-1">
                    Los emails de notificación de nuevos registros se enviarán a esta dirección
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Configuración del remitente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del remitente
                    </label>
                    <input
                      type="text"
                      value={authSettings.from_name}
                      onChange={(e) => handleSettingChange('from_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="AuthSystem"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nombre que aparecerá en los emails enviados
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email del remitente (opcional)
                    </label>
                    <input
                      type="email"
                      value={authSettings.from_email}
                      onChange={(e) => handleSettingChange('from_email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="noreply@tudominio.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Deja vacío para usar el email del sistema
                    </p>
                  </div>
                </div>
              </div>

              {/* SMTP Configuration */}
              {authSettings.email_provider === 'smtp' && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configuración del Servidor SMTP
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Host SMTP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={authSettings.smtp_host}
                        onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Puerto SMTP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={authSettings.smtp_port}
                        onChange={(e) => handleSettingChange('smtp_port', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="587"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Común: 587 (TLS), 465 (SSL), 25 (sin cifrar)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Usuario SMTP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={authSettings.smtp_user}
                        onChange={(e) => handleSettingChange('smtp_user', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="usuario@gmail.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contraseña SMTP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={authSettings.smtp_password}
                        onChange={(e) => handleSettingChange('smtp_password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Para Gmail, usa una contraseña de aplicación
                      </p>
                    </div>

                    <div className="col-span-2">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={authSettings.smtp_secure}
                          onChange={(e) => handleSettingChange('smtp_secure', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Usar conexión segura (TLS/SSL)</span>
                          <p className="text-xs text-gray-500">Recomendado para mayor seguridad</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h5 className="text-sm font-medium text-blue-900 mb-2">Ejemplos de configuración SMTP</h5>
                    <div className="space-y-2 text-xs text-blue-800">
                      <p><strong>Gmail:</strong> smtp.gmail.com:587 (TLS) - Requiere contraseña de aplicación</p>
                      <p><strong>Outlook:</strong> smtp-mail.outlook.com:587 (TLS)</p>
                      <p><strong>SendGrid:</strong> smtp.sendgrid.net:587 (TLS) - Usuario: apikey</p>
                      <p><strong>Mailgun:</strong> smtp.mailgun.org:587 (TLS)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* API Key Configuration for Resend/SendGrid */}
              {(authSettings.email_provider === 'resend' || authSettings.email_provider === 'sendgrid') && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Configuración de API Key
                  </h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key de {authSettings.email_provider === 'resend' ? 'Resend' : 'SendGrid'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={authSettings.api_key}
                      onChange={(e) => handleSettingChange('api_key', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="re_xxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {authSettings.email_provider === 'resend' && 'Obtén tu API key desde https://resend.com/api-keys'}
                      {authSettings.email_provider === 'sendgrid' && 'Obtén tu API key desde https://app.sendgrid.com/settings/api_keys'}
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <h5 className="text-sm font-medium text-green-900 mb-2">
                      Ventajas de usar {authSettings.email_provider === 'resend' ? 'Resend' : 'SendGrid'}
                    </h5>
                    <ul className="space-y-1 text-xs text-green-800 list-disc list-inside">
                      <li>Entrega garantizada y alta tasa de éxito</li>
                      <li>Estadísticas detalladas de emails enviados</li>
                      <li>Gestión automática de rebotes y quejas</li>
                      <li>Plantillas HTML y personalización avanzada</li>
                      {authSettings.email_provider === 'resend' && <li>API simple y moderna, perfecta para desarrolladores</li>}
                      {authSettings.email_provider === 'sendgrid' && <li>Infraestructura robusta usada por empresas Fortune 500</li>}
                    </ul>
                  </div>
                </div>
              )}

              {authSettings.email_provider === 'system' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-medium text-yellow-900">Modo Demo - Solo Logs</h5>
                      <p className="text-sm text-yellow-800 mt-1">
                        Los emails se registrarán en la tabla de logs pero no se enviarán físicamente.
                        Para enviar emails reales, selecciona un proveedor de email y configura sus credenciales.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Password Policy */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Lock className="w-5 h-5" />
              <span>Política de Contraseñas</span>
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitud Mínima
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    min="6"
                    max="50"
                    value={authSettings.password_min_length}
                    onChange={(e) => handleSettingChange('password_min_length', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">caracteres</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Requisitos de Caracteres</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={authSettings.password_require_uppercase}
                      onChange={(e) => handleSettingChange('password_require_uppercase', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Requiere mayúsculas</span>
                      <p className="text-xs text-gray-500">Al menos una letra mayúscula (A-Z)</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={authSettings.password_require_lowercase}
                      onChange={(e) => handleSettingChange('password_require_lowercase', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Requiere minúsculas</span>
                      <p className="text-xs text-gray-500">Al menos una letra minúscula (a-z)</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={authSettings.password_require_numbers}
                      onChange={(e) => handleSettingChange('password_require_numbers', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Requiere números</span>
                      <p className="text-xs text-gray-500">Al menos un dígito (0-9)</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={authSettings.password_require_symbols}
                      onChange={(e) => handleSettingChange('password_require_symbols', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Requiere símbolos</span>
                      <p className="text-xs text-gray-500">Al menos un carácter especial (!@#$%)</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Password Policy Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-900 mb-2">Vista previa de la política:</h5>
                <p className="text-sm text-blue-800">{validatePasswordPolicy()}</p>
              </div>
            </div>
          </div>

          {/* Session Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Configuración de Sesiones</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duración de Sesión
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={authSettings.session_timeout}
                    onChange={(e) => handleSettingChange('session_timeout', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">horas</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tiempo antes de que expire el token de acceso</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Token
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={authSettings.refresh_token_lifetime}
                    onChange={(e) => handleSettingChange('refresh_token_lifetime', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">días</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tiempo de vida del token de renovación</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sesiones Concurrentes
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={authSettings.max_concurrent_sessions}
                  onChange={(e) => handleSettingChange('max_concurrent_sessions', parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Máximo de sesiones activas por usuario</p>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Configuración de Seguridad</span>
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Rate Limiting</h4>
                  <p className="text-sm text-gray-600">Limita intentos de autenticación por IP</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.enable_rate_limiting}
                    onChange={(e) => handleSettingChange('enable_rate_limiting', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo Intentos de Login
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="3"
                      max="20"
                      value={authSettings.max_login_attempts}
                      onChange={(e) => handleSettingChange('max_login_attempts', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">intentos</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Antes de bloquear temporalmente la IP</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duración de Bloqueo
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={authSettings.lockout_duration}
                      onChange={(e) => handleSettingChange('lockout_duration', parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">minutos</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Tiempo de bloqueo después de exceder intentos</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">CAPTCHA</h4>
                  <p className="text-sm text-gray-600">Protección adicional contra bots (próximamente)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authSettings.enable_captcha}
                    onChange={(e) => handleSettingChange('enable_captcha', e.target.checked)}
                    className="sr-only peer"
                    disabled
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 opacity-50"></div>
                </label>
              </div>

              {/* Auto-Block IP Configuration */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Bloqueo Automático de IP</h4>
                    <p className="text-sm text-gray-600">Bloquea automáticamente IPs después de múltiples intentos fallidos</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={authSettings.auto_block_enabled}
                      onChange={(e) => handleSettingChange('auto_block_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {authSettings.auto_block_enabled && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-blue-900 mb-2">
                          Intentos fallidos permitidos antes de bloqueo
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={authSettings.max_failed_attempts || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? null : parseInt(e.target.value);
                              handleSettingChange('max_failed_attempts', value);
                            }}
                            className="w-24 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            placeholder="5"
                          />
                          <span className="text-sm text-blue-800">intentos</span>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                          Cuando una IP alcance este número de intentos fallidos de login, será bloqueada automáticamente.
                          Puedes desbloquearla manualmente desde el Log de Actividad.
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          <strong>Nota:</strong> Deja vacío o en 0 para bloqueo manual únicamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Token Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Configuración de Tokens</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Algoritmo JWT
                </label>
                <select
                  value={authSettings.jwt_algorithm}
                  onChange={(e) => handleSettingChange('jwt_algorithm', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="HS256">HS256 (Recomendado)</option>
                  <option value="HS384">HS384</option>
                  <option value="HS512">HS512</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emisor del Token
                </label>
                <input
                  type="text"
                  value={authSettings.token_issuer}
                  onChange={(e) => handleSettingChange('token_issuer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AuthSystem"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={authSettings.include_user_metadata}
                  onChange={(e) => handleSettingChange('include_user_metadata', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Incluir metadata del usuario en tokens</span>
                  <p className="text-xs text-gray-500">Agrega información adicional del usuario al JWT</p>
                </div>
              </label>
            </div>
          </div>

          {/* Callback URLs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">URLs Permitidas</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URLs de Callback Permitidas
                </label>
                <textarea
                  value={authSettings.allowed_callback_urls}
                  onChange={(e) => handleSettingChange('allowed_callback_urls', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://miapp.com/auth/callback&#10;https://localhost:3000/callback&#10;https://staging.miapp.com/callback"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Una URL por línea. Solo estas URLs podrán recibir redirecciones después de la autenticación.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URLs de Logout Permitidas
                </label>
                <textarea
                  value={authSettings.allowed_logout_urls}
                  onChange={(e) => handleSettingChange('allowed_logout_urls', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://miapp.com/logout&#10;https://localhost:3000/logout"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URLs permitidas para redirección después del logout.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orígenes Permitidos (CORS)
                </label>
                <textarea
                  value={authSettings.allowed_origins}
                  onChange={(e) => handleSettingChange('allowed_origins', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://miapp.com&#10;https://localhost:3000&#10;https://staging.miapp.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dominios permitidos para hacer requests CORS a la API de autenticación.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleResetToDefaults}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restablecer a valores por defecto</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saveLoading || !selectedApp}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saveLoading ? 'Guardando...' : 'Guardar Configuración'}</span>
            </button>
          </div>

          {/* Warning Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Importante</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  Los cambios en la configuración de autenticación se aplicarán inmediatamente a todas las nuevas 
                  autenticaciones. Las sesiones existentes no se verán afectadas hasta que expiren o se renueven.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        confirmText={notification.confirmText}
        onConfirm={notification.onConfirm}
      />
    </div>
  );
}