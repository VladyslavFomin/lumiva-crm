import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createEsignTemplate, updateEsignTemplate, fetchEsignTemplates, EsignTemplate } from '../../api/esign';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

const KIND_OPTIONS = ['Договор', 'Акт', 'Счёт-договор', 'Согласие', 'Прочее'];

export const EsignTemplateFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editId: string | undefined = route.params?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('Договор');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [fileNamePattern, setFileNamePattern] = useState('{KIND}-{NAME}-{CONTRACT_DATE}');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    fetchEsignTemplates().then((list) => {
      const t = list.find((x) => x.id === editId);
      if (t) {
        setName(t.name);
        setDescription(t.description || '');
        setKind(t.kind);
        setBodyTemplate(t.bodyTemplate);
        setFileNamePattern(t.fileNamePattern);
      }
    }).catch(() => showToast('Не удалось загрузить шаблон', { variant: 'error' })).finally(() => setLoading(false));
  }, [editId]);

  const missing = [
    ...(!name.trim() ? ['название'] : []),
    ...(!bodyTemplate.trim() ? ['текст шаблона'] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, kind, bodyTemplate: bodyTemplate.trim(), fileNamePattern: fileNamePattern.trim() || undefined };
      if (editId) {
        await updateEsignTemplate(editId, payload);
        showToast('Шаблон обновлён', { variant: 'success' });
      } else {
        await createEsignTemplate(payload);
        showToast('Шаблон создан', { variant: 'success' });
      }
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось сохранить шаблон', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <EntityFormShell
      title={editId ? 'Изменить шаблон' : 'Новый шаблон'} kicker="Подписание" sub="Используйте {KEY} — список ключей смотрите в карточке документа"
      missing={missing} entityLabel="шаблон" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard icon="document-text-outline" title="Основное">
        <EntityField label="Название шаблона" required value={name} onChangeText={setName} placeholder="Договор оказания услуг" />
        <PickLabel label="Тип документа" />
        <ChipPicker options={KIND_OPTIONS.map((k) => ({ key: k, label: k }))} value={kind} onChange={setKind} />
        <EntityField label="Описание" value={description} onChangeText={setDescription} placeholder="Необязательно" />
        <EntityField label="Шаблон имени файла" value={fileNamePattern} onChangeText={setFileNamePattern} placeholder="{KIND}-{NAME}-{CONTRACT_DATE}" />
      </FieldCard>

      <FieldCard icon="create-outline" title="Текст документа">
        <EntityField
          label="Текст шаблона" required value={bodyTemplate} onChangeText={setBodyTemplate}
          placeholder={'Договор № {CONTRACT_NO} от {CONTRACT_DATE}\n\nЗаказчик: {NAME}, {ADDRESS}\n...'}
          multiline
          help="{NAME}, {PHONE}, {EMAIL}, {AMOUNT}, {CONTRACT_NO}, {CONTRACT_DATE}, {SERVICE}, {TERM}, {PAY_TERMS}, {ORG_NAME}, {MANAGER}, {TODAY} и другие"
        />
      </FieldCard>
    </EntityFormShell>
  );
};
