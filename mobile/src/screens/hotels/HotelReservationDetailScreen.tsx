import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchHotelReservation, fetchHotel, Hotel, HotelReservation, HotelReservationStatus, HotelReservationPaidStatus,
} from '../../api/hotels';
import type { HotelsStackParamList } from './HotelsStack';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { formatMoney } from '../../utils/money';
import { AvatarInitials, SkeletonList, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<HotelsStackParamList, 'HotelReservationDetail'>;

const STATUS_LABEL: Record<HotelReservationStatus, string> = {
  confirmed: 'Подтверждена', pending: 'Ожидает', checked_in: 'Заселён', checked_out: 'Выселен', cancelled: 'Отменена',
};
const STATUS_TONE: Record<HotelReservationStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  confirmed: 'acc', pending: 'warn', checked_in: 'pos', checked_out: 'default', cancelled: 'neg',
};
const PAID_LABEL: Record<HotelReservationPaidStatus, string> = { full: 'Оплачено', partial: 'Частично', none: 'Не оплачено', refunded: 'Возврат' };
const PAID_TONE: Record<HotelReservationPaidStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  full: 'pos', partial: 'warn', none: 'neg', refunded: 'default',
};
const SOURCE_LABEL: Record<string, string> = { manual: 'Вручную', import: 'Импорт', website: 'Сайт' };

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const HotelReservationDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const [reservation, setReservation] = useState<HotelReservation | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchHotelReservation(id);
        setReservation(r);
        fetchHotel(r.hotelId).then(setHotel).catch(() => {});
      } catch {
        showToast('Не удалось загрузить бронь', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  const currency = hotel?.currency || 'EUR';
  const nights = Math.max(1, Math.round((new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / 86_400_000));

  const properties = [
    hotel && { label: 'Отель', value: hotel.name, icon: 'business-outline' as const, iconColor: colors.fg3 },
    reservation.guestPhone && { label: 'Телефон', value: reservation.guestPhone, icon: 'call-outline' as const, iconColor: colors.success, onPress: () => Linking.openURL(`tel:${reservation.guestPhone}`) },
    reservation.guestEmail && { label: 'Email', value: reservation.guestEmail, icon: 'mail-outline' as const, iconColor: colors.secondary, onPress: () => Linking.openURL(`mailto:${reservation.guestEmail}`) },
    { label: 'Даты', value: `${fmtDate(reservation.checkIn)} – ${fmtDate(reservation.checkOut)} (${nights} ноч.)`, icon: 'calendar-outline' as const, iconColor: colors.info },
    { label: 'Гостей', value: String(reservation.pax), icon: 'people-outline' as const, iconColor: colors.fg3 },
    reservation.market && { label: 'Рынок', value: reservation.market, icon: 'globe-outline' as const, iconColor: colors.warning },
    (reservation.earlyCheckIn || reservation.lateCheckOut) && {
      label: 'Особые условия',
      value: [reservation.earlyCheckIn && 'Ранний заезд', reservation.lateCheckOut && 'Поздний выезд'].filter(Boolean).join(', '),
      icon: 'alarm-outline' as const, iconColor: colors.warning,
    },
    { label: 'Источник', value: SOURCE_LABEL[reservation.source] || reservation.source, icon: 'code-slash-outline' as const, iconColor: colors.fg3 },
    reservation.bookingCode && { label: 'Код брони', value: reservation.bookingCode, icon: 'ticket-outline' as const, iconColor: colors.fg3 },
    reservation.notes && { label: 'Заметки', value: reservation.notes, icon: 'document-text-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  const pricing = [
    { label: 'Цена за ночь (брутто)', value: formatMoney(reservation.grossPerNight, currency) },
    { label: 'Скидка', value: `${reservation.discountPct}%` },
    { label: 'Сумма за проживание', value: formatMoney(reservation.roomTotal, currency) },
    { label: 'Депозит', value: formatMoney(reservation.depositAmount, currency) },
  ];

  const total = Number(reservation.total) || 0;
  const received = reservation.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remaining = Math.max(0, total - received);
  const paidPct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

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
          <AvatarInitials name={reservation.guestName} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{reservation.guestName}</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <Pill label={STATUS_LABEL[reservation.status]} tone={STATUS_TONE[reservation.status]} />
              <Pill label={PAID_LABEL[reservation.paidStatus]} tone={PAID_TONE[reservation.paidStatus]} />
            </View>
          </View>
        </View>

        <GlassCard variant="g" style={styles.payCard}>
          <View style={styles.payHead}>
            <Text style={[styles.payKicker, { color: colors.textSecondary }]}>К оплате</Text>
            <Pill label={PAID_LABEL[reservation.paidStatus]} tone={PAID_TONE[reservation.paidStatus]} />
          </View>
          <Text style={[styles.payAmount, { color: colors.text, fontFamily: fonts.bold }]}>{formatMoney(total, currency)}</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant, marginTop: 12 }]}>
            <View style={[styles.progressFill, { width: `${paidPct}%`, backgroundColor: colors.success }]} />
          </View>
          <View style={styles.payMetaRow}>
            <Text style={[styles.payMetaTxt, { color: colors.textSecondary }]}>получено {formatMoney(received, currency)}</Text>
            <Text style={[styles.payMetaTxt, { color: colors.textSecondary }]}>остаток {formatMoney(remaining, currency)}</Text>
          </View>
        </GlassCard>

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
                  <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={3}>{p.value}</Text>
                </View>
                {p.onPress && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
              </Row>
            );
          })}
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ОПЛАТА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {pricing.map((p, i) => (
            <View key={i} style={[styles.priceRow, { borderBottomColor: colors.line3, borderBottomWidth: i < pricing.length - 1 ? 1 : 0 }]}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{p.label}</Text>
              <Text style={[styles.priceValue, { color: colors.text, fontFamily: fonts.semibold }]}>{p.value}</Text>
            </View>
          ))}
        </GlassCard>

        {reservation.payments.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПЛАТЕЖИ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {reservation.payments.map((pay, i) => (
                <View key={pay.id} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < reservation.payments.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.propIco, { backgroundColor: colors.success + '22' }]}>
                    <Ionicons name="cash-outline" size={16} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]}>{formatMoney(pay.amount, currency)} · {pay.method}</Text>
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{fmtDate(pay.date)}{pay.note ? ` · ${pay.note}` : ''}</Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        {reservation.guests.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ГОСТИ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {reservation.guests.map((g, i) => (
                <View key={g.id} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < reservation.guests.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.propIco, { backgroundColor: colors.fg3 + '22' }]}>
                    <Ionicons name="person-outline" size={16} color={colors.fg3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{g.fullName}</Text>
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[g.citizenship, g.age && `${g.age} лет`].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
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
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  priceLabel: { fontSize: 13, fontFamily: fonts.regular },
  priceValue: { fontSize: 14 },
  payCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.xxl, padding: spacing.lg },
  payHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payKicker: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.6 },
  payAmount: { fontSize: 28, marginTop: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  payMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  payMetaTxt: { fontSize: 12, fontFamily: fonts.regular },
});
