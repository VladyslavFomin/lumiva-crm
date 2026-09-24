import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchSale, updateSale, Sale } from '../../api/sales';
import { fetchLeads, Lead } from '../../api/leads';
import { fetchStaff, Staff } from '../../api/staff';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker, LinkPicker } from '../../components/mg';

const STATUSES = ['new', 'pending', 'confirmed', 'cancelled', 'refunded', 'other'] as const;

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Sale edit form — exactly what the website's sale card saves: status, managers, notes, linked lead
 *  (amount, guest, dates etc. come from the order/integration and are read-only there too). */
export const SaleEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { t } = useLanguage();
  const { colors } = useTheme();

  const [original, setOriginal] = useState<Sale | null>(null);
  const [status, setStatus] = useState('new');
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchSale(id), fetchLeads().catch(() => [] as Lead[]), fetchStaff().catch(() => [] as Staff[])])
      .then(([s, ld, sf]) => {
        setOriginal(s); setStatus(s.status); setNotes(s.notes || ''); setLeadId(s.leadId); setLeads(ld); setStaff(sf);
        // managerName is a comma-separated list of names — map back to staff ids (same as the website).
        const names = (s.managerName || '').split(',').map((x) => x.trim()).filter(Boolean);
        setManagerIds(sf.filter((m) => names.includes(m.fullName)).map((m) => m.id));
      })
      .catch(() => { showToast(t('saleDetail.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!original) return;
    setSaving(true);
    try {
      // Keep manager names that don't match any staff member (imported orders) instead of silently dropping them.
      const known = staff.map((m) => m.fullName);
      const unknown = (original.managerName || '').split(',').map((x) => x.trim()).filter((n) => n && !known.includes(n));
      const names = [...staff.filter((m) => managerIds.includes(m.id)).map((m) => m.fullName), ...unknown];
      await updateSale({ id, status, managerName: names.length ? names.join(', ') : null, notes: notes.trim() || null, leadId });
      showToast(t('saleEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('saleEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t('saleEdit.title')} kicker={t('salesList.title')} sub={`#${id.slice(0, 8)}`}
      missing={[]} entityLabel={t('saleEdit.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <PickLabel label={t('contactEdit.field.status')} />
        <ChipPicker options={STATUSES.map((s) => ({ key: s, label: t(`saleStatus.${s}`) }))} value={status} onChange={setStatus} />
      </FieldCard>
      <FieldCard icon="people-outline" title={t('saleEdit.section.team')}>
        <PickLabel label={t('saleDetail.prop.manager')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={managerIds} onChange={setManagerIds} multi />
        </View>
        <LinkPicker label={t('saleDetail.prop.lead')} value={leadId} options={leads.map((l) => ({ id: l.id, label: l.name || l.email || l.phone || l.id, sub: l.email || l.phone }))} onChange={setLeadId} />
      </FieldCard>
      <FieldCard icon="document-text-outline" title={t('saleDetail.section.note')}>
        <EntityField label={t('saleDetail.section.note')} value={notes} onChangeText={setNotes} multiline />
      </FieldCard>
    </EntityFormShell>
  );
};
