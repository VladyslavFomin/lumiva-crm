import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchProject, fetchProjectActivity, updateProject, archiveProject, moveProjectToTrash, Project, ProjectStatus, TaskStatus, ProjectActivityEntry } from '../../api/projects';
import { EntityComment } from '../../api/comments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AvatarInitials, SkeletonList, showToast, CustomFieldsSection, CommentsSection } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Segmented, Pill } from '../../components/mg';
import { appLocale } from '../../i18n/format';
import { describeChanges } from '../../utils/changeFormat';
import { fetchCustomFieldDefs, CustomFieldDef } from '../../api/customFields';
import { fetchCompany } from '../../api/companies';
import { fetchContact } from '../../api/contacts';
import { fetchLead } from '../../api/leads';

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
const ACTIVITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  create: 'flash-outline', update: 'create-outline', status_change: 'swap-horizontal-outline',
  archive: 'archive-outline', unarchive: 'arrow-undo-outline', delete: 'trash-outline', restore: 'refresh-outline',
};

function relativeTime(dateStr: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('common.now');
  if (min < 60) return `${min} ${t('projectDetail.timeMinAgo')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('projectDetail.timeHourAgo')}`;
  return `${Math.floor(hr / 24)} ${t('projectDetail.timeDayAgo')}`;
}

