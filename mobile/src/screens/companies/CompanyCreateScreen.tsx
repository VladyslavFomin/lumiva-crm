import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createCompany } from '../../api/companies';
import { fetchStaff, Staff } from '../../api/staff';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

const INDUSTRIES = ['Строительство', 'Недвижимость', 'Логистика', 'Производство', 'Ритейл'];
const SIZES = ['1–10', '10–50', '50–200', '200+'];
const STATUSES = [{ key: 'active', label: 'Активна' }, { key: 'inactive', label: 'Неактивна' }];

export const CompanyCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [size, setSize] = useState(SIZES[2]);
  const [status, setStatus] = useState('active');
  const [ownerId, setOwnerId] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchStaff().then(setStaff).catch(() => {}); }, []);

  const missing = [
    ...(!name.trim() ? ['название'] : []),
    ...(!ownerId ? ['ответственный'] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const owner = staff.find((s) => s.id === ownerId);
      await createCompany({
        name: name.trim(),
        website: website || null,
        city: city || null,
        industry,
        size,
        status,
        assignedTo: owner?.fullName || null,
      });
      showToast('Компания создана', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать компанию', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новая компания" kicker="Компании" sub="Дубликаты проверяются по названию"
      missing={missing} entityLabel="компанию" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Название" required value={name} onChangeText={setName} placeholder="Marmara Group" />
        <EntityField label="Сайт" value={website} onChangeText={setWebsite} placeholder="company.com" autoCapitalize="none" />
        <EntityField label="Город" value={city} onChangeText={setCity} placeholder="İstanbul" />
      </FieldCard>

      <FieldCard icon="layers-outline" title="Профиль">
        <PickLabel label="Отрасль" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={INDUSTRIES.map((v) => ({ key: v, label: v }))} value={industry} onChange={setIndustry} />
        </View>
        <PickLabel label="Размер" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={SIZES.map((v) => ({ key: v, label: v }))} value={size} onChange={setSize} />
        </View>
        <PickLabel label="Статус" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={STATUSES} value={status} onChange={setStatus} />
        </View>
        <PickLabel label="Ответственный" />
        <ChipPicker options={staff.map((s) => ({ key: s.id, label: s.fullName }))} value={ownerId} onChange={setOwnerId} />
      </FieldCard>
    </EntityFormShell>
  );
};
