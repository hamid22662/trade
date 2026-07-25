import { ThemeMode } from '@/types';

export type AppTheme = {
  mode: ThemeMode;
  colors: {
    background: string;
    backgroundElevated: string;
    surface: string;
    surfaceMuted: string;
    surfaceRaised: string;
    border: string;
    borderFocus: string;
    overlay: string;
    primary: string;
    primaryPressed: string;
    primarySoft: string;
    primaryGlow: string;
    success: string;
    successSoft: string;
    danger: string;
    dangerSoft: string;
    warning: string;
    warningSoft: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    info: string;
    infoSoft: string;
  };
  shadow: {
    color: string;
    opacity: number;
    radius: number;
    elevation: number;
    offset: { width: number; height: number };
  };
};

const darkColors: AppTheme['colors'] = {
  background: '#050505',
  backgroundElevated: '#0B0B0B',
  surface: '#101010',
  surfaceMuted: '#181818',
  surfaceRaised: '#232323',
  border: '#2A2A2A',
  borderFocus: '#D4AF37',
  overlay: 'rgba(0,0,0,0.82)',
  primary: '#D4AF37',
  primaryPressed: '#B8941F',
  primarySoft: 'rgba(212,175,55,0.16)',
  primaryGlow: '#F6D365',
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.14)',
  text: '#FAFAFA',
  textMuted: '#A3A3A3',
  textSubtle: '#737373',
  info: '#60A5FA',
  infoSoft: 'rgba(96,165,250,0.14)',
};

const lightColors: AppTheme['colors'] = {
  background: '#FBF8F0',
  backgroundElevated: '#F4EAD0',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F2E5',
  surfaceRaised: '#FFFFFF',
  border: '#E7D8AA',
  borderFocus: '#B8941F',
  overlay: 'rgba(24,24,27,0.42)',
  primary: '#B8941F',
  primaryPressed: '#8A6A12',
  primarySoft: 'rgba(184,148,31,0.12)',
  primaryGlow: '#B8941F',
  success: '#059669',
  successSoft: 'rgba(5,150,105,0.10)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
  warning: '#B45309',
  warningSoft: 'rgba(180,83,9,0.11)',
  text: '#171717',
  textMuted: '#525252',
  textSubtle: '#A3A3A3',
  info: '#2563EB',
  infoSoft: 'rgba(37,99,235,0.10)',
};

export const makeTheme = (mode: ThemeMode): AppTheme => (
  mode === 'dark'
    ? {
        mode,
        colors: darkColors,
        shadow: {
          color: '#000000',
          opacity: 0.40,
          radius: 26,
          elevation: 12,
          offset: { width: 0, height: 14 },
        },
      }
    : {
        mode,
        colors: lightColors,
        shadow: {
          color: '#2A2110',
          opacity: 0.12,
          radius: 20,
          elevation: 6,
          offset: { width: 0, height: 8 },
        },
      }
);