function describeActivity(a: ProjectActivityEntry, t: (k: string) => string, defs: CustomFieldDef[]): string {
  const p = a.payload;
  if (a.action === 'status_change' && p?.from && p?.to) return `${p.from} → ${p.to}`;
  if (a.action === 'update' && Array.isArray(p?.changes) && p.changes.length > 0) {
    // Real "was → became" values, custom fields labelled from the tenant schema (a date range reads as a range, not an object).
    const lines = describeChanges(p.changes, t, defs);
    if (lines.length) return lines.join('\n');
  }
  return a.actorName || a.actorEmail || '—';
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(appLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ProjectDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const ACTIVITY_LABEL: Record<string, string> = {
    create: t('projectDetail.activity.create'), update: t('projectDetail.activity.update'), status_change: t('projectDetail.activity.statusChange'),
    archive: t('projectDetail.activity.archive'), unarchive: t('projectDetail.activity.unarchive'), delete: t('projectDetail.activity.delete'), restore: t('projectDetail.activity.restore'),
  };
  const [project, setProject] = useState<Project | null>(null);
  const [activity, setActivity] = useState<ProjectActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'tasks' | 'files' | 'chat'>('info');

  const [cfDefs, setCfDefs] = useState<CustomFieldDef[]>([]);
  React.useEffect(() => { fetchCustomFieldDefs('project').then(setCfDefs).catch(() => {}); }, []);
  const [linked, setLinked] = useState<{ lead?: string; company?: string; contact?: string }>({});
  const [linkedInfo, setLinkedInfo] = useState<{ leadEmail?: string; leadPhone?: string; companyEmail?: string; companyPhone?: string }>({});

  // Refetch on every focus: the edit screen is a modal on top of this one, and the values shown here must reflect what was just saved.
  useFocusEffect(useCallback(() => {
    let alive = true;
    fetchProject(id)
      .then((data) => {
        if (!alive) return;
        setProject(data);
        fetchProjectActivity(id).then((a) => alive && setActivity(a)).catch(() => {});
        // Names of the linked records — one small request each, only for links that exist.
        if (data.leadId) fetchLead(data.leadId).then((l) => { if (!alive) return; setLinked((x) => ({ ...x, lead: l.name || l.email || l.phone })); setLinkedInfo((x) => ({ ...x, leadEmail: l.email || undefined, leadPhone: l.phone || undefined })); }).catch(() => {});
        else setLinked((x) => ({ ...x, lead: undefined }));
        if (data.companyId) fetchCompany(data.companyId).then((c) => { if (!alive) return; setLinked((x) => ({ ...x, company: c.name })); setLinkedInfo((x) => ({ ...x, companyEmail: c.email || undefined, companyPhone: c.phone || undefined })); }).catch(() => {});
        else setLinked((x) => ({ ...x, company: undefined }));
        if (data.contactId) fetchContact(data.contactId).then((c) => alive && setLinked((x) => ({ ...x, contact: c.fullName }))).catch(() => {});
        else setLinked((x) => ({ ...x, contact: undefined }));
      })
      .catch(() => alive && showToast(t('projectDetail.loadError'), { variant: 'error' }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

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
    archiveProject(project.id).then(() => showToast(t('projectDetail.archivedToast'), { variant: 'success' })).catch(() => showToast(t('projectDetail.archiveError'), { variant: 'error' }));
  };

  const handleTrash = () => {
    if (!project) return;
    navigation.goBack();
    moveProjectToTrash(project.id).then(() => showToast(t('projectDetail.trashedToast'), { variant: 'success' })).catch(() => showToast(t('projectDetail.trashError'), { variant: 'error' }));
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
        <Text style={{ color: colors.text }}>{t('projectDetail.notFound')}</Text>
      </View>
    );
  }

  const notes = project.customFields?.projectNotes ? String(project.customFields.projectNotes) : '';
  const priority = project.customFields?.priority ? String(project.customFields.priority) : '';
  type Prop = { label: string; value: string; icon: any; iconColor: string; onPress?: () => void };
  const properties = [
    { label: t('projectDetail.prop.amount'), value: formatMoney(project.amount, project.currency), icon: 'cash-outline' as const, iconColor: colors.success },
    project.category && { label: t('projectDetail.prop.category'), value: project.category, icon: 'pricetag-outline' as const, iconColor: colors.secondary },
    priority && { label: t('projectDetail.prop.priority'), value: priority, icon: 'flag-outline' as const, iconColor: colors.warning },
    project.owner && { label: t('projectDetail.prop.owner'), value: project.owner, icon: 'person-outline' as const, iconColor: colors.info },
    project.leadId && { label: t('projectDetail.prop.lead'), value: linked.lead || '…', icon: 'flash-outline' as const, iconColor: colors.accent, onPress: () => navigation.navigate('Leads' as never, { screen: 'LeadDetail', params: { id: project.leadId } } as never) },
    project.companyId && { label: t('projectDetail.prop.company'), value: linked.company || '…', icon: 'business-outline' as const, iconColor: colors.info, onPress: () => navigation.navigate('Clients' as never, { screen: 'CompanyDetail', params: { id: project.companyId } } as never) },
    project.contactId && { label: t('projectDetail.prop.contact'), value: linked.contact || '…', icon: 'person-circle-outline' as const, iconColor: colors.info, onPress: () => navigation.navigate('Clients' as never, { screen: 'ContactDetail', params: { id: project.contactId } } as never) },
    project.briefFileUrl && { label: t('projectDetail.prop.brief'), value: project.briefFileName || project.briefFileUrl, icon: 'document-attach-outline' as const, iconColor: colors.info, onPress: () => Linking.openURL(project.briefFileUrl!) },
    project.relatedProjectIds.length > 0 && { label: t('projectDetail.prop.related'), value: `${project.relatedProjectIds.length}`, icon: 'git-network-outline' as const, iconColor: colors.fg3 },
    { label: t('projectDetail.prop.created'), value: fmtDate(project.createdAt), icon: 'calendar-outline' as const, iconColor: colors.fg3 },
    project.updatedAt && { label: t('projectDetail.prop.updated'), value: fmtDate(project.updatedAt), icon: 'refresh-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as Prop[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('tabs.projects')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ProjectEdit', { id: project.id })}>
              <Ionicons name="create-outline" size={17} color={colors.text} />
            </TouchableOpacity>
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
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{project.owner || t('common.unassigned')}</Text>
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
              { key: 'info', label: t('projectDetail.tab.info') },
              { key: 'tasks', label: t('projectDetail.tab.tasks') },
              { key: 'files', label: t('projectDetail.tab.files') },
              { key: 'chat', label: t('projectDetail.tab.chat') },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </View>

        {tab === 'info' && <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('projectDetail.section.properties')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => {
            const Row: any = p.onPress ? TouchableOpacity : View;
            return (
            <Row key={i} onPress={p.onPress} activeOpacity={0.7} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]}>
              <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                <Ionicons name={p.icon} size={16} color={p.iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.value}</Text>
              </View>
              {p.onPress && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
            </Row>
            );
          })}
        </GlassCard>

        {project.description ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('projectDetail.section.description')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.desc, { color: colors.text }]}>{project.description}</Text>
            </GlassCard>
          </>
        ) : null}

        {notes ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('projectDetail.section.notes')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.desc, { color: colors.text }]}>{notes}</Text>
            </GlassCard>
          </>
        ) : null}

        {activity.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('projectDetail.section.history')}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {activity.map((a, i) => (
                <View key={a.id} style={[styles.timelineRow, { borderBottomColor: colors.line3, borderBottomWidth: i < activity.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.timelineIco, { backgroundColor: colors.ink }]}>
                    <Ionicons name={ACTIVITY_ICON[a.action] || 'ellipse-outline'} size={14} color={colors.onInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.timelineTitle, { color: colors.text }]}>{ACTIVITY_LABEL[a.action] || a.action}</Text>
                    <Text style={[styles.timelineSub, { color: colors.textSecondary }]} numberOfLines={5}>{describeActivity(a, t, cfDefs)}</Text>
                  </View>
                  <Text style={[styles.timelineTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relativeTime(a.createdAt, t)}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        <CustomFieldsSection
          entityType="project"
          values={project.customFields}
          onUpdate={handleCustomFieldUpdate}
          // Same fallbacks as the website: an email/phone/url field with no value of its own shows the linked lead / company / first file.
          autoValue={(f) => {
            const src = f.meta?.source;
            if (f.type === 'email') return src === 'company' ? linkedInfo.companyEmail : linkedInfo.leadEmail || linkedInfo.companyEmail;
            if (f.type === 'phone') return src === 'company' ? linkedInfo.companyPhone : linkedInfo.leadPhone || linkedInfo.companyPhone;
            if (f.type === 'url') return project.files[0]?.url;
            return undefined;
          }}
        />
        </>}

        {tab === 'tasks' && (
          project.tasks.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('projectDetail.noTasks')}</Text>
            </GlassCard>
          ) : (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, paddingTop: 0 }]}>{t('projectDetail.tasksCount')} ({project.tasks.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ProjectTaskBoard', { id: project.id })}>
                <Text style={[styles.boardLink, { color: colors.secondary }]}>{t('projectDetail.boardLink')}</Text>
              </TouchableOpacity>
            </View>
            <GlassCard variant="g2" style={styles.progressCard}>
              <View style={styles.progressHead}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{t('projectDetail.progressDone')}</Text>
                <Text style={[styles.progressPct, { color: colors.text, fontFamily: fonts.mono }]}>
                  {project.tasks.filter((t) => t.status === 'Готово').length} / {project.tasks.length}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                <View style={[styles.progressFill, { width: `${Math.round((project.tasks.filter((t) => t.status === 'Готово').length / project.tasks.length) * 100)}%`, backgroundColor: colors.success }]} />
              </View>
            </GlassCard>
            <GlassCard variant="g2" style={styles.listCard}>
              {project.tasks.map((task, i) => (
                <View key={task.id} style={[styles.taskRow, { borderBottomColor: colors.line3, borderBottomWidth: i < project.tasks.length - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>{task.title}</Text>
                    <View style={styles.taskMetaRow}>
                      {task.deadline && <Text style={[styles.taskMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{new Date(task.deadline).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })}</Text>}
                      {task.priority === 'Высокий' && <Text style={[styles.taskMeta, { color: '#cc2f47', fontFamily: fonts.semibold }]}>{t('projectDetail.highPriority')}</Text>}
                      {task.assignees.length > 0 && <Text style={[styles.taskMeta, { color: colors.textTertiary }]} numberOfLines={1}>{task.assignees.join(', ')}</Text>}
                    </View>
                  </View>
                  <Pill label={task.status} tone={TASK_STATUS_TONE[task.status] || 'default'} />
                </View>
              ))}
            </GlassCard>
          </>
          )
        )}

        {tab === 'files' && (
          project.files.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('projectDetail.noFiles')}</Text>
            </GlassCard>
          ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('projectDetail.section.files')}</Text>
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
