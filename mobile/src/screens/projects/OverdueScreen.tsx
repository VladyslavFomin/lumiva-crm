import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProjects, updateProject, Project, ProjectTask } from '../../api/projects';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { Chips, Pill, EntityField } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

interface OverdueTask extends ProjectTask {
  projectId: string;
  projectName: string;
}

function daysOverdue(deadline: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(deadline).getTime()) / 86400000));
}

export const OverdueScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const sheetRef = React.useRef<AppBottomSheetRef>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [who, setWho] = useState('all');
  const [rescheduleTarget, setRescheduleTarget] = useState<OverdueTask | null>(null);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetchProjects();
      setProjects(res.items);
    } catch {
      showToast('Не удалось загрузить задачи', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allOverdue = useMemo<OverdueTask[]>(() => {
    const today = new Date();
    const out: OverdueTask[] = [];
    projects.forEach((p) => p.tasks.forEach((t) => {
      if (t.status !== 'Готово' && t.deadline && new Date(t.deadline) < today) {
        out.push({ ...t, projectId: p.id, projectName: p.name });
      }
    }));
    return out.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }, [projects]);

  const people = useMemo(() => {
    const set = new Set<string>();
    allOverdue.forEach((t) => t.assignees.forEach((a) => set.add(a)));
    return [...set];
  }, [allOverdue]);

  const list = who === 'all' ? allOverdue : allOverdue.filter((t) => t.assignees.includes(who));
  const maxDays = allOverdue.length ? Math.max(...allOverdue.map((t) => daysOverdue(t.deadline!))) : 0;

  const openReschedule = (t: OverdueTask) => {
    setRescheduleTarget(t);
    setNewDate(t.deadline ? new Date(t.deadline).toISOString().slice(0, 10) : '');
    sheetRef.current?.snapToIndex(0);
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget || !newDate.trim()) return;
    const project = projects.find((p) => p.id === rescheduleTarget.projectId);
    if (!project) return;
    setSaving(true);
    try {
      const nextTasks = project.tasks.map((t) => (t.id === rescheduleTarget.id ? { ...t, deadline: newDate } : t));
      await updateProject({ id: project.id, tasks: nextTasks });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, tasks: nextTasks } : p)));
      sheetRef.current?.close();
      showToast('Срок перенесён', { variant: 'success' });
    } catch {
      showToast('Не удалось перенести срок', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Проекты</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Просроченные задачи</Text>
      {!loading && (
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{allOverdue.length} задач{maxDays > 0 ? ` · максимум ${maxDays} дн просрочки` : ''}</Text>
      )}

      {!loading && people.length > 0 && (
        <View style={styles.chipsWrap}>
          <Chips
            options={[{ key: 'all', label: 'Все', count: allOverdue.length }, ...people.map((p) => ({ key: p, label: p, count: allOverdue.filter((t) => t.assignees.includes(p)).length }))]}
            activeKey={who}
            onChange={setWho}
          />
        </View>
      )}

      {loading ? (
        <SkeletonList count={5} />
      ) : list.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="Просроченных задач нет" subtitle="Все задачи выполняются в срок" />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
        >
          {list.map((t) => (
            <GlassCard key={t.id} variant="g" style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>{t.title}</Text>
                  <Text style={[styles.taskMeta, { color: colors.textTertiary }]} numberOfLines={1}>{t.projectName} · {t.status}</Text>
                </View>
                <Pill label={`+${daysOverdue(t.deadline!)} дн`} tone="neg" />
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaTxt, { color: colors.textSecondary }]}>срок {new Date(t.deadline!).toLocaleDateString(appLocale())}</Text>
                {t.assignees.length > 0 && <Text style={[styles.metaTxt, { color: colors.textSecondary }]} numberOfLines={1}>{t.assignees.join(', ')}</Text>}
                {t.priority !== 'Обычный' && <Pill label={t.priority} tone={t.priority === 'Высокий' ? 'neg' : 'default'} />}
              </View>
              <View style={styles.actionsRow}>
                <Button label="Открыть проект" variant="accent" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('ProjectDetail', { id: t.projectId })} />
                <Button label="Перенести срок" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => openReschedule(t)} />
              </View>
            </GlassCard>
          ))}
          <Text style={[styles.note, { color: colors.textTertiary }]}>Массовый перенос сроков и переназначение — в веб-версии.</Text>
        </ScrollView>
      )}

      <AppBottomSheet ref={sheetRef} snapPoints={['40%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Перенести срок</Text>
        {rescheduleTarget && <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{rescheduleTarget.title}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <EntityField label="Новый срок" value={newDate} onChangeText={setNewDate} placeholder="ГГГГ-ММ-ДД" help="формат: ГГГГ-ММ-ДД" />
          <Button label="Сохранить" variant="accent" fullWidth loading={saving} disabled={!newDate.trim()} onPress={submitReschedule} />
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
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  chipsWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  card: { borderRadius: 22 },
  cardContent: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  taskTitle: { fontSize: 15, fontFamily: fonts.semibold },
  taskMeta: { fontSize: 11.5, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  metaTxt: { fontSize: 11.5 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  note: { fontSize: 11.5, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
});
