import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { fetchContact, deleteContact, fetchContactRelations, updateContact, Contact, ContactRelatedRef } from '../../api/contacts';
import { fetchAuditLog, AuditLogEntry } from '../../api/auditLog';
import { EntityComment } from '../../api/comments';
import { countryName } from '../../utils/refData';
import { AvatarInitials, Button, SkeletonList, showToast, CustomFieldsSection, ActivityFeed, CommentsSection } from '../../components/ui';
import { Segmented, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const LEAD_STATUS_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc', in_progress: 'default', waiting: 'warn', won: 'pos', lost: 'neg',
};

type Tab = 'about' | 'hist' | 'linked';

export const ContactDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const LEAD_STATUS_LABEL: Record<string, string> = {
    new: t('contactDetail.leadStatus.new'), in_progress: t('contactDetail.leadStatus.in_progress'), waiting: t('contactDetail.leadStatus.waiting'), won: t('contactDetail.leadStatus.won'), lost: t('contactDetail.leadStatus.lost'),
  };
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [contact, setContact] = useState<Contact | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [leads, setLeads] = useState<ContactRelatedRef[]>([]);
  const [projects, setProjects] = useState<ContactRelatedRef[]>([]);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('about');

  // Refetch on focus so edits saved in the edit modal show up immediately.
  useFocusEffect(useCallback(() => {
    fetchContact(id)
      .then((data) => {
        setContact(data);
        fetchContactRelations(id).then((rel) => {
          setCompanyName(rel.companyName);
          setLeads(rel.leads);
          setProjects(rel.projects);
        }).catch(() => {});
        fetchAuditLog('contact', id).then(setActivity).catch(() => {});
      })
      .catch(() => showToast(t('contactDetail.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const handleCustomFieldUpdate = async (key: string, value: any) => {
    if (!contact) return;
    const nextCustomFields = { ...(contact.customFields || {}), [key]: value };
    const updated = await updateContact({ id: contact.id, customFields: nextCustomFields });
    setContact(updated);
  };

  const handleCommentsSave = async (nextComments: EntityComment[]) => {
    if (!contact) return;
    const updated = await updateContact({ id: contact.id, comments: nextComments });
    setContact(updated);
  };

  const handleDelete = () => {
    if (!contact) return;
    navigation.goBack();
    deleteContact(contact.id).then(() => showToast(t('contactDetail.deletedToast'), { variant: 'success' })).catch(() => showToast(t('contactDetail.deleteError'), { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('contactDetail.notFound')}</Text>
      </View>
    );
  }

  const properties = [
    contact.companyId && {
      label: t('contactDetail.prop.company'), value: companyName || `#${contact.companyId.slice(0, 8)}`, icon: 'business-outline' as const, iconColor: colors.secondary,
      onPress: () => navigation.navigate('CompanyDetail', { id: contact.companyId }),
    },
    contact.phone && { label: t('contactDetail.prop.phone'), value: contact.phone, icon: 'call-outline' as const, iconColor: colors.success, onPress: () => Linking.openURL(`tel:${contact.phone}`) },
    contact.email && { label: t('contactDetail.prop.email'), value: contact.email, icon: 'mail-outline' as const, iconColor: colors.secondary, onPress: () => Linking.openURL(`mailto:${contact.email}`) },
    contact.position && { label: t('contactDetail.prop.position'), value: contact.position, icon: 'briefcase-outline' as const, iconColor: colors.fg3 },
    contact.assignedTo && { label: t('contactDetail.prop.assignedTo'), value: contact.assignedTo, icon: 'person-outline' as const, iconColor: colors.ink },
    (contact.city || contact.country) && { label: t('contactDetail.prop.cityCountry'), value: [contact.city, countryName(contact.country)].filter(Boolean).join(', '), icon: 'location-outline' as const, iconColor: colors.fg3 },
    contact.customFields?.passport && { label: t('contactEdit.field.passport'), value: String(contact.customFields.passport), icon: 'card-outline' as const, iconColor: colors.fg3 },
    contact.address && { label: t('contactDetail.prop.address'), value: contact.address, icon: 'map-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  const hasLinked = leads.length > 0 || projects.length > 0 || !!contact.companyId;

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
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ContactEdit', { id: contact.id })}>
              <Ionicons name="create-outline" size={17} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={contact.fullName} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{contact.fullName}</Text>
            {contact.position && <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{contact.position}</Text>}
            {contact.status && (
              <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Pill label={contact.status === 'active' ? t('contactDetail.status.active') : contact.status === 'inactive' ? t('contactDetail.status.inactive') : t('contactDetail.status.archived')} tone={contact.status === 'active' ? 'pos' : 'default'} />
              </View>
            )}
          </View>
        </View>

        {contact.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {contact.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          {contact.phone && <Button label={t('contactDetail.call')} variant="accent" size="sm" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${contact.phone}`)} />}
          {contact.email && <Button label={t('contactDetail.email')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => Linking.openURL(`mailto:${contact.email}`)} />}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Segmented
            options={[
              { key: 'about', label: t('contactDetail.tab.about') },
              { key: 'hist', label: t('contactDetail.tab.history') },
              { key: 'linked', label: t('contactDetail.tab.linked') },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as Tab)}
          />
        </View>

        {tab === 'about' && <>
          {properties.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('contactDetail.section.contactInfo')}</Text>
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
                    </Row>
                  );
                })}
              </GlassCard>
            </>
          )}

          {contact.notes ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('contactDetail.section.notes')}</Text>
              <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
                <Text style={[styles.notes, { color: colors.text }]}>{contact.notes}</Text>
              </GlassCard>
            </>
          ) : null}

          <CustomFieldsSection entityType="contact" values={contact.customFields} onUpdate={handleCustomFieldUpdate} />
          <CommentsSection entries={contact.comments} onSave={handleCommentsSave} />
        </>}

        {tab === 'hist' && <ActivityFeed entries={activity} />}

        {tab === 'linked' && (
          hasLinked ? (
            <>
              {(leads.length > 0 || projects.length > 0) && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('contactDetail.section.related')}</Text>
                  <GlassCard variant="g2" style={styles.listCard}>
                    {leads.map((l, i) => (
                      <TouchableOpacity
                        key={`l-${l.id}`}
                        style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < leads.length - 1 || projects.length > 0 ? 1 : 0 }]}
                        onPress={() => navigation.navigate('Leads', { screen: 'LeadDetail', params: { id: l.id } })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.propIco, { backgroundColor: colors.info + '22' }]}>
                          <Ionicons name="flash-outline" size={16} color={colors.info} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{t('contactDetail.related.lead')}</Text>
                          <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{l.name || t('common.noName')}</Text>
                        </View>
                        {l.status && <Pill label={LEAD_STATUS_LABEL[l.status] || l.status} tone={LEAD_STATUS_TONE[l.status] || 'default'} />}
                      </TouchableOpacity>
                    ))}
                    {projects.map((p, i) => (
                      <TouchableOpacity
                        key={`p-${p.id}`}
                        style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < projects.length - 1 ? 1 : 0 }]}
                        onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: p.id } })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.propIco, { backgroundColor: colors.secondary + '22' }]}>
                          <Ionicons name="layers-outline" size={16} color={colors.secondary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{t('contactDetail.related.project')}</Text>
                          <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.name || t('contactDetail.noProjectName')}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </GlassCard>
                </>
              )}

              {contact.companyId && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('contactDetail.section.company')}</Text>
                  <TouchableOpacity
                    style={[styles.companyRow, { backgroundColor: colors.cardElevated }]}
                    onPress={() => navigation.navigate('CompanyDetail', { id: contact.companyId })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.propIco, { backgroundColor: colors.secondary + '22' }]}>
                      <Ionicons name="business-outline" size={16} color={colors.secondary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{companyName || t('contactDetail.section.company')}</Text>
                      <Text style={[styles.propLabel, { color: colors.textSecondary, marginTop: 2 }]}>{t('contactDetail.companyCard')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg, margin: spacing.lg }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('contactDetail.noRelated')}</Text>
            </GlassCard>
          )
        )}
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
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.xxl },
});
