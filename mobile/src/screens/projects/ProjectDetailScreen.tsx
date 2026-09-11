import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchProject, fetchProjectActivity, updateProject, archiveProject, moveProjectToTrash, Project, ProjectStatus, TaskStatus, ProjectActivityEntry } from '../../api/projects';
import { EntityComment } from '../../api/comments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, showToast, CustomFieldsSection, CommentsSection } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Segmented, Pill } from '../../components/mg';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectDetail'>;

const STATUS_TONE: Record<ProjectStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  'Новый': 'acc', 'В работе': 'warn', 'На проверке': 'default', 'Заморожен': 'neg', 'Закрыт': 'pos',
};
const TASK_STATUS_TONE: Record<TaskStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  'К выполнению': 'default', 'В работе': 'acc', 'На проверке': 'warn', 'Заблокировано': 'neg', 'Отложено': 'warn', 'Готово': 'pos',
};
const FILE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline', link: 'link-outline', drive: 'logo-google', dropbox: 'logo-dropbox',
};
const ACTIVITY_LABEL: Record<string, string> = {
  create: 'Проект создан', update: 'Изменения', status_change: 'Статус изменён',
  archive: 'Отправлен в архив', unarchive: 'Возвращён из архива', delete: 'Удалён', restore: 'Восстановлен',
};
const ACTIVITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  create: 'flash-outline', update: 'create-outline', status_change: 'swap-horizontal-outline',
  archive: 'archive-outline', unarchive: 'arrow-undo-outline', delete: 'trash-outline', restore: 'refresh-outline',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} д назад`;
}

function describeActivity(a: ProjectActivityEntry): string {
  const p = a.payload;
  if (a.action === 'status_change' && p?.from && p?.to) return `${p.from} → ${p.to}`;
  if (a.action === 'update' && Array.isArray(p?.changes) && p.changes.length > 0) {
    return p.changes.map((c: any) => c.field).join(', ');
  }
  return a.actorName || a.actorEmail || '—';
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ProjectDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [project, setProject] = useState<Project | null>(null);
  const [activity, setActivity] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'tasks' | 'files' | 'chat'>('info');

  useEffect(() => {
    fetchProject(id)
      .then((data) => {
        setProject(data);
        fetchProjectActivity(id).then(setActivity).catch(() => {});
      })
      .catch(() => showToast('Не удалось загрузить проект', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCustomFieldUpdate = async (key: string, value: any) => {
    if (!project) return;
    const nextCustomFields = { ...(project.customFields || {}), [key]: value };
    const updated = await updateProject({ id: project.id, customFields: nextCustomFields });
    setProject(updated);
  };

  const handleCommentsSave = async (nextComments: EntityComment[]) => {
    if (!project) return;
    const updated = await updateProject({ id: project.id, comments: nextComments });
    setProject(updated);
  };

  const handleArchive = () => {
    if (!project) return;
    navigation.goBack();
    archiveProject(project.id).then(() => showToast('Проект отправлен в архив', { variant: 'success' })).catch(() => showToast('Не удалось архивировать проект', { variant: 'error' }));
  };

  const handleTrash = () => {
    if (!project) return;
    navigation.goBack();
    moveProjectToTrash(project.id).then(() => showToast('Проект перемещён в корзину', { variant: 'success' })).catch(() => showToast('Не удалось удалить проект', { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Проект не найден</Text>
      </View>
    );
  }

  const properties = [
    { label: 'Сумма', value: formatMoney(project.amount, project.currency), icon: 'cash-outline' as const, iconColor: colors.success },
    project.category && { label: 'Категория', value: project.category, icon: 'pricetag-outline' as const, iconColor: colors.secondary },
    { label: 'Создан', value: fmtDate(project.createdAt), icon: 'calendar-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Проекты</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleArchive}>
              <Ionicons name="archive-outline" size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleTrash}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={project.owner || project.name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{project.name}</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{project.owner || 'Без ответственного'}</Text>
            <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Pill label={project.status} tone={STATUS_TONE[project.status]} />
            </View>
          </View>
        </View>

        {project.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {project.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Segmented
            options={[
              { key: 'info', label: 'Свойства' },
              { key: 'tasks', label: 'Задачи' },
              { key: 'files', label: 'Файлы' },
              { key: 'chat', label: 'Обсуждение' },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </View>

        {tab === 'info' && <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => (
            <View key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]}>
              <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                <Ionicons name={p.icon} size={16} color={p.iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.value}</Text>
              </View>
            </View>
          ))}
        </GlassCard>

        {project.description ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ОПИСАНИЕ</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.desc, { color: colors.text }]}>{project.description}</Text>
            </GlassCard>
          </>
        ) : null}

        {activity.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ИСТОРИЯ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {activity.map((a, i) => (
                <View key={a.id} style={[styles.timelineRow, { borderBottomColor: colors.line3, borderBottomWidth: i < activity.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.timelineIco, { backgroundColor: colors.ink }]}>
                    <Ionicons name={ACTIVITY_ICON[a.action] || 'ellipse-outline'} size={14} color={colors.onInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.timelineTitle, { color: colors.text }]}>{ACTIVITY_LABEL[a.action] || a.action}</Text>
                    <Text style={[styles.timelineSub, { color: colors.textSecondary }]} numberOfLines={2}>{describeActivity(a)}</Text>
                  </View>
                  <Text style={[styles.timelineTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relativeTime(a.createdAt)}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        <CustomFieldsSection entityType="project" values={project.customFields} onUpdate={handleCustomFieldUpdate} />
        </>}

        {tab === 'tasks' && (
          project.tasks.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Задач пока нет</Text>
            </GlassCard>
          ) : (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, paddingTop: 0 }]}>ЗАДАЧИ ({project.tasks.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ProjectTaskBoard', { id: project.id })}>
                <Text style={[styles.boardLink, { color: colors.secondary }]}>Доска →</Text>
              </TouchableOpacity>
            </View>
            <GlassCard variant="g2" style={styles.progressCard}>
              <View style={styles.progressHead}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Выполнено</Text>
                <Text style={[styles.progressPct, { color: colors.text, fontFamily: fonts.mono }]}>
                  {project.tasks.filter((t) => t.status === 'Готово').length} / {project.tasks.length}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                <View style={[styles.progressFill, { width: `${Math.round((project.tasks.filter((t) => t.status === 'Готово').length / project.tasks.length) * 100)}%`, backgroundColor: colors.success }]} />
              </View>
            </GlassCard>
            <GlassCard variant="g2" style={styles.listCard}>
              {project.tasks.map((t, i) => (
                <View key={t.id} style={[styles.taskRow, { borderBottomColor: colors.line3, borderBottomWidth: i < project.tasks.length - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>{t.title}</Text>
                    <View style={styles.taskMetaRow}>
                      {t.deadline && <Text style={[styles.taskMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{new Date(t.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</Text>}
                      {t.priority === 'Высокий' && <Text style={[styles.taskMeta, { color: '#cc2f47', fontFamily: fonts.semibold }]}>Высокий приоритет</Text>}
                      {t.assignees.length > 0 && <Text style={[styles.taskMeta, { color: colors.textTertiary }]} numberOfLines={1}>{t.assignees.join(', ')}</Text>}
                    </View>
                  </View>
                  <Pill label={t.status} tone={TASK_STATUS_TONE[t.status] || 'default'} />
                </View>
              ))}
            </GlassCard>
          </>
          )
        )}

        {tab === 'files' && (
          project.files.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Файлов пока нет</Text>
            </GlassCard>
          ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ФАЙЛЫ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {project.files.map((f, i) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < project.files.length - 1 ? 1 : 0 }]}
                  onPress={() => Linking.openURL(f.url)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.propIco, { backgroundColor: colors.info + '22' }]}>
                    <Ionicons name={FILE_ICON[f.provider] || 'document-outline'} size={16} color={colors.info} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{f.label}</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </GlassCard>
          </>
          )
        )}

        {tab === 'chat' && (
          <CommentsSection entries={project.comments} onSave={handleCommentsSave} />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3, lineHeight: 26 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  tagTxt: { fontSize: 11, fontFamily: fonts.medium },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  boardLink: { fontSize: 12, fontFamily: fonts.semibold },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  desc: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  taskTitle: { fontSize: 14, fontFamily: fonts.medium },
  taskMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3, flexWrap: 'wrap' },
  taskMeta: { fontSize: 11 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: 12, paddingHorizontal: spacing.lg },
  timelineIco: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineTitle: { fontSize: 13.5, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  timelineSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2, lineHeight: 16 },
  timelineTime: { fontSize: 11, flexShrink: 0 },
  progressCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xl, padding: spacing.md },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.6 },
  progressPct: { fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
});
