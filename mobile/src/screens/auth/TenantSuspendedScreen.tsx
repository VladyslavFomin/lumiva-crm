import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuthShell } from './AuthShell';
import { GlassCard } from '../../components/glass';
import { Button } from '../../components/ui';
import { appLocale } from '../../i18n/format';

function fmtDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(appLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
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

export const TenantSuspendedScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { reason, activeUntil, clientKey } = route.params || {};

  const reasonLabel = reason === 'expired' ? 'Истёк оплаченный период' : 'Доступ приостановлен администратором платформы';
  const untilLabel = fmtDate(activeUntil);

  return (
    <AuthShell foot="Данные пространства сохранены и будут доступны сразу после возобновления доступа.">
      <View style={[styles.avatar, { backgroundColor: colors.warningBg }]}>
        <Ionicons name="time-outline" size={22} color={colors.warning} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>Пространство приостановлено</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{clientKey}</Text>
      </View>

      <GlassCard variant="g" contentStyle={styles.card}>
        <KV k="Причина" v={reasonLabel} />
        {untilLabel && <KV k={reason === 'expired' ? 'Было активно до' : 'Активно до'} v={untilLabel} />}
        <Button label="Написать в поддержку" variant="accent" fullWidth onPress={() => Linking.openURL(`mailto:support@lumiva.agency?subject=${encodeURIComponent('Пространство ' + (clientKey || '') + ' приостановлено')}`)} style={{ marginTop: spacing.sm }} />
      </GlassCard>

      <Button label="Выбрать другое пространство" variant="secondary" size="sm" fullWidth onPress={() => navigation.navigate('Login')} />
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.mono, textAlign: 'center' },
  card: { padding: spacing.lg },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1 },
  kvKey: { fontSize: 13 },
  kvVal: { fontSize: 13.5, fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' },
});
