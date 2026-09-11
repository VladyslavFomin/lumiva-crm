import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../../theme/ThemeContext';

const PALETTE = ['#2f3a52', '#1769d1', '#1f8a5e', '#c08319', '#cc2f47', '#3b6cb6', '#5a45a8', '#777777'];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

interface Props {
  name: string;
  size?: number;
}

export const AvatarInitials: React.FC<Props> = ({ name, size = 36 }) => (
  <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name || '?') }]}>
    <Text style={[styles.txt, { fontSize: size * 0.34 }]}>{initials(name)}</Text>
  </View>
);

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txt: { color: '#fff', fontFamily: fonts.semibold, letterSpacing: -0.2 },
});
