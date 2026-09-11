import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Linking, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { fetchLead, updateLead, fetchLeadHistory, convertLead, Lead, LeadStatusCode, LeadActivityEntry, LeadTask } from '../../api/leads';
import { fetchContact } from '../../api/contacts';
import { fetchCompany } from '../../api/companies';
import { fetchSalesByLead, Sale } from '../../api/sales';
import { EntityComment } from '../../api/comments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SegmentedProgress, Button, SkeletonList, showToast, CustomFieldsSection, CommentsSection, AppBottomSheet, AppBottomSheetRef } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Segmented, Pill } from '../../components/mg';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadDetail'>;

const STATUS_TONE: Record<LeadStatusCode, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc',
  in_progress: 'default',
  waiting: 'warn',
  won: 'pos',
  lost: 'neg',
};
const STATUS_LABEL: Record<LeadStatusCode, string> = {
  new: 'Новый', in_progress: 'В работе', waiting: 'Ожидает', won: 'Успех', lost: 'Проигран',
};

const PIPELINE_STAGES = ['Новый', 'Связались', 'Квалиф.', 'Презент.', 'Оплата'];
const STATUS_TO_STAGE: Record<LeadStatusCode, number> = { new: 0, in_progress: 1, waiting: 2, won: 4, lost: 4 };

const ACTIVITY_LABEL: Record<string, string> = {
  created: 'Лид создан',
  status_changed: 'Статус изменён',
  assignee_changed: 'Сменён ответственный',
  comment: 'Комментарий',
};
const ACTIVITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  created: 'flash-outline',
  status_changed: 'swap-horizontal-outline',
  assignee_changed: 'person-outline',
  comment: 'chatbubble-outline',
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

