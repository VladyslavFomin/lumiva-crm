import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from './SalesStack';
import { fetchSale, fetchSalesChannels, fetchSalesByContact, updateSale, Sale } from '../../api/sales';
import { fetchLead } from '../../api/leads';
import { fetchContact } from '../../api/contacts';
import { fetchProject } from '../../api/projects';
import { fetchAuditLog, AuditLogEntry } from '../../api/auditLog';
import { EntityComment } from '../../api/comments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SkeletonList, showToast, CustomFieldsSection, ActivityFeed, CommentsSection, Button } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleDetail'>;

const STATUS_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc', pending: 'warn', confirmed: 'pos', cancelled: 'neg', refunded: 'neg', other: 'default',
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(appLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

export const SaleDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const STATUS_LABEL: Record<string, string> = {
    new: t('saleStatus.new'), pending: t('saleStatus.pending'), confirmed: t('saleStatus.confirmed'), cancelled: t('saleStatus.cancelled'), refunded: t('saleStatus.refunded'), other: t('saleStatus.other'),
  };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const [item, setItem] = useState<Sale | null>(null);
  const [leadName, setLeadName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [customerStats, setCustomerStats] = useState<{ count: number; total: number; firstOrder: string } | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactName, setContactName] = useState<string | null>(null);

  // Refetch on focus so edits saved in the edit modal show up immediately.
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const data = await fetchSale(id);
        setItem(data);
        fetchAuditLog('sale', id).then(setActivity).catch(() => {});
        if (data.contactId) fetchContact(data.contactId).then((c) => setContactName(c.fullName || null)).catch(() => {});
        if (data.leadId) fetchLead(data.leadId).then((l) => setLeadName(l.name || null)).catch(() => {});
        if (data.projectId) fetchProject(data.projectId).then((p) => setProjectName(p.name)).catch(() => {});
        if (data.channelId) fetchSalesChannels().then((chans) => setChannelName(chans.find((c) => c.id === data.channelId)?.name || null)).catch(() => {});
        if (data.contactId) {
          fetchSalesByContact(data.contactId).then((sales) => {
            if (sales.length === 0) return;
            const total = sales.reduce((sum, s) => sum + toDisplay(s.amount || 0, s.currency), 0);
            const firstOrder = sales.reduce((min, s) => (s.createdAt < min ? s.createdAt : min), sales[0].createdAt);
            setCustomerStats({ count: sales.length, total, firstOrder });
          }).catch(() => {});
        }
      } catch {
        showToast(t('saleDetail.loadError'), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const handleCustomFieldUpdate = async (key: string, value: any) => {
    if (!item) return;
    const nextCustomFields = { ...(item.customFields || {}), [key]: value };
    const updated = await updateSale({ id: item.id, customFields: nextCustomFields });
    setItem(updated);
  };

  const handleStatusChange = async (status: string) => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await updateSale({ id: item.id, status });
      setItem(updated);
      showToast(t('saleDetail.statusUpdated'), { variant: 'success' });
    } catch {
      showToast(t('saleDetail.statusError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCommentsSave = async (nextComments: EntityComment[]) => {
    if (!item) return;
    const updated = await updateSale({ id: item.id, comments: nextComments });
    setItem(updated);
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('saleDetail.notFound')}</Text>
      </View>
    );
  }

  const properties = [
    item.leadId && {
      label: t('saleDetail.prop.lead'), value: leadName || `#${item.leadId.slice(0, 8)}`, icon: 'flash-outline' as const, iconColor: colors.info,
      onPress: () => navigation.navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id: item.leadId } } }),
    },
    item.projectId && {
      label: t('saleDetail.prop.project'), value: projectName || `#${item.projectId.slice(0, 8)}`, icon: 'layers-outline' as const, iconColor: colors.secondary,
      onPress: () => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: item.projectId } }),
    },
    item.contactId && {
      label: t('saleDetail.prop.contact'), value: contactName || `#${item.contactId.slice(0, 8)}`, icon: 'person-circle-outline' as const, iconColor: colors.info,
      onPress: () => navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: item.contactId } }),
    },
    item.guestName && { label: t('saleDetail.prop.guest'), value: item.guestName, icon: 'person-outline' as const, iconColor: colors.fg3 },
    item.agentName && { label: t('saleDetail.prop.agent'), value: item.agentName, icon: 'briefcase-outline' as const, iconColor: colors.fg3 },
    item.channelId && { label: t('saleDetail.prop.channel'), value: channelName || `#${item.channelId.slice(0, 8)}`, icon: 'git-network-outline' as const, iconColor: colors.info },
    item.managerName && { label: t('saleDetail.prop.manager'), value: item.managerName, icon: 'person-outline' as const, iconColor: colors.ink },
    item.market && { label: t('saleDetail.prop.market'), value: item.market, icon: 'globe-outline' as const, iconColor: colors.fg3 },
    item.hotel && { label: t('saleDetail.prop.hotel'), value: item.hotel, icon: 'business-outline' as const, iconColor: colors.fg3 },
    item.externalOrderNo && { label: t('saleDetail.prop.orderNo'), value: item.externalOrderNo, icon: 'receipt-outline' as const, iconColor: colors.warning },
    item.checkInAt && { label: t('saleDetail.prop.checkIn'), value: fmtDate(item.checkInAt), icon: 'log-in-outline' as const, iconColor: colors.fg3 },
    item.checkOutAt && { label: t('saleDetail.prop.checkOut'), value: fmtDate(item.checkOutAt), icon: 'log-out-outline' as const, iconColor: colors.fg3 },
    item.externalId && { label: t('saleDetail.prop.externalId'), value: item.externalId, icon: 'key-outline' as const, iconColor: colors.fg3 },
    { label: t('saleDetail.prop.saleDate'), value: fmtDate(item.saleDate), icon: 'calendar-outline' as const, iconColor: colors.fg3 },
    { label: t('saleDetail.prop.created'), value: fmtDate(item.createdAt), icon: 'time-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('salesList.title')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('SaleEdit', { id: item.id })}>
            <Ionicons name="create-outline" size={17} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.heroId, { color: colors.textTertiary, fontFamily: fonts.mono }]}>#{item.id.slice(0, 8)}</Text>
          <Text style={[styles.heroAmount, { color: colors.text }]}>{formatMoney(item.amount, item.currency)}</Text>
          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Pill label={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status] || 'default'} />
          </View>
        </View>

        {customerStats && (
          <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{customerStats.count}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('saleDetail.stat.orders')}</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success, fontFamily: fonts.mono }]} numberOfLines={1}>{fmt(customerStats.total)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('saleDetail.stat.totalSpent')}</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]} numberOfLines={1}>{new Date(customerStats.firstOrder).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('saleDetail.stat.firstOrder')}</Text>
            </View>
          </GlassCard>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('saleDetail.section.properties')}</Text>
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

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('saleDetail.section.actions')}</Text>
        <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
          <View style={styles.actionsRow}>
            <Button label={t('saleDetail.action.confirm')} variant="accent" size="sm" disabled={saving || item.status === 'confirmed'} onPress={() => handleStatusChange('confirmed')} style={{ flex: 1 }} />
            <Button label={t('saleDetail.action.cancel')} variant="secondary" size="sm" disabled={saving || item.status === 'cancelled'} onPress={() => handleStatusChange('cancelled')} style={{ flex: 1 }} />
          </View>
        </GlassCard>

        {item.notes && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('saleDetail.section.note')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
            </GlassCard>
          </>
        )}

        <ActivityFeed entries={activity} />

        <CommentsSection entries={item.comments} onSave={handleCommentsSave} />

        <CustomFieldsSection entityType="sale" values={item.customFields} onUpdate={handleCustomFieldUpdate} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroId: { fontSize: 12, marginBottom: 4 },
  heroAmount: { fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  notesText: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  statsCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xxl, padding: 14 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: fonts.semibold },
  statLabel: { fontSize: 10, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
});
