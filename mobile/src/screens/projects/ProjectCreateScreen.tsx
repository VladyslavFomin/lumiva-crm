import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createProject, ProjectStatus } from '../../api/projects';
import { fetchProjectStatusDefs, ProjectStatusDef } from '../../api/projectSettings';
import { fetchLeads, Lead } from '../../api/leads';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

export const ProjectCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { codes } = useCurrencyMode();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [statuses, setStatuses] = useState<ProjectStatusDef[]>([]);
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjectStatusDefs().then((defs) => { setStatuses(defs); if (defs[0]) setStatus(defs[0].value); }).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
    fetchLeads().then(setLeads).catch(() => {});
  }, []);

  useEffect(() => { if (codes[0]) setCurrency(codes[0]); }, [codes]);

  const missing = [
    ...(!name.trim() ? ['название'] : []),
    ...(!ownerIds.length ? ['руководитель'] : []),
    ...(!amount ? ['сумма'] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const ownerName = staff.find((s) => s.id === ownerIds[0])?.fullName;
      await createProject({
        name: name.trim(),
        amount: amount || '0',
        currency,
        status: status as ProjectStatus,
        category: category || undefined,
        tags: tags.trim() || undefined,
        ownerName,
        ownerUserIds: ownerIds,
        leadId: leadId || undefined,
      });
      showToast('Проект создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать проект', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый проект" kicker="Проекты" sub="Статусы — из справочника тенанта"
      missing={missing} entityLabel="проект" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Название проекта" required value={name} onChangeText={setName} placeholder="Фасад БЦ «Marmara»" />
        <EntityField label="Сумма проекта" required value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
        <PickLabel label="Валюта" />
        <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
      </FieldCard>

      <FieldCard icon="flag-outline" title="Классификация">
        <PickLabel label="Статус" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={statuses.map((s) => ({ key: s.value, label: s.value }))} value={status} onChange={setStatus} />
        </View>
        <EntityField label="Категория" value={category} onChangeText={setCategory} placeholder="Разработка, дизайн…" />
        <EntityField label="Метки" value={tags} onChangeText={setTags} placeholder="фасад, приоритет, тендер" help="через запятую" />
      </FieldCard>

      <FieldCard icon="people-outline" title="Команда и лид">
        <PickLabel label="Руководитель и команда" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={ownerIds} onChange={setOwnerIds} multi />
        </View>
        <PickLabel label="Из какого лида" />
        <ChipPicker
          options={[{ key: '', label: 'Без лида' }, ...leads.slice(0, 20).map((l) => ({ key: l.id, label: l.name }))]}
          value={leadId}
          onChange={setLeadId}
        />
      </FieldCard>
    </EntityFormShell>
  );
};
