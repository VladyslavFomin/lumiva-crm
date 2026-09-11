import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { GlassCard } from '../glass';
import { Button } from './Button';

interface Props {
  title?: string;
  subtitle: string;
  yourRole: string;
  neededRole: string;
  admins?: string[];
  onRequestAccess?: () => void;
  onBack?: () => void;
}

const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.kvRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.kvKey, { color: colors.textSecondary }]}>{k}</Text>
      <Text style={[styles.kvVal, { color: colors.text }]} numberOfLines={1}>{v}</Text>
    </View>
  );
};

/** RN port of the design's `DeniedScreen` — a full-screen RBAC gate for sections a role can't open. Not yet wired to a live permission check anywhere (the mobile app has no client-side role gating today); ready to drop in once a screen needs it. */
export const AccessDenied: React.FC<Props> = ({ title = 'Нет доступа', subtitle, yourRole, neededRole, admins, onRequestAccess, onBack }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.avatar, { backgroundColor: colors.errorBg }]}>
        <Ionicons name="shield-outline" size={22} color={colors.error} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <GlassCard variant="g" contentStyle={styles.card}>
        <KV k="Ваша роль" v={yourRole} />
        <KV k="Нужна роль" v={neededRole} />
        {admins && admins.length > 0 && <KV k={admins.length > 1 ? 'Администраторы' : 'Администратор'} v={admins.join(', ')} />}
        {onRequestAccess && <Button label="Запросить доступ" variant="accent" fullWidth onPress={onRequestAccess} style={{ marginTop: spacing.sm }} />}
      </GlassCard>
      {onBack && <Button label="Вернуться" variant="secondary" size="sm" fullWidth onPress={onBack} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl * 2, gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  card: { padding: spacing.lg },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1 },
  kvKey: { fontSize: 13 },
  kvVal: { fontSize: 13.5, fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' },
});
