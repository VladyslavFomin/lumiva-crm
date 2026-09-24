import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  fetchCompany, deleteCompany, fetchCompanyAnalytics, fetchCompanyRelations, updateCompany,
  Company, CompanyAnalytics, CompanyRelatedContact, CompanyRelatedLead, CompanyRelatedProject, CompanyTaskSummary, CompanyTaskStatus,
} from '../../api/companies';
import { fetchAuditLog, AuditLogEntry } from '../../api/auditLog';
import { EntityComment } from '../../api/comments';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { countryName } from '../../utils/refData';
import { AvatarInitials, SkeletonList, showToast, CustomFieldsSection, ActivityFeed, CommentsSection } from '../../components/ui';
import { Chips, StatGrid2, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const TASK_STATUS_TONE: Record<CompanyTaskStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  todo: 'default', in_progress: 'acc', review: 'warn', done: 'pos', cancelled: 'neg',
};
const LEAD_STATUS_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc', in_progress: 'default', waiting: 'warn', won: 'pos', lost: 'neg',
};
const COMPANY_STATUS_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  active: 'pos', inactive: 'default', archived: 'warn',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'about' | 'contacts' | 'deals' | 'projects' | 'tasks' | 'hist';

export const CompanyDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const { id } = route.params;
  const TASK_STATUS_LABEL: Record<CompanyTaskStatus, string> = {
    todo: t('companyDetail.taskStatus.todo'), in_progress: t('companyDetail.taskStatus.in_progress'), review: t('companyDetail.taskStatus.review'), done: t('companyDetail.taskStatus.done'), cancelled: t('companyDetail.taskStatus.cancelled'),
  };
  const LEAD_STATUS_LABEL: Record<string, string> = {
    new: t('companyDetail.leadStatus.new'), in_progress: t('companyDetail.leadStatus.in_progress'), waiting: t('companyDetail.leadStatus.waiting'), won: t('companyDetail.leadStatus.won'), lost: t('companyDetail.leadStatus.lost'),
  };
  const COMPANY_STATUS_LABEL: Record<string, string> = { active: t('companyDetail.status.active'), inactive: t('companyDetail.status.inactive'), archived: t('companyDetail.status.archived') };
  const [company, setCompany] = useState<Company | null>(null);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [contacts, setContacts] = useState<CompanyRelatedContact[]>([]);
  const [leads, setLeads] = useState<CompanyRelatedLead[]>([]);
  const [projects, setProjects] = useState<CompanyRelatedProject[]>([]);
  const [tasks, setTasks] = useState<CompanyTaskSummary[]>([]);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('about');

  // Refetch on focus so edits saved in the edit modal show up immediately.
  useFocusEffect(useCallback(() => {
    fetchCompany(id)
      .then((data) => {
        setCompany(data);
        fetchCompanyAnalytics(id).then(setAnalytics).catch(() => {});
        fetchCompanyRelations(id).then((rel) => {
          setContacts(rel.contacts);
          setLeads(rel.leads);
          setProjects(rel.projects);
          setTasks(rel.tasks);
        }).catch(() => {});
        fetchAuditLog('company', id).then(setActivity).catch(() => {});
      })
      .catch(() => showToast(t('companyDetail.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const handleCustomFieldUpdate = async (key: string, value: any) => {
    if (!company) return;
    const nextCustomFields = { ...(company.customFields || {}), [key]: value };
    const updated = await updateCompany({ id: company.id, customFields: nextCustomFields });
    setCompany(updated);
  };

  const handleCommentsSave = async (nextComments: EntityComment[]) => {
    if (!company) return;
    const updated = await updateCompany({ id: company.id, comments: nextComments });
    setCompany(updated);
  };

  const handleDelete = () => {
    if (!company) return;
    navigation.goBack();
    deleteCompany(company.id).then(() => showToast(t('companyDetail.deletedToast'), { variant: 'success' })).catch(() => showToast(t('companyDetail.deleteError'), { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('companyDetail.notFound')}</Text>
      </View>
    );
  }

  const requisiteRows = [
    company.legalName && { label: t('companyDetail.req.legalName'), value: company.legalName },
    company.taxId && { label: t('companyDetail.req.taxId'), value: company.taxId },
    ...company.legalRequisites.map((r) => ({ label: r.type, value: r.value })),
    company.address && { label: t('companyDetail.req.address'), value: company.address },
    company.website && { label: t('companyDetail.req.website'), value: company.website },
  ].filter(Boolean) as { label: string; value: string }[];

  const contactProps = [
    company.phone && { label: t('companyDetail.prop.phone'), value: company.phone, icon: 'call-outline' as const, iconColor: colors.success, onPress: () => Linking.openURL(`tel:${company.phone}`) },
    company.email && { label: t('companyDetail.prop.email'), value: company.email, icon: 'mail-outline' as const, iconColor: colors.secondary, onPress: () => Linking.openURL(`mailto:${company.email}`) },
    (company.city || company.country) && { label: t('companyDetail.prop.city'), value: [company.city, countryName(company.country)].filter(Boolean).join(', '), icon: 'location-outline' as const, iconColor: colors.fg3 },
    company.type && { label: t('companyEdit.field.type'), value: t(`companyType.${company.type}`), icon: 'flag-outline' as const, iconColor: colors.fg3 },
    company.assignedTo && { label: t('contactDetail.prop.assignedTo'), value: company.assignedTo, icon: 'person-outline' as const, iconColor: colors.ink },
    company.size && { label: t('companyDetail.prop.size'), value: company.size, icon: 'people-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  const tabOptions = [
    { key: 'about', label: t('companyDetail.tab.about') },
    { key: 'contacts', label: `${t('companyDetail.tab.contacts')} ${contacts.length}` },
    { key: 'deals', label: `${t('companyDetail.tab.deals')} ${leads.length}` },
    { key: 'projects', label: `${t('companyDetail.tab.projects')} ${projects.length}` },
    { key: 'tasks', label: `${t('companyDetail.tab.tasks')} ${tasks.length}` },
    { key: 'hist', label: t('companyDetail.tab.history') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('clients.title')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('CompanyEdit', { id: company.id })}>
              <Ionicons name="create-outline" size={17} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={company.name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{company.name}</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {[company.industry, company.city, company.size].filter(Boolean).join(' · ')}
            </Text>
            {company.status && (
              <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Pill label={COMPANY_STATUS_LABEL[company.status] || company.status} tone={COMPANY_STATUS_TONE[company.status] || 'default'} />
              </View>
            )}
          </View>
        </View>

        {company.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {company.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Chips options={tabOptions} activeKey={tab} onChange={(k) => setTab(k as Tab)} />
        </View>

        {tab === 'about' && <>
          {analytics && (
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <StatGrid2 items={[
                { label: t('companyDetail.stat.revenue'), value: fmt(analytics.metrics.totalRevenueConverted, undefined, { short: true }) },
                { label: t('companyDetail.stat.potential'), value: fmt(analytics.metrics.potentialRevenueConverted, undefined, { short: true }) },
              ]} />
            </View>
          )}

          {contactProps.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('companyDetail.section.contactInfo')}</Text>
              <GlassCard variant="g2" style={styles.listCard}>
                {contactProps.map((p, i) => {
                  const Row = p.onPress ? TouchableOpacity : View;
                  return (
                    <Row key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < contactProps.length - 1 ? 1 : 0 }]} onPress={p.onPress} activeOpacity={0.7}>
                      <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                        <Ionicons name={p.icon} size={16} color={p.iconColor} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                        <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.value}</Text>
                      </View>
                    </Row>
                  );
                })}
              </GlassCard>
            </>
          )}

          {requisiteRows.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('companyDetail.section.requisites')}</Text>
              <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, gap: 10 }]}>
                {requisiteRows.map((r, i) => (
                  <View key={i} style={styles.kvRow}>
                    <Text style={[styles.kvKey, { color: colors.textSecondary }]} numberOfLines={1}>{r.label}</Text>
                    <Text style={[styles.kvVal, { color: colors.text }]} numberOfLines={1}>{r.value}</Text>
                  </View>
                ))}
              </GlassCard>
            </>
          )}

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('companyDetail.section.terms')}</Text>
          <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, gap: 10 }]}>
            <View style={styles.kvRow}>
              <Text style={[styles.kvKey, { color: colors.textSecondary }]}>{t('companyDetail.terms.assignedTo')}</Text>
              <Text style={[styles.kvVal, { color: colors.text }]} numberOfLines={1}>{company.assignedTo || '—'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.kvKey, { color: colors.textSecondary }]}>{t('companyDetail.terms.clientSince')}</Text>
              <Text style={[styles.kvVal, { color: colors.text }]}>{fmtDate(company.createdAt)}</Text>
            </View>
          </GlassCard>

          {company.description ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('companyDetail.section.description')}</Text>
              <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
                <Text style={[styles.notes, { color: colors.text }]}>{company.description}</Text>
              </GlassCard>
            </>
          ) : null}

          <CustomFieldsSection entityType="company" values={company.customFields} onUpdate={handleCustomFieldUpdate} />
          <CommentsSection entries={company.comments} onSave={handleCommentsSave} />
        </>}

        {tab === 'contacts' && (
          contacts.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('companyDetail.empty.contacts')}</Text>
            </GlassCard>
          ) : (
            <GlassCard variant="g2" style={styles.listCard}>
              {contacts.map((c, i) => {
                const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || t('common.noName');
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < contacts.length - 1 ? 1 : 0 }]}
                    onPress={() => navigation.navigate('ContactDetail', { id: c.id })}
                    activeOpacity={0.7}
                  >
                    <AvatarInitials name={name} size={32} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                      {c.position && <Text style={[styles.propLabel, { color: colors.textSecondary, marginTop: 1 }]}>{c.position}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </GlassCard>
          )
        )}

        {tab === 'deals' && (
          leads.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('companyDetail.empty.deals')}</Text>
            </GlassCard>
          ) : (
            <GlassCard variant="g2" style={styles.listCard}>
              {leads.map((l, i) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < leads.length - 1 ? 1 : 0 }]}
                  onPress={() => navigation.navigate('Leads', { screen: 'LeadDetail', params: { id: l.id } })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{l.name || t('common.noName')}</Text>
                    <View style={{ marginTop: 3, alignSelf: 'flex-start' }}>
                      <Pill label={LEAD_STATUS_LABEL[l.status] || l.status} tone={LEAD_STATUS_TONE[l.status] || 'default'} />
                    </View>
                  </View>
                  <Text style={[styles.propValue, { color: colors.text }]}>{fmt(toDisplay(l.amount, l.currency), undefined, { short: true })}</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          )
        )}

        {tab === 'projects' && (
          projects.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('companyDetail.empty.projects')}</Text>
            </GlassCard>
          ) : (
            <GlassCard variant="g2" style={styles.listCard}>
              {projects.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < projects.length - 1 ? 1 : 0 }]}
                  onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: p.id } })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.propLabel, { color: colors.textSecondary, marginTop: 2 }]}>{p.status} · {p.tasksCount} {t('companyDetail.tasksCount')}</Text>
                  </View>
                  <Text style={[styles.propValue, { color: colors.text }]}>{fmt(toDisplay(p.amount, p.currency), undefined, { short: true })}</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          )
        )}

        {tab === 'tasks' && (
          tasks.length === 0 ? (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('companyDetail.empty.tasks')}</Text>
            </GlassCard>
          ) : (
            <>
              <GlassCard variant="g2" style={styles.listCard}>
                {tasks.map((task, i) => (
                  <View key={task.id} style={[styles.taskRow, { borderBottomColor: colors.line3, borderBottomWidth: i < tasks.length - 1 ? 1 : 0 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={2}>{task.title}</Text>
                      {(task.assignedTo || task.dueDate) && (
                        <Text style={[styles.propLabel, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
                          {[task.assignedTo, task.dueDate ? new Date(task.dueDate).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' }) : null].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Pill label={TASK_STATUS_LABEL[task.status as CompanyTaskStatus] || task.status} tone={TASK_STATUS_TONE[task.status as CompanyTaskStatus] || 'default'} />
                  </View>
                ))}
              </GlassCard>
              <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => navigation.navigate('CoTasks')} activeOpacity={0.7}>
                <Ionicons name="grid-outline" size={14} color={colors.text} />
                <Text style={[styles.linkBtnTxt, { color: colors.text }]}>{t('companyDetail.tasksBoard')}</Text>
              </TouchableOpacity>
            </>
          )
        )}

        {tab === 'hist' && <ActivityFeed entries={activity} />}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  tagTxt: { fontSize: 11, fontFamily: fonts.medium },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  notes: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  kvKey: { fontSize: 13, fontFamily: fonts.regular },
  kvVal: { fontSize: 13, fontFamily: fonts.medium, flexShrink: 1, textAlign: 'right' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingVertical: 11, borderRadius: radius.lg },
  linkBtnTxt: { fontSize: 13, fontFamily: fonts.medium },
});
