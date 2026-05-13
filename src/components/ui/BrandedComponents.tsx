import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { BrandingConfig } from '../../types';

function getFormWidthClass(width?: string): string {
  switch (width) {
    case 'narrow':
      return 'max-w-sm';
    case 'wide':
      return 'max-w-2xl';
    default:
      return 'max-w-md';
  }
}

function getSpacingClass(spacing?: string): string {
  switch (spacing) {
    case 'compact':
      return 'space-y-4';
    case 'relaxed':
      return 'space-y-8';
    default:
      return 'space-y-6';
  }
}

function getAnimationDuration(speed?: string): string {
  switch (speed) {
    case 'slow':
      return 'duration-500';
    case 'fast':
      return 'duration-150';
    default:
      return 'duration-300';
  }
}

function isGradientValue(value?: string | null): boolean {
  return !!value && value.includes('gradient');
}

function hexToRgb(color?: string | null): { r: number; g: number; b: number } | null {
  if (!color) return null;
  const normalized = color.trim();

  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((char) => `${char}${char}`).join('');
    }
    if (hex.length !== 6) return null;
    const numeric = Number.parseInt(hex, 16);
    if (Number.isNaN(numeric)) return null;
    return {
      r: (numeric >> 16) & 255,
      g: (numeric >> 8) & 255,
      b: numeric & 255
    };
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) return null;

  return {
    r: Number(rgbMatch[1]),
    g: Number(rgbMatch[2]),
    b: Number(rgbMatch[3])
  };
}

function withAlpha(color: string | undefined, alpha: number, fallback = `rgba(15, 23, 42, ${alpha})`) {
  const rgb = hexToRgb(color);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function luminance(color?: string | null): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 255;
  return (0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b);
}

function readableForeground(background?: string | null, fallbackDark = '#0F172A', fallbackLight = '#FFFFFF') {
  return luminance(background) > 165 ? fallbackDark : fallbackLight;
}

function getCardShadow(branding: BrandingConfig) {
  const primaryGlow = withAlpha(branding.primary_color, 0.22, 'rgba(14, 165, 233, 0.22)');
  switch (branding.shadow_intensity) {
    case 'none':
      return 'none';
    case 'light':
      return `0 18px 40px -34px ${primaryGlow}`;
    case 'strong':
      return `0 40px 90px -42px ${primaryGlow}, 0 18px 42px -30px rgba(15, 23, 42, 0.45)`;
    default:
      return `0 28px 70px -38px ${primaryGlow}, 0 16px 34px -28px rgba(15, 23, 42, 0.35)`;
  }
}

