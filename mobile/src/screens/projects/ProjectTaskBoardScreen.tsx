import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchProject, updateProject, Project, ProjectTask, TaskStatus } from '../../api/projects';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Pill } from '../../components/mg';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectTaskBoard'>;

const STATUS_ORDER: TaskStatus[] = ['К выполнению', 'В работе', 'На проверке', 'Заблокировано', 'Отложено', 'Готово'];
const STATUS_TONE: Record<TaskStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  'К выполнению': 'default', 'В работе': 'acc', 'На проверке': 'warn', 'Заблокировано': 'neg', 'Отложено': 'warn', 'Готово': 'pos',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TaskColumn {
  status: TaskStatus;
  items: ProjectTask[];
}

export const ProjectTaskBoardScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<TaskColumn>>(null);
  const moveSheetRef = useRef<AppBottomSheetRef>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCol, setActiveCol] = useState(0);
  const [moveTarget, setMoveTarget] = useState<ProjectTask | null>(null);

  const load = useCallback(async () => {
    try {
      setProject(await fetchProject(id));
    } catch {
      showToast('Не удалось загрузить задачи', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openMoveSheet = useCallback((task: ProjectTask) => {
    setMoveTarget(task);
    moveSheetRef.current?.snapToIndex(0);
  }, []);

  const moveTo = useCallback(async (status: TaskStatus) => {
    if (!project || !moveTarget || moveTarget.status === status) {
      moveSheetRef.current?.close();
      return;
    }
    moveSheetRef.current?.close();
    const nextTasks = project.tasks.map((t) => (t.id === moveTarget.id ? { ...t, status } : t));
    setProject({ ...project, tasks: nextTasks });
    try {
      await updateProject({ id: project.id, tasks: nextTasks });
      showToast(`Задача перемещена в «${status}»`, { variant: 'success' });
    } catch {
      setProject((prev) => (prev ? { ...prev, tasks: project.tasks } : prev));
      showToast('Не удалось изменить статус задачи', { variant: 'error' });
    }
  }, [project, moveTarget]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }
  if (!project) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AuraBackground />
        <Text style={{ color: colors.text }}>Проект не найден</Text>
      </View>
    );
  }

  const columns = STATUS_ORDER.map((status) => ({ status, items: project.tasks.filter((t) => t.status === status) }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{project.name}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Задачи · доска</Text>

      {project.tasks.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="Нет задач" subtitle="В этом проекте пока нет задач" />
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={columns}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.status}
            onMomentumScrollEnd={(e) => setActiveCol(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            renderItem={({ item: col }) => (
              <View style={{ width: SCREEN_WIDTH }}>
                <View style={styles.colHeader}>
                  <Pill label={col.status} tone={STATUS_TONE[col.status]} />
                  <Text style={[styles.colCount, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{col.items.length}</Text>
                </View>
                {col.items.length === 0 ? (
                  <EmptyState icon="checkbox-outline" title="Пусто" />
                ) : (
                  <FlatList
                    data={col.items}
                    keyExtractor={(t) => t.id}
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 24, gap: spacing.sm }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardInner}>
                        <TouchableOpacity style={styles.cardTouchable} onLongPress={() => openMoveSheet(item)} delayLongPress={280} activeOpacity={0.8}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                            <View style={styles.cardMetaRow}>
                              {item.deadline && <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{new Date(item.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</Text>}
                              {item.priority === 'Высокий' && <Text style={[styles.cardMeta, { color: colors.error, fontFamily: fonts.semibold }]}>Высокий</Text>}
                              {item.assignees.length > 0 && <Text style={[styles.cardMeta, { color: colors.textTertiary }]} numberOfLines={1}>{item.assignees.join(', ')}</Text>}
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
          <View style={styles.dots}>
            {columns.map((c, i) => (
              <View key={c.status} style={[styles.dot, { backgroundColor: i === activeCol ? colors.ink : colors.line2 }]} />
            ))}
          </View>
        </>
      )}

      <AppBottomSheet ref={moveSheetRef} snapPoints={['50%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Переместить задачу</Text>
        {moveTarget && <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{moveTarget.title}</Text>}
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {STATUS_ORDER.map((s) => {
            const isCurrent = moveTarget?.status === s;
            return (
              <TouchableOpacity key={s} style={[styles.moveRow, { borderColor: colors.line2, opacity: isCurrent ? 0.5 : 1 }]} onPress={() => moveTo(s)} disabled={isCurrent} activeOpacity={0.7}>
                <Pill label={s} tone={STATUS_TONE[s]} />
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
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  colCount: { fontSize: 12 },
  card: { borderRadius: radius.xl },
  cardInner: { flex: 1 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2 },
  cardTitle: { fontSize: 13.5, fontFamily: fonts.semibold },
  cardMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11 },
  moveBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  sheetCurrentLabel: { fontSize: 11, fontFamily: fonts.regular, marginLeft: 'auto' },
});
