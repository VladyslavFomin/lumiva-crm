import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchHotels, fetchHotelRoomTypes, fetchHotelDailyRates, fetchHotelReservations,
  Hotel, HotelRoomType, HotelReservation,
} from '../../api/hotels';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Metric = 'occ' | 'rate';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const c = new Date(d); c.setUTCDate(c.getUTCDate() + n); return c; }

/** RN port of `mglass-w3-ops.jsx`'s `HotelCalScreen` — a real 7-day × room-type grid, but built
 * from data this session actually confirmed real rather than the design's single "rate" number:
 * occupancy is computed client-side from real reservations (exact — same overlap logic as the
 * backend's own `getConcurrentCountsByDay`, which isn't exposed via a route); rate is a real
 * average of `hotels-pricing.service.ts`'s per-market-group `netPP` (this tenant prices per
 * market, there's no single "the" rate) — labelled as an average, not fabricated precision.
 * Editing anything here stays web-only, same as the rest of the Hotels module. */
export const HotelCalendarScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt } = useCurrencyMode();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('occ');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [rates, setRates] = useState<Record<string, Record<string, number>>>({}); // roomTypeId -> date -> avg netPP
  const [loading, setLoading] = useState(true);
  const [selDay, setSelDay] = useState<number | null>(null);

  const days = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);
  const dateStrs = useMemo(() => days.map(isoDate), [days]);

  useEffect(() => {
    fetchHotels().then((list) => { setHotels(list); if (list.length > 0) setHotelId(list[0].id); }).catch(() => showToast('Не удалось загрузить отели', { variant: 'error' }));
  }, []);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [types, res] = await Promise.all([
        fetchHotelRoomTypes(hotelId),
        fetchHotelReservations({ hotelId }),
      ]);
      setRoomTypes(types);
      setReservations(res.filter((r) => r.status !== 'cancelled'));
      const rateEntries = await Promise.all(types.map(async (t) => [t.id, await fetchHotelDailyRates(t.id, dateStrs)] as const));
      setRates(Object.fromEntries(rateEntries));
    } catch {
      showToast('Не удалось загрузить календарь', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hotelId, dateStrs]);

  useEffect(() => { load(); }, [load]);

  const soldFor = (roomTypeId: string, date: string) =>
    reservations.filter((r) => r.roomTypeId === roomTypeId && r.checkIn <= date && r.checkOut > date).length;

  const hotel = hotels.find((h) => h.id === hotelId) || null;
  const totalRooms = roomTypes.reduce((a, t) => a + t.quantity, 0);
  const dayOcc = (date: string) => {
    if (totalRooms === 0) return 0;
    const sold = roomTypes.reduce((a, t) => a + soldFor(t.id, date), 0);
    return Math.round((sold / totalRooms) * 100);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Отели</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Календарь отеля</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{hotel ? `${hotel.name} · 7 дней` : 'Загрузка…'}</Text>

      {hotels.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {hotels.map((h) => (
            <TouchableOpacity key={h.id} style={[styles.chip, { backgroundColor: hotelId === h.id ? colors.ink : colors.surfaceVariant }]} onPress={() => setHotelId(h.id)}>
              <Text style={[styles.chipTxt, { color: hotelId === h.id ? colors.onInk : colors.text }]}>{h.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <View style={[styles.seg, { backgroundColor: colors.surfaceVariant }]}>
          {([['occ', 'Загрузка'], ['rate', 'Тариф (в среднем)']] as [Metric, string][]).map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.segBtn, metric === k && { backgroundColor: colors.card }]} onPress={() => setMetric(k)}>
              <Text style={[styles.segTxt, { color: metric === k ? colors.text : colors.textSecondary, fontFamily: metric === k ? fonts.semibold : fonts.medium }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonList count={4} />
        ) : roomTypes.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>Нет типов номеров</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <GlassCard variant="g" style={styles.gridCard} contentStyle={{ padding: spacing.lg }}>
              <View style={styles.gridHead}>
                <Ionicons name="calendar-outline" size={16} color={colors.text} />
                <Text style={[styles.gridTitle, { color: colors.text }]}>{days[0].toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })} – {days[6].toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })}</Text>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.rowLabelCol} />
                {days.map((d, i) => (
                  <TouchableOpacity key={i} style={[styles.dayHead, selDay === i && { backgroundColor: colors.accentSoft, borderRadius: radius.md }]} onPress={() => setSelDay(selDay === i ? null : i)}>
                    <Text style={[styles.dayWd, { color: colors.textTertiary }]}>{d.toLocaleDateString(appLocale(), { weekday: 'short' })}</Text>
                    <Text style={[styles.dayNum, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{d.getUTCDate()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {roomTypes.map((t) => (
                <View key={t.id} style={styles.gridRow}>
                  <View style={styles.rowLabelCol}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t.name}</Text>
                    <Text style={[styles.rowSub, { color: colors.textTertiary, fontFamily: fonts.mono }]}>/{t.quantity}</Text>
                  </View>
                  {dateStrs.map((date, i) => {
                    const sold = soldFor(t.id, date);
                    const pct = t.quantity > 0 ? sold / t.quantity : 0;
                    const rate = rates[t.id]?.[date] || 0;
                    return (
                      <View
                        key={date}
                        style={[
                          styles.cell,
                          { borderColor: selDay === i ? colors.accent : colors.line2, backgroundColor: metric === 'occ' ? `rgba(43,108,140,${Math.min(0.6, pct * 0.62)})` : colors.surfaceVariant },
                        ]}
                      >
                        <Text style={[styles.cellTxt, { color: colors.text }]}>{metric === 'occ' ? sold : (rate || '—')}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={styles.gridRow}>
                <View style={styles.rowLabelCol}>
                  <Text style={[styles.rowLabel, { color: colors.textTertiary, fontSize: 9 }]}>ЗАГРУЗКА</Text>
                </View>
                {dateStrs.map((date) => (
                  <View key={date} style={styles.dayHead}>
                    <Text style={[styles.dayOcc, { color: dayOcc(date) >= 95 ? colors.error : colors.textSecondary, fontFamily: fonts.monoSemibold }]}>{dayOcc(date)}%</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </ScrollView>
        )}

        {selDay != null && !loading && (
          <GlassCard variant="g" style={styles.detailCard} contentStyle={{ padding: spacing.lg }}>
            <View style={styles.gridHead}>
              <Text style={[styles.kicker, { color: colors.textTertiary }]}>{days[selDay].toLocaleDateString(appLocale(), { day: '2-digit', month: 'long', weekday: 'short' })}</Text>
              <View style={{ flex: 1 }} />
              <View style={[styles.pill, { backgroundColor: dayOcc(dateStrs[selDay]) >= 95 ? colors.errorBg : colors.accentSoft }]}>
                <Text style={[styles.pillTxt, { color: dayOcc(dateStrs[selDay]) >= 95 ? colors.error : colors.accent }]}>{dayOcc(dateStrs[selDay])}%</Text>
              </View>
            </View>
            {roomTypes.map((t, i) => {
              const sold = soldFor(t.id, dateStrs[selDay]);
              return (
                <View key={t.id} style={[styles.detailRow, i > 0 && { borderTopColor: colors.line3, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.detailRowTop}>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{t.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.mono }}>{sold}/{t.quantity}</Text>
                    <Text style={{ color: colors.text, fontSize: 12.5, fontFamily: fonts.monoSemibold }}>{fmt(rates[t.id]?.[dateStrs[selDay]] || 0, t.currency, { short: true })}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={{ width: `${t.quantity > 0 ? Math.min(100, (sold / t.quantity) * 100) : 0}%`, height: '100%', borderRadius: 999, backgroundColor: colors.accent }} />
                  </View>
                </View>
              );
            })}
          </GlassCard>
        )}

        <Text style={[styles.note, { color: colors.textTertiary }]}>Правка тарифов, стоп-сейлы и овербукинг — в веб-версии.</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.medium },
  seg: { flexDirection: 'row', padding: 3, borderRadius: radius.full, gap: 2 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.full, alignItems: 'center' },
  segTxt: { fontSize: 11.5 },
  gridCard: { borderRadius: radius.xxl },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  gridTitle: { fontSize: 14, fontFamily: fonts.semibold },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  rowLabelCol: { width: 84 },
  rowLabel: { fontSize: 11.5 },
  rowSub: { fontSize: 9.5, opacity: 0.7 },
  dayHead: { width: 40, alignItems: 'center', paddingVertical: 4 },
  dayWd: { fontSize: 9, fontFamily: fonts.mono, letterSpacing: 0.5 },
  dayNum: { fontSize: 12.5, marginTop: 1 },
  dayOcc: { fontSize: 10.5 },
  cell: { width: 40, minHeight: 34, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  cellTxt: { fontSize: 11.5, fontFamily: fonts.monoSemibold },
  detailCard: { borderRadius: radius.xxl },
  kicker: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'capitalize' },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  pillTxt: { fontSize: 11, fontFamily: fonts.semibold },
  detailRow: { paddingVertical: 8 },
  detailRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  note: { fontSize: 11, textAlign: 'center', paddingHorizontal: spacing.md, paddingBottom: 4 },
});