function getPatternStyle(branding: BrandingConfig): React.CSSProperties {
  const primarySoft = withAlpha(branding.primary_color, 0.08, 'rgba(59, 130, 246, 0.08)');
  const accentSoft = withAlpha(branding.accent_color || branding.secondary_color, 0.09, 'rgba(236, 72, 153, 0.09)');

  switch (branding.background_pattern) {
    case 'dot-grid':
      return {
        backgroundImage: `radial-gradient(${primarySoft} 1px, transparent 1px)`,
        backgroundSize: '22px 22px'
      };
    case 'mesh':
      return {
        backgroundImage: `
          radial-gradient(circle at 20% 20%, ${primarySoft}, transparent 32%),
          radial-gradient(circle at 80% 0%, ${accentSoft}, transparent 28%),
          radial-gradient(circle at 100% 80%, ${withAlpha(branding.secondary_color, 0.08)}, transparent 34%)
        `
      };
    case 'diagonal-lines':
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${primarySoft} 0, ${primarySoft} 1px, transparent 1px, transparent 15px)`
      };
    case 'radial-burst':
      return {
        backgroundImage: `radial-gradient(circle at top, ${accentSoft}, transparent 36%), radial-gradient(circle at bottom right, ${primarySoft}, transparent 30%)`
      };
    default:
      return {};
  }
}

function getScaleClasses(scale?: string) {
  switch (scale) {
    case 'small':
      return {
        title: 'text-2xl',
        subtitle: 'text-sm',
        body: 'text-sm'
      };
    case 'large':
      return {
        title: 'text-4xl',
        subtitle: 'text-lg',
        body: 'text-base'
      };
    default:
      return {
        title: 'text-3xl',
        subtitle: 'text-base',
        body: 'text-sm'
      };
  }
}

type MessageStatus = 'idle' | 'loading' | 'success' | 'error';

interface BrandedContainerProps {
  branding: BrandingConfig;
  children: React.ReactNode;
  viewport?: 'screen' | 'full' | 'auto';
}

export function BrandedContainer({ branding, children, viewport = 'screen' }: BrandedContainerProps) {
  const patternStyle = getPatternStyle(branding);
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: branding.background_color || '#F8FAFC',
    color: branding.text_color || '#0F172A',
    fontFamily: branding.font_family || 'Inter, sans-serif'
  };

  const viewportClass = viewport === 'full'
    ? 'min-h-full'
    : viewport === 'auto'
      ? ''
      : 'min-h-screen';

  if (branding.use_gradient && branding.gradient_start && branding.gradient_end) {
    backgroundStyle.background = `linear-gradient(135deg, ${branding.gradient_start}, ${branding.gradient_end})`;
  }

  if (branding.background_image_url) {
    backgroundStyle.backgroundImage = `${backgroundStyle.background ? `${backgroundStyle.background}, ` : ''}url(${branding.background_image_url})`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
  }

  const overlayStyle = getPatternStyle(branding);

  return (
    <div
      className={`relative ${viewportClass} overflow-hidden px-4 py-10 sm:px-8 ${branding.blur_background ? 'isolate' : ''}`}
      style={backgroundStyle}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          ...overlayStyle,
          backgroundColor: branding.background_image_url ? withAlpha(branding.background_color, 0.72, 'rgba(248,250,252,0.72)') : undefined
        }}
      />

      {branding.blur_background && (
        <>
          <div
            className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl"
            style={{ background: withAlpha(branding.primary_color, 0.24) }}
          />
          <div
            className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full blur-3xl"
            style={{ background: withAlpha(branding.secondary_color, 0.18) }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full blur-3xl"
            style={{ background: withAlpha(branding.accent_color || branding.primary_color, 0.16) }}
          />
        </>
      )}

      <div className={`relative mx-auto w-full ${getFormWidthClass(branding.form_width)}`}>
        <div className={getSpacingClass(branding.spacing)} style={patternStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface AuthSystemBadgeProps {
  branding?: Partial<BrandingConfig>;
  text?: string;
  compact?: boolean;
}

export function AuthSystemBadge({
  branding,
  text = 'AuthSystem',
  compact = false
}: AuthSystemBadgeProps) {
  const borderRadius = compact ? 16 : 9999;
  const color = withAlpha(branding?.text_color || '#0F172A', 0.74, 'rgba(15,23,42,0.74)');
  const background = withAlpha(branding?.card_background || '#FFFFFF', compact ? 0.86 : 0.72, compact ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.72)');

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2.5 border border-white/60 shadow-sm backdrop-blur ${compact ? 'px-3 py-2 text-sm' : 'px-3.5 py-1.5 text-xs tracking-[0.24em]'}`}
      style={{
        borderRadius,
        background,
        color
      }}
    >
      <img
        src="/images/icon.svg"
        alt="AuthSystem"
        className={compact ? 'h-5 w-5 rounded-lg' : 'h-5 w-5 rounded-lg'}
      />
      <span className={`truncate font-semibold ${compact ? 'normal-case tracking-normal' : ''}`}>{text}</span>
    </div>
  );
}

interface BrandedCardProps {
  branding: BrandingConfig;
  children: React.ReactNode;
}

