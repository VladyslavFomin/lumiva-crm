import React, { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createSegment } from '../../api/marketing';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

const STATUS_OPTIONS = [
  { key: 'new', label: 'Новый' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'waiting', label: 'Ожидает' },
  { key: 'won', label: 'Успех' },
  { key: 'lost', label: 'Проигран' },
];

export const SegmentCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('');
  const [manager, setManager] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const missing = [...(!name.trim() ? ['название'] : [])];

  const submit = async () => {
    setSaving(true);
    try {
      await createSegment({
        name: name.trim(),
        description: description.trim() || undefined,
        filters: {
          statuses: status ? [status] : undefined,
          sources: source.trim() ? [source.trim()] : undefined,
          countries: country.trim() ? [country.trim()] : undefined,
          managers: manager.trim() ? [manager.trim()] : undefined,
          createdFrom: createdFrom.trim() || undefined,
          createdTo: createdTo.trim() || undefined,
        },
      });
      showToast('Сегмент создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать сегмент', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый сегмент" kicker="Маркетинг" sub="Сегменты строятся только по лидам; таргетинг по кампаниям — на ПК"
      missing={missing} entityLabel="сегмент" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Название сегмента" required value={name} onChangeText={setName} placeholder="Тёплые лиды из Стамбула" />
        <EntityField label="Описание" value={description} onChangeText={setDescription} placeholder="Необязательно" />
      </FieldCard>

      <FieldCard icon="funnel-outline" title="Фильтры лидов">
        <PickLabel label="Статус" />
        <ChipPicker options={[{ key: '', label: 'Любой' }, ...STATUS_OPTIONS]} value={status} onChange={setStatus} />
        <EntityField label="Источник" value={source} onChangeText={setSource} placeholder="сайт, реклама, рекомендация…" />
        <EntityField label="Страна" value={country} onChangeText={setCountry} placeholder="Turkey, Russia…" />
        <EntityField label="Ответственный" value={manager} onChangeText={setManager} placeholder="Имя менеджера" />
      </FieldCard>

      <FieldCard icon="calendar-outline" title="Период создания лида">
        <EntityField label="С" value={createdFrom} onChangeText={setCreatedFrom} placeholder="ГГГГ-ММ-ДД" />
        <EntityField label="По" value={createdTo} onChangeText={setCreatedTo} placeholder="ГГГГ-ММ-ДД" />
      </FieldCard>
    </EntityFormShell>
  );
};
