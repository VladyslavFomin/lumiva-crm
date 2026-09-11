import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchHotelReservations, fetchHotels, Hotel, HotelReservation, HotelReservationStatus,
} from '../../api/hotels';
import type { HotelsStackParamList } from './HotelsStack';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<HotelsStackParamList, 'HotelReservations'>;

const STATUS_LABEL: Record<HotelReservationStatus, string> = {
  confirmed: 'Подтверждена', pending: 'Ожидает', checked_in: 'Заселён', checked_out: 'Выселен', cancelled: 'Отменена',
};
const STATUS_TONE: Record<HotelReservationStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  confirmed: 'acc', pending: 'warn', checked_in: 'pos', checked_out: 'default', cancelled: 'neg',
};
const STATUS_ORDER: HotelReservationStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export const HotelReservationsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hotelId = route.params?.hotelId;

  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HotelReservationStatus | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [items, h] = await Promise.all([
        fetchHotelReservations({ hotelId, status: statusFilter || undefined, search: search || undefined }),
        hotels.length ? Promise.resolve(hotels) : fetchHotels().catch(() => []),
      ]);
      setReservations(items);
      if (!hotels.length) setHotels(h);
    } catch {
      showToast('Не удалось загрузить брони', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const currentHotel = hotelId ? hotelById.get(hotelId) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{currentHotel ? currentHotel.name : 'Отели'}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Бронирования</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{reservations.length}</Text> броней
        </Text>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Имя гостя…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ flexGrow: 0 }}>
          <TouchableOpacity onPress={() => setStatusFilter(null)}>
            <View style={[styles.chip, { borderColor: statusFilter === null ? colors.ink : colors.line2 }]}>
              <Text style={[styles.chipTxt, { color: statusFilter === null ? colors.text : colors.textSecondary }]}>Все</Text>
            </View>
          </TouchableOpacity>
          {STATUS_ORDER.map((s) => (
            <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}>
              <View style={[styles.chip, { borderColor: statusFilter === s ? colors.ink : colors.line2 }]}>
                <Text style={[styles.chipTxt, { color: statusFilter === s ? colors.text : colors.textSecondary }]}>{STATUS_LABEL[s]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : reservations.length === 0 ? (
        <EmptyState icon="calendar-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет броней" subtitle="Записи появятся здесь по мере поступления" />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
        >
          {reservations.map((r) => {
            const h = hotelById.get(r.hotelId);
            return (
              <GlassCard key={r.id} variant="flat" style={styles.row} contentStyle={styles.rowInner}>
                <TouchableOpacity style={styles.rowTouchable} onPress={() => navigation.navigate('HotelReservationDetail', { id: r.id })} activeOpacity={0.7}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{r.guestName}</Text>
                      <Pill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                    </View>
                    <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {fmtDate(r.checkIn)} – {fmtDate(r.checkOut)} · {r.pax} гост.{!hotelId && h ? ` · ${h.name}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </GlassCard>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  backTxt: { fontSize: 13 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1 },
  chipTxt: { fontSize: 12, fontFamily: fonts.medium },
  row: { borderRadius: radius.xl },
  rowInner: { flex: 1 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { fontSize: 14, fontFamily: fonts.semibold, flexShrink: 1 },
  rowMeta: { fontSize: 11.5, fontFamily: fonts.regular, marginTop: 3 },
});
