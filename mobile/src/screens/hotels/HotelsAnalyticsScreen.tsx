import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchHotels, fetchHotelAnalytics, Hotel, HotelAnalyticsSummary } from '../../api/hotels';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, showToast } from '../../components/ui';
import { Segmented, StatGrid2, FunnelBars, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Tab = 'sum' | 'hotels' | 'mix';

interface HotelRow {
  hotel: Hotel;
  summary: HotelAnalyticsSummary | null;
}

export const HotelsAnalyticsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();

  const [tab, setTab] = useState<Tab>('sum');
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState<HotelAnalyticsSummary | null>(null);
  const [hotelRows, setHotelRows] = useState<HotelRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hotels = await fetchHotels();
      const [summary, perHotel] = await Promise.all([
        fetchHotelAnalytics(),
        Promise.all(hotels.map((h) => fetchHotelAnalytics({ hotelId: h.id }).catch(() => null))),
      ]);
      setOverall(summary);
      setHotelRows(hotels.map((h, i) => ({ hotel: h, summary: perHotel[i] })).sort((a, b) => (b.summary?.kpis.occupancyNowPct || 0) - (a.summary?.kpis.occupancyNowPct || 0)));
    } catch {
      showToast('Не удалось загрузить аналитику отелей', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const marketRows = useMemo(() => {
    if (!overall) return [];
    return [...overall.markets].sort((a, b) => b.revenueActual - a.revenueActual).slice(0, 8);
  }, [overall]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Отели</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Аналитика отелей</Text>
      {overall && (
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Загрузка сейчас {overall.kpis.occupancyNowPct}% · {overall.kpis.roomsAvailable} своб. из {overall.kpis.roomsTotal}
        </Text>
      )}

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <Segmented
          options={[{ key: 'sum', label: 'Сводка' }, { key: 'hotels', label: 'Отели' }, { key: 'mix', label: 'Рынки' }]}
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        {tab === 'sum' && overall && (
          <>
            <StatGrid2 items={[
              { label: 'Загрузка сейчас', value: `${overall.kpis.occupancyNowPct}%` },
              { label: 'Выручка (оплачено)', value: fmt(toDisplay(overall.kpis.revenueSold, overall.kpis.currency), undefined, { short: true }) },
              { label: 'Свободно номеров', value: String(overall.kpis.roomsAvailable) },
              { label: 'Всего номеров', value: String(overall.kpis.roomsTotal) },
            ]} />
            {marketRows.length > 0 && (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
                <View style={styles.cardHead}>
                  <Ionicons name="flag-outline" size={16} color={colors.text} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Топ рынков по выручке</Text>
                </View>
                <FunnelBars rows={marketRows.slice(0, 5).map((m) => ({
                  label: m.market,
                  value: m.revenueActual,
                  displayValue: fmt(toDisplay(m.revenueActual, overall.kpis.currency), undefined, { short: true }),
                }))} />
              </GlassCard>
            )}
            <Text style={[styles.note, { color: colors.textTertiary }]}>ADR/RevPAR, каналы продаж и помесячная динамика — в веб-версии.</Text>
          </>
        )}

        {tab === 'hotels' && (
          hotelRows.length === 0 ? (
            <GlassCard variant="g2" style={[styles.card, { padding: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Отелей нет</Text>
            </GlassCard>
          ) : hotelRows.map(({ hotel, summary }) => {
            const occ = summary?.kpis.occupancyNowPct ?? 0;
            const tone = occ >= 85 ? 'pos' : occ >= 60 ? 'acc' : 'warn';
            return (
              <TouchableOpacity key={hotel.id} activeOpacity={0.7} onPress={() => navigation.navigate('HotelDetail', { id: hotel.id })}>
                <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
                  <View style={styles.hotelHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.hotelName, { color: colors.text }]} numberOfLines={1}>{hotel.name}</Text>
                      <Text style={[styles.hotelMeta, { color: colors.textSecondary }]} numberOfLines={1}>{[hotel.city, summary ? `${summary.kpis.roomsTotal} номеров` : null].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Pill label={`${occ}%`} tone={tone} />
                  </View>
                  {summary && (
                    <>
                      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, occ)}%`, backgroundColor: colors.accent }]} />
                      </View>
                      <Text style={[styles.hotelMeta, { color: colors.textSecondary, marginTop: 8 }]}>
                        выручка {fmt(toDisplay(summary.kpis.revenueSold, summary.kpis.currency), undefined, { short: true })} · свободно {summary.kpis.roomsAvailable}
                      </Text>
                    </>
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}

        {tab === 'mix' && (
          marketRows.length === 0 || !overall ? (
            <GlassCard variant="g2" style={[styles.card, { padding: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Нет данных по рынкам</Text>
            </GlassCard>
          ) : (
            <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
              <View style={styles.cardHead}>
                <Ionicons name="flag-outline" size={16} color={colors.text} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Рынки</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.kicker, { color: colors.textTertiary }]}>брони · выручка</Text>
              </View>
              {marketRows.map((m, i) => (
                <View key={m.market} style={[styles.marketRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line3 }]}>
                  <Text style={[styles.marketName, { color: colors.text }]} numberOfLines={1}>{m.market}</Text>
                  <Text style={[styles.marketMeta, { color: colors.textSecondary }]}>{m.roomsSold} брон.</Text>
                  <Text style={[styles.marketMoney, { color: colors.text, fontFamily: fonts.mono }]}>{fmt(toDisplay(m.revenueActual, overall.kpis.currency), undefined, { short: true })}</Text>
                </View>
              ))}
            </GlassCard>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: { borderRadius: radius.xxl },
  cardInner: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14.5, fontFamily: fonts.semibold },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.5 },
  hotelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hotelName: { fontSize: 15, fontFamily: fonts.semibold },
  hotelMeta: { fontSize: 11.5 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 11 },
  progressFill: { height: 6, borderRadius: 3 },
  marketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9 },
  marketName: { flex: 1, fontSize: 13, fontFamily: fonts.medium },
  marketMeta: { fontSize: 11.5 },
  marketMoney: { fontSize: 12.5 },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
});
