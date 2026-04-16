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
}

const lightColors: ThemeColors = {
  background: '#f6f7fb',
  surface: '#ffffff',
  surfaceVariant: '#f8fafc',
  primary: '#0ea5e9',
  primaryVariant: '#0284c7',
  secondary: '#6366f1',
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  border: '#e5e7eb',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
  card: '#ffffff',
  cardElevated: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const darkColors: ThemeColors = {
  background: '#020617',
  surface: '#0f172a',
  surfaceVariant: '#1e293b',
  primary: '#38bdf8',
  primaryVariant: '#0ea5e9',
  secondary: '#818cf8',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textTertiary: '#64748b',
  border: '#1e293b',
  borderLight: '#334155',
  error: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
  info: '#60a5fa',
  card: '#1e293b',
  cardElevated: '#334155',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
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
  const [mode, setModeState] = useState<ThemeMode>('auto');
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

  if (!isInitialized) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ colors, mode, isDark, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};






