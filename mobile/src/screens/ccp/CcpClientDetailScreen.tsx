import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CcpStackParamList } from './CcpStack';
import { ccpApi, CcpClientAnalytics } from '../../api/ccp';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<CcpStackParamList, 'CcpClientDetail'>;

function fmt(n: number | null | undefined, suffix = '') {
  if (n == null) return '—';
  return n.toLocaleString(appLocale(), { maximumFractionDigits: 2 }) + suffix;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export const CcpClientDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CcpClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ccpApi.clientAnalytics(id)
      .then(setData)
      .catch(() => showToast('Не удалось загрузить аналитику клиента', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AuraBackground />
        <Text style={{ color: colors.text }}>Клиент не найден</Text>
      </View>
    );
  }

  const { client, metrics, txns, transfers } = data;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Клиенты</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={client.name || client.email} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{client.name || client.email}</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>{client.email}</Text>
            {client.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${client.phone}`)}>
                <Text style={[styles.heroSub, { color: colors.secondary }]}>{client.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>€{fmt(metrics.balances.eur)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Баланс EUR</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>${fmt(metrics.balances.usd)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Баланс USD</Text>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ИНВЕСТИЦИИ</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <View style={styles.kvRow}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Стиль</Text><Text style={[styles.kvV, { color: colors.text }]}>{metrics.investments.style || '—'}</Text></View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: colors.line3 }]}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Инвестировано</Text><Text style={[styles.kvV, { color: colors.text, fontFamily: fonts.mono }]}>{fmt(metrics.investments.amount)}</Text></View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: colors.line3 }]}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Годовых</Text><Text style={[styles.kvV, { color: colors.text }]}>{fmt(metrics.investments.annualPercent, '%')}</Text></View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: colors.line3 }]}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Ожид. доход/мес</Text><Text style={[styles.kvV, { color: colors.success, fontFamily: fonts.mono }]}>{fmt(metrics.investments.expectedMonthlyProfit)}</Text></View>
        </GlassCard>

        {(metrics.credit.leverage != null) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>КРЕДИТНОЕ ПЛЕЧО</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              <View style={styles.kvRow}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Плечо</Text><Text style={[styles.kvV, { color: colors.text }]}>{fmt(metrics.credit.leverage, 'x')}</Text></View>
              <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: colors.line3 }]}><Text style={[styles.kvK, { color: colors.textSecondary }]}>Погашение/мес</Text><Text style={[styles.kvV, { color: colors.error, fontFamily: fonts.mono }]}>{fmt(metrics.credit.expectedMonthlyRepay)}</Text></View>
            </GlassCard>
          </>
        )}

        {txns.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПОСЛЕДНИЕ ОПЕРАЦИИ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {txns.slice(0, 8).map((t, i) => (
                <View key={t.id} style={[styles.txnRow, { borderBottomColor: colors.line3, borderBottomWidth: i < Math.min(txns.length, 8) - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.txnTitle, { color: colors.text }]} numberOfLines={1}>{t.title || t.desc || 'Операция'}</Text>
                    <Text style={[styles.txnMeta, { color: colors.textTertiary }]}>{fmtDate(t.date)}{t.ccpStatus ? ` · ${t.ccpStatus}` : ''}</Text>
                  </View>
                  <Text style={[styles.txnAmt, { color: colors.error, fontFamily: fonts.monoSemibold }]}>
                    {t.spendEur ? `-€${fmt(Number(t.spendEur))}` : t.spendUsd ? `-$${fmt(Number(t.spendUsd))}` : ''}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        {transfers.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПОСЛЕДНИЕ ПЕРЕВОДЫ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {transfers.slice(0, 8).map((t, i) => (
                <View key={t.id} style={[styles.txnRow, { borderBottomColor: colors.line3, borderBottomWidth: i < Math.min(transfers.length, 8) - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.txnTitle, { color: colors.text }]} numberOfLines={1}>{t.title || 'Перевод'}</Text>
                    <Text style={[styles.txnMeta, { color: colors.textTertiary }]}>{fmtDate(t.date)}{t.ccpStatus ? ` · ${t.ccpStatus}` : ''}</Text>
                  </View>
                  <Text style={[styles.txnAmt, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{t.amount ? fmt(Number(t.amount)) : ''} {t.currency || ''}</Text>
                </View>
              ))}
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
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  statsCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.xxl, padding: 14 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: fonts.semibold },
  statLabel: { fontSize: 10, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 32, marginHorizontal: 8 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 11 },
  kvK: { fontSize: 12.5, fontFamily: fonts.regular },
  kvV: { fontSize: 13, fontFamily: fonts.medium },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  txnTitle: { fontSize: 13.5, fontFamily: fonts.medium },
  txnMeta: { fontSize: 11, marginTop: 2 },
  txnAmt: { fontSize: 12.5 },
});
