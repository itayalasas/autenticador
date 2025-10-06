import React, { useState } from 'react';
import { Palette, Upload, Eye, Save, RotateCcw, Type, MessageSquare } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';

export default function BrandingManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [branding, setBranding] = useState({
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    accent_color: '#F59E0B',
    background_color: '#FFFFFF',
    text_color: '#1F2937',
    font_family: 'Inter',
    logo_url: '',
    favicon_url: '',
    border_radius: '8',
    button_style: 'rounded'
  });

  const [texts, setTexts] = useState({
    // Login form texts
    login_title: 'Iniciar Sesión',
    login_subtitle: 'Ingresa tus credenciales',
    login_email_label: 'Email',
    login_email_placeholder: 'tu@email.com',
    login_password_label: 'Contraseña',
    login_password_placeholder: '••••••••',
    login_button_text: 'Iniciar Sesión',
    login_forgot_password_text: '¿Olvidaste tu contraseña?',
    login_register_link_text: '¿No tienes cuenta? Regístrate aquí',
    login_success_message: '¡Bienvenido de vuelta!',
    login_error_message: 'Email o contraseña incorrectos',

    // Register form texts
    register_title: 'Crear Cuenta',
    register_subtitle: 'Regístrate para comenzar',
    register_name_label: 'Nombre Completo',
    register_name_placeholder: 'Tu nombre completo',
    register_email_label: 'Email',
    register_email_placeholder: 'tu@email.com',
    register_password_label: 'Contraseña',
    register_password_placeholder: '••••••••',
    register_confirm_password_label: 'Confirmar Contraseña',
    register_confirm_password_placeholder: '••••••••',
    register_button_text: 'Crear Cuenta',
    register_login_link_text: '¿Ya tienes cuenta? Inicia sesión',
    register_success_message: 'Cuenta creada exitosamente',
    register_error_message: 'Error al crear la cuenta',

    // Reset password form texts
    reset_title: 'Recuperar Contraseña',
    reset_subtitle: 'Te enviaremos un email para recuperar tu contraseña',
    reset_email_label: 'Email',
    reset_email_placeholder: 'tu@email.com',
    reset_button_text: 'Enviar Email de Recuperación',
    reset_login_link_text: '¿Recordaste tu contraseña? Inicia sesión',
    reset_success_message: 'Email de recuperación enviado',
    reset_error_message: 'Error al enviar email de recuperación',

    // Confirm reset password form texts
    confirm_reset_title: 'Nueva Contraseña',
    confirm_reset_subtitle: 'Ingresa tu nueva contraseña',
    confirm_reset_password_label: 'Nueva Contraseña',
    confirm_reset_password_placeholder: '••••••••',
    confirm_reset_confirm_password_label: 'Confirmar Nueva Contraseña',
    confirm_reset_confirm_password_placeholder: '••••••••',
    confirm_reset_button_text: 'Cambiar Contraseña',
    confirm_reset_success_message: 'Contraseña actualizada exitosamente',
    confirm_reset_error_message: 'Error al actualizar la contraseña',

    // Common texts
    loading_text: 'Cargando...',
    processing_text: 'Procesando...',
    security_badge_text: 'Protegido por AuthSystem',
    password_mismatch_error: 'Las contraseñas no coinciden',

    // Role selection texts
    role_selection_label: 'Tipo de Usuario',
    role_selection_placeholder: 'Selecciona un rol',
    role_selection_description: 'Selecciona el tipo de acceso que necesitas'
  });

  const [previewMode, setPreviewMode] = useState('login');

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
      loadBranding();
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

  const loadBranding = async () => {
    try {
      setLoading(true);
      const brandingConfig = await applicationService.getBranding(selectedApp);
      if (brandingConfig) {
        setBranding({
          primary_color: brandingConfig.primary_color || '#3B82F6',
          secondary_color: brandingConfig.secondary_color || '#1E40AF',
          accent_color: brandingConfig.accent_color || '#F59E0B',
          background_color: brandingConfig.background_color || '#FFFFFF',
          text_color: brandingConfig.text_color || '#1F2937',
          font_family: brandingConfig.font_family || 'Inter',
          logo_url: brandingConfig.logo_url || '',
          favicon_url: brandingConfig.favicon_url || '',
          border_radius: brandingConfig.border_radius?.toString() || '8',
          button_style: brandingConfig.button_style || 'rounded'
        });

        // Load custom texts if they exist
        if (brandingConfig.custom_texts) {
          setTexts(prev => ({
            ...prev,
            ...brandingConfig.custom_texts
          }));
        }
      }
    } catch (error) {
      console.error('Error loading branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const fontOptions = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans Pro'
  ];

  const handleColorChange = (field: string, value: string) => {
    setBranding(prev => ({ ...prev, [field]: value }));
  };

  const handleTextChange = (field: string, value: string) => {
    setTexts(prev => ({ ...prev, [field]: value }));
  };

  const resetToDefaults = () => {
    setBranding({
      primary_color: '#3B82F6',
      secondary_color: '#1E40AF',
      accent_color: '#F59E0B',
      background_color: '#FFFFFF',
      text_color: '#1F2937',
      font_family: 'Inter',
      logo_url: '',
      favicon_url: '',
      border_radius: '8',
      button_style: 'rounded'
    });

    setTexts({
      // Login form texts
      login_title: 'Iniciar Sesión',
      login_subtitle: 'Ingresa tus credenciales',
      login_email_label: 'Email',
      login_email_placeholder: 'tu@email.com',
      login_password_label: 'Contraseña',
      login_password_placeholder: '••••••••',
      login_button_text: 'Iniciar Sesión',
      login_forgot_password_text: '¿Olvidaste tu contraseña?',
      login_register_link_text: '¿No tienes cuenta? Regístrate aquí',
      login_success_message: '¡Bienvenido de vuelta!',
      login_error_message: 'Email o contraseña incorrectos',

      // Register form texts
      register_title: 'Crear Cuenta',
      register_subtitle: 'Regístrate para comenzar',
      register_name_label: 'Nombre Completo',
      register_name_placeholder: 'Tu nombre completo',
      register_email_label: 'Email',
      register_email_placeholder: 'tu@email.com',
      register_password_label: 'Contraseña',
      register_password_placeholder: '••••••••',
      register_confirm_password_label: 'Confirmar Contraseña',
      register_confirm_password_placeholder: '••••••••',
      register_button_text: 'Crear Cuenta',
      register_login_link_text: '¿Ya tienes cuenta? Inicia sesión',
      register_success_message: 'Cuenta creada exitosamente',
      register_error_message: 'Error al crear la cuenta',

      // Reset password form texts
      reset_title: 'Recuperar Contraseña',
      reset_subtitle: 'Te enviaremos un email para recuperar tu contraseña',
      reset_email_label: 'Email',
      reset_email_placeholder: 'tu@email.com',
      reset_button_text: 'Enviar Email de Recuperación',
      reset_login_link_text: '¿Recordaste tu contraseña? Inicia sesión',
      reset_success_message: 'Email de recuperación enviado',
      reset_error_message: 'Error al enviar email de recuperación',

      // Confirm reset password form texts
      confirm_reset_title: 'Nueva Contraseña',
      confirm_reset_subtitle: 'Ingresa tu nueva contraseña',
      confirm_reset_password_label: 'Nueva Contraseña',
      confirm_reset_password_placeholder: '••••••••',
      confirm_reset_confirm_password_label: 'Confirmar Nueva Contraseña',
      confirm_reset_confirm_password_placeholder: '••••••••',
      confirm_reset_button_text: 'Cambiar Contraseña',
      confirm_reset_success_message: 'Contraseña actualizada exitosamente',
      confirm_reset_error_message: 'Error al actualizar la contraseña',

      // Common texts
      loading_text: 'Cargando...',
      processing_text: 'Procesando...',
      security_badge_text: 'Protegido por AuthSystem',
      password_mismatch_error: 'Las contraseñas no coinciden',

      // Role selection texts
      role_selection_label: 'Tipo de Usuario',
      role_selection_placeholder: 'Selecciona un rol',
      role_selection_description: 'Selecciona el tipo de acceso que necesitas'
    });
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      await applicationService.updateBranding(selectedApp, {
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color,
        background_color: branding.background_color,
        text_color: branding.text_color,
        font_family: branding.font_family,
        logo_url: branding.logo_url,
        favicon_url: branding.favicon_url,
        border_radius: parseInt(branding.border_radius),
        button_style: branding.button_style as 'rounded' | 'square',
        custom_texts: texts
      });
      showSuccess(
        'Branding guardado',
        'La configuración de branding y textos ha sido guardada exitosamente.'
      );
    } catch (error) {
      console.error('Error saving branding:', error);
      showError(
        'Error al guardar',
        'Ha ocurrido un error al guardar la configuración de branding. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const renderPreviewForm = () => {
    switch (previewMode) {
      case 'login':
        return (
          <div 
            className="w-full max-w-md p-8 rounded-lg shadow-lg"
            style={{ 
              backgroundColor: '#FFFFFF',
              borderRadius: `${branding.border_radius}px`
            }}
          >
            {/* Logo */}
            <div className="text-center mb-8">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-12 mx-auto mb-4" />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  L
                </div>
              )}
              <h2 
                className="text-2xl font-bold"
                style={{ color: branding.text_color }}
              >
                {texts.login_title}
              </h2>
              <p className="text-gray-500 mt-1">
                {texts.login_subtitle}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.login_email_label}
                </label>
                <input
                  type="email"
                  placeholder={texts.login_email_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.login_password_label}
                </label>
                <input
                  type="password"
                  placeholder={texts.login_password_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <button
                className="w-full py-3 font-medium text-white transition-colors"
                style={{ 
                  backgroundColor: branding.primary_color,
                  borderRadius: branding.button_style === 'rounded' 
                    ? `${branding.border_radius}px` 
                    : '4px'
                }}
              >
                {texts.login_button_text}
              </button>

              <div className="text-center space-y-2">
                <a 
                  href="#" 
                  className="text-sm hover:underline block"
                  style={{ color: branding.accent_color }}
                >
                  {texts.login_forgot_password_text}
                </a>
                <p className="text-sm text-gray-600">
                  {texts.login_register_link_text}
                </p>
              </div>
            </div>
          </div>
        );

      case 'register':
        return (
          <div 
            className="w-full max-w-md p-8 rounded-lg shadow-lg"
            style={{ 
              backgroundColor: '#FFFFFF',
              borderRadius: `${branding.border_radius}px`
            }}
          >
            {/* Logo */}
            <div className="text-center mb-8">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-12 mx-auto mb-4" />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  L
                </div>
              )}
              <h2 
                className="text-2xl font-bold"
                style={{ color: branding.text_color }}
              >
                {texts.register_title}
              </h2>
              <p className="text-gray-500 mt-1">
                {texts.register_subtitle}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.register_name_label}
                </label>
                <input
                  type="text"
                  placeholder={texts.register_name_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.register_email_label}
                </label>
                <input
                  type="email"
                  placeholder={texts.register_email_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.register_password_label}
                </label>
                <input
                  type="password"
                  placeholder={texts.register_password_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.register_confirm_password_label}
                </label>
                <input
                  type="password"
                  placeholder={texts.register_confirm_password_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              {/* Role Selection */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  Tipo de Usuario
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                >
                  <option value="">Selecciona un rol</option>
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                  <option value="moderator">Moderador</option>
                </select>
              </div>

              <button
                className="w-full py-3 font-medium text-white transition-colors"
                style={{ 
                  backgroundColor: branding.primary_color,
                  borderRadius: branding.button_style === 'rounded' 
                    ? `${branding.border_radius}px` 
                    : '4px'
                }}
              >
                {texts.register_button_text}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {texts.register_login_link_text}
                </p>
              </div>
            </div>
          </div>
        );

      case 'reset-password':
        return (
          <div 
            className="w-full max-w-md p-8 rounded-lg shadow-lg"
            style={{ 
              backgroundColor: '#FFFFFF',
              borderRadius: `${branding.border_radius}px`
            }}
          >
            {/* Logo */}
            <div className="text-center mb-8">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-12 mx-auto mb-4" />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  L
                </div>
              )}
              <h2 
                className="text-2xl font-bold"
                style={{ color: branding.text_color }}
              >
                {texts.reset_title}
              </h2>
              <p className="text-gray-500 mt-1">
                {texts.reset_subtitle}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.reset_email_label}
                </label>
                <input
                  type="email"
                  placeholder={texts.reset_email_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{ 
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <button
                className="w-full py-3 font-medium text-white transition-colors"
                style={{ 
                  backgroundColor: branding.primary_color,
                  borderRadius: branding.button_style === 'rounded' 
                    ? `${branding.border_radius}px` 
                    : '4px'
                }}
              >
                {texts.reset_button_text}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {texts.reset_login_link_text}
                </p>
              </div>
            </div>
          </div>
        );

      case 'confirm-reset':
        return (
          <div
            className="w-full max-w-md p-8 rounded-lg shadow-lg"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: `${branding.border_radius}px`
            }}
          >
            {/* Logo */}
            <div className="text-center mb-8">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-12 mx-auto mb-4" />
              ) : (
                <div
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  L
                </div>
              )}
              <h2
                className="text-2xl font-bold"
                style={{ color: branding.text_color }}
              >
                {texts.confirm_reset_title}
              </h2>
              <p className="text-gray-500 mt-1">
                {texts.confirm_reset_subtitle}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.confirm_reset_password_label}
                </label>
                <input
                  type="password"
                  placeholder={texts.confirm_reset_password_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: branding.text_color }}
                >
                  {texts.confirm_reset_confirm_password_label}
                </label>
                <input
                  type="password"
                  placeholder={texts.confirm_reset_confirm_password_placeholder}
                  className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:border-transparent"
                  style={{
                    borderRadius: `${branding.border_radius}px`,
                    '--tw-ring-color': branding.primary_color
                  } as React.CSSProperties}
                />
              </div>

              <button
                className="w-full py-3 font-medium text-white transition-colors"
                style={{
                  backgroundColor: branding.primary_color,
                  borderRadius: branding.button_style === 'rounded'
                    ? `${branding.border_radius}px`
                    : '4px'
                }}
              >
                {texts.confirm_reset_button_text}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Branding</h2>
        <p className="text-gray-600">
          Personaliza la apariencia y textos de los formularios de autenticación para cada aplicación
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Colors */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Palette className="w-5 h-5" />
              <span>Colores</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Primario
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => handleColorChange('primary_color', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.primary_color}
                    onChange={(e) => handleColorChange('primary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Secundario
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={branding.secondary_color}
                    onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.secondary_color}
                    onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color de Acento
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={branding.accent_color}
                    onChange={(e) => handleColorChange('accent_color', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.accent_color}
                    onChange={(e) => handleColorChange('accent_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color de Fondo
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={branding.background_color}
                    onChange={(e) => handleColorChange('background_color', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.background_color}
                    onChange={(e) => handleColorChange('background_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color de Texto
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={branding.text_color}
                    onChange={(e) => handleColorChange('text_color', e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.text_color}
                    onChange={(e) => handleColorChange('text_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Type className="w-5 h-5" />
              <span>Tipografía</span>
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Familia de Fuente
              </label>
              <select 
                value={branding.font_family}
                onChange={(e) => setBranding(prev => ({ ...prev, font_family: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {fontOptions.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Logos */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Logos y Assets</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Principal
                </label>
                <div className="flex items-center space-x-4">
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Upload className="w-4 h-4" />
                    <span>Subir Logo</span>
                  </button>
                  <input
                    type="url"
                    placeholder="O ingresa URL del logo"
                    value={branding.logo_url}
                    onChange={(e) => setBranding(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Favicon
                </label>
                <div className="flex items-center space-x-4">
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Upload className="w-4 h-4" />
                    <span>Subir Favicon</span>
                  </button>
                  <input
                    type="url"
                    placeholder="O ingresa URL del favicon"
                    value={branding.favicon_url}
                    onChange={(e) => setBranding(prev => ({ ...prev, favicon_url: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Style Options */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Opciones de Estilo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Radio de Bordes (px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={branding.border_radius}
                  onChange={(e) => setBranding(prev => ({ ...prev, border_radius: e.target.value }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0px (Cuadrado)</span>
                  <span>{branding.border_radius}px</span>
                  <span>20px (Redondeado)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estilo de Botones
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBranding(prev => ({ ...prev, button_style: 'rounded' }))}
                    className={`p-3 border-2 rounded-lg text-center ${
                      branding.button_style === 'rounded'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Redondeado
                  </button>
                  <button
                    onClick={() => setBranding(prev => ({ ...prev, button_style: 'square' }))}
                    className={`p-3 border-2 rounded-lg text-center ${
                      branding.button_style === 'square'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Cuadrado
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Texts */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Textos Personalizados</span>
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm text-gray-600">Editando textos para:</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPreviewMode('login')}
                    className={`px-3 py-1.5 rounded text-sm ${
                      previewMode === 'login'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setPreviewMode('register')}
                    className={`px-3 py-1.5 rounded text-sm ${
                      previewMode === 'register'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Registro
                  </button>
                  <button
                    onClick={() => setPreviewMode('reset-password')}
                    className={`px-3 py-1.5 rounded text-sm ${
                      previewMode === 'reset-password'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Recuperar
                  </button>
                  <button
                    onClick={() => setPreviewMode('confirm-reset')}
                    className={`px-3 py-1.5 rounded text-sm ${
                      previewMode === 'confirm-reset'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Nueva Contraseña
                  </button>
                </div>
              </div>

              {/* Dynamic text fields based on preview mode */}
              {previewMode === 'login' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        value={texts.login_title}
                        onChange={(e) => handleTextChange('login_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={texts.login_subtitle}
                        onChange={(e) => handleTextChange('login_subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Email</label>
                      <input
                        type="text"
                        value={texts.login_email_label}
                        onChange={(e) => handleTextChange('login_email_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Email</label>
                      <input
                        type="text"
                        value={texts.login_email_placeholder}
                        onChange={(e) => handleTextChange('login_email_placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Contraseña</label>
                      <input
                        type="text"
                        value={texts.login_password_label}
                        onChange={(e) => handleTextChange('login_password_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Botón</label>
                      <input
                        type="text"
                        value={texts.login_button_text}
                        onChange={(e) => handleTextChange('login_button_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Texto "Olvidaste contraseña"</label>
                    <input
                      type="text"
                      value={texts.login_forgot_password_text}
                      onChange={(e) => handleTextChange('login_forgot_password_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enlace a Registro</label>
                    <input
                      type="text"
                      value={texts.login_register_link_text}
                      onChange={(e) => handleTextChange('login_register_link_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {previewMode === 'register' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        value={texts.register_title}
                        onChange={(e) => handleTextChange('register_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={texts.register_subtitle}
                        onChange={(e) => handleTextChange('register_subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Nombre</label>
                      <input
                        type="text"
                        value={texts.register_name_label}
                        onChange={(e) => handleTextChange('register_name_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Nombre</label>
                      <input
                        type="text"
                        value={texts.register_name_placeholder}
                        onChange={(e) => handleTextChange('register_name_placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Email</label>
                      <input
                        type="text"
                        value={texts.register_email_label}
                        onChange={(e) => handleTextChange('register_email_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Botón</label>
                      <input
                        type="text"
                        value={texts.register_button_text}
                        onChange={(e) => handleTextChange('register_button_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enlace a Login</label>
                    <input
                      type="text"
                      value={texts.register_login_link_text}
                      onChange={(e) => handleTextChange('register_login_link_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Tipo de Usuario</label>
                      <input
                        type="text"
                        value={texts.role_selection_label}
                        onChange={(e) => handleTextChange('role_selection_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder Selector</label>
                      <input
                        type="text"
                        value={texts.role_selection_placeholder}
                        onChange={(e) => handleTextChange('role_selection_placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Selector</label>
                    <input
                      type="text"
                      value={texts.role_selection_description}
                      onChange={(e) => handleTextChange('role_selection_description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {previewMode === 'reset-password' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        value={texts.reset_title}
                        onChange={(e) => handleTextChange('reset_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={texts.reset_subtitle}
                        onChange={(e) => handleTextChange('reset_subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Email</label>
                      <input
                        type="text"
                        value={texts.reset_email_label}
                        onChange={(e) => handleTextChange('reset_email_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Botón</label>
                      <input
                        type="text"
                        value={texts.reset_button_text}
                        onChange={(e) => handleTextChange('reset_button_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enlace a Login</label>
                    <input
                      type="text"
                      value={texts.reset_login_link_text}
                      onChange={(e) => handleTextChange('reset_login_link_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {previewMode === 'confirm-reset' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        value={texts.confirm_reset_title}
                        onChange={(e) => handleTextChange('confirm_reset_title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={texts.confirm_reset_subtitle}
                        onChange={(e) => handleTextChange('confirm_reset_subtitle', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Nueva Contraseña</label>
                      <input
                        type="text"
                        value={texts.confirm_reset_password_label}
                        onChange={(e) => handleTextChange('confirm_reset_password_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta Confirmar Contraseña</label>
                      <input
                        type="text"
                        value={texts.confirm_reset_confirm_password_label}
                        onChange={(e) => handleTextChange('confirm_reset_confirm_password_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Botón</label>
                    <input
                      type="text"
                      value={texts.confirm_reset_button_text}
                      onChange={(e) => handleTextChange('confirm_reset_button_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={resetToDefaults}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restablecer</span>
            </button>
            <button 
              onClick={handleSave}
              disabled={saveLoading || !selectedApp}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex-1 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saveLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Vista Previa</span>
              </h3>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewMode('login')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    previewMode === 'login'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setPreviewMode('register')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    previewMode === 'register'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Registro
                </button>
                <button
                  onClick={() => setPreviewMode('reset-password')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    previewMode === 'reset-password'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Recuperar
                </button>
              </div>
            </div>

            {/* Preview Window */}
            <div 
              className="border-2 border-gray-200 rounded-lg p-8 min-h-96 flex items-center justify-center"
              style={{ 
                backgroundColor: branding.background_color,
                fontFamily: branding.font_family
              }}
            >
              {renderPreviewForm()}
            </div>
          </div>

          {/* Security Badge Preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Badge de Seguridad</h4>
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
                <span>{texts.security_badge_text}</span>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto del Badge</label>
              <input
                type="text"
                value={texts.security_badge_text}
                onChange={(e) => handleTextChange('security_badge_text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
      
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