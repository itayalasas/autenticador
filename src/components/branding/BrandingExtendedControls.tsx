import React, { useMemo, useState } from 'react';
import { Palette, Wand2, Layers, Type, Sparkles, Settings, Languages, Image as ImageIcon, LayoutTemplate, MessagesSquare } from 'lucide-react';
import { themePresets } from '../../utils/themePresets';
import { ThemeStyle, CardStyle, InputStyle, ButtonVariant, ButtonSize, ShadowIntensity, AnimationSpeed, FormWidth, Spacing } from '../../types';
import { BRANDING_LANGUAGE_OPTIONS, BrandingLanguage } from '../../utils/brandingTranslations';

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
  selectedLanguage: BrandingLanguage;
  onLanguageChange: (language: BrandingLanguage) => void;
  onTranslateMessages: (language: BrandingLanguage) => void;
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

function ControlCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100 text-sky-700 shadow-inner">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function LabeledColorField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
    </label>
  );
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

  const activeTheme = useMemo(
    () => themePresets.find((theme) => theme.name === branding.theme_style),
    [branding.theme_style]
  );

  return (
    <div className="space-y-8">
      <ControlCard
        icon={Wand2}
        title="Sistema de temas"
        description="Parte de un preset listo para producción y luego afina la atmósfera, copy y microdetalles sin romper el flujo actual."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themePresets.map((theme) => {
            const isActive = branding.theme_style === theme.name;
            const palette = [
              theme.config.primary_color,
              theme.config.secondary_color,
              theme.config.accent_color
            ].filter(Boolean) as string[];

            return (
              <button
                key={theme.name}
                type="button"
                onClick={() => onApplyTheme(theme.name)}
                className={`group rounded-3xl border p-4 text-left transition-all ${
                  isActive
                    ? 'border-sky-400 bg-sky-50/90 shadow-[0_16px_40px_-28px_rgba(14,165,233,0.7)]'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {palette.slice(0, 3).map((color, index) => (
                      <span
                        key={`${theme.name}-${index}`}
                        className="h-8 w-8 rounded-full border border-white/70 shadow-sm"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">
                      Activo
                    </span>
                  )}
                </div>
                <div className="text-base font-semibold text-slate-900">{theme.label}</div>
                <p className="mt-1 text-sm text-slate-600">{theme.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
          <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Generar dirección creativa desde prompt
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder="Ej: Quiero una experiencia premium, minimalista y tecnológica, con fondos suaves, tipografía elegante y llamadas a la acción muy claras."
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!prompt.trim()) return;
                  await onGenerateThemeFromPrompt(prompt);
                }}
                disabled={!prompt.trim() || isGeneratingTheme}
                className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingTheme ? 'Generando propuesta...' : 'Generar propuesta'}
              </button>
              <button
                type="button"
                onClick={onSaveGeneratedTheme}
                disabled={!generatedThemeDraft || isGeneratingTheme}
                className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar tema IA
              </button>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white shadow-[0_24px_60px_-32px_rgba(2,132,199,0.65)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
              Tema actual
            </div>
            <div className="mt-3 text-2xl font-semibold">
              {generatedThemeDraft?.label || activeTheme?.label || 'Custom'}
            </div>
            <p className="mt-2 text-sm text-slate-200/80">
              {generatedThemeDraft?.description || activeTheme?.description || 'Combinación personalizada lista para seguir afinando.'}
            </p>
            {generatedThemeDraft && (
              <button
                type="button"
                onClick={onSelectGeneratedTheme}
                className="mt-5 inline-flex rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Aplicar esta propuesta
              </button>
            )}
          </div>
        </div>
      </ControlCard>

      <ControlCard
        icon={Languages}
        title="Copy, idioma y traducciones"
        description="Define el tono base del formulario y rellena automáticamente títulos, mensajes y textos clave del flujo público."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4 xl:grid-cols-2">
            <SelectField
              label="Idioma base del borrador"
              value={selectedLanguage}
              onChange={(value) => onLanguageChange(value as BrandingLanguage)}
              options={BRANDING_LANGUAGE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label
              }))}
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-medium text-slate-800">
                {BRANDING_LANGUAGE_OPTIONS.find((option) => option.value === selectedLanguage)?.label}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {BRANDING_LANGUAGE_OPTIONS.find((option) => option.value === selectedLanguage)?.description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTranslateMessages(selectedLanguage)}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Aplicar textos sugeridos
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Mensajería transaccional</div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Texto mientras procesa</label>
              <input
                type="text"
                value={branding.message_loading_text || ''}
                onChange={(e) => onChange('message_loading_text', e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Texto de éxito</label>
              <input
                type="text"
                value={branding.message_success_text || ''}
                onChange={(e) => onChange('message_success_text', e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Texto de error</label>
              <input
                type="text"
                value={branding.message_error_text || ''}
                onChange={(e) => onChange('message_error_text', e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Ayuda complementaria en errores</label>
              <textarea
                value={branding.message_error_help_text || ''}
                onChange={(e) => onChange('message_error_help_text', e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>
      </ControlCard>

      <ControlCard
        icon={LayoutTemplate}
        title="Layout y atmósfera"
        description="Ajusta ancho, ritmo visual, fondo e imagen de ambiente para que el formulario se sienta consistente con la marca."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Ancho del formulario"
            value={branding.form_width || 'medium'}
            onChange={(value) => onChange('form_width', value)}
            options={[
              { value: 'narrow', label: 'Compacto' },
              { value: 'medium', label: 'Balanceado' },
              { value: 'wide', label: 'Amplio' }
            ]}
          />
          <SelectField
            label="Espaciado general"
            value={branding.spacing || 'normal'}
            onChange={(value) => onChange('spacing', value)}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'normal', label: 'Normal' },
              { value: 'relaxed', label: 'Aireado' }
            ]}
          />
          <SelectField
            label="Escala tipográfica"
            value={branding.font_size_scale || 'medium'}
            onChange={(value) => onChange('font_size_scale', value)}
            options={[
              { value: 'small', label: 'Pequeña' },
              { value: 'medium', label: 'Media' },
              { value: 'large', label: 'Grande' }
            ]}
          />
          <SelectField
            label="Patrón de fondo"
            value={branding.background_pattern || 'none'}
            onChange={(value) => onChange('background_pattern', value === 'none' ? '' : value)}
            options={[
              { value: 'none', label: 'Sin patrón' },
              { value: 'dot-grid', label: 'Puntos suaves' },
              { value: 'mesh', label: 'Malla difusa' },
              { value: 'diagonal-lines', label: 'Líneas diagonales' },
              { value: 'radial-burst', label: 'Radial moderno' }
            ]}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Fuente para titulares</label>
            <input
              type="text"
              value={branding.heading_font_family || ''}
              onChange={(e) => onChange('heading_font_family', e.target.value)}
              placeholder="Ej: Space Grotesk, Manrope, Inter"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Imagen de fondo opcional</label>
            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="url"
                value={branding.background_image_url || ''}
                onChange={(e) => onChange('background_image_url', e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>
      </ControlCard>

      <div className="grid gap-8 xl:grid-cols-2">
        <ControlCard
          icon={Layers}
          title="Tarjeta principal"
          description="Controla el lenguaje visual de la superficie central del login: profundidad, blur y tipo de elevación."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <SelectField
              label="Estilo de tarjeta"
              value={branding.card_style || 'elevated'}
              onChange={(value) => onChange('card_style', value)}
              options={[
                { value: 'flat', label: 'Flat' },
                { value: 'elevated', label: 'Elevated' },
                { value: 'glass', label: 'Glass' },
                { value: 'neumorphic', label: 'Neumorphic' }
              ]}
            />
            <SelectField
              label="Intensidad de sombra"
              value={branding.shadow_intensity || 'medium'}
              onChange={(value) => onChange('shadow_intensity', value)}
              options={[
                { value: 'none', label: 'Sin sombra' },
                { value: 'light', label: 'Ligera' },
                { value: 'medium', label: 'Media' },
                { value: 'strong', label: 'Fuerte' }
              ]}
            />
            <LabeledColorField
              label="Fondo de tarjeta"
              value={branding.card_background || '#FFFFFF'}
              onChange={(value) => onChange('card_background', value)}
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Blur de tarjeta</label>
              <input
                type="range"
                min="0"
                max="40"
                value={branding.card_blur || 0}
                onChange={(e) => onChange('card_blur', Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="text-xs text-slate-500">{branding.card_blur || 0}px</div>
            </div>
          </div>
        </ControlCard>

        <ControlCard
          icon={Type}
          title="Campos e inputs"
          description="Ajusta contraste, foco y lenguaje visual de los campos para priorizar legibilidad y confianza."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <SelectField
              label="Estilo de input"
              value={branding.input_style || 'outlined'}
              onChange={(value) => onChange('input_style', value)}
              options={[
                { value: 'outlined', label: 'Outlined' },
                { value: 'filled', label: 'Filled' },
                { value: 'underlined', label: 'Underlined' }
              ]}
            />
            <LabeledColorField
              label="Color de foco"
              value={branding.input_focus_color || '#3B82F6'}
              onChange={(value) => onChange('input_focus_color', value)}
            />
            <LabeledColorField
              label="Fondo de input"
              value={branding.input_background || '#F8FAFC'}
              onChange={(value) => onChange('input_background', value)}
            />
            <LabeledColorField
              label="Borde de input"
              value={branding.input_border_color || '#D1D5DB'}
              onChange={(value) => onChange('input_border_color', value)}
            />
          </div>
        </ControlCard>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <ControlCard
          icon={Settings}
          title="CTA y botones"
          description="Haz que el llamado a la acción se sienta fuerte, claro y consistente con el tipo de marca que estás construyendo."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <SelectField
              label="Variante principal"
              value={branding.button_variant || 'solid'}
              onChange={(value) => onChange('button_variant', value)}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'outline', label: 'Outline' },
                { value: 'ghost', label: 'Ghost' },
                { value: 'gradient', label: 'Gradient' }
              ]}
            />
            <SelectField
              label="Tamaño"
              value={branding.button_size || 'medium'}
              onChange={(value) => onChange('button_size', value)}
              options={[
                { value: 'small', label: 'Pequeño' },
                { value: 'medium', label: 'Medio' },
                { value: 'large', label: 'Grande' }
              ]}
            />
          </div>

          <div className="mt-5 grid gap-3">
            <ToggleField
              label="Transformación en hover"
              description="Aplica un leve lift para que el CTA responda con más intención."
              checked={branding.button_hover_transform ?? true}
              onChange={(value) => onChange('button_hover_transform', value)}
            />
            <ToggleField
              label="Usar gradiente de marca"
              description="Permite usar un CTA más expresivo cuando el preset lo amerita."
              checked={branding.use_gradient ?? false}
              onChange={(value) => onChange('use_gradient', value)}
            />
          </div>

          {(branding.use_gradient || branding.button_variant === 'gradient') && (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <LabeledColorField
                label="Inicio del gradiente"
                value={branding.gradient_start || '#3B82F6'}
                onChange={(value) => onChange('gradient_start', value)}
              />
              <LabeledColorField
                label="Fin del gradiente"
                value={branding.gradient_end || '#8B5CF6'}
                onChange={(value) => onChange('gradient_end', value)}
              />
            </div>
          )}
        </ControlCard>

        <ControlCard
          icon={MessagesSquare}
          title="Mensajes de estado"
          description="Refina los colores de éxito, error y loading para que la UI responda con una narrativa clara y moderna."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <LabeledColorField
              label="Color de éxito"
              value={branding.success_color || '#10B981'}
              onChange={(value) => onChange('success_color', value)}
            />
            <LabeledColorField
              label="Color de error"
              value={branding.error_color || '#EF4444'}
              onChange={(value) => onChange('error_color', value)}
            />
            <LabeledColorField
              label="Color de advertencia"
              value={branding.warning_color || '#F59E0B'}
              onChange={(value) => onChange('warning_color', value)}
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Retraso antes del redirect</label>
              <input
                type="number"
                min="500"
                step="100"
                value={branding.redirect_delay || 2000}
                onChange={(e) => onChange('redirect_delay', Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <LabeledColorField
              label="Fondo de loading"
              value={branding.message_loading_bg || '#DBEAFE'}
              onChange={(value) => onChange('message_loading_bg', value)}
            />
            <LabeledColorField
              label="Fondo de éxito"
              value={branding.message_success_bg || '#DCFCE7'}
              onChange={(value) => onChange('message_success_bg', value)}
            />
            <LabeledColorField
              label="Fondo de error"
              value={branding.message_error_bg || '#FEE2E2'}
              onChange={(value) => onChange('message_error_bg', value)}
            />
          </div>
        </ControlCard>
      </div>

      <ControlCard
        icon={Sparkles}
        title="Movimiento y ambiente"
        description="Activa una experiencia más viva, con patrones y desenfoques que elevan la percepción del formulario sin cambiar su estructura."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <ToggleField
            label="Glass effect"
            description="Añade transparencia y borde de cristal sobre la tarjeta principal."
            checked={branding.glass_effect ?? false}
            onChange={(value) => onChange('glass_effect', value)}
          />
          <ToggleField
            label="Blur en el fondo"
            description="Genera orbes y capas atmosféricas detrás del formulario."
            checked={branding.blur_background ?? false}
            onChange={(value) => onChange('blur_background', value)}
          />
          <ToggleField
            label="Animaciones"
            description="Mantiene transiciones suaves entre inputs, botones y estados."
            checked={branding.enable_animations ?? true}
            onChange={(value) => onChange('enable_animations', value)}
          />
        </div>

        {branding.enable_animations !== false && (
          <div className="mt-5 max-w-sm">
            <SelectField
              label="Velocidad de animación"
              value={branding.animation_speed || 'normal'}
              onChange={(value) => onChange('animation_speed', value)}
              options={[
                { value: 'slow', label: 'Lenta' },
                { value: 'normal', label: 'Normal' },
                { value: 'fast', label: 'Rápida' }
              ]}
            />
          </div>
        )}
      </ControlCard>
    </div>
  );
}
