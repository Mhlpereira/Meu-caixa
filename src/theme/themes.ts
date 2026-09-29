export type ThemeName = 'neon' | 'escuro' | 'claro';

export interface ThemeColors {
  bg: string;
  surface: string;
  card: string;
  cardElevated: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;

  positive: string;
  positiveDim: string;
  negative: string;
  negativeDim: string;
  warning: string;
  warningDim: string;

  brand: string;
  brandDim: string;
  brandText: string;
  onBrand: string;

  overlay: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  dark: boolean;
  colors: ThemeColors;
  shadowOpacity: number;
}

const neon: Theme = {
  name: 'neon',
  label: 'Neon',
  description: 'Azul profundo com acentos vibrantes',
  dark: true,
  shadowOpacity: 0.35,
  colors: {
    bg: '#0B0F14',
    surface: '#151B23',
    card: '#1A222D',
    cardElevated: '#212B38',
    border: '#253040',
    borderStrong: '#31405433',

    text: '#E8EEF5',
    textMuted: '#8A9AAD',
    textFaint: '#7A8CA3',

    positive: '#34D399',
    positiveDim: '#34D39922',
    negative: '#F87171',
    negativeDim: '#F8717122',
    warning: '#FBBF24',
    warningDim: '#FBBF2422',

    brand: '#6366F1',
    brandDim: '#6366F122',
    brandText: '#C7D2FE',
    onBrand: '#FFFFFF',

    overlay: '#000000AA',
  },
};

const escuro: Theme = {
  name: 'escuro',
  label: 'Escuro',
  description: 'Preto neutro, sem tons de cor',
  dark: true,
  shadowOpacity: 0.5,
  colors: {
    bg: '#0A0A0A',
    surface: '#161618',
    card: '#1C1C1E',
    cardElevated: '#262629',
    border: '#2E2E32',
    borderStrong: '#3A3A4033',

    text: '#F2F2F2',
    textMuted: '#9A9A9E',
    textFaint: '#8A8A90',

    positive: '#30D158',
    positiveDim: '#30D15822',
    negative: '#FF6961',
    negativeDim: '#FF696122',
    warning: '#FFD60A',
    warningDim: '#FFD60A22',

    brand: '#0A84FF',
    brandDim: '#0A84FF22',
    brandText: '#7FBEFF',
    onBrand: '#FFFFFF',

    overlay: '#000000B8',
  },
};

const claro: Theme = {
  name: 'claro',
  label: 'Claro',
  description: 'Fundo branco, para ambientes iluminados',
  dark: false,
  shadowOpacity: 0.08,
  colors: {
    bg: '#F5F6F8',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#EEF1F5',
    border: '#DFE3E9',
    borderStrong: '#C4CAD433',

    text: '#10151B',
    textMuted: '#5B6675',
    textFaint: '#656E7B',

    positive: '#047857',
    positiveDim: '#04785714',
    negative: '#B91C1C',
    negativeDim: '#B91C1C14',
    warning: '#B45309',
    warningDim: '#B4530914',

    brand: '#4F46E5',
    brandDim: '#4F46E514',
    brandText: '#4338CA',
    onBrand: '#FFFFFF',

    overlay: '#0B121CA8',
  },
};

export const THEMES: Record<ThemeName, Theme> = { neon, escuro, claro };

export const THEME_ORDER: ThemeName[] = ['neon', 'escuro', 'claro'];

export const DEFAULT_THEME: ThemeName = 'neon';

export function isThemeName(value: string | null): value is ThemeName {
  return value === 'neon' || value === 'escuro' || value === 'claro';
}
