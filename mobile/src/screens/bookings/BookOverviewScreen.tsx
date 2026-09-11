import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchReservations, fetchBookingServices, fetchBookingResources, fetchResourceStats,
  Reservation, BookingService, BookingResource, ResourceStat,
} from '../../api/bookings';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, showToast } from '../../components/ui';
import { Pill, StatGrid2 } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function isToday(dateStr: string, ref: Date) {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function utilTone(pct: number): 'neg' | 'warn' | 'acc' {
  return pct >= 90 ? 'neg' : pct >= 70 ? 'warn' : 'acc';
}

export const BookOverviewScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [resourceStats, setResourceStats] = useState<ResourceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      const to = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
      const [res, svc, rsc, stats] = await Promise.all([
        fetchReservations({ from, to }),
        fetchBookingServices().catch(() => []),
        fetchBookingResources().catch(() => []),
        fetchResourceStats().catch(() => []),
      ]);
      setReservations(res);
      setServices(svc);
      setResources(rsc);
      setResourceStats(stats);
    } catch {
      showToast('Не удалось загрузить обзор бронирования', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = useMemo(() => {
    const now = new Date();
    const arrivals = reservations.filter((r) => isToday(r.startAt, now));
    const departures = reservations.filter((r) => isToday(r.endAt, now));
    const revenue = arrivals
      .filter((r) => r.status === 'completed' && r.price != null)
      .reduce((sum, r) => sum + toDisplay(r.price || 0, r.currency ?? undefined), 0);
    const noshow = arrivals.filter((r) => r.status === 'no_show').length;
    return { arrivals: arrivals.length, departures: departures.length, revenue, noshow };
  }, [reservations, toDisplay]);

  const resourceRows = useMemo(() => {
    const byId = new Map(resourceStats.map((s) => [s.id, s]));
    return resources
      .filter((r) => r.active)
      .map((r) => ({ resource: r, stat: byId.get(r.id) }))
      .sort((a, b) => (b.stat?.utilizationToday || 0) - (a.stat?.utilizationToday || 0))
      .slice(0, 6);
  }, [resources, resourceStats]);

  const serviceRows = useMemo(() => {
    const now = new Date();
    const todayReservations = reservations.filter((r) => isToday(r.startAt, now));
    return services
      .map((s) => ({ service: s, bookings: todayReservations.filter((r) => r.serviceId === s.id).length }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 6);
  }, [services, reservations]);

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
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Бронирования</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Обзор бронирования</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Сегодня</Text>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
        showsVerticalScrollIndicator={false}
      >
        <StatGrid2 items={[
          { label: 'Заезды', value: String(today.arrivals) },
          { label: 'Выезды', value: String(today.departures) },
          { label: 'Выручка дня', value: fmt(today.revenue, undefined, { short: true }) },
          { label: 'No-show', value: String(today.noshow) },
        ]} />

        <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
          <View style={styles.cardHead}>
            <Ionicons name="layers-outline" size={16} color={colors.text} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Ресурсы</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.kicker, { color: colors.textTertiary }]}>занятость</Text>
          </View>
          {resourceRows.length === 0 ? (
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>Ресурсы не настроены</Text>
          ) : resourceRows.map(({ resource, stat }, i) => {
            const pct = stat?.utilizationToday || 0;
            return (
              <View key={resource.id} style={[styles.resRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line3 }]}>
                <View style={styles.resHead}>
                  <Text style={[styles.resName, { color: colors.text }]} numberOfLines={1}>{resource.name}</Text>
                  <Pill label={`${pct}%`} tone={utilTone(pct)} />
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? colors.error : colors.accent }]} />
                </View>
                <Text style={[styles.resMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {resource.type} · слотов {resource.quantity}
                  {stat?.nextReservation ? ` · ближайший ${new Date(stat.nextReservation.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>
            );
          })}
        </GlassCard>

        <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
          <View style={styles.cardHead}>
            <Ionicons name="pricetag-outline" size={16} color={colors.text} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Услуги</Text>
          </View>
          {serviceRows.length === 0 ? (
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>Услуги не настроены</Text>
          ) : serviceRows.map(({ service, bookings }, i) => (
            <View key={service.id} style={[styles.svcRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line3 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.resName, { color: colors.text }]} numberOfLines={1}>{service.name}</Text>
                <Text style={[styles.resMeta, { color: colors.textSecondary }]}>{service.durationMinutes} мин · {bookings} записей сегодня</Text>
              </View>
              <Text style={[styles.svcPrice, { color: colors.text, fontFamily: fonts.mono }]}>
                {Number(service.price) > 0 ? fmt(toDisplay(Number(service.price), service.currency), undefined, {}) : 'бесплатно'}
              </Text>
            </View>
          ))}
        </GlassCard>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => navigation.navigate('BookingsCalendar')} activeOpacity={0.7}>
            <Text style={[styles.linkBtnTxt, { color: colors.text }]}>Все брони</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => navigation.navigate('Waitlist')} activeOpacity={0.7}>
            <Text style={[styles.linkBtnTxt, { color: colors.text }]}>Лист ожидания</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.note, { color: colors.textTertiary }]}>Доступность, ресурсы, услуги и импорт настраиваются на ПК.</Text>
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
  emptyTxt: { fontSize: 12.5 },
  resRow: { paddingVertical: 9 },
  resHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  resName: { fontSize: 13, fontFamily: fonts.medium, flexShrink: 1 },
  progressTrack: { height: 5, borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3 },
  resMeta: { fontSize: 11, marginTop: 5 },
  svcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9 },
  svcPrice: { fontSize: 13 },
  linkBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.lg },
  linkBtnTxt: { fontSize: 13, fontFamily: fonts.medium },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
});
