import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Linking, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { fetchLead, updateLead, fetchLeadHistory, convertLead, Lead, LeadStatusCode, LeadActivityEntry, LeadTask } from '../../api/leads';
import { fetchContact } from '../../api/contacts';
import { fetchCompany } from '../../api/companies';
import { fetchSalesByLead, Sale } from '../../api/sales';
import { EntityComment } from '../../api/comments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { countryName } from '../../utils/refData';
import { AvatarInitials, SegmentedProgress, Button, SkeletonList, showToast, CustomFieldsSection, CommentsSection, AppBottomSheet, AppBottomSheetRef } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Segmented, Pill } from '../../components/mg';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadDetail'>;

const STATUS_TONE: Record<LeadStatusCode, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc',
  in_progress: 'default',
  waiting: 'warn',
  won: 'pos',
  lost: 'neg',
};

const STATUS_TO_STAGE: Record<LeadStatusCode, number> = { new: 0, in_progress: 1, waiting: 2, won: 4, lost: 4 };

const ACTIVITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  created: 'flash-outline',
  status_changed: 'swap-horizontal-outline',
  assignee_changed: 'person-outline',
  comment: 'chatbubble-outline',
};

function relativeTime(dateStr: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('common.now');
  if (min < 60) return `${min} ${t('leadDetail.timeMinAgo')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('leadDetail.timeHourAgo')}`;
  return `${Math.floor(hr / 24)} ${t('leadDetail.timeDayAgo')}`;
}

