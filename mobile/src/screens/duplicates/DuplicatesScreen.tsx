import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchDedupOverview, fetchDedupGroups, ignoreDedupGroup, mergeDedupRecords,
  DedupEntityType, DedupOverview, DuplicateGroup,
} from '../../api/deduplication';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function recordLabel(entityType: DedupEntityType, r: Record<string, any>): { title: string; subtitle: string } {
  if (entityType === 'contact') return { title: r.fullName || 'Без имени', subtitle: [r.email, r.phone].filter(Boolean).join(' · ') || '—' };
  if (entityType === 'company') return { title: r.name || 'Без названия', subtitle: [r.industry, r.website].filter(Boolean).join(' · ') || '—' };
  return { title: r.name || 'Без имени', subtitle: [r.channel, r.email].filter(Boolean).join(' · ') || '—' };
}

export const DuplicatesScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const sheetRef = useRef<AppBottomSheetRef>(null);

  const [entityType, setEntityType] = useState<DedupEntityType>('contact');
  const [overview, setOverview] = useState<DedupOverview | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [ov, gr] = await Promise.all([fetchDedupOverview(entityType), fetchDedupGroups(entityType)]);
      setOverview(ov);
      setGroups(gr);
    } catch {
      showToast('Не удалось загрузить дубликаты', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityType]);

  useEffect(() => { load(); }, [load]);

  const openGroup = (g: DuplicateGroup) => {
    setActiveGroup(g);
    setMasterId(g.ids[0]);
    sheetRef.current?.snapToIndex(0);
  };

  const handleIgnore = async () => {
    if (!activeGroup) return;
    try {
      await ignoreDedupGroup(activeGroup.ids);
      showToast('Помечено как не дубли', { variant: 'success' });
      sheetRef.current?.close();
      setGroups((prev) => prev.filter((g) => g !== activeGroup));
    } catch {
      showToast('Не удалось сохранить', { variant: 'error' });
    }
  };

  const handleMerge = async () => {
    if (!activeGroup || !masterId) return;
    setMerging(true);
    try {
      const losers = activeGroup.ids.filter((id) => id !== masterId);
      for (const loserId of losers) {
        await mergeDedupRecords(entityType, masterId, loserId);
      }
      showToast('Записи объединены', { variant: 'success' });
      sheetRef.current?.close();
      setGroups((prev) => prev.filter((g) => g !== activeGroup));
    } catch {
      showToast('Не удалось объединить — часть записей могла уже измениться', { variant: 'error' });
    } finally {
      setMerging(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Дубликаты</Text>
        </View>
      </View>

      <Segmented
        options={[
          { key: 'contact', label: 'Контакты' },
          { key: 'company', label: 'Компании' },
          { key: 'lead', label: 'Лиды' },
        ]}
        activeKey={entityType}
        onChange={(key) => setEntityType(key as DedupEntityType)}
      />

      {overview && (
        <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{overview.groupsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Групп</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning, fontFamily: fonts.mono }]}>{overview.recordsInvolved}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Записей</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success, fontFamily: fonts.mono }]}>{overview.mergedTotal}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Объединено</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{overview.duplicateRatePct}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Доля</Text>
          </View>
        </GlassCard>
      )}

      {loading ? (
        <SkeletonList count={5} />
      ) : groups.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Дубликатов нет" subtitle="Все записи уникальны — отличная гигиена данных" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={groups}
            keyExtractor={(g: DuplicateGroup) => g.pairIds.join('-')}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: g }: { item: DuplicateGroup }) => {
              const first = recordLabel(entityType, g.records[0]);
              return (
                <TouchableOpacity style={[styles.row, { borderBottomColor: colors.line3 }]} onPress={() => openGroup(g)} activeOpacity={0.7}>
                  <AvatarInitials name={first.title} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{first.title} +{g.records.length - 1}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>{g.reasons.join(', ') || 'Похожие поля'}</Text>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: g.score >= 90 ? colors.errorBg : colors.warningBg }]}>
                    <Text style={[styles.scoreTxt, { color: g.score >= 90 ? colors.error : colors.warning, fontFamily: fonts.monoSemibold }]}>{g.score}%</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </GlassCard>
      )}

      <AppBottomSheet ref={sheetRef} snapPoints={['60%', '85%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Группа дублей</Text>
        <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>Выберите основную запись — остальные будут объединены в неё</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {activeGroup?.records.map((r) => {
            const label = recordLabel(entityType, r);
            const isMaster = r.id === masterId;
            return (
              <TouchableOpacity key={r.id} style={[styles.memberRow, { borderColor: isMaster ? colors.ink : colors.line2 }]} onPress={() => setMasterId(r.id)} activeOpacity={0.7}>
                <AvatarInitials name={label.title} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{label.title}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>{label.subtitle}</Text>
                </View>
                <View style={[styles.radio, { borderColor: isMaster ? colors.ink : colors.line2, backgroundColor: isMaster ? colors.ink : 'transparent' }]}>
                  {isMaster && <Ionicons name="checkmark" size={12} color={colors.onInk} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          <Button label="Не дубли" variant="secondary" onPress={handleIgnore} style={{ flex: 1 }} />
          <Button label="Объединить" variant="primary" loading={merging} onPress={handleMerge} style={{ flex: 1 }} />
        </View>
      </AppBottomSheet>
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
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  scoreTxt: { fontSize: 11 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
