import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchTenantSettings, planLabel, TenantSettings } from '../../api/tenant';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

export const BillingScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenantSettings().then(setTenant).catch(() => showToast('Не удалось загрузить тариф', { variant: 'error' })).finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Аккаунт</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Тариф</Text>

        {loading ? (
          <View style={{ padding: spacing.lg }}><SkeletonCard /></View>
        ) : (
          <>
            <View style={[styles.planHero, { backgroundColor: colors.ink }]}>
              <Text style={[styles.planKicker, { color: colors.onInk, opacity: 0.6 }]}>ТЕКУЩИЙ ПЛАН</Text>
              <Text style={[styles.planName, { color: colors.onInk }]}>{planLabel(tenant?.plan)}</Text>
              {tenant?.activeUntil ? (
                <Text style={[styles.planSub, { color: colors.onInk, opacity: 0.7 }]}>Действует до {fmtDate(tenant.activeUntil)}</Text>
              ) : (
                <Text style={[styles.planSub, { color: colors.onInk, opacity: 0.7 }]}>Статус: {tenant?.status || '—'}</Text>
              )}
            </View>

            <GlassCard variant="g2" style={styles.noteCard} contentStyle={styles.noteCardRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.info} />
              <Text style={[styles.noteTxt, { color: colors.textSecondary }]}>
                Смена тарифа, способы оплаты и история счетов управляются в веб-версии CRM (Настройки → Тариф и оплата).
              </Text>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  planHero: { marginHorizontal: spacing.lg, borderRadius: radius.xxl, padding: spacing.lg },
  planKicker: { fontSize: 11, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  planName: { fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5, marginTop: 4 },
  planSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 6 },
  noteCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.xl },
  noteCardRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md },
  noteTxt: { flex: 1, fontSize: 12.5, fontFamily: fonts.regular, lineHeight: 18 },
});
