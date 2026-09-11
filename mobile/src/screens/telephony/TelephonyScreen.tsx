import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchCalls, fetchTelephonyStats, isTelephonyDisabledError, Call, TelephonyStats } from '../../api/telephony';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type DirectionFilter = 'all' | 'inbound' | 'outbound' | 'missed';

const DIRECTION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  inbound: 'call-outline',
  outbound: 'call-outline',
};
const MISSED_STATUSES = ['no-answer', 'busy', 'failed', 'canceled'];

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const TelephonyScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<TelephonyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [direction, setDirection] = useState<DirectionFilter>('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [list, st] = await Promise.all([
        fetchCalls({ direction: direction === 'all' ? undefined : direction }),
        fetchTelephonyStats(30),
      ]);
      setCalls(list.items);
      setStats(st);
      setDisabled(false);
    } catch (e) {
      if (isTelephonyDisabledError(e)) {
        setDisabled(true);
      } else {
        showToast('Не удалось загрузить звонки', { variant: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [direction]);

  useEffect(() => { load(); }, [load]);

  if (disabled) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Телефония</Text>
          </View>
        </View>
        <EmptyState icon="call-outline" title="Телефония не подключена" subtitle="Это платное дополнение — подключите его в настройках на сайте, чтобы видеть звонки здесь" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Телефония</Text>
        </View>
      </View>

      {stats && (
        <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{stats.totalCalls}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Звонков</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success, fontFamily: fonts.mono }]}>{Math.round(stats.pickupRate)}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Отвечено</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.error, fontFamily: fonts.mono }]}>{stats.missedCalls}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Пропущено</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{fmtDuration(Math.round(stats.avgDurationSeconds))}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ср. длит.</Text>
          </View>
        </GlassCard>
      )}

      <Segmented
        options={[
          { key: 'all', label: 'Все' },
          { key: 'inbound', label: 'Входящие' },
          { key: 'outbound', label: 'Исходящие' },
          { key: 'missed', label: 'Пропущенные' },
        ]}
        activeKey={direction}
        onChange={(key) => setDirection(key as DirectionFilter)}
      />

      {loading ? (
        <SkeletonList count={6} />
      ) : calls.length === 0 ? (
        <EmptyState icon="call-outline" title="Нет звонков" subtitle="Здесь появится журнал звонков" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={calls}
            keyExtractor={(item: Call) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: Call }) => {
              const missed = MISSED_STATUSES.includes(item.status);
              const number = item.direction === 'inbound' ? item.fromNumber : item.toNumber;
              return (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.line3 }]}
                  onPress={() => navigation.navigate('CallDetail', { call: item })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dirIco, { backgroundColor: missed ? colors.errorBg : colors.surfaceVariant }]}>
                    <Ionicons
                      name={DIRECTION_ICON[item.direction] || 'call-outline'}
                      size={16}
                      color={missed ? colors.error : colors.textSecondary}
                      style={item.direction === 'outbound' ? { transform: [{ rotate: '90deg' }] } : undefined}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: missed ? colors.error : colors.text }]} numberOfLines={1}>{number || 'Неизвестный номер'}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                      {item.direction === 'inbound' ? 'Входящий' : 'Исходящий'} · {fmtDuration(item.durationSeconds)} · {relTime(item.createdAt)}
                    </Text>
                  </View>
                  {item.recordingUrl && <Ionicons name="mic-outline" size={14} color={colors.textTertiary} />}
                  {number && (
                    <TouchableOpacity hitSlop={8} onPress={() => Linking.openURL(`tel:${number}`)}>
                      <Ionicons name="call-outline" size={16} color={colors.success} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </GlassCard>
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
  statsCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.xxl, padding: 14 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontFamily: fonts.semibold },
  statLabel: { fontSize: 9.5, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 3 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 2 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dirIco: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