export const LeadDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [convertCompanyName, setConvertCompanyName] = useState('');
  const [convertMarkWon, setConvertMarkWon] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchLead(id)
      .then((data) => {
        setLead(data);
        if (data.contactId) fetchContact(data.contactId).then((c) => setContactName(c.fullName || null)).catch(() => {});
        if (data.companyId) fetchCompany(data.companyId).then((c) => setCompanyName(c.name || null)).catch(() => {});
        fetchSalesByLead(id).then(setSales).catch(() => {});
        fetchLeadHistory(id).then(setHistory).catch(() => {});
      })
      .catch(() => showToast('Не удалось загрузить лид', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

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
      showToast('Не удалось обновить чек-лист', { variant: 'error' });
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
        result.contactCreated ? 'создан контакт' : 'привязан существующий контакт',
        result.company ? (result.companyCreated ? 'создана компания' : 'привязана существующая компания') : null,
      ].filter(Boolean);
      showToast(parts.join(', '), { variant: 'success' });
      navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: result.contact.id } });
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось конвертировать лид', { variant: 'error' });
    } finally {
      setConverting(false);
    }
  }, [lead, convertCompanyName, convertMarkWon, navigation]);

  const handleStatusUpdate = useCallback(async (newStatus: LeadStatusCode) => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await updateLead({ id: lead.id, status: newStatus });
      setLead(updated);
      showToast(newStatus === 'won' ? 'Сделка закрыта' : 'Статус обновлён', { variant: 'success' });
    } catch {
      showToast('Не удалось обновить статус', { variant: 'error' });
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
        <Text style={{ color: colors.text }}>Лид не найден</Text>
      </View>
    );
  }

  const stageIdx = STATUS_TO_STAGE[lead.status];
  const name = lead.name || 'Без имени';

  // Each action no-op'd silently on missing data (`lead.phone &&` guard with nothing on the
  // false branch) — a button that looks live but does nothing when tapped is worse than one that
  // says why, so every branch now ends in either a real Linking.openURL or a toast.
  const quickActions = [
    { label: 'Позвонить', icon: 'call-outline' as const, color: colors.success, onPress: () => lead.phone ? Linking.openURL(`tel:${lead.phone}`) : showToast('У лида не указан телефон') },
    { label: 'WhatsApp', icon: 'logo-whatsapp' as const, color: '#25D366', onPress: () => lead.phone ? Linking.openURL(`https://wa.me/${lead.phone.replace(/\D/g, '')}`) : showToast('У лида не указан телефон') },
    { label: 'Email', icon: 'mail-outline' as const, color: colors.secondary, onPress: () => lead.email ? Linking.openURL(`mailto:${lead.email}`) : showToast('У лида не указан e-mail') },
    // No Telegram handle is stored on a lead (only phone/email) and there's no reliable
    // phone→chat deep link, unlike the tel:/mailto:/wa.me actions above — surface that instead
    // of a button that silently does nothing when tapped.
    { label: 'Telegram', icon: 'paper-plane-outline' as const, color: '#229ED9', onPress: () => showToast('Нет привязанного Telegram — напишите из раздела «Диалоги»') },
  ];

  const properties = [
    lead.phone && { label: 'Телефон', value: lead.phone, iconColor: colors.success, icon: 'call-outline' as const },
    lead.email && { label: 'Email', value: lead.email, iconColor: colors.secondary, icon: 'mail-outline' as const },
    lead.country && { label: 'Страна', value: lead.country, iconColor: colors.fg3, icon: 'globe-outline' as const },
    lead.companyId && {
      label: 'Компания', value: companyName || `#${lead.companyId.slice(0, 8)}`, iconColor: colors.secondary, icon: 'business-outline' as const,
      onPress: () => navigation.navigate('Clients', { screen: 'CompanyDetail', params: { id: lead.companyId } }),
    },
    lead.contactId && {
      label: 'Контакт', value: contactName || `#${lead.contactId.slice(0, 8)}`, iconColor: colors.info, icon: 'person-circle-outline' as const,
      onPress: () => navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: lead.contactId } }),
    },
    lead.assignedToList.length > 0 && { label: lead.assignedToList.length > 1 ? 'Ответственные' : 'Менеджер', value: lead.assignedToList.join(', '), iconColor: colors.ink, icon: 'person-outline' as const },
    lead.channel && { label: 'Источник', value: lead.channel, iconColor: colors.warning, icon: 'flash-outline' as const },
  ].filter(Boolean) as { label: string; value: string; iconColor: string; icon: any; onPress?: () => void }[];

  const utm = [
    ['utm_source', lead.meta?.utm_source],
    ['utm_medium', lead.meta?.utm_medium],
    ['utm_campaign', lead.meta?.utm_campaign],
  ].filter(([, v]) => v) as [string, string][];

  const note: string | undefined = typeof lead.meta?.note === 'string' && lead.meta.note.trim() ? lead.meta.note.trim() : undefined;

  const timeline = history.length > 0
    ? history.map((a) => ({
        icon: ACTIVITY_ICON[a.type] || 'ellipse-outline',
        color: a.type === 'status_changed' ? colors.info : a.type === 'comment' ? colors.secondary : colors.ink,
        title: ACTIVITY_LABEL[a.type] || a.type,
        sub: a.comment || [a.fromValue, a.toValue].filter(Boolean).join(' → ') || '—',
        time: relativeTime(a.createdAt),
      }))
    : [
        { icon: 'flash-outline' as const, color: colors.ink, title: 'Лид создан', sub: `Источник: ${lead.channel || 'сайт'}`, time: relativeTime(lead.createdAt) },
      ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text }]}>Лиды</Text>
          </TouchableOpacity>
          <View style={styles.navActions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
              <Ionicons name="star-outline" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => convertSheetRef.current?.snapToIndex(0)}>
              <Ionicons name="person-add-outline" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={name} size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{name}</Text>
            {(lead.country || lead.channel) && (
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{[lead.channel, lead.country].filter(Boolean).join(' · ')}</Text>
            )}
            <View style={styles.heroTags}>
              <Pill label={STATUS_LABEL[lead.status]} tone={STATUS_TONE[lead.status]} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Segmented
            options={[
              { key: 'info', label: 'Обзор' },
              { key: 'tasks', label: 'Шаги' },
              { key: 'fields', label: 'Поля' },
              { key: 'history', label: 'История' },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </View>

        {tab === 'info' && <>
        <View style={styles.quickGrid}>
          {quickActions.map((q, i) => (
            <GlassCard key={i} variant="flat" style={styles.quickBtn}>
              <TouchableOpacity style={styles.quickBtnInner} onPress={q.onPress} activeOpacity={0.7}>
                <View style={[styles.quickIco, { backgroundColor: q.color }]}>
                  <Ionicons name={q.icon} size={16} color="#fff" />
                </View>
                <Text style={[styles.quickLabel, { color: colors.text }]}>{q.label}</Text>
              </TouchableOpacity>
            </GlassCard>
          ))}
        </View>

        <GlassCard variant="g" style={styles.amountCard} contentStyle={styles.amountCardRow}>
          {lead.amount > 0 && (
            <>
              <View style={styles.amountItem}>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>СУММА СДЕЛКИ</Text>
                <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1}>{formatMoney(lead.amount, lead.currency)}</Text>
              </View>
              <View style={[styles.amountDiv, { backgroundColor: colors.separator }]} />
            </>
          )}
          <View style={styles.amountItem}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>ИСТОЧНИК</Text>
            <Text style={[styles.amountValue, { color: colors.text }]} numberOfLines={1}>{lead.channel || '—'}</Text>
          </View>
          <View style={[styles.amountDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.amountItem}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>СОЗДАН</Text>
            <Text style={[styles.amountValueSm, { color: colors.text, fontFamily: fonts.mono }]}>{relativeTime(lead.createdAt)}</Text>
          </View>
        </GlassCard>

        {note && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ЗАМЕТКА ОТ КЛИЕНТА</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.noteText, { color: colors.text }]}>{note}</Text>
            </GlassCard>
          </>
        )}

        {properties.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА ЛИДА</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>UTM-МЕТКИ</Text>
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

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ЭТАП ВОРОНКИ</Text>
        <GlassCard variant="g2" style={styles.pipelineCard}>
          <SegmentedProgress stages={PIPELINE_STAGES} activeIndex={stageIdx} activeColor={colors.info} />
        </GlassCard>

        {(lead.projects.length > 0 || sales.length > 0) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВЯЗАННЫЕ ЗАПИСИ</Text>
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
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Проект</Text>
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
                    <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Продажа</Text>
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СЛЕДУЮЩИЕ ШАГИ</Text>
        {lead.tasks.length === 0 ? (
          <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Шагов пока нет</Text>
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
                {t.deadline && <Text style={[styles.taskDeadline, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{new Date(t.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</Text>}
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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СОБЫТИЯ</Text>
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

      <View style={[styles.ctaBar, { bottom: insets.bottom + 90 }]}>
        <Button label="В работу" variant="secondary" fullWidth disabled={saving || lead.status === 'in_progress'} onPress={() => handleStatusUpdate('in_progress')} style={{ flex: 1 }} />
        <Button label="Закрыть сделку" variant="primary" fullWidth disabled={saving || lead.status === 'won'} onPress={() => handleStatusUpdate('won')} style={{ flex: 1 }} />
      </View>

      <AppBottomSheet ref={convertSheetRef} snapPoints={['55%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Конвертировать лида</Text>
        <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 4 }]}>
          {lead.contactId
            ? 'Лид уже привязан к контакту — повторная конвертация просто обновит связь.'
            : 'Найдёт контакт по телефону/email или создаст новый и привяжет его к лиду.'}
        </Text>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>НАЗВАНИЕ КОМПАНИИ (НЕОБЯЗАТЕЛЬНО)</Text>
        <GlassCard variant="flat" style={styles.convertInputCard} contentStyle={{ paddingHorizontal: spacing.md, paddingVertical: 2 }}>
          <TextInput
            value={convertCompanyName}
            onChangeText={setConvertCompanyName}
            placeholder={lead.companyId ? 'Уже привязана компания' : 'Найдёт или создаст компанию'}
            placeholderTextColor={colors.textTertiary}
            style={{ color: colors.text, fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular }}
          />
        </GlassCard>
        <TouchableOpacity style={styles.convertWonRow} onPress={() => setConvertMarkWon((v) => !v)} activeOpacity={0.7}>
          <View style={[styles.taskCheck, { borderColor: convertMarkWon ? colors.ink : colors.line2, backgroundColor: convertMarkWon ? colors.ink : 'transparent' }]}>
            {convertMarkWon && <Ionicons name="checkmark" size={13} color={colors.onInk} />}
          </View>
          <Text style={{ color: colors.text, fontSize: 13.5 }}>Отметить лид как «Выиграно»</Text>
        </TouchableOpacity>
        <Button label="Конвертировать" variant="primary" fullWidth loading={converting} onPress={handleConvert} style={{ marginTop: spacing.lg }} />
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

  quickGrid: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  quickBtn: { flex: 1, borderRadius: radius.xl, minHeight: 64 },
  quickBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 },
  quickIco: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontFamily: fonts.semibold },

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

  ctaBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', gap: 10 },

  sheetTitle: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  sub: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.regular },
  fieldLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, marginBottom: 6 },
  convertInputCard: { borderRadius: radius.lg },
  convertWonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
