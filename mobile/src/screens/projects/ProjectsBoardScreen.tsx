import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchProjects, updateProjectStatus, Project, ProjectStatus } from '../../api/projects';
import { fetchProjectStatusDefs, ProjectStatusDef } from '../../api/projectSettings';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectsBoard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ProjectsBoardScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fmt, toDisplay } = useCurrencyMode();
  const listRef = useRef<FlatList<{ status: ProjectStatusDef; items: Project[] }>>(null);
  const moveSheetRef = useRef<AppBottomSheetRef>(null);

  const [statuses, setStatuses] = useState<ProjectStatusDef[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCol, setActiveCol] = useState(0);
  const [moveTarget, setMoveTarget] = useState<Project | null>(null);

  const load = useCallback(async () => {
    try {
      const [defs, res] = await Promise.all([fetchProjectStatusDefs(), fetchProjects()]);
      setStatuses(defs);
      setProjects(res.items);
    } catch {
      showToast('Не удалось загрузить проекты', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openMoveSheet = (p: Project) => {
    setMoveTarget(p);
    moveSheetRef.current?.snapToIndex(0);
  };

  const moveTo = async (status: string) => {
    if (!moveTarget || moveTarget.status === status) {
      moveSheetRef.current?.close();
      return;
    }
    const id = moveTarget.id;
    moveSheetRef.current?.close();
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: status as ProjectStatus } : p)));
    try {
      await updateProjectStatus(id, status as ProjectStatus);
      showToast(`Проект перемещён в «${status}»`, { variant: 'success' });
    } catch {
      showToast('Не удалось изменить статус проекта', { variant: 'error' });
      load();
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }

  const columns = statuses.map((s) => ({ status: s, items: projects.filter((p) => p.status === s.value) }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Проекты</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Доска проектов</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Долгое нажатие — переместить между статусами</Text>

      {projects.length === 0 ? (
        <EmptyState icon="layers-outline" title="Нет проектов" />
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={columns}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.status.id}
            onMomentumScrollEnd={(e) => setActiveCol(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            renderItem={({ item: col }) => (
              <View style={{ width: SCREEN_WIDTH }}>
                <View style={styles.colHeader}>
                  <View style={[styles.dot, { backgroundColor: col.status.color }]} />
                  <Text style={[styles.colTitle, { color: colors.text }]} numberOfLines={1}>{col.status.value}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.colCount, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{col.items.length}</Text>
                </View>
                {col.items.length === 0 ? (
                  <EmptyState icon="layers-outline" title="Пусто" subtitle="Перенесите сюда проект" />
                ) : (
                  <FlatList
                    data={col.items}
                    keyExtractor={(p) => p.id}
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 24, gap: spacing.sm }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardInner}>
                        <TouchableOpacity
                          style={styles.cardTouchable}
                          onPress={() => navigation.navigate('ProjectDetail', { id: item.id })}
                          onLongPress={() => openMoveSheet(item)}
                          delayLongPress={280}
                          activeOpacity={0.8}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                            <Text style={[styles.cardMeta, { color: colors.textTertiary }]} numberOfLines={1}>{item.owner || 'Без ответственного'}</Text>
                            <View style={styles.cardBottomRow}>
                              <Text style={[styles.cardMoney, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(toDisplay(item.amount, item.currency), undefined, { short: true })}</Text>
                              <Pill label={`${item.tasks.length} зад.`} />
                            </View>
                          </View>
                          <TouchableOpacity style={[styles.moveBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => openMoveSheet(item)} hitSlop={8}>
                            <Ionicons name="swap-horizontal" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </GlassCard>
                    )}
                  />
                )}
              </View>
            )}
          />
          <View style={styles.dotsRow}>
            {columns.map((c, i) => (
              <View key={c.status.id} style={[styles.pageDot, { backgroundColor: i === activeCol ? colors.ink : colors.line2 }]} />
            ))}
          </View>
        </>
      )}

      <AppBottomSheet ref={moveSheetRef} snapPoints={['55%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Переместить проект</Text>
        {moveTarget && <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{moveTarget.name}</Text>}
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {statuses.map((s) => {
            const isCurrent = moveTarget?.status === s.value;
            return (
              <TouchableOpacity key={s.id} style={[styles.moveRow, { borderColor: colors.line2, opacity: isCurrent ? 0.5 : 1 }]} onPress={() => moveTo(s.value)} disabled={isCurrent} activeOpacity={0.7}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text style={[styles.moveRowLabel, { color: colors.text }]}>{s.value}</Text>
                {isCurrent && <Text style={[styles.sheetCurrentLabel, { color: colors.textTertiary }]}>текущий</Text>}
                {!isCurrent && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15, flexShrink: 1 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: 4 },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  colTitle: { fontSize: 14.5, fontFamily: fonts.semibold, flexShrink: 1 },
  colCount: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: radius.xl },
  cardInner: { flex: 1 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2 },
  cardTitle: { fontSize: 13.5, fontFamily: fonts.semibold },
  cardMeta: { fontSize: 11, marginTop: 3 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  cardMoney: { fontSize: 13 },
  moveBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  pageDot: { width: 6, height: 6, borderRadius: 3 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  moveRowLabel: { fontSize: 14, fontFamily: fonts.medium },
  sheetCurrentLabel: { fontSize: 11, fontFamily: fonts.regular, marginLeft: 'auto' },
});
