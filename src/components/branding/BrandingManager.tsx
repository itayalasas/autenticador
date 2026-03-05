import React, { useRef, useState } from 'react';
import { Palette, Upload, Eye, Save, RotateCcw, Type, MessageSquare, Wand2, Settings } from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import BrandingExtendedControls from './BrandingExtendedControls';
import { applyThemePreset } from '../../utils/themePresets';
import BrandedPublicAuth from '../auth/BrandedPublicAuth';
import { FORM_TEXT_TRANSLATIONS, MESSAGE_TRANSLATIONS, BrandingLanguage, getLanguageFromCustomTexts } from '../../utils/brandingTranslations';
import { generateThemeFromPrompt, generateThemeLabelFromPrompt, generateThemeDescriptionFromPrompt } from '../../utils/themePromptGenerator';
import { BrandingConfig } from '../../types';
import { applyFaviconToDocument } from '../../utils/favicon';

type GeneratedThemeStatus = 'draft' | 'saved';

interface GeneratedThemeDraft {
  id: string;
  label: string;
  description: string;
  status: GeneratedThemeStatus;
  prompt: string;
  created_at: string;
  config: Partial<BrandingConfig>;
}

function isGeneratedThemeDraft(value: unknown): value is GeneratedThemeDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.label === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.config === 'object' &&
    candidate.config !== null;
}

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

  const [texts, setTexts] = useState({ ...FORM_TEXT_TRANSLATIONS.es });
  const [selectedLanguage, setSelectedLanguage] = useState<BrandingLanguage>('es');
  const [generatedThemeDraft, setGeneratedThemeDraft] = useState<GeneratedThemeDraft | null>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const [extendedBranding, setExtendedBranding] = useState({
    theme_style: 'corporate',
    card_style: 'elevated',
    card_background: '#FFFFFF',
    card_blur: 0,
    input_style: 'outlined',
    input_background: '#F9FAFB',
    input_border_color: '#D1D5DB',
    input_focus_color: '#3B82F6',
    button_variant: 'solid',
    button_size: 'medium',
    button_hover_transform: true,
    shadow_intensity: 'medium',
    gradient_start: '',
    gradient_end: '',
    error_color: '#EF4444',
    success_color: '#10B981',
    warning_color: '#F59E0B',
    heading_font_family: '',
    font_size_scale: 'medium',
    use_gradient: false,
    glass_effect: false,
    blur_background: false,
    enable_animations: true,
    animation_speed: 'normal',
    form_width: 'medium',
    spacing: 'normal',
    message_loading_text: MESSAGE_TRANSLATIONS.es.message_loading_text,
    message_success_text: MESSAGE_TRANSLATIONS.es.message_success_text,
    message_error_text: MESSAGE_TRANSLATIONS.es.message_error_text,
    message_error_help_text: MESSAGE_TRANSLATIONS.es.message_error_help_text,
    redirect_delay: 2000,
    message_loading_bg: '#DBEAFE',
    message_success_bg: '#DCFCE7',
    message_error_bg: '#FEE2E2'
  });

  const [previewMode, setPreviewMode] = useState('login');
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'texts'>('basic');
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const faviconFileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    applyFaviconToDocument(branding.favicon_url);
  }, [branding.favicon_url]);

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
        const customTexts = brandingConfig.custom_texts || {};
        const language = getLanguageFromCustomTexts(customTexts);
        setSelectedLanguage(language);

        if (isGeneratedThemeDraft(customTexts.__generated_theme)) {
          setGeneratedThemeDraft(customTexts.__generated_theme);
        } else {
          setGeneratedThemeDraft(null);
        }

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

        // Load extended branding fields
        setExtendedBranding({
          theme_style: brandingConfig.theme_style || 'corporate',
          card_style: brandingConfig.card_style || 'elevated',
          card_background: brandingConfig.card_background || '#FFFFFF',
          card_blur: brandingConfig.card_blur || 0,
          input_style: brandingConfig.input_style || 'outlined',
          input_background: brandingConfig.input_background || '#F9FAFB',
          input_border_color: brandingConfig.input_border_color || '#D1D5DB',
          input_focus_color: brandingConfig.input_focus_color || '#3B82F6',
          button_variant: brandingConfig.button_variant || 'solid',
          button_size: brandingConfig.button_size || 'medium',
          button_hover_transform: brandingConfig.button_hover_transform ?? true,
          shadow_intensity: brandingConfig.shadow_intensity || 'medium',
          gradient_start: brandingConfig.gradient_start || '',
          gradient_end: brandingConfig.gradient_end || '',
          error_color: brandingConfig.error_color || '#EF4444',
          success_color: brandingConfig.success_color || '#10B981',
          warning_color: brandingConfig.warning_color || '#F59E0B',
          heading_font_family: brandingConfig.heading_font_family || '',
          font_size_scale: brandingConfig.font_size_scale || 'medium',
          use_gradient: brandingConfig.use_gradient || false,
          glass_effect: brandingConfig.glass_effect || false,
          blur_background: brandingConfig.blur_background || false,
          enable_animations: brandingConfig.enable_animations ?? true,
          animation_speed: brandingConfig.animation_speed || 'normal',
          form_width: brandingConfig.form_width || 'medium',
          spacing: brandingConfig.spacing || 'normal',
          message_loading_text: brandingConfig.message_loading_text || customTexts.message_loading_text || MESSAGE_TRANSLATIONS[language].message_loading_text,
          message_success_text: brandingConfig.message_success_text || customTexts.message_success_text || MESSAGE_TRANSLATIONS[language].message_success_text,
          message_error_text: brandingConfig.message_error_text || customTexts.message_error_text || MESSAGE_TRANSLATIONS[language].message_error_text,
          message_error_help_text: brandingConfig.message_error_help_text || customTexts.message_error_help_text || MESSAGE_TRANSLATIONS[language].message_error_help_text,
          redirect_delay: brandingConfig.redirect_delay || 2000,
          message_loading_bg: brandingConfig.message_loading_bg || '#DBEAFE',
          message_success_bg: brandingConfig.message_success_bg || '#DCFCE7',
          message_error_bg: brandingConfig.message_error_bg || '#FEE2E2'
        });

        // Load custom texts if they exist
        if (customTexts) {
          setTexts(prev => ({
            ...prev,
            ...customTexts
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

  const handleExtendedChange = (field: string, value: any) => {
    setExtendedBranding(prev => ({ ...prev, [field]: value }));
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('No se pudo leer el archivo'));
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleAssetUpload = async (assetType: 'logo' | 'favicon', file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Archivo inválido', 'Solo se permiten imágenes para logo y favicon.');
      return;
    }

    const maxSizeBytes = assetType === 'favicon' ? 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showError(
        'Archivo muy grande',
        assetType === 'favicon'
          ? 'El favicon debe ser menor o igual a 1MB.'
          : 'El logo debe ser menor o igual a 3MB.'
      );
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBranding(prev => ({
        ...prev,
        [assetType === 'logo' ? 'logo_url' : 'favicon_url']: dataUrl
      }));

      showSuccess(
        assetType === 'logo' ? 'Logo cargado' : 'Favicon cargado',
        'Se cargó la imagen desde tu PC. Guarda cambios para persistirla.'
      );
    } catch (error) {
      console.error(`Error uploading ${assetType}:`, error);
      showError('Error al cargar imagen', 'No se pudo procesar la imagen seleccionada.');
    }
  };

  const handleTranslateMessages = (language: BrandingLanguage) => {
    setSelectedLanguage(language);

    setTexts(prev => ({
      ...prev,
      ...FORM_TEXT_TRANSLATIONS[language],
      processing_text: MESSAGE_TRANSLATIONS[language].processing_text
    }));

    setExtendedBranding(prev => ({
      ...prev,
      message_loading_text: MESSAGE_TRANSLATIONS[language].message_loading_text,
      message_success_text: MESSAGE_TRANSLATIONS[language].message_success_text,
      message_error_text: MESSAGE_TRANSLATIONS[language].message_error_text,
      message_error_help_text: MESSAGE_TRANSLATIONS[language].message_error_help_text
    }));
  };

  const handleGenerateThemeFromPrompt = async (prompt: string) => {
    setIsGeneratingTheme(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const generatedTheme = generateThemeFromPrompt(prompt, {
        ...branding,
        ...extendedBranding,
        border_radius: parseInt(branding.border_radius)
      });

      const {
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        text_color,
        border_radius,
        button_style,
        font_family,
        ...extendedGeneratedTheme
      } = generatedTheme;

      setBranding(prev => ({
        ...prev,
        primary_color: primary_color || prev.primary_color,
        secondary_color: secondary_color || prev.secondary_color,
        accent_color: accent_color || prev.accent_color,
        background_color: background_color || prev.background_color,
        text_color: text_color || prev.text_color,
        font_family: font_family || prev.font_family,
        border_radius: (border_radius ?? parseInt(prev.border_radius)).toString(),
        button_style: (button_style as 'rounded' | 'square') || prev.button_style
      }));

      setExtendedBranding(prev => ({
        ...prev,
        ...extendedGeneratedTheme
      } as any));

      const now = new Date().toISOString();
      const shortPrompt = prompt.trim().replace(/\s+/g, ' ');
      const label = generateThemeLabelFromPrompt(shortPrompt);
      const description = generateThemeDescriptionFromPrompt(shortPrompt);

      setGeneratedThemeDraft({
        id: `ai-theme-${Date.now()}`,
        label: label || 'Modern Fusion',
        description,
        status: 'draft',
        prompt: shortPrompt,
        created_at: now,
        config: generatedTheme
      });

      showSuccess('Tema generado', 'Se aplicó un tema generado desde tu prompt. Si te gusta, guarda los cambios.');
    } catch (error) {
      console.error('Error generating theme from prompt:', error);
      showError('Error al generar tema', 'No se pudo generar el tema. Intenta con otro prompt.');
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleSelectGeneratedTheme = () => {
    if (!generatedThemeDraft) {
      showError('Sin tema generado', 'Primero genera un tema con prompt para poder seleccionarlo.');
      return;
    }

    const generatedTheme = generatedThemeDraft.config;
    const {
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      text_color,
      border_radius,
      button_style,
      font_family,
      ...extendedGeneratedTheme
    } = generatedTheme;

    setBranding(prev => ({
      ...prev,
      primary_color: primary_color || prev.primary_color,
      secondary_color: secondary_color || prev.secondary_color,
      accent_color: accent_color || prev.accent_color,
      background_color: background_color || prev.background_color,
      text_color: text_color || prev.text_color,
      font_family: font_family || prev.font_family,
      border_radius: (border_radius ?? parseInt(prev.border_radius)).toString(),
      button_style: (button_style as 'rounded' | 'square') || prev.button_style
    }));

    setExtendedBranding(prev => ({
      ...prev,
      ...extendedGeneratedTheme
    } as any));

    showSuccess('Tema aplicado', 'Se aplicó el tema generado para que puedas seguir ajustándolo.');
  };

  const handleSaveGeneratedTheme = async () => {
    if (!generatedThemeDraft) {
      showError('Sin tema generado', 'Primero genera un tema para poder guardarlo.');
      return;
    }

    if (!selectedApp) {
      showError('Sin aplicación', 'Selecciona una aplicación antes de guardar el tema.');
      return;
    }

    const savedTheme: GeneratedThemeDraft = {
      ...generatedThemeDraft,
      status: 'saved'
    };

    setGeneratedThemeDraft(savedTheme);

    const customTextsToPersist = {
      ...texts,
      __language: selectedLanguage,
      message_loading_text: extendedBranding.message_loading_text,
      message_success_text: extendedBranding.message_success_text,
      message_error_text: extendedBranding.message_error_text,
      message_error_help_text: extendedBranding.message_error_help_text,
      __generated_theme: savedTheme
    };

    try {
      await applicationService.updateBranding(selectedApp, {
        custom_texts: customTextsToPersist
      } as any);

      showSuccess('Tema guardado', 'El tema generado quedó guardado y marcado como listo para usar.');
    } catch (error) {
      console.error('Error saving generated theme:', error);
      showError('Error al guardar tema', 'No se pudo guardar el tema generado. Inténtalo nuevamente.');
    }
  };

  const applyTheme = (themeName: string) => {
    const preset = applyThemePreset(themeName as any, branding);

    // Update basic fields
    setBranding({
      ...branding,
      primary_color: preset.primary_color,
      secondary_color: preset.secondary_color,
      accent_color: preset.accent_color,
      background_color: preset.background_color,
      text_color: preset.text_color,
      font_family: preset.font_family,
      border_radius: preset.border_radius?.toString() || '8',
      button_style: preset.button_style
    });

    // Update extended fields
    setExtendedBranding({
      theme_style: preset.theme_style || themeName,
      card_style: preset.card_style || 'elevated',
      card_background: preset.card_background || '#FFFFFF',
      card_blur: preset.card_blur || 0,
      input_style: preset.input_style || 'outlined',
      input_background: preset.input_background || '#F9FAFB',
      input_border_color: preset.input_border_color || '#D1D5DB',
      input_focus_color: preset.input_focus_color || '#3B82F6',
      button_variant: preset.button_variant || 'solid',
      button_size: preset.button_size || 'medium',
      button_hover_transform: preset.button_hover_transform ?? true,
      shadow_intensity: preset.shadow_intensity || 'medium',
      gradient_start: preset.gradient_start || '',
      gradient_end: preset.gradient_end || '',
      error_color: preset.error_color || '#EF4444',
      success_color: preset.success_color || '#10B981',
      warning_color: preset.warning_color || '#F59E0B',
      heading_font_family: preset.heading_font_family || '',
      font_size_scale: preset.font_size_scale || 'medium',
      use_gradient: preset.use_gradient || false,
      glass_effect: preset.glass_effect || false,
      blur_background: preset.blur_background || false,
      enable_animations: preset.enable_animations ?? true,
      animation_speed: preset.animation_speed || 'normal',
      form_width: preset.form_width || 'medium',
      spacing: preset.spacing || 'normal',
      message_loading_text: preset.message_loading_text || MESSAGE_TRANSLATIONS[selectedLanguage].message_loading_text,
      message_success_text: preset.message_success_text || MESSAGE_TRANSLATIONS[selectedLanguage].message_success_text,
      message_error_text: preset.message_error_text || MESSAGE_TRANSLATIONS[selectedLanguage].message_error_text,
      message_error_help_text: preset.message_error_help_text || MESSAGE_TRANSLATIONS[selectedLanguage].message_error_help_text,
      redirect_delay: preset.redirect_delay || 2000,
      message_loading_bg: preset.message_loading_bg || '#DBEAFE',
      message_success_bg: preset.message_success_bg || '#DCFCE7',
      message_error_bg: preset.message_error_bg || '#FEE2E2'
    });
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

    setTexts({ ...FORM_TEXT_TRANSLATIONS[selectedLanguage] });

    setExtendedBranding(prev => ({
      ...prev,
      message_loading_text: MESSAGE_TRANSLATIONS[selectedLanguage].message_loading_text,
      message_success_text: MESSAGE_TRANSLATIONS[selectedLanguage].message_success_text,
      message_error_text: MESSAGE_TRANSLATIONS[selectedLanguage].message_error_text,
      message_error_help_text: MESSAGE_TRANSLATIONS[selectedLanguage].message_error_help_text
    }));

    setGeneratedThemeDraft(null);
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      const customTextsToPersist = {
        ...texts,
        __language: selectedLanguage,
        message_loading_text: extendedBranding.message_loading_text,
        message_success_text: extendedBranding.message_success_text,
        message_error_text: extendedBranding.message_error_text,
        message_error_help_text: extendedBranding.message_error_help_text,
        __generated_theme: generatedThemeDraft
      };

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
        custom_texts: customTextsToPersist,
        // Extended branding fields
        ...extendedBranding
      } as any);
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
                <div className="w-20 h-20 mx-auto mb-4 rounded-xl border border-gray-200 bg-white/80 p-2 flex items-center justify-center overflow-hidden">
                  <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
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
                <div className="w-20 h-20 mx-auto mb-4 rounded-xl border border-gray-200 bg-white/80 p-2 flex items-center justify-center overflow-hidden">
                  <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
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
                <div className="w-20 h-20 mx-auto mb-4 rounded-xl border border-gray-200 bg-white/80 p-2 flex items-center justify-center overflow-hidden">
                  <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
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
                <div className="w-20 h-20 mx-auto mb-4 rounded-xl border border-gray-200 bg-white/80 p-2 flex items-center justify-center overflow-hidden">
                  <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
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

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'basic'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Palette className="w-5 h-5" />
            <span>Diseño Base</span>
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'advanced'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wand2 className="w-5 h-5" />
            <span>Avanzado</span>
          </button>
          <button
            onClick={() => setActiveTab('texts')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'texts'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Contenido</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">{(activeTab === 'basic' || activeTab === 'texts') && (
          <>
          {activeTab === 'basic' && (
          <>
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
                <div className="flex items-center space-x-4 mb-3">
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Logo</span>
                  </button>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAssetUpload('logo', e.target.files?.[0])}
                  />
                  <input
                    type="url"
                    placeholder="O ingresa URL del logo"
                    value={branding.logo_url}
                    onChange={(e) => setBranding(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {branding.logo_url && (
                  <div className="w-28 h-16 rounded-lg border border-gray-200 bg-gray-50 p-2 flex items-center justify-center overflow-hidden">
                    <img src={branding.logo_url} alt="Preview logo" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Favicon
                </label>
                <div className="flex items-center space-x-4 mb-3">
                  <button
                    type="button"
                    onClick={() => faviconFileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Favicon</span>
                  </button>
                  <input
                    ref={faviconFileInputRef}
                    type="file"
                    accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => handleAssetUpload('favicon', e.target.files?.[0])}
                  />
                  <input
                    type="url"
                    placeholder="O ingresa URL del favicon"
                    value={branding.favicon_url}
                    onChange={(e) => setBranding(prev => ({ ...prev, favicon_url: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {branding.favicon_url && (
                  <div className="w-10 h-10 rounded-md border border-gray-200 bg-gray-50 p-1 flex items-center justify-center overflow-hidden">
                    <img src={branding.favicon_url} alt="Preview favicon" className="w-full h-full object-contain" />
                  </div>
                )}
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

          </>
          )}

          {/* Custom Texts */}
          {activeTab === 'texts' && (
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
          )}
          </>
          )}

          {activeTab === 'advanced' && (
            <BrandingExtendedControls
              branding={extendedBranding}
              onChange={handleExtendedChange}
              onApplyTheme={applyTheme}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              onTranslateMessages={handleTranslateMessages}
              onGenerateThemeFromPrompt={handleGenerateThemeFromPrompt}
              isGeneratingTheme={isGeneratingTheme}
              generatedThemeDraft={generatedThemeDraft}
              onSelectGeneratedTheme={handleSelectGeneratedTheme}
              onSaveGeneratedTheme={handleSaveGeneratedTheme}
            />
          )}

          {/* Actions */}
          <div className="sticky bottom-0 z-20 -mx-2 px-2 py-3 bg-white/95 backdrop-blur border-t border-gray-200">
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
        </div>

        {/* Preview Panel */}
        <div className="space-y-6 lg:sticky lg:top-24 self-start">
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
            <div className="preview-scroll border-2 border-gray-200 rounded-lg overflow-y-auto overflow-x-hidden max-h-[70vh] lg:max-h-[calc(100vh-13rem)]">
              <BrandedPublicAuth
                applicationId={selectedApp || 'preview'}
                formType={previewMode === 'confirm-reset' ? 'reset-password-confirm' : previewMode as 'login' | 'register' | 'reset-password' | 'reset-password-confirm'}
                branding={{
                  ...branding,
                  ...extendedBranding,
                  border_radius: parseInt(branding.border_radius),
                  custom_texts: texts
                }}
                onSubmit={async (data) => {
                  console.log('Preview submit:', data);
                  return { success: true };
                }}
                onSuccess={() => {
                  console.log('Preview success');
                }}
                onError={(error) => {
                  console.log('Preview error:', error);
                }}
              />
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
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}