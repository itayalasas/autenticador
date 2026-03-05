import { useState } from 'react';
import { Palette, Wand2, Layers, Type, Sparkles, Settings } from 'lucide-react';
import { themePresets } from '../../utils/themePresets';
import { ThemeStyle, CardStyle, InputStyle, ButtonVariant, ButtonSize, ShadowIntensity, AnimationSpeed, FormWidth, Spacing } from '../../types';

interface ExtendedBrandingState {
  theme_style?: ThemeStyle;
  card_style?: CardStyle;
  card_background?: string;
  card_blur?: number;
  input_style?: InputStyle;
  input_background?: string;
  input_border_color?: string;
  input_focus_color?: string;
  button_variant?: ButtonVariant;
  button_size?: ButtonSize;
  button_hover_transform?: boolean;
  shadow_intensity?: ShadowIntensity;
  gradient_start?: string;
  gradient_end?: string;
  error_color?: string;
  success_color?: string;
  warning_color?: string;
  heading_font_family?: string;
  font_size_scale?: string;
  background_pattern?: string;
  background_image_url?: string;
  use_gradient?: boolean;
  glass_effect?: boolean;
  blur_background?: boolean;
  enable_animations?: boolean;
  animation_speed?: AnimationSpeed;
  form_width?: FormWidth;
  spacing?: Spacing;
  message_loading_text?: string;
  message_success_text?: string;
  message_error_text?: string;
  message_error_help_text?: string;
  redirect_delay?: number;
  message_loading_bg?: string;
  message_success_bg?: string;
  message_error_bg?: string;
}

interface BrandingExtendedControlsProps {
  branding: ExtendedBrandingState;
  onChange: (field: string, value: any) => void;
  onApplyTheme: (themeName: string) => void;
  selectedLanguage: 'es' | 'en';
  onLanguageChange: (language: 'es' | 'en') => void;
  onTranslateMessages: (language: 'es' | 'en') => void;
  onGenerateThemeFromPrompt: (prompt: string) => Promise<void>;
  isGeneratingTheme: boolean;
  generatedThemeDraft: {
    label: string;
    description: string;
    status: 'draft' | 'saved';
    created_at: string;
  } | null;
  onSelectGeneratedTheme: () => void;
  onSaveGeneratedTheme: () => void;
}