export const LeadDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const STATUS_LABEL: Record<LeadStatusCode, string> = {
    new: t('leadDetailStatus.new'), in_progress: t('leadDetailStatus.in_progress'), waiting: t('leadDetailStatus.waiting'), won: t('leadDetailStatus.won'), lost: t('leadDetailStatus.lost'),
  };
  const PIPELINE_STAGES = [t('leadDetail.stage.new'), t('leadDetail.stage.contacted'), t('leadDetail.stage.qualified'), t('leadDetail.stage.presentation'), t('leadDetail.stage.payment')];
  const ACTIVITY_LABEL: Record<string, string> = {
    created: t('leadDetail.activity.created'),
    status_changed: t('leadDetail.activity.statusChanged'),
    assignee_changed: t('leadDetail.activity.assigneeChanged'),
    comment: t('leadDetail.activity.comment'),
  };
  const navigation = useNavigation<any>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactName, setContactName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [history, setHistory] = useState<LeadActivityEntry[]>([]);
  const [tab, setTab] = useState<'info' | 'tasks' | 'fields' | 'history'>('info');
  const convertSheetRef = useRef<AppBottomSheetRef>(null);
  const statusSheetRef = useRef<AppBottomSheetRef>(null);
  const [convertCompanyName, setConvertCompanyName] = useState('');
  const [convertMarkWon, setConvertMarkWon] = useState(false);
  const [converting, setConverting] = useState(false);

  // Refetch on focus so edits saved in the edit modal show up immediately.
  useFocusEffect(useCallback(() => {
    fetchLead(id)
      .then((data) => {
        setLead(data);
        if (data.contactId) fetchContact(data.contactId).then((c) => setContactName(c.fullName || null)).catch(() => {});
        if (data.companyId) fetchCompany(data.companyId).then((c) => setCompanyName(c.name || null)).catch(() => {});
        fetchSalesByLead(id).then(setSales).catch(() => {});
        fetchLeadHistory(id).then(setHistory).catch(() => {});
      })
      .catch(() => showToast(t('leadDetail.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const handleCustomFieldUpdate = useCallback(async (key: string, value: any) => {
    if (!lead) return;
    const nextCustomFields = { ...(lead.customFields || {}), [key]: value };
    const updated = await updateLead({ id: lead.id, customFields: nextCustomFields });
    setLead(updated);
  }, [lead]);

  const handleCommentsSave = useCallback(async (nextComments: EntityComment[]) => {
    if (!lead) return;
    const updated = await updateLead({ id: lead.id, comments: nextComments });
    setLead(updated);
  }, [lead]);

  const toggleTask = useCallback(async (task: LeadTask) => {
    if (!lead) return;
    const nextTasks = lead.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
    setLead({ ...lead, tasks: nextTasks });
    try {
      await updateLead({ id: lead.id, tasks: nextTasks });
    } catch {
      setLead((prev) => (prev ? { ...prev, tasks: lead.tasks } : prev));
      showToast(t('leadDetail.checklistError'), { variant: 'error' });
    }
  }, [lead]);

  const handleConvert = useCallback(async () => {
    if (!lead) return;
    setConverting(true);
    try {
      const result = await convertLead(lead.id, { companyName: convertCompanyName.trim() || undefined, markWon: convertMarkWon });
      setLead(result.lead);
      convertSheetRef.current?.close();
      const parts = [
        result.contactCreated ? t('leadDetail.convert.contactCreated') : t('leadDetail.convert.contactLinked'),
        result.company ? (result.companyCreated ? t('leadDetail.convert.companyCreated') : t('leadDetail.convert.companyLinked')) : null,
      ].filter(Boolean);
      showToast(parts.join(', '), { variant: 'success' });
      navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: result.contact.id } });
    } catch (e: any) {
      showToast(e?.response?.data?.message || t('leadDetail.convertError'), { variant: 'error' });
    } finally {
      setConverting(false);
    }
  }, [lead, convertCompanyName, convertMarkWon, navigation]);

  const handleStatusUpdate = useCallback(async (newStatus: LeadStatusCode) => {
    if (!lead || lead.status === newStatus) {
      statusSheetRef.current?.close();
      return;
    }
    setSaving(true);
    try {
      const updated = await updateLead({ id: lead.id, status: newStatus });
      setLead(updated);
      statusSheetRef.current?.close();
      showToast(newStatus === 'won' ? t('leadDetail.dealClosed') : t('leadDetail.statusUpdated'), { variant: 'success' });
    } catch {
      showToast(t('leadDetail.statusError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [lead]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={5} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('leadDetail.notFound')}</Text>
      </View>
    );
  }

  const stageIdx = STATUS_TO_STAGE[lead.status];
  const name = lead.name || t('common.noName');

  // Matches `mglass-leads.jsx`'s `LeadDetail` "Действия" grid exactly: Позвонить/Письмо/
  // Конвертировать/Сменить статус. Each still ends in a real action or a toast explaining why
  // not (missing phone/email), never a silent no-op.
  const actions = [
    { label: t('leadDetail.action.call'), icon: 'call-outline' as const, accent: true, onPress: () => lead.phone ? Linking.openURL(`tel:${lead.phone}`) : showToast(t('leadDetail.noPhone')) },
    { label: t('leadDetail.action.email'), icon: 'mail-outline' as const, onPress: () => lead.email ? Linking.openURL(`mailto:${lead.email}`) : showToast(t('leadDetail.noEmail')) },
    { label: t('leadDetail.action.convert'), icon: 'person-add-outline' as const, onPress: () => convertSheetRef.current?.snapToIndex(0) },
    { label: t('leadDetail.action.changeStatus'), icon: 'flag-outline' as const, onPress: () => statusSheetRef.current?.snapToIndex(0) },
  ];

  const properties = [
    lead.phone && { label: t('leadDetail.prop.phone'), value: lead.phone, iconColor: colors.success, icon: 'call-outline' as const },
    lead.email && { label: t('leadDetail.prop.email'), value: lead.email, iconColor: colors.secondary, icon: 'mail-outline' as const },
    lead.country && { label: t('leadDetail.prop.country'), value: countryName(lead.country), iconColor: colors.fg3, icon: 'globe-outline' as const },
    lead.companyId && {
      label: t('leadDetail.prop.company'), value: companyName || `#${lead.companyId.slice(0, 8)}`, iconColor: colors.secondary, icon: 'business-outline' as const,
      onPress: () => navigation.navigate('Clients', { screen: 'CompanyDetail', params: { id: lead.companyId } }),
    },
    lead.contactId && {
      label: t('leadDetail.prop.contact'), value: contactName || `#${lead.contactId.slice(0, 8)}`, iconColor: colors.info, icon: 'person-circle-outline' as const,
      onPress: () => navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: lead.contactId } }),
    },
    lead.assignedToList.length > 0 && { label: lead.assignedToList.length > 1 ? t('leadDetail.prop.assignees') : t('leadDetail.prop.manager'), value: lead.assignedToList.join(', '), iconColor: colors.ink, icon: 'person-outline' as const },
    lead.channel && { label: t('leadDetail.prop.source'), value: lead.channel, iconColor: colors.warning, icon: 'flash-outline' as const },
  ].filter(Boolean) as { label: string; value: string; iconColor: string; icon: any; onPress?: () => void }[];

  const utm = [
    ['utm_source', lead.utm.source],
    ['utm_medium', lead.utm.medium],
    ['utm_campaign', lead.utm.campaign],
    ['utm_content', lead.utm.content],
    ['utm_term', lead.utm.term],
  ].filter(([, v]) => v) as [string, string][];

  const note: string | undefined = typeof lead.meta?.note === 'string' && lead.meta.note.trim() ? lead.meta.note.trim() : undefined;

  const timeline = history.length > 0
    ? history.map((a) => ({
        icon: ACTIVITY_ICON[a.type] || 'ellipse-outline',
        color: a.type === 'status_changed' ? colors.info : a.type === 'comment' ? colors.secondary : colors.ink,
        title: ACTIVITY_LABEL[a.type] || a.type,
        sub: a.comment || [a.fromValue, a.toValue].filter(Boolean).join(' → ') || '—',
        time: relativeTime(a.createdAt, t),
      }))
    : [
        { icon: 'flash-outline' as const, color: colors.ink, title: t('leadDetail.activity.created'), sub: `${t('leadDetail.createdSource')}: ${lead.channel || t('leadDetail.createdDefaultChannel')}`, time: relativeTime(lead.createdAt, t) },
      ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text }]}>{t('tabs.leads')}</Text>
          </TouchableOpacity>
          <View style={styles.navActions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('LeadEdit', { id: lead.id })}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={name} size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{name}</Text>
            {(lead.country || lead.channel) && (
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{[lead.channel, countryName(lead.country)].filter(Boolean).join(' · ')}</Text>
            )}
            <View style={styles.heroTags}>
              <Pill label={STATUS_LABEL[lead.status]} tone={STATUS_TONE[lead.status]} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Segmented
            options={[
              { key: 'info', label: t('leadDetail.tab.overview') },
              { key: 'tasks', label: t('leadDetail.tab.steps') },
              { key: 'fields', label: t('leadDetail.tab.fields') },
              { key: 'history', label: t('leadDetail.tab.history') },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </View>

        {tab === 'info' && <>
        <GlassCard variant="g" style={styles.actionsCard} contentStyle={{ padding: spacing.lg }}>
          <View style={styles.actionsHead}>
            <Ionicons name="sparkles-outline" size={16} color={colors.text} />
            <Text style={[styles.actionsTitle, { color: colors.text }]}>{t('leadDetail.actionsTitle')}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {actions.map((a, i) => (
              <Button
                key={i}
                label={a.label}
                icon={a.icon}
                variant={a.accent ? 'accent' : 'secondary'}
                onPress={a.onPress}
                style={styles.actionBtn}
              />
            ))}
          </View>
          <Text style={[styles.actionsNote, { color: colors.textTertiary }]}>{t('leadDetail.convertNote')}</Text>
        </GlassCard>

        <GlassCard variant="g" style={styles.amountCard} contentStyle={styles.amountCardRow}>
          {lead.amount > 0 && (
            <>
              <View style={styles.amountItem}>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>{t('leadDetail.kicker.amount')}</Text>
                <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1}>{formatMoney(lead.amount, lead.currency)}</Text>
              </View>
              <View style={[styles.amountDiv, { backgroundColor: colors.separator }]} />
            </>
          )}
          <View style={styles.amountItem}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>{t('leadDetail.kicker.source')}</Text>
            <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1}>{lead.channel || '—'}</Text>
          </View>
          <View style={[styles.amountDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.amountItem}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>{t('leadDetail.kicker.created')}</Text>
            <Text style={[styles.amountValueSm, { color: colors.text, fontFamily: fonts.mono }]}>{relativeTime(lead.createdAt, t)}</Text>
          </View>
        </GlassCard>

        {note && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.note')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.noteText, { color: colors.text }]}>{note}</Text>
            </GlassCard>
          </>
        )}

        {properties.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.properties')}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {properties.map((p, i) => {
                const Row = p.onPress ? TouchableOpacity : View;
                return (
                  <Row key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]} onPress={p.onPress} activeOpacity={0.7}>
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
          </>
        )}

        {utm.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.utm')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, gap: 6 }]}>
              {utm.map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row' }}>
                  <Text style={{ flex: 1, color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 11 }}>{k}</Text>
                  <Text style={{ color: colors.text, fontSize: 12.5, fontFamily: fonts.medium }} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.stage')}</Text>
        <GlassCard variant="g2" style={styles.pipelineCard}>
          <SegmentedProgress stages={PIPELINE_STAGES} activeIndex={stageIdx} activeColor={colors.info} />
        </GlassCard>

        {(lead.projects.length > 0 || sales.length > 0) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.related')}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {lead.projects.map((p, i) => (
                <TouchableOpacity
                  key={`p-${p.id}`}
                  style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < lead.projects.length - 1 || sales.length > 0 ? 1 : 0 }]}
                  onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: p.id } })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.propIco, { backgroundColor: colors.secondary + '22' }]}>
                    <Ionicons name="layers-outline" size={16} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{t('leadDetail.related.project')}</Text>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.name || `#${p.id.slice(0, 8)}`}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {sales.map((s, i) => (
                <TouchableOpacity
                  key={`s-${s.id}`}
                  style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < sales.length - 1 ? 1 : 0 }]}
                  onPress={() => navigation.navigate('Sales', { screen: 'SaleDetail', params: { id: s.id } })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.propIco, { backgroundColor: colors.success + '22' }]}>
                    <Ionicons name="cash-outline" size={16} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{t('leadDetail.related.sale')}</Text>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{formatMoney(s.amount, s.currency)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </GlassCard>
          </>
        )}
        </>}

        {tab === 'tasks' && <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.nextSteps')}</Text>
        {lead.tasks.length === 0 ? (
          <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('leadDetail.noSteps')}</Text>
          </GlassCard>
        ) : (
          <GlassCard variant="g2" style={styles.listCard}>
            {lead.tasks.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.taskRow, { borderBottomColor: colors.line3, borderBottomWidth: i < lead.tasks.length - 1 ? 1 : 0 }]}
                onPress={() => toggleTask(t)}
                activeOpacity={0.7}
              >
                <View style={[styles.taskCheck, { borderColor: t.done ? colors.ink : colors.line2, backgroundColor: t.done ? colors.ink : 'transparent' }]}>
                  {t.done && <Ionicons name="checkmark" size={13} color={colors.onInk} />}
                </View>
                <Text style={[styles.taskTitle, { color: t.done ? colors.textTertiary : colors.text, textDecorationLine: t.done ? 'line-through' : 'none' }]} numberOfLines={2}>
                  {t.title}
                </Text>
                {t.deadline && <Text style={[styles.taskDeadline, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{new Date(t.deadline).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })}</Text>}
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}
        <CommentsSection entries={lead.comments} onSave={handleCommentsSave} />
        </>}

        {tab === 'fields' && (
          <CustomFieldsSection entityType="lead" values={lead.customFields} onUpdate={handleCustomFieldUpdate} />
        )}

        {tab === 'history' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('leadDetail.section.events')}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {timeline.map((e, i) => (
                <View key={i} style={[styles.timelineRow, { borderBottomColor: colors.line3, borderBottomWidth: i < timeline.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.timelineIco, { backgroundColor: e.color }]}>
                    <Ionicons name={e.icon} size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.timelineTitle, { color: colors.text }]}>{e.title}</Text>
                    <Text style={[styles.timelineSub, { color: colors.textSecondary }]}>{e.sub}</Text>
                  </View>
                  <Text style={[styles.timelineTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{e.time}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>

      <AppBottomSheet ref={statusSheetRef} snapPoints={['50%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('leadDetail.action.changeStatus')}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {(Object.keys(STATUS_LABEL) as LeadStatusCode[]).map((s) => {
            const isCurrent = lead.status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusRow, { borderColor: colors.line2, opacity: isCurrent ? 0.5 : 1 }]}
                onPress={() => handleStatusUpdate(s)}
                disabled={isCurrent || saving}
                activeOpacity={0.7}
              >
                <Pill label={STATUS_LABEL[s]} tone={STATUS_TONE[s]} />
                {isCurrent ? (
                  <Text style={[styles.statusCurrentLabel, { color: colors.textTertiary }]}>{t('leadDetail.current')}</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={convertSheetRef} snapPoints={['55%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('leadDetail.convertSheetTitle')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 4 }]}>
          {lead.contactId
            ? t('leadDetail.convertDesc.linked')
            : t('leadDetail.convertDesc.new')}
        </Text>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>{t('leadDetail.companyNameLabel')}</Text>
        <GlassCard variant="flat" style={styles.convertInputCard} contentStyle={{ paddingHorizontal: spacing.md, paddingVertical: 2 }}>
          <TextInput
            value={convertCompanyName}
            onChangeText={setConvertCompanyName}
            placeholder={lead.companyId ? t('leadDetail.companyPlaceholder.linked') : t('leadDetail.companyPlaceholder.new')}
            placeholderTextColor={colors.textTertiary}
            style={{ color: colors.text, fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular }}
          />
        </GlassCard>
        <TouchableOpacity style={styles.convertWonRow} onPress={() => setConvertMarkWon((v) => !v)} activeOpacity={0.7}>
          <View style={[styles.taskCheck, { borderColor: convertMarkWon ? colors.ink : colors.line2, backgroundColor: convertMarkWon ? colors.ink : 'transparent' }]}>
            {convertMarkWon && <Ionicons name="checkmark" size={13} color={colors.onInk} />}
          </View>
          <Text style={{ color: colors.text, fontSize: 13.5 }}>{t('leadDetail.markWon')}</Text>
        </TouchableOpacity>
        <Button label={t('leadDetail.action.convert')} variant="primary" fullWidth loading={converting} onPress={handleConvert} style={{ marginTop: spacing.lg }} />
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 17, fontFamily: fonts.regular },
  navActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  heroName: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, lineHeight: 26 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  heroTags: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },

  actionsCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xxl },
  actionsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  actionsTitle: { fontSize: 15, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexBasis: '47%', flexGrow: 1 },
  actionsNote: { fontSize: 11.5, lineHeight: 15, marginTop: spacing.md },

  amountCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xxl, padding: 14 },
  amountCardRow: { flexDirection: 'row', alignItems: 'center' },
  amountItem: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  amountValue: { fontSize: 15, fontFamily: fonts.semibold },
  amountValueSm: { fontSize: 13, fontFamily: fonts.medium },
  amountDiv: { width: StyleSheet.hairlineWidth, height: 32, marginHorizontal: 8 },

  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, marginBottom: 4, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  noteText: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  taskCheck: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { flex: 1, fontSize: 14, fontFamily: fonts.medium },
  taskDeadline: { fontSize: 11 },

  pipelineCard: { marginHorizontal: spacing.lg, marginBottom: 4, borderRadius: radius.xxl, padding: 14 },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: 12, paddingHorizontal: spacing.lg },
  timelineIco: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineTitle: { fontSize: 13.5, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  timelineSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2, lineHeight: 16 },
  timelineTime: { fontSize: 11, flexShrink: 0 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  statusCurrentLabel: { fontSize: 11, marginLeft: 'auto' },

  sheetTitle: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  sub: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.regular },
  fieldLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, marginBottom: 6 },
  convertInputCard: { borderRadius: radius.lg },
  convertWonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