export function BrandedCard({ branding, children }: BrandedCardProps) {
  const cardStyle: React.CSSProperties = useMemo(() => {
    const borderRadius = branding.border_radius || 18;
    const defaultBackground = branding.card_background || '#FFFFFF';
    const style: React.CSSProperties = {
      borderRadius,
      border: `1px solid ${withAlpha(branding.primary_color, branding.card_style === 'glass' ? 0.18 : 0.08, 'rgba(148, 163, 184, 0.18)')}`,
      boxShadow: branding.card_style === 'neumorphic'
        ? `18px 18px 40px ${withAlpha('#94A3B8', 0.2)}, -18px -18px 40px ${withAlpha('#FFFFFF', 0.85)}`
        : getCardShadow(branding),
      background: defaultBackground
    };

    if (branding.card_style === 'glass' || branding.glass_effect) {
      style.background = isGradientValue(defaultBackground)
        ? defaultBackground
        : `linear-gradient(180deg, ${withAlpha(defaultBackground, 0.82, 'rgba(255,255,255,0.82)')}, ${withAlpha(defaultBackground, 0.68, 'rgba(255,255,255,0.68)')})`;
      style.backdropFilter = `blur(${Math.max(branding.card_blur || 18, branding.glass_effect ? 18 : 0)}px)`;
      style.WebkitBackdropFilter = style.backdropFilter;
    }

    if (branding.card_style === 'flat') {
      style.boxShadow = 'none';
      style.border = `1px solid ${withAlpha(branding.primary_color, 0.12, 'rgba(148,163,184,0.18)')}`;
    }

    return style;
  }, [branding]);

  return (
    <div className="relative overflow-hidden p-6 sm:p-8" style={cardStyle}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${withAlpha(branding.primary_color, 0.65)}, transparent)`
        }}
      />
      {children}
    </div>
  );
}

interface BrandedInputProps {
  type: string;
  id?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  branding: BrandingConfig;
  icon?: React.ReactNode;
  label?: string;
  showPasswordToggle?: boolean;
  onPasswordToggle?: () => void;
  showPassword?: boolean;
}

export function BrandedInput({
  type,
  id,
  placeholder,
  value,
  onChange,
  branding,
  icon,
  label,
  showPasswordToggle,
  onPasswordToggle,
  showPassword
}: BrandedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const radius = branding.button_style === 'rounded' ? `${branding.border_radius || 14}px` : '12px';
  const transition = branding.enable_animations === false ? '' : getAnimationDuration(branding.animation_speed);

  const wrapperStyle: React.CSSProperties = {
    borderRadius: radius,
    border: branding.input_style === 'underlined'
      ? 'none'
      : `1px solid ${isFocused ? (branding.input_focus_color || branding.primary_color) : (branding.input_border_color || 'rgba(148, 163, 184, 0.4)')}`,
    background: branding.input_style === 'underlined'
      ? 'transparent'
      : (branding.input_background || '#FFFFFF'),
    boxShadow: isFocused
      ? `0 0 0 4px ${withAlpha(branding.input_focus_color || branding.primary_color, 0.14)}`
      : 'none'
  };

  const inputStyle: React.CSSProperties = {
    color: branding.text_color || '#0F172A',
    borderRadius: branding.input_style === 'underlined' ? 0 : radius,
    borderBottom: branding.input_style === 'underlined'
      ? `2px solid ${isFocused ? (branding.input_focus_color || branding.primary_color) : (branding.input_border_color || '#CBD5E1')}`
      : undefined,
    background: 'transparent',
    outline: 'none'
  };

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium tracking-wide text-slate-700"
          style={{ color: withAlpha(branding.text_color, 0.84, 'rgba(15,23,42,0.84)') }}
        >
          {label}
        </label>
      )}

      <div className={`relative ${branding.input_style === 'underlined' ? '' : `transition-all ${transition}`}`} style={wrapperStyle}>
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4" style={{ color: withAlpha(branding.primary_color, 0.72) }}>
            {icon}
          </div>
        )}

        <input
          type={type}
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full ${branding.input_style === 'underlined' ? 'px-0 py-3.5' : 'py-3.5'} ${icon ? 'pl-12' : 'pl-4'} ${showPasswordToggle ? 'pr-12' : 'pr-4'} text-[15px] transition-all ${transition} placeholder:text-slate-400`}
          style={inputStyle}
        />

        {showPasswordToggle && (
          <button
            type="button"
            onClick={onPasswordToggle}
            className="absolute inset-y-0 right-0 flex items-center pr-4 transition-opacity hover:opacity-80"
            style={{ color: withAlpha(branding.primary_color, 0.72) }}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface BrandedButtonProps {
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  branding: BrandingConfig;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export function BrandedButton({
  type = 'button',
  onClick,
  children,
  branding,
  variant = 'primary',
  disabled,
  loading,
  loadingText
}: BrandedButtonProps) {
  const transformClass = branding.button_hover_transform && branding.enable_animations !== false
    ? 'hover:-translate-y-0.5 active:translate-y-0'
    : '';

  const sizeClass = branding.button_size === 'small'
    ? 'min-h-[44px] px-4 text-sm'
    : branding.button_size === 'large'
      ? 'min-h-[58px] px-6 text-base'
      : 'min-h-[52px] px-5 text-sm';

  const borderRadius = branding.button_style === 'rounded'
    ? `${branding.border_radius || 14}px`
    : '12px';

  const style: React.CSSProperties = {
    borderRadius,
    border: '1px solid transparent',
    color: '#FFFFFF',
    boxShadow: getCardShadow({
      ...branding,
      shadow_intensity: branding.shadow_intensity === 'none' ? 'light' : branding.shadow_intensity
    })
  };

  const primaryColor = branding.primary_color || '#2563EB';
  const secondaryColor = branding.secondary_color || '#1D4ED8';

  if (variant === 'secondary') {
    style.background = withAlpha(primaryColor, 0.08);
    style.color = primaryColor;
    style.border = `1px solid ${withAlpha(primaryColor, 0.18)}`;
    style.boxShadow = 'none';
  } else if (branding.button_variant === 'outline') {
    style.background = 'transparent';
    style.color = primaryColor;
    style.border = `1px solid ${withAlpha(primaryColor, 0.22)}`;
    style.boxShadow = 'none';
  } else if (branding.button_variant === 'ghost') {
    style.background = withAlpha(primaryColor, 0.08);
    style.color = primaryColor;
    style.boxShadow = 'none';
  } else if (branding.button_variant === 'gradient' && branding.gradient_start && branding.gradient_end) {
    style.background = `linear-gradient(135deg, ${branding.gradient_start}, ${branding.gradient_end})`;
  } else {
    style.background = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex w-full items-center justify-center gap-2 font-semibold tracking-[0.01em] transition-all ${getAnimationDuration(branding.animation_speed)} ${transformClass} ${sizeClass} ${disabled || loading ? 'cursor-not-allowed opacity-60' : ''}`}
      style={style}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{loadingText || branding.message_loading_text || 'Procesando...'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

interface BrandedMessageProps {
  status: MessageStatus;
  branding: BrandingConfig;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  errorHelpText?: string;
}

export function BrandedMessage({
  status,
  branding,
  loadingText,
  successText,
  errorText,
  errorHelpText
}: BrandedMessageProps) {
  if (status === 'idle') return null;

  const baseBackground = status === 'loading'
    ? branding.message_loading_bg || withAlpha(branding.primary_color, 0.12)
    : status === 'success'
      ? branding.message_success_bg || withAlpha(branding.success_color || '#10B981', 0.16)
      : branding.message_error_bg || withAlpha(branding.error_color || '#EF4444', 0.14);

  const accentColor = status === 'loading'
    ? branding.primary_color || '#2563EB'
    : status === 'success'
      ? branding.success_color || '#10B981'
      : branding.error_color || '#EF4444';

  const foreground = readableForeground(baseBackground, '#0F172A', '#FFFFFF');

  const message = status === 'loading'
    ? (loadingText || branding.message_loading_text || 'Procesando...')
    : status === 'success'
      ? (successText || branding.message_success_text || 'Operación exitosa')
      : (errorText || branding.message_error_text || 'No pudimos completar la operación');

  const icon = status === 'loading'
    ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
    : status === 'success'
      ? <CheckCircle className="h-5 w-5" style={{ color: accentColor }} />
      : <XCircle className="h-5 w-5" style={{ color: accentColor }} />;

  const messageStyle: React.CSSProperties = {
    borderRadius: `${branding.border_radius || 16}px`,
    background: isGradientValue(baseBackground) ? baseBackground : baseBackground,
    border: `1px solid ${withAlpha(accentColor, 0.24)}`,
    color: foreground
  };

  return (
    <div className={`mb-6 transition-all ${status === 'error' ? 'animate-shake' : status === 'success' ? 'animate-slideIn' : 'animate-pulse'}`} style={messageStyle}>
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{message}</p>
          {status === 'error' && errorHelpText && (
            <p className="mt-1 text-sm opacity-80">{errorHelpText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface BrandedHeaderProps {
  branding: BrandingConfig;
  logoUrl?: string;
  title: string;
  subtitle?: string;
}

export function BrandedHeader({ branding, logoUrl, title, subtitle }: BrandedHeaderProps) {
  const scale = getScaleClasses(branding.font_size_scale);
  const titleColor = branding.text_color || '#0F172A';
  const supportingColor = withAlpha(titleColor, 0.76, 'rgba(15,23,42,0.76)');
  const badgeText = branding.custom_texts?.security_badge_text || 'AuthSystem';

  return (
    <div className="text-center">
      <div className="mb-4">
        <AuthSystemBadge branding={branding} text={badgeText} />
      </div>

      {logoUrl && (
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden border border-white/60 bg-white/70 p-3 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)] backdrop-blur"
          style={{ borderRadius: `${branding.border_radius || 20}px` }}
        >
          <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
        </div>
      )}

      <h1
        className={`${scale.title} font-semibold tracking-[-0.04em]`}
        style={{
          color: titleColor,
          fontFamily: branding.heading_font_family || branding.font_family
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          className={`mx-auto mt-3 max-w-xl ${scale.subtitle}`}
          style={{ color: supportingColor }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
