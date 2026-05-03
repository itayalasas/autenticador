import { BrandingConfig } from '../types';

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function extractHexColors(prompt: string): string[] {
  const matches = prompt.match(/#[0-9a-fA-F]{6}/g);
  return matches ? Array.from(new Set(matches.map(color => color.toUpperCase()))) : [];
}

type NamedColor = {
  names: string[];
  hex: string;
  token: string;
};

const NAMED_COLORS: NamedColor[] = [
  { names: ['red', 'rojo', 'roja', 'crimson'], hex: '#F87171', token: 'Crimson' },
  { names: ['blue', 'azul', 'navy'], hex: '#3B82F6', token: 'Blue' },
  { names: ['green', 'verde', 'emerald'], hex: '#10B981', token: 'Green' },
  { names: ['teal', 'turquesa', 'cyan'], hex: '#0D9488', token: 'Teal' },
  { names: ['orange', 'naranja', 'amber'], hex: '#F59E0B', token: 'Amber' },
  { names: ['pink', 'rosa'], hex: '#EC4899', token: 'Rose' },
  { names: ['gray', 'grey', 'gris', 'slate'], hex: '#94A3B8', token: 'Slate' },
  { names: ['black', 'negro'], hex: '#111827', token: 'Midnight' },
  { names: ['white', 'blanco'], hex: '#F8FAFC', token: 'Light' }
];

function detectNamedColor(normalizedPrompt: string): NamedColor | null {
  return NAMED_COLORS.find((color) => color.names.some((name) => normalizedPrompt.includes(name))) || null;
}

function detectColorNearKeyword(normalizedPrompt: string, keywordRegex: string): NamedColor | null {
  for (const color of NAMED_COLORS) {
    const colorRegex = color.names.join('|');
    const nearRegex = new RegExp(`${keywordRegex}[\\w\\s]{0,35}(?:${colorRegex})|(?:${colorRegex})[\\w\\s]{0,35}${keywordRegex}`);
    if (nearRegex.test(normalizedPrompt)) {
      return color;
    }
  }

  return null;
}

function getReadableTextColor(backgroundColor: string): string {
  const cleanHex = backgroundColor.replace('#', '');
  if (cleanHex.length !== 6) {
    return '#1F2937';
  }

  const red = parseInt(cleanHex.slice(0, 2), 16);
  const green = parseInt(cleanHex.slice(2, 4), 16);
  const blue = parseInt(cleanHex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.6 ? '#1F2937' : '#F8FAFC';
}

export function generateThemeLabelFromPrompt(prompt: string): string {
  const normalized = prompt.toLowerCase();
  const isDark = /dark|oscuro|nocturno|night|black|negro/.test(normalized);
  const useGradient = /gradient|gradiente|degradado/.test(normalized);
  const minimal = /minimal|limpio|clean/.test(normalized);
  const professional = /professional|profesional|corporate|corporativo|empresa/.test(normalized);

  let styleToken = 'Modern';
  if (professional) styleToken = 'Corporate';
  else if (minimal) styleToken = 'Minimal';
  else if (useGradient) styleToken = 'Gradient';
  else if (isDark) styleToken = 'Dark';

  const buttonColor = detectColorNearKeyword(normalized, 'bot[oó]n|button');
  const genericColor = detectNamedColor(normalized);
  const colorToken = (buttonColor || genericColor)?.token || 'Fusion';

  return `${styleToken} ${colorToken}`;
}

export function generateThemeDescriptionFromPrompt(prompt: string): string {
  const normalized = prompt.toLowerCase();
  const backgroundColor = detectColorNearKeyword(normalized, 'fondo|background');
  const buttonColor = detectColorNearKeyword(normalized, 'bot[oó]n|button');

  if (backgroundColor && buttonColor) {
    return `Background ${backgroundColor.token.toLowerCase()} with ${buttonColor.token.toLowerCase()} action accents`;
  }

  if (backgroundColor) {
    return `Style with ${backgroundColor.token.toLowerCase()} background focus`;
  }

  if (buttonColor) {
    return `Style with ${buttonColor.token.toLowerCase()} call-to-action buttons`;
  }

  return 'Generated from your prompt preferences';
}

export function generateThemeFromPrompt(prompt: string, base: Partial<BrandingConfig> = {}): Partial<BrandingConfig> {
  const normalized = prompt.toLowerCase();
  const seed = hashString(prompt || 'auth-theme');

  const palettes = [
    { primary: '#2563EB', secondary: '#1E40AF', accent: '#3B82F6', background: '#F1F5F9', text: '#1E293B' },
    { primary: '#334155', secondary: '#1E293B', accent: '#0EA5E9', background: '#F8FAFC', text: '#0F172A' },
    { primary: '#059669', secondary: '#047857', accent: '#10B981', background: '#ECFDF5', text: '#064E3B' },
    { primary: '#F97316', secondary: '#EA580C', accent: '#FB923C', background: '#FFF7ED', text: '#7C2D12' },
    { primary: '#0EA5E9', secondary: '#0284C7', accent: '#06B6D4', background: '#F0F9FF', text: '#0C4A6E' }
  ];

  const selected = { ...pick(palettes, seed) };
  const customColors = extractHexColors(prompt);

  const backgroundNamedColor = detectColorNearKeyword(normalized, 'fondo|background');
  const buttonNamedColor = detectColorNearKeyword(normalized, 'bot[oó]n|button');

  if (customColors[0]) selected.primary = customColors[0];
  if (customColors[1]) selected.secondary = customColors[1];
  if (customColors[2]) selected.accent = customColors[2];

  if (buttonNamedColor) {
    selected.primary = buttonNamedColor.hex;
  }

  if (backgroundNamedColor) {
    selected.background = backgroundNamedColor.hex;
  }

  const isDark = /dark|oscuro|nocturno|night|black|negro/.test(normalized);
  const useGradient = /gradient|gradiente|degradado/.test(normalized);
  const glass = /glass|vidrio|glassmorphism/.test(normalized);
  const minimal = /minimal|limpio|clean/.test(normalized);
  const neumorphic = /neumorphic|neumorf|soft ui/.test(normalized);
  const rounded = /rounded|redondead/.test(normalized);
  const square = /square|cuadrad/.test(normalized);
  const animated = /animat|din[aá]mic|motion/.test(normalized);

  const config: Partial<BrandingConfig> = {
    ...base,
    theme_style: 'custom',
    primary_color: selected.primary,
    secondary_color: selected.secondary,
    accent_color: selected.accent,
    background_color: isDark ? '#0F172A' : selected.background,
    text_color: isDark ? '#F8FAFC' : getReadableTextColor(selected.background),
    card_background: isDark ? '#111827' : '#FFFFFF',
    input_background: isDark ? '#1F2937' : '#F9FAFB',
    input_border_color: isDark ? '#374151' : '#D1D5DB',
    input_focus_color: selected.primary,
    button_style: square ? 'square' : 'rounded',
    button_variant: useGradient ? 'gradient' : 'solid',
    border_radius: rounded ? 16 : square ? 4 : 10,
    card_style: glass ? 'glass' : neumorphic ? 'neumorphic' : minimal ? 'flat' : 'elevated',
    shadow_intensity: minimal ? 'none' : 'medium',
    use_gradient: useGradient,
    gradient_start: selected.primary,
    gradient_end: selected.secondary,
    glass_effect: glass,
    blur_background: glass,
    enable_animations: animated || glass || useGradient,
    animation_speed: animated ? 'fast' : 'normal',
    form_width: /ancho|wide/.test(normalized) ? 'wide' : /estrecho|narrow/.test(normalized) ? 'narrow' : 'medium',
    spacing: /compact|compacto/.test(normalized) ? 'compact' : /relajado|relaxed/.test(normalized) ? 'relaxed' : 'normal'
  };

  return config;
}
