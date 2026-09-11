import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchHotels, fetchHotelOverviewKpis, Hotel, HotelOverviewKpis, HotelStatus } from '../../api/hotels';
import type { HotelsStackParamList } from './HotelsStack';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { formatMoney } from '../../utils/money';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<HotelsStackParamList, 'HotelsList'>;

const STATUS_LABEL: Record<HotelStatus, string> = { active: 'Активен', draft: 'Черновик' };
const STATUS_TONE: Record<HotelStatus, 'pos' | 'default'> = { active: 'pos', draft: 'default' };

export const HotelsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [kpis, setKpis] = useState<HotelOverviewKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [h, k] = await Promise.all([fetchHotels(), fetchHotelOverviewKpis().catch(() => null)]);
      setHotels(h);
      setKpis(k);
    } catch {
      showToast('Не удалось загрузить отели', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpiTiles = kpis
    ? [
        { label: 'ОТЕЛИ', value: String(kpis.hotelsCount) },
        { label: 'НОМЕРА', value: String(kpis.roomsCount) },
        { label: 'ЗАГРУЗКА', value: `${kpis.occupancyToday}%` },
        { label: 'ADR', value: kpis.adr.toLocaleString('ru-RU') },
        { label: 'БРОНИ 30Д', value: String(kpis.bookings30d) },
        { label: 'ВЫРУЧКА 30Д', value: kpis.revenue30d.toLocaleString('ru-RU') },
      ]
    : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Отели</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{hotels.length}</Text> объектов
        </Text>
      </View>

      {!loading && kpiTiles.length > 0 && (
        <View style={styles.kpiGrid}>
          {kpiTiles.map((t, i) => (
            <GlassCard key={i} variant="g" style={styles.kpiTile}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t.label}</Text>
              <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>{t.value}</Text>
            </GlassCard>
          ))}
        </View>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : hotels.length === 0 ? (
        <EmptyState icon="business-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет отелей" subtitle="Отели, добавленные на сайте, появятся здесь" />
      ) : (
        <Animated.FlatList
          data={hotels}
          keyExtractor={(item: Hotel) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 32, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Hotel }) => (
            <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardContent}>
              <TouchableOpacity onPress={() => navigation.navigate('HotelDetail', { id: item.id })} activeOpacity={0.7} style={styles.cardRow}>
                {item.coverPhotoUrl ? (
                  <Image source={{ uri: item.coverPhotoUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
                    <Ionicons name="business-outline" size={22} color={colors.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Pill label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
                  </View>
                  <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                    {[item.city, item.country].filter(Boolean).join(', ') || '—'}
                    {item.stars ? `  ·  ${'★'.repeat(item.stars)}` : ''}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaTxt, { color: colors.textTertiary }]}>{item.roomsCount} номеров</Text>
                    <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
                    <Text style={[styles.metaTxt, { color: colors.textTertiary }]}>{item.occupancyToday}% загрузка</Text>
                    <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
                    <Text style={[styles.metaTxt, { color: colors.textTertiary }]}>ADR {formatMoney(item.adr, item.currency)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </GlassCard>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  kpiTile: { width: '31%', borderRadius: radius.lg, padding: 10, gap: 3 },
  kpiLabel: { fontSize: 9, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 16, letterSpacing: -0.3 },

  card: { borderRadius: radius.xxl },
  cardContent: { padding: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.lg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontFamily: fonts.semibold, flexShrink: 1 },
  location: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaTxt: { fontSize: 11, fontFamily: fonts.regular },
  metaDot: { fontSize: 11 },
});
