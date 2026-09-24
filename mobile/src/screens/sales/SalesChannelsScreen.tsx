import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchSalesChannels, toggleSalesChannel, SalesChannel, SalesChannelType } from '../../api/salesChannels';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Chips, StatGrid2, Pill } from '../../components/mg';
import { useCurrencyMode } from '../../context/CurrencyModeContext';

const TYPE_ICON: Record<SalesChannelType, keyof typeof Ionicons.glyphMap> = {
  b2b: 'briefcase-outline', ota: 'globe-outline', direct: 'link-outline', gds: 'airplane-outline', other: 'ellipsis-horizontal-outline',
};

function relTime(dateStr: string | null, t: (key: string) => string) {
  if (!dateStr) return t('salesChannels.never');
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return t('common.now');
  if (m < 60) return `${m} ${t('salesChannels.timeMinAgo')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('salesChannels.timeHourAgo')}`;
  return `${Math.floor(h / 24)} ${t('salesChannels.timeDayAgo')}`;
}

export const SalesChannelsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const TYPE_LABEL: Record<SalesChannelType, string> = {
    b2b: t('salesChannels.type.b2b'), ota: t('salesChannels.type.ota'), direct: t('salesChannels.type.direct'), gds: t('salesChannels.type.gds'), other: t('salesChannels.type.other'),
  };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setChannels(await fetchSalesChannels());
    } catch {
      showToast(t('salesChannels.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (c: SalesChannel) => {
    const next = !c.isEnabled;
    setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, isEnabled: next } : x)));
    try {
      await toggleSalesChannel(c.id, next);
    } catch {
      setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, isEnabled: !next } : x)));
      showToast(t('salesChannels.toggleError'), { variant: 'error' });
    }
  };

  const typeCounts: Record<string, number> = {};
  channels.forEach((c) => (typeCounts[c.type] = (typeCounts[c.type] || 0) + 1));
  const visible = typeFilter === 'all' ? channels : channels.filter((c) => c.type === typeFilter);
  const totalAmount = channels.reduce((s, c) => s + toDisplay(c.totalSalesAmount, c.currency), 0);
  const totalCount = channels.reduce((s, c) => s + c.totalSalesCount, 0);
  const errorChannels = channels.filter((c) => c.lastSyncStatus === 'error');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('salesChannels.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{channels.filter((c) => c.isEnabled).length}</Text> {t('salesChannels.activeOf')} {channels.length} · {totalCount} {t('salesChannels.orders')}
        </Text>
        {channels.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Chips
              options={[
                { key: 'all', label: t('salesChannels.all'), count: channels.length },
                ...(Object.keys(TYPE_LABEL) as SalesChannelType[]).filter((ty) => typeCounts[ty]).map((ty) => ({ key: ty, label: TYPE_LABEL[ty], count: typeCounts[ty] })),
              ]}
              activeKey={typeFilter}
              onChange={setTypeFilter}
            />
          </View>
        )}
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : channels.length === 0 ? (
        <EmptyState icon="git-network-outline" title={t('salesChannels.empty.title')} subtitle={t('salesChannels.empty.subtitle')} />
      ) : (
        <Animated.FlatList
          data={visible}
          keyExtractor={(item: SalesChannel) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm }}>
              <StatGrid2 items={[
                { label: t('salesChannels.stat.revenue'), value: fmt(totalAmount, undefined, { short: true }) },
                { label: t('salesChannels.stat.syncErrors'), value: String(errorChannels.length) },
              ]} />
            </View>
          }
          renderItem={({ item }: { item: SalesChannel }) => (
            <GlassCard variant="flat" style={[styles.card, { opacity: item.isEnabled ? 1 : 0.6 }]} contentStyle={styles.cardContent}>
              <View style={[styles.ico, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={TYPE_ICON[item.type]} size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {TYPE_LABEL[item.type]} · {item.totalSalesCount} {t('salesChannels.salesCount')} · {formatMoney(item.totalSalesAmount, item.currency)}
                </Text>
                {item.lastSyncStatus === 'error' ? (
                  <View style={{ marginTop: 3 }}><Pill label={item.lastError || t('salesChannels.syncError')} tone="neg" /></View>
                ) : (
                  <Text style={[styles.meta, { color: colors.textTertiary, marginTop: 1 }]} numberOfLines={1}>{t('salesChannels.syncPrefix')} {relTime(item.lastSyncAt, t)}</Text>
                )}
              </View>
              <Switch value={item.isEnabled} onValueChange={() => toggle(item)} trackColor={{ false: colors.line2, true: colors.success }} thumbColor={colors.card} />
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
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  card: { borderRadius: radius.xxl },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  ico: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontFamily: fonts.semibold },
  meta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
