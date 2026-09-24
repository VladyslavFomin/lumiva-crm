import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchCompanies, Company, fetchAllCompanyTasks, changeCompanyTaskStatus, createCompanyTask,
  CompanyTask, CompanyTaskStatus,
} from '../../api/companies';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { EntityField, ChipPicker, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_ORDER: CompanyTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
const STATUS_LABEL: Record<CompanyTaskStatus, string> = {
  todo: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Готово', cancelled: 'Отменена',
};
const STATUS_TONE: Record<CompanyTaskStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  todo: 'acc', in_progress: 'warn', review: 'default', done: 'pos', cancelled: 'neg',
};

type Task = CompanyTask & { companyName: string };

export const CoTasksScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const listRef = useRef<FlatList<{ status: CompanyTaskStatus; items: Task[] }>>(null);
  const moveSheetRef = useRef<AppBottomSheetRef>(null);
  const createSheetRef = useRef<AppBottomSheetRef>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCol, setActiveCol] = useState(0);
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newPriority, setNewPriority] = useState('Обычный');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const cos = await fetchCompanies();
      setCompanies(cos);
      setTasks(await fetchAllCompanyTasks(cos));
    } catch {
      showToast('Не удалось загрузить задачи', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openMoveSheet = (task: Task) => {
    setMoveTarget(task);
    moveSheetRef.current?.snapToIndex(0);
  };

  const moveTo = async (status: CompanyTaskStatus) => {
    if (!moveTarget || moveTarget.status === status) {
      moveSheetRef.current?.close();
      return;
    }
    const id = moveTarget.id;
    moveSheetRef.current?.close();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await changeCompanyTaskStatus(id, status);
      showToast(`Задача перемещена в «${STATUS_LABEL[status]}»`, { variant: 'success' });
    } catch {
      showToast('Не удалось изменить статус задачи', { variant: 'error' });
      load();
    }
  };

  const openCreate = () => {
    setNewTitle('');
    setNewCompanyId(companies[0]?.id || '');
    setNewPriority('Обычный');
    createSheetRef.current?.snapToIndex(0);
  };

  const submitCreate = async () => {
    if (!newTitle.trim() || !newCompanyId) return;
    setCreating(true);
    try {
      await createCompanyTask({ companyId: newCompanyId, title: newTitle.trim(), priority: newPriority, status: 'todo' });
      createSheetRef.current?.close();
      showToast('Задача создана', { variant: 'success' });
      load();
    } catch {
      showToast('Не удалось создать задачу', { variant: 'error' });
    } finally {
      setCreating(false);
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

  const columns = STATUS_ORDER.map((status) => ({ status, items: tasks.filter((t) => t.status === status) }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Компании</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={openCreate}>
          <Ionicons name="add" size={18} color={colors.accentFg} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Задачи компаний</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{tasks.length} задач · {STATUS_ORDER.length} статуса</Text>

      {tasks.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="Нет задач" subtitle="Здесь появятся задачи, связанные с компаниями" ctaLabel="Добавить задачу" onCta={openCreate} />
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
                  <Pill label={STATUS_LABEL[col.status]} tone={STATUS_TONE[col.status]} />
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
                            <Text style={[styles.cardCompany, { color: colors.textTertiary }]} numberOfLines={1}>{item.companyName}</Text>
                            <View style={styles.cardMetaRow}>
                              {item.dueDate && <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>до {new Date(item.dueDate).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })}</Text>}
                              {item.priority === 'Высокий' && <Text style={[styles.cardMeta, { color: colors.error, fontFamily: fonts.semibold }]}>Высокий</Text>}
                              {item.assignedTo && <Text style={[styles.cardMeta, { color: colors.textTertiary }]} numberOfLines={1}>{item.assignedTo}</Text>}
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
                <Pill label={STATUS_LABEL[s]} tone={STATUS_TONE[s]} />
                {isCurrent && <Text style={[styles.sheetCurrentLabel, { color: colors.textTertiary }]}>текущий</Text>}
                {!isCurrent && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={createSheetRef} snapPoints={['62%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Новая задача</Text>
        <View style={{ marginTop: spacing.md }}>
          <EntityField label="Название" required value={newTitle} onChangeText={setNewTitle} placeholder="Собрать реквизиты" />
          <Text style={[styles.pickLabel, { color: colors.textSecondary }]}>Компания</Text>
          <ChipPicker options={companies.map((c) => ({ key: c.id, label: c.name }))} value={newCompanyId} onChange={setNewCompanyId} />
          <Text style={[styles.pickLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Приоритет</Text>
          <ChipPicker options={[{ key: 'Обычный', label: 'Обычный' }, { key: 'Высокий', label: 'Высокий' }]} value={newPriority} onChange={setNewPriority} />
          <Button label="Создать задачу" variant="accent" fullWidth loading={creating} disabled={!newTitle.trim() || !newCompanyId} onPress={submitCreate} style={{ marginTop: spacing.lg }} />
        </View>
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15, flexShrink: 1 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: 4 },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  colCount: { fontSize: 12 },
  card: { borderRadius: radius.xl },
  cardInner: { flex: 1 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2 },
  cardTitle: { fontSize: 13.5, fontFamily: fonts.semibold },
  cardCompany: { fontSize: 11, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11 },
  moveBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  sheetCurrentLabel: { fontSize: 11, fontFamily: fonts.regular, marginLeft: 'auto' },
  pickLabel: { fontSize: 11.5, fontFamily: fonts.regular, marginBottom: 6 },
});
