import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchHotels, fetchHotelFrontDeskToday, fetchHotelReservations, checkInReservation, checkOutReservation,
  Hotel, HotelReservation,
} from '../../api/hotels';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { StatGrid2 } from '../../components/mg';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Tab = 'arr' | 'dep' | 'in';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** RN port of `mglass-w3-ops.jsx`'s `FrontDeskScreen` — real backend
 * (`GET /hotels/frontdesk/today`, `POST /hotels/reservations/:id/check-in|check-out`), never
 * had a mobile surface. Same-day arrivals/departures/in-house with real check-in/check-out
 * actions — a deliberate, narrow exception to this module's read-only-on-mobile policy (see
 * api/hotels.ts), since front-desk work is inherently a phone-at-the-counter task. */
export const FrontDeskScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt } = useCurrencyMode();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('arr');
  const [arrivals, setArrivals] = useState<HotelReservation[]>([]);
  const [departures, setDepartures] = useState<HotelReservation[]>([]);
  const [inHouse, setInHouse] = useState<HotelReservation[]>([]);
  const [inHouseCount, setInHouseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchHotels().then((list) => {
      setHotels(list);
      if (list.length > 0) setHotelId(list[0].id);
    }).catch(() => showToast('Не удалось загрузить отели', { variant: 'error' }));
  }, []);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const today = await fetchHotelFrontDeskToday({ hotelId });
      setArrivals(today.arrivals);
      setDepartures(today.departures);
      setInHouseCount(today.inHouseCount);
      if (tab === 'in') {
        const res = await fetchHotelReservations({ hotelId, status: 'checked_in' });
        setInHouse(res);
      }
    } catch {
      showToast('Не удалось загрузить данные front desk', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hotelId, tab]);

  useEffect(() => { load(); }, [load]);

  const hotel = useMemo(() => hotels.find((h) => h.id === hotelId) || null, [hotels, hotelId]);

  const doCheckIn = async (r: HotelReservation) => {
    setBusyId(r.id);
    try {
      await checkInReservation(r.id, r.roomUnitId || undefined);
      showToast(`${r.guestName} заселён(а)`, { variant: 'success' });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось заселить', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const doCheckOut = async (r: HotelReservation) => {
    setBusyId(r.id);
    try {
      await checkOutReservation(r.id);
      showToast(`${r.guestName} выселен(а)`, { variant: 'success' });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось выселить', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const nights = (r: HotelReservation) => Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Отели</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Front desk</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{hotel ? `${hotel.name} · сегодня` : 'Загрузка…'}</Text>

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
          {([['arr', `Заезды ${arrivals.length}`], ['dep', `Выезды ${departures.length}`], ['in', `В отеле ${inHouseCount}`]] as [Tab, string][]).map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.segBtn, tab === k && { backgroundColor: colors.card }]} onPress={() => setTab(k)}>
              <Text style={[styles.segTxt, { color: tab === k ? colors.text : colors.textSecondary, fontFamily: tab === k ? fonts.semibold : fonts.medium }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        {hotel && (
          <StatGrid2 items={[
            { label: 'Заезды', value: String(arrivals.length) },
            { label: 'Выезды', value: String(departures.length) },
            { label: 'Занято', value: `${hotel.roomsCount - Math.round(hotel.roomsCount * (1 - hotel.occupancyToday / 100))} / ${hotel.roomsCount}` },
            { label: 'Загрузка', value: `${Math.round(hotel.occupancyToday)}%` },
          ]} />
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : tab === 'arr' ? (
          arrivals.length === 0 ? <EmptyState icon="log-in-outline" title="Заездов сегодня нет" /> : arrivals.map((r) => (
            <GlassCard key={r.id} variant="g" style={styles.card} contentStyle={{ padding: spacing.lg }}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}><Text style={{ color: colors.text, fontSize: 12, fontFamily: fonts.semibold }}>{initials(r.guestName)}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.guestName, { color: colors.text }]} numberOfLines={1}>{r.guestName}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{r.pax} гостя · {nights(r)} ноч.</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: r.status === 'pending' ? colors.warningBg : colors.accentSoft }]}>
                  <Text style={[styles.pillTxt, { color: r.status === 'pending' ? colors.warning : colors.accent }]}>{r.status === 'pending' ? 'ожидается' : 'подтверждено'}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.mono, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{r.bookingCode || `#${r.id.slice(0, 8)}`}</Text>
                <Text style={[styles.mono, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(Number(r.total), undefined, { short: true })}</Text>
              </View>
              <View style={[styles.pillRow]}>
                <View style={[styles.pill, { backgroundColor: r.paidStatus === 'none' ? colors.errorBg : colors.successBg }]}>
                  <Text style={[styles.pillTxt, { color: r.paidStatus === 'none' ? colors.error : colors.success }]}>{r.paidStatus === 'none' ? 'к оплате' : r.paidStatus === 'partial' ? 'частично оплачено' : 'оплачено'}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => doCheckIn(r)} disabled={busyId === r.id}>
                  {busyId === r.id ? <ActivityIndicator size="small" color={colors.accentFg} /> : <><Ionicons name="checkmark" size={15} color={colors.accentFg} /><Text style={[styles.actionTxt, { color: colors.accentFg }]}>Заселить</Text></>}
                </TouchableOpacity>
                {!!r.guestPhone && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => Linking.openURL(`tel:${r.guestPhone}`)}>
                    <Ionicons name="call-outline" size={15} color={colors.text} /><Text style={[styles.actionTxt, { color: colors.text }]}>Позвонить</Text>
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          ))
        ) : tab === 'dep' ? (
          departures.length === 0 ? <EmptyState icon="log-out-outline" title="Выездов сегодня нет" /> : departures.map((r) => (
            <GlassCard key={r.id} variant="g" style={styles.card} contentStyle={{ padding: spacing.lg }}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}><Text style={{ color: colors.text, fontSize: 12, fontFamily: fonts.semibold }}>{initials(r.guestName)}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.guestName, { color: colors.text }]} numberOfLines={1}>{r.guestName}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>выезд сегодня</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: Number(r.total) > 0 ? colors.errorBg : colors.successBg }]}>
                  <Text style={[styles.pillTxt, { color: Number(r.total) > 0 ? colors.error : colors.success }]}>без долга</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.mono, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{r.bookingCode || `#${r.id.slice(0, 8)}`}</Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => doCheckOut(r)} disabled={busyId === r.id}>
                  {busyId === r.id ? <ActivityIndicator size="small" color={colors.accentFg} /> : <><Ionicons name="checkmark" size={15} color={colors.accentFg} /><Text style={[styles.actionTxt, { color: colors.accentFg }]}>Выселить</Text></>}
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        ) : (
          inHouse.length === 0 ? <EmptyState icon="bed-outline" title="Гостей в отеле нет" /> : (
            <GlassCard variant="g" style={styles.card}>
              {inHouse.map((g, i) => (
                <View key={g.id} style={[styles.row, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant, width: 30, height: 30 }]}><Text style={{ color: colors.text, fontSize: 11, fontFamily: fonts.semibold }}>{initials(g.guestName)}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.guestName, { color: colors.text, fontSize: 13.5 }]} numberOfLines={1}>{g.guestName}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>до {new Date(g.checkOut).toLocaleDateString(appLocale())} · {g.pax} гостя</Text>
                  </View>
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
  card: { borderRadius: radius.xxl },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  guestName: { fontSize: 15, fontFamily: fonts.semibold },
  meta: { fontSize: 11.5, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  mono: { fontSize: 12 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start' },
  pillTxt: { fontSize: 10.5, fontFamily: fonts.semibold },
  pillRow: { flexDirection: 'row', marginTop: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.lg },
  actionTxt: { fontSize: 12.5, fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 11 },
});
