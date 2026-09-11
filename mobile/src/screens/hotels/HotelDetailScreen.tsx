import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchHotel, fetchHotelAnalytics, Hotel, HotelAnalyticsSummary, HotelStatus,
} from '../../api/hotels';
import type { HotelsStackParamList } from './HotelsStack';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { formatMoney } from '../../utils/money';
import { SkeletonList, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<HotelsStackParamList, 'HotelDetail'>;

const STATUS_LABEL: Record<HotelStatus, string> = { active: 'Активен', draft: 'Черновик' };
const STATUS_TONE: Record<HotelStatus, 'pos' | 'default'> = { active: 'pos', draft: 'default' };

export const HotelDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [analytics, setAnalytics] = useState<HotelAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const h = await fetchHotel(id);
        setHotel(h);
        fetchHotelAnalytics({ hotelId: id }).then(setAnalytics).catch(() => {});
      } catch {
        showToast('Не удалось загрузить отель', { variant: 'error' });
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

  if (!hotel) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Отель не найден</Text>
      </View>
    );
  }

  const kpis = analytics?.kpis;
  const markets = (analytics?.markets || []).filter((m) => m.roomsSold > 0);
  const maxMarketRevenue = Math.max(1, ...markets.map((m) => m.revenueActual));

  const properties = [
    hotel.address && { label: 'Адрес', value: hotel.address, icon: 'location-outline' as const, iconColor: colors.fg3 },
    !hotel.address && (hotel.city || hotel.country) && {
      label: 'Город', value: [hotel.city, hotel.country].filter(Boolean).join(', '), icon: 'location-outline' as const, iconColor: colors.fg3,
    },
    { label: 'Заезд / выезд', value: `${hotel.checkInTime} / ${hotel.checkOutTime}`, icon: 'time-outline' as const, iconColor: colors.info },
    { label: 'Номерной фонд', value: `${hotel.roomsCount} номеров · ${hotel.roomTypesCount} типов`, icon: 'bed-outline' as const, iconColor: colors.secondary },
    { label: 'Рынки', value: String(hotel.marketsCount), icon: 'globe-outline' as const, iconColor: colors.warning },
    hotel.description && { label: 'Описание', value: hotel.description, icon: 'document-text-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Отели</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <View style={[styles.heroIco, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="business-outline" size={26} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>{hotel.name}</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <Pill label={STATUS_LABEL[hotel.status]} tone={STATUS_TONE[hotel.status]} />
              {hotel.stars ? <Pill label={'★'.repeat(hotel.stars)} tone="default" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <GlassCard variant="g" style={styles.kpiTile}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ЗАГРУЗКА</Text>
            <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]}>
              {kpis ? `${kpis.occupancyNowPct}%` : `${hotel.occupancyToday}%`}
            </Text>
          </GlassCard>
          <GlassCard variant="g" style={styles.kpiTile}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ADR</Text>
            <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
              {formatMoney(hotel.adr, hotel.currency)}
            </Text>
          </GlassCard>
        </View>
        {kpis && (
          <View style={styles.kpiGrid}>
            <GlassCard variant="g" style={styles.kpiTile}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>СВОБОДНО / ВСЕГО</Text>
              <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                {kpis.roomsAvailable} / {kpis.roomsTotal}
              </Text>
            </GlassCard>
            <GlassCard variant="g" style={styles.kpiTile}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ВЫРУЧКА (30Д)</Text>
              <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                {formatMoney(kpis.revenueSold, kpis.currency)}
              </Text>
            </GlassCard>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => (
            <View key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]}>
              <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                <Ionicons name={p.icon} size={16} color={p.iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={3}>{p.value}</Text>
              </View>
            </View>
          ))}
        </GlassCard>

        {markets.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ВЫРУЧКА ПО РЫНКАМ (30Д)</Text>
            <GlassCard variant="g" style={styles.widget}>
              {markets.map((m, i) => {
                const pct = Math.round((m.revenueActual / maxMarketRevenue) * 100);
                return (
                  <View key={i} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < markets.length - 1 ? 1 : 0 }]}>
                    <Text style={[styles.srcName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{m.market}</Text>
                    <View style={[styles.srcTrack, { backgroundColor: colors.surfaceVariant }]}>
                      <View style={[styles.srcFill, { width: `${Math.max(pct, 8)}%`, backgroundColor: colors.ink }]}>
                        <Text style={[styles.srcFillTxt, { color: colors.onInk, fontFamily: fonts.semibold }]} numberOfLines={1}>
                          {formatMoney(m.revenueActual, kpis?.currency || hotel.currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>БРОНИРОВАНИЯ</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('HotelReservations', { hotelId: hotel.id })}
          >
            <View style={[styles.propIco, { backgroundColor: colors.info + '22' }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.info} />
            </View>
            <Text style={[styles.propValue, { color: colors.text, flex: 1 }]}>Все брони этого отеля</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </GlassCard>
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
  heroIco: { width: 56, height: 56, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },

  kpiGrid: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  kpiTile: { flex: 1, borderRadius: radius.xxl, padding: 14, gap: 4 },
  kpiLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 20, letterSpacing: -0.4 },

  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },

  widget: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, padding: spacing.lg },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  srcName: { width: 90, fontSize: 13 },
  srcTrack: { flex: 1, height: 24, borderRadius: radius.sm, overflow: 'hidden' },
  srcFill: { height: '100%', borderRadius: radius.sm, justifyContent: 'center', paddingLeft: 8, minWidth: 30 },
  srcFillTxt: { fontSize: 10.5 },
});
