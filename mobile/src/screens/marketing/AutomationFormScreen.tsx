import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createAutomation, updateAutomation, fetchAutomations } from '../../api/marketing';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

const TYPE_OPTIONS = [
  { key: 'n8n_webhook', label: 'n8n · вебхук' },
  { key: 'n8n_schedule', label: 'n8n · по расписанию' },
  { key: 'other', label: 'Другое' },
];

export const AutomationFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editId: string | undefined = route.params?.id;

  const [name, setName] = useState('');
  const [type, setType] = useState('n8n_webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    fetchAutomations().then((list) => {
      const a = list.find((x) => x.id === editId);
      if (a) { setName(a.name); setType(a.type); setWebhookUrl(a.webhookUrl || ''); }
    }).catch(() => showToast('Не удалось загрузить автоматизацию', { variant: 'error' })).finally(() => setLoading(false));
  }, [editId]);

  const missing = [...(!name.trim() ? ['название'] : [])];

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { name: name.trim(), type, webhookUrl: webhookUrl.trim() || undefined };
      if (editId) {
        await updateAutomation(editId, payload);
        showToast('Автоматизация обновлена', { variant: 'success' });
      } else {
        await createAutomation(payload);
        showToast('Автоматизация создана', { variant: 'success' });
      }
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось сохранить автоматизацию', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <EntityFormShell
      title={editId ? 'Изменить автоматизацию' : 'Новая автоматизация'} kicker="Маркетинг" sub="Подключение вебхука (например, из n8n)"
      missing={missing} entityLabel="автоматизацию" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard icon="flash-outline" title="Основное">
        <EntityField label="Название" required value={name} onChangeText={setName} placeholder="Уведомление о новом лиде" />
        <PickLabel label="Тип" />
        <ChipPicker options={TYPE_OPTIONS} value={type} onChange={setType} />
        <EntityField label="Webhook URL" value={webhookUrl} onChangeText={setWebhookUrl} placeholder="https://n8n.example.com/webhook/…" keyboardType="url" autoCapitalize="none" />
      </FieldCard>
    </EntityFormShell>
  );
};
