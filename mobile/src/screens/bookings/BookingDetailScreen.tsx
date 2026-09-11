import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import {
  fetchReservation, fetchBookingServices, fetchBookingLocations, fetchReservationActivity, fetchCustomerStats,
  Reservation, ReservationStatus, ReservationActivityEntry, CustomerStats,
  confirmReservation, cancelReservation, rejectReservation, checkInReservation, completeReservation, noShowReservation,
} from '../../api/bookings';
import { fetchLead } from '../../api/leads';
import { formatMoney } from '../../utils/money';
import { AvatarInitials, Button, SkeletonList, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  draft: 'Черновик', pending: 'Ожидает', confirmed: 'Подтверждена', checked_in: 'Пришёл', in_progress: 'В процессе',
  completed: 'Завершена', cancelled_by_customer: 'Отменена клиентом', cancelled_by_business: 'Отменена нами',
  rejected: 'Отклонена', no_show: 'Неявка',
};
const STATUS_TONE: Record<ReservationStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  draft: 'default', pending: 'warn', confirmed: 'acc', checked_in: 'acc', in_progress: 'warn',
  completed: 'pos', cancelled_by_customer: 'neg', cancelled_by_business: 'neg', rejected: 'neg', no_show: 'neg',
};

const PAYMENT_LABEL: Record<string, string> = {
  not_required: 'Не требуется', unpaid: 'Не оплачено', deposit_paid: 'Внесён депозит', paid: 'Оплачено',
  partially_refunded: 'Частичный возврат', refunded: 'Возврат', failed: 'Ошибка оплаты',
};
const PAYMENT_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  not_required: 'default', unpaid: 'warn', deposit_paid: 'acc', paid: 'pos',
  partially_refunded: 'warn', refunded: 'neg', failed: 'neg',
};
const SOURCE_LABEL: Record<string, string> = {
  website: 'Сайт', phone: 'Телефон', walkin: 'Без записи', manual: 'Вручную', api: 'API', import: 'Импорт', telegram: 'Telegram',
};
const SOURCE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  website: 'globe-outline', phone: 'call-outline', walkin: 'walk-outline', manual: 'create-outline',
  api: 'code-slash-outline', import: 'download-outline', telegram: 'paper-plane-outline',
};
const ACTIVITY_LABEL: Record<string, string> = {
  created: 'Бронь создана', status_changed: 'Статус изменён', rescheduled: 'Перенесена', staff_changed: 'Сменён исполнитель',
  resource_changed: 'Изменён ресурс', notification_sent: 'Отправлено уведомление', note_added: 'Добавлена заметка',
};
const ACTIVITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  created: 'flash-outline', status_changed: 'swap-horizontal-outline', rescheduled: 'calendar-outline',
  staff_changed: 'person-outline', resource_changed: 'cube-outline', notification_sent: 'notifications-outline', note_added: 'chatbubble-outline',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} д назад`;
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const BookingDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [leadName, setLeadName] = useState<string | null>(null);
  const [activity, setActivity] = useState<ReservationActivityEntry[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchReservation(id);
        setReservation(r);
        const [services, locations] = await Promise.all([fetchBookingServices().catch(() => []), fetchBookingLocations().catch(() => [])]);
        if (r.serviceId) setServiceName(services.find((s) => s.id === r.serviceId)?.name || null);
        setLocationName(locations.find((l) => l.id === r.locationId)?.name || null);
        if (r.leadId) fetchLead(r.leadId).then((l) => setLeadName(l.name || null)).catch(() => {});
        if (r.contactId) fetchCustomerStats(r.contactId).then(setCustomerStats).catch(() => {});
        fetchReservationActivity(id).then(setActivity).catch(() => {});
      } catch {
        showToast('Не удалось загрузить бронь', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const runAction = async (fn: (id: string) => Promise<Reservation>, successMsg: string) => {
    if (!reservation) return;
    setActing(true);
    try {
      const updated = await fn(reservation.id);
      setReservation(updated);
      showToast(successMsg, { variant: 'success' });
    } catch {
      showToast('Не удалось выполнить действие', { variant: 'error' });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Бронь не найдена</Text>
      </View>
    );
  }

  const actions: { label: string; variant: 'primary' | 'secondary' | 'danger'; onPress: () => void }[] = [];
  if (reservation.status === 'pending') {
    actions.push({ label: 'Подтвердить', variant: 'primary', onPress: () => runAction(confirmReservation, 'Бронь подтверждена') });
    actions.push({ label: 'Отклонить', variant: 'danger', onPress: () => runAction(rejectReservation, 'Бронь отклонена') });
  } else if (reservation.status === 'confirmed') {
    actions.push({ label: 'Отметить приход', variant: 'primary', onPress: () => runAction(checkInReservation, 'Отмечен приход') });
    actions.push({ label: 'Отменить', variant: 'danger', onPress: () => runAction(cancelReservation, 'Бронь отменена') });
  } else if (reservation.status === 'checked_in' || reservation.status === 'in_progress') {
    actions.push({ label: 'Завершить', variant: 'primary', onPress: () => runAction(completeReservation, 'Бронь завершена') });
    actions.push({ label: 'Неявка', variant: 'secondary', onPress: () => runAction(noShowReservation, 'Отмечена неявка') });
  }

  const properties = [
    reservation.customerPhone && { label: 'Телефон', value: reservation.customerPhone, icon: 'call-outline' as const, iconColor: colors.success, onPress: () => Linking.openURL(`tel:${reservation.customerPhone}`) },
    reservation.customerEmail && { label: 'Email', value: reservation.customerEmail, icon: 'mail-outline' as const, iconColor: colors.secondary, onPress: () => Linking.openURL(`mailto:${reservation.customerEmail}`) },
    serviceName && { label: 'Услуга', value: serviceName, icon: 'pricetag-outline' as const, iconColor: colors.warning },
    locationName && { label: 'Локация', value: locationName, icon: 'location-outline' as const, iconColor: colors.fg3 },
    { label: 'Время', value: `${fmtDateTime(reservation.startAt)} – ${fmtDateTime(reservation.endAt)}`, icon: 'time-outline' as const, iconColor: colors.info },
    { label: 'Участников', value: String(reservation.participants), icon: 'people-outline' as const, iconColor: colors.fg3 },
    reservation.price != null && { label: 'Стоимость', value: formatMoney(reservation.price, reservation.currency), icon: 'cash-outline' as const, iconColor: colors.success },
    reservation.leadId && {
      label: 'Лид', value: leadName || `#${reservation.leadId.slice(0, 8)}`, icon: 'flash-outline' as const, iconColor: colors.info,
      onPress: () => navigation.navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id: reservation.leadId } } }),
    },
    { label: 'Источник', value: SOURCE_LABEL[reservation.source] || reservation.source, icon: SOURCE_ICON[reservation.source] || 'help-circle-outline', iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Бронирования</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={reservation.customerName} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{reservation.customerName}</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <Pill label={STATUS_LABEL[reservation.status]} tone={STATUS_TONE[reservation.status]} />
              <Pill label={PAYMENT_LABEL[reservation.paymentStatus] || reservation.paymentStatus} tone={PAYMENT_TONE[reservation.paymentStatus] || 'default'} />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => {
            const Row = p.onPress ? TouchableOpacity : View;
            return (
              <Row key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]} onPress={p.onPress} activeOpacity={0.7}>
                <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                  <Ionicons name={p.icon} size={16} color={p.iconColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                  <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={2}>{p.value}</Text>
                </View>
                {p.onPress && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
              </Row>
            );
          })}
        </GlassCard>

        {customerStats && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>КЛИЕНТ</Text>
            <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{customerStats.visits}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Визитов</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{customerStats.noShows}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Неявок</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{customerStats.cancellations}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Отмен</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]} numberOfLines={1}>{formatMoney(customerStats.ltv, reservation.currency)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>LTV</Text>
              </View>
            </GlassCard>
          </>
        )}

        {activity.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СОБЫТИЯ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {activity.map((a, i) => (
                <View key={a.id} style={[styles.timelineRow, { borderBottomColor: colors.line3, borderBottomWidth: i < activity.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.timelineIco, { backgroundColor: colors.ink }]}>
                    <Ionicons name={ACTIVITY_ICON[a.type] || 'ellipse-outline'} size={14} color={colors.onInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.timelineTitle, { color: colors.text }]}>{ACTIVITY_LABEL[a.type] || a.type}</Text>
                    <Text style={[styles.timelineSub, { color: colors.textSecondary }]} numberOfLines={2}>
                      {a.description || [a.fromValue, a.toValue].filter(Boolean).join(' → ') || a.user?.fullName || '—'}
                    </Text>
                  </View>
                  <Text style={[styles.timelineTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relativeTime(a.createdAt)}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>

      {actions.length > 0 && (
        <View style={[styles.ctaBar, { bottom: insets.bottom + 16 }]}>
          {actions.map((a, i) => (
            <Button key={i} label={a.label} variant={a.variant} fullWidth loading={acting} disabled={acting} onPress={a.onPress} style={{ flex: 1 }} />
          ))}
        </View>
      )}
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
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  statsCard: { marginHorizontal: spacing.lg, marginBottom: 4, borderRadius: radius.xxl, padding: 14 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontFamily: fonts.semibold },
  statLabel: { fontSize: 10, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: 12, paddingHorizontal: spacing.lg },
  timelineIco: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineTitle: { fontSize: 13.5, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  timelineSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2, lineHeight: 16 },
  timelineTime: { fontSize: 11, flexShrink: 0 },
  ctaBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', gap: 10 },
});
