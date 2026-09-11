import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  primaryVariant: string;
  secondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  card: string;
  cardElevated: string;
  shadow: string;
  overlay: string;
  // Swiss-minimal specifics (mirrors --ink/--fg-*/--line-* on the web app)
  ink: string;
  inkSubtle: string;
  separator: string;
  fg2: string;
  fg3: string;
  fg4: string;
  line2: string;
  line3: string;
  // Inverse of `ink` — text/icon color placed on top of an ink-filled surface
  onInk: string;
  // Status backgrounds (pastel), pairs with success/warning/error/info
  successBg: string;
  warningBg: string;
  errorBg: string;
  infoBg: string;
  // "Liquid glass" design system (2026-09-08 import) — glass surfaces layer over `background`/AuraBackground
  accent: string;
  accentSoft: string;
  accentFg: string;
  glassBorder: string;
  glassHighlight: string;
  // `.g`/`.g2` in styles/mobile-glass.css are a top-to-bottom gradient (glass sheen), not a flat
  // tint — these are the exact two gradient stops for each, for use with expo-linear-gradient.
  glassGradient: readonly [string, string];
  glass2Gradient: readonly [string, string];
  // `.g-flat`'s border — mirrors `--line`, distinct from `--glass-b` (glassBorder) which is only
  // for the blurred `.g`/`.g2` surfaces.
  glassLine: string;
}

const lightColors: ThemeColors = {
  background: '#e9edf1',
  surface: 'rgba(255,255,255,0.6)',
  surfaceVariant: 'rgba(20,22,26,0.05)',
  primary: '#14161a',
  primaryVariant: '#2b2e33',
  secondary: '#2b6c8c',
  text: '#14161a',
  textSecondary: 'rgba(20,22,26,0.62)',
  textTertiary: 'rgba(20,22,26,0.4)',
  border: 'rgba(20,22,26,0.14)',
  borderLight: 'rgba(20,22,26,0.08)',
  error: '#a4442c',
  success: '#1c7a58',
  warning: '#8a6512',
  info: '#2b6c8c',
  card: 'rgba(255,255,255,0.72)',
  cardElevated: 'rgba(255,255,255,0.86)',
  shadow: 'rgba(16,24,40,0.10)',
  overlay: 'rgba(8,10,14,0.34)',
  ink: '#14161a',
  inkSubtle: 'rgba(20,22,26,0.5)',
  separator: 'rgba(20,22,26,0.12)',
  fg2: 'rgba(20,22,26,0.62)',
  fg3: 'rgba(20,22,26,0.4)',
  fg4: 'rgba(20,22,26,0.28)',
  line2: 'rgba(20,22,26,0.16)',
  line3: 'rgba(20,22,26,0.08)',
  onInk: '#ffffff',
  successBg: 'rgba(28,122,88,0.14)',
  warningBg: 'rgba(138,101,18,0.16)',
  errorBg: 'rgba(164,68,44,0.14)',
  infoBg: 'rgba(43,108,140,0.12)',
  accent: '#2b6c8c',
  accentSoft: 'rgba(43,108,140,0.12)',
  accentFg: '#ffffff',
  glassBorder: 'rgba(255,255,255,0.75)',
  glassHighlight: 'rgba(255,255,255,0.9)',
  glassGradient: ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.56)'],
  glass2Gradient: ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.38)'],
  glassLine: 'rgba(20,22,26,0.10)',
};

const darkColors: ThemeColors = {
  background: '#0a0c0f',
  surface: 'rgba(255,255,255,0.09)',
  surfaceVariant: 'rgba(255,255,255,0.07)',
  primary: '#f2f4f7',
  primaryVariant: '#d7dce2',
  secondary: '#82b9d8',
  text: '#f2f4f7',
  textSecondary: 'rgba(242,244,247,0.64)',
  textTertiary: 'rgba(242,244,247,0.42)',
  border: 'rgba(255,255,255,0.14)',
  borderLight: 'rgba(255,255,255,0.08)',
  error: '#e8927a',
  success: '#5fd3a3',
  warning: '#e0bd6a',
  info: '#82b9d8',
  card: 'rgba(255,255,255,0.09)',
  cardElevated: 'rgba(255,255,255,0.14)',
  shadow: 'rgba(0,0,0,0.5)',
  overlay: 'rgba(0,0,0,0.5)',
  ink: '#f2f4f7',
  inkSubtle: 'rgba(242,244,247,0.5)',
  separator: 'rgba(255,255,255,0.12)',
  fg2: 'rgba(242,244,247,0.64)',
  fg3: 'rgba(242,244,247,0.42)',
  fg4: 'rgba(242,244,247,0.28)',
  line2: 'rgba(255,255,255,0.16)',
  line3: 'rgba(255,255,255,0.08)',
  onInk: '#0a0c0f',
  successBg: 'rgba(95,211,163,0.16)',
  warningBg: 'rgba(224,189,106,0.16)',
  errorBg: 'rgba(232,146,122,0.16)',
  infoBg: 'rgba(130,185,216,0.16)',
  accent: '#82b9d8',
  accentSoft: 'rgba(130,185,216,0.16)',
  accentFg: '#08121a',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassHighlight: 'rgba(255,255,255,0.2)',
  glassGradient: ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.045)'],
  glass2Gradient: ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.03)'],
  glassLine: 'rgba(255,255,255,0.12)',
};

// 4pt grid — mirrors the site's spacing rhythm
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// Same radius steps as tailwind.config.cjs (radius-sm...xl) plus `full` for pills/avatars
export const radius = { sm: 6, md: 8, lg: 10, xl: 12, xxl: 16, xxxl: 20, full: 999 };

// "Liquid glass" import (2026-09-08): Inter for body text, Inter Tight for display/headings/numbers-as-titles
// (mirrors --ff-b/--ff-d in styles/mobile-glass.css), JetBrains Mono unchanged for numbers/counters/codes.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
};

interface ThemeContextType {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((stored) => {
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
        setModeState(stored as ThemeMode);
      }
      setIsInitialized(true);
    });
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem('theme_mode', newMode);
  };

  const toggleTheme = () => {
    const currentIsDark = mode === 'dark' || (mode === 'auto' && systemScheme === 'dark');
    setMode(currentIsDark ? 'light' : 'dark');
  };

  const isDark = mode === 'dark' || (mode === 'auto' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  if (!isInitialized) return null;

  return (
    <ThemeContext.Provider value={{ colors, mode, isDark, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
