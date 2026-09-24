import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchReservations, confirmReservation, cancelReservation, Reservation, ReservationStatus } from '../../api/bookings';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SwipeableRow, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const STATUS_TONE: Record<ReservationStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  draft: 'default', pending: 'warn', confirmed: 'acc', checked_in: 'acc', in_progress: 'warn',
  completed: 'pos', cancelled_by_customer: 'neg', cancelled_by_business: 'neg', rejected: 'neg', no_show: 'neg',
};
const ACTIVE_STATUSES: ReservationStatus[] = ['draft', 'pending', 'confirmed', 'checked_in', 'in_progress'];

const DAYS_BACK = 3;
const DAYS_FORWARD = 14;

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }); }

export const BookingsCalendarScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const STATUS_LABEL: Record<ReservationStatus, string> = {
    draft: t('bookingStatus.draft'), pending: t('bookingStatus.pending'), confirmed: t('bookingStatus.confirmed'), checked_in: t('bookingStatus.checked_in'), in_progress: t('bookingStatus.in_progress'),
    completed: t('bookingStatus.completed'), cancelled_by_customer: t('bookingStatus.cancelled_by_customer'), cancelled_by_business: t('bookingStatus.cancelled_by_business'),
    rejected: t('bookingStatus.rejected'), no_show: t('bookingStatus.no_show'),
  };
  const WEEKDAY = [t('weekday.sun'), t('weekday.mon'), t('weekday.tue'), t('weekday.wed'), t('weekday.thu'), t('weekday.fri'), t('weekday.sat')];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_BACK + DAYS_FORWARD + 1 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - DAYS_BACK + i);
      return d;
    });
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const items = await fetchReservations({ from: selectedDay, to: selectedDay });
      setReservations(items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
    } catch {
      showToast(t('bookingsCalendar.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay, t]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = useCallback(async (r: Reservation) => {
    try {
      const updated = await confirmReservation(r.id);
      setReservations((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      showToast(t('bookingsCalendar.confirmedToast'), { variant: 'success' });
    } catch {
      showToast(t('bookingsCalendar.confirmError'), { variant: 'error' });
    }
  }, [t]);

  const handleCancel = useCallback(async (r: Reservation) => {
    try {
      const updated = await cancelReservation(r.id);
      setReservations((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      showToast(t('bookingsCalendar.cancelledToast'), { variant: 'success' });
    } catch {
      showToast(t('bookingsCalendar.cancelError'), { variant: 'error' });
    }
  }, [t]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t('bookingsCalendar.title')}</Text>
          {!loading && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {reservations.length} {t('bookingsCalendar.onThisDay')}
              {reservations.filter((r) => r.status === 'pending').length > 0 && (
                <Text style={{ color: colors.warning, fontFamily: fonts.monoSemibold }}> · {reservations.filter((r) => r.status === 'pending').length} {t('bookingsCalendar.waitingConfirmation')}</Text>
              )}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.availBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('Waitlist')}>
          <Ionicons name="time-outline" size={17} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.availBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('Availability')}>
          <Ionicons name="people-outline" size={17} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={{ flexGrow: 0 }}>
        {days.map((d) => {
          const k = dayKey(d);
          const isSelected = k === selectedDay;
          const isToday = k === dayKey(new Date());
          return (
            <GlassCard key={k} variant="flat" style={[styles.dayCell, isSelected && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.dayCellInner}>
              <TouchableOpacity onPress={() => setSelectedDay(k)} style={styles.dayCellTouchable}>
                <Text style={[styles.dayWeekday, { color: isSelected ? colors.onInk : colors.textTertiary }]}>{WEEKDAY[d.getDay()]}</Text>
                <Text style={[styles.dayNum, { color: isSelected ? colors.onInk : colors.text, fontFamily: isToday && !isSelected ? fonts.bold : fonts.semibold }]}>{d.getDate()}</Text>
              </TouchableOpacity>
            </GlassCard>
          );
        })}
      </ScrollView>

      {loading ? (
        <SkeletonList count={5} />
      ) : reservations.length === 0 ? (
        <EmptyState icon="calendar-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title={t('bookingsCalendar.empty.title')} subtitle={t('bookingsCalendar.empty.subtitle')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
        >
          {reservations.map((r) => {
            const canConfirm = r.status === 'pending';
            const canCancel = ACTIVE_STATUSES.includes(r.status) && r.status !== 'draft';
            const row = (
              <GlassCard variant="flat" style={styles.row} contentStyle={styles.rowInner}>
                <TouchableOpacity
                  style={styles.rowTouchable}
                  onPress={() => navigation.navigate('BookingDetail', { id: r.id })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.timeBlock, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.timeTxt, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmtTime(r.startAt)}</Text>
                    <Text style={[styles.timeTxtEnd, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{fmtTime(r.endAt)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{r.customerName}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>{r.participants} {t('bookingsCalendar.people')} {r.price ? `· ${r.price.toLocaleString(appLocale())} ${r.currency}` : ''}</Text>
                  </View>
                  <Pill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </TouchableOpacity>
              </GlassCard>
            );
            if (!canConfirm && !canCancel) return <View key={r.id}>{row}</View>;
            return (
              <SwipeableRow
                key={r.id}
                leftAction={canConfirm ? { icon: 'checkmark-outline', label: t('bookingsCalendar.confirm'), color: colors.success, onPress: () => handleConfirm(r) } : undefined}
                rightAction={canCancel ? { icon: 'close-outline', label: t('bookingsCalendar.cancel'), color: colors.error, onPress: () => handleCancel(r) } : undefined}
              >
                {row}
              </SwipeableRow>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: 4 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 12.5, fontFamily: fonts.regular, marginTop: 2 },
  availBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  strip: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md },
  dayCell: { width: 48, borderRadius: radius.lg },
  dayCellInner: { flex: 1 },
  dayCellTouchable: { alignItems: 'center', paddingVertical: 10, gap: 4 },
  dayWeekday: { fontSize: 10, fontFamily: fonts.medium },
  dayNum: { fontSize: 15 },
  row: { borderRadius: radius.xl },
  rowInner: { flex: 1 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  timeBlock: { alignItems: 'center', borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 8, minWidth: 56 },
  timeTxt: { fontSize: 13 },
  timeTxtEnd: { fontSize: 10, marginTop: 1 },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