export default function BrandingExtendedControls({
  branding,
  onChange,
  onApplyTheme,
  selectedLanguage,
  onLanguageChange,
  onTranslateMessages,
  onGenerateThemeFromPrompt,
  isGeneratingTheme,
  generatedThemeDraft,
  onSelectGeneratedTheme,
  onSaveGeneratedTheme
}: BrandingExtendedControlsProps) {
  const [prompt, setPrompt] = useState('');

  return (
    <div className="space-y-8">
      {/* Theme Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Tema Predefinido</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Selecciona un tema base y personalízalo después
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themePresets.map((theme) => (
            <button
              key={theme.name}
              onClick={() => onApplyTheme(theme.name)}
              className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                branding.theme_style === theme.name
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-left">
                <div className="font-semibold text-gray-900 mb-1">{theme.label}</div>
                <div className="text-xs text-gray-600">{theme.description}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Generar tema con prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ej: Quiero un diseño oscuro elegante con gradiente morado y botones redondeados"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (!prompt.trim()) return;
                await onGenerateThemeFromPrompt(prompt);
              }}
              disabled={!prompt.trim() || isGeneratingTheme}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeneratingTheme ? 'Generando...' : 'Generar Diseño'}
            </button>
            <button
              onClick={onSaveGeneratedTheme}
              disabled={!generatedThemeDraft || isGeneratingTheme}
              className="px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              Guardar Tema
            </button>
          </div>

          {generatedThemeDraft && (
            <button
              onClick={onSelectGeneratedTheme}
              className="w-full mt-3 p-4 border rounded-lg text-left transition-all hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900">{generatedThemeDraft.label}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  generatedThemeDraft.status === 'saved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {generatedThemeDraft.status === 'saved' ? 'guardado' : 'borrador'}
                </span>
              </div>
              <p className="text-xs text-gray-600">{generatedThemeDraft.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                Generado: {new Date(generatedThemeDraft.created_at).toLocaleString()}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Card Styling */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Estilo de Tarjeta</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estilo
            </label>
            <select
              value={branding.card_style || 'elevated'}
              onChange={(e) => onChange('card_style', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="flat">Plano (Flat)</option>
              <option value="elevated">Elevado (Elevated)</option>
              <option value="glass">Vidrio (Glass)</option>
              <option value="neumorphic">Neumórfico</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Fondo
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.card_background || '#FFFFFF'}
                onChange={(e) => onChange('card_background', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.card_background || '#FFFFFF'}
                onChange={(e) => onChange('card_background', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          {branding.card_style === 'glass' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Intensidad de Blur
              </label>
              <input
                type="range"
                min="0"
                max="40"
                value={branding.card_blur || 0}
                onChange={(e) => onChange('card_blur', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-600 mt-1">{branding.card_blur || 0}px</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intensidad de Sombra
            </label>
            <select
              value={branding.shadow_intensity || 'medium'}
              onChange={(e) => onChange('shadow_intensity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">Sin sombra</option>
              <option value="light">Ligera</option>
              <option value="medium">Media</option>
              <option value="strong">Fuerte</option>
            </select>
          </div>
        </div>
      </div>

      {/* Input Styling */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Estilo de Inputs</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estilo
            </label>
            <select
              value={branding.input_style || 'outlined'}
              onChange={(e) => onChange('input_style', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="outlined">Outlined (borde)</option>
              <option value="filled">Filled (relleno)</option>
              <option value="underlined">Underlined (línea)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Fondo
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.input_background || '#F9FAFB'}
                onChange={(e) => onChange('input_background', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.input_background || '#F9FAFB'}
                onChange={(e) => onChange('input_background', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#F9FAFB"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Borde
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.input_border_color || '#D1D5DB'}
                onChange={(e) => onChange('input_border_color', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.input_border_color || '#D1D5DB'}
                onChange={(e) => onChange('input_border_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#D1D5DB"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color en Focus
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.input_focus_color || '#3B82F6'}
                onChange={(e) => onChange('input_focus_color', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.input_focus_color || '#3B82F6'}
                onChange={(e) => onChange('input_focus_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Button Styling */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Estilo de Botones</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Variante
            </label>
            <select
              value={branding.button_variant || 'solid'}
              onChange={(e) => onChange('button_variant', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="solid">Sólido</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
              <option value="gradient">Gradiente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tamaño
            </label>
            <select
              value={branding.button_size || 'medium'}
              onChange={(e) => onChange('button_size', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                checked={branding.button_hover_transform || false}
                onChange={(e) => onChange('button_hover_transform', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Transformación en Hover
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Extended Colors */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Colores Extendidos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Éxito
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.success_color || '#10B981'}
                onChange={(e) => onChange('success_color', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.success_color || '#10B981'}
                onChange={(e) => onChange('success_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#10B981"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Error
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.error_color || '#EF4444'}
                onChange={(e) => onChange('error_color', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.error_color || '#EF4444'}
                onChange={(e) => onChange('error_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#EF4444"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de Advertencia
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.warning_color || '#F59E0B'}
                onChange={(e) => onChange('warning_color', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.warning_color || '#F59E0B'}
                onChange={(e) => onChange('warning_color', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#F59E0B"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={branding.use_gradient || false}
              onChange={(e) => onChange('use_gradient', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">
              Usar Gradiente en Fondo
            </label>
          </div>

          {branding.use_gradient && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Inicial del Gradiente
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.gradient_start || '#3B82F6'}
                    onChange={(e) => onChange('gradient_start', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.gradient_start || '#3B82F6'}
                    onChange={(e) => onChange('gradient_start', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Final del Gradiente
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.gradient_end || '#8B5CF6'}
                    onChange={(e) => onChange('gradient_end', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={branding.gradient_end || '#8B5CF6'}
                    onChange={(e) => onChange('gradient_end', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#8B5CF6"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Effects */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Efectos Visuales</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={branding.glass_effect || false}
              onChange={(e) => onChange('glass_effect', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Efecto Glassmorphism
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={branding.blur_background || false}
              onChange={(e) => onChange('blur_background', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Blur en Fondo (blobs animados)
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={branding.enable_animations || true}
              onChange={(e) => onChange('enable_animations', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Habilitar Animaciones
            </span>
          </label>

          {branding.enable_animations && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Velocidad de Animación
              </label>
              <select
                value={branding.animation_speed || 'normal'}
                onChange={(e) => onChange('animation_speed', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="slow">Lenta</option>
                <option value="normal">Normal</option>
                <option value="fast">Rápida</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Layout */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Layout</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ancho del Formulario
            </label>
            <select
              value={branding.form_width || 'medium'}
              onChange={(e) => onChange('form_width', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="narrow">Estrecho</option>
              <option value="medium">Mediano</option>
              <option value="wide">Ancho</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Espaciado
            </label>
            <select
              value={branding.spacing || 'normal'}
              onChange={(e) => onChange('spacing', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="compact">Compacto</option>
              <option value="normal">Normal</option>
              <option value="relaxed">Relajado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Custom Messages */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mensajes Personalizados</h3>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Idioma activo</label>
          <select
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as 'es' | 'en')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={() => onTranslateMessages(selectedLanguage)}
            className="px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            Traducir mensajes al idioma activo
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de Carga
            </label>
            <input
              type="text"
              value={branding.message_loading_text || 'Authenticating...'}
              onChange={(e) => onChange('message_loading_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Authenticating..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de Éxito
            </label>
            <input
              type="text"
              value={branding.message_success_text || 'Welcome back! Redirecting...'}
              onChange={(e) => onChange('message_success_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Welcome back! Redirecting..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje de Error
            </label>
            <input
              type="text"
              value={branding.message_error_text || 'Invalid credentials. Please try again.'}
              onChange={(e) => onChange('message_error_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Invalid credentials. Please try again."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto de Ayuda en Error
            </label>
            <input
              type="text"
              value={branding.message_error_help_text || 'Please check your email and password.'}
              onChange={(e) => onChange('message_error_help_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please check your email and password."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiempo de Redirección (milisegundos)
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              step="500"
              value={branding.redirect_delay || 2000}
              onChange={(e) => onChange('redirect_delay', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="2000"
            />
            <div className="text-sm text-gray-600 mt-1">
              {((branding.redirect_delay || 2000) / 1000).toFixed(1)} segundos
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
