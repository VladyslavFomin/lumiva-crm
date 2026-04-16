import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { fetchLead, Lead, LeadStatusCode, updateLead, deleteLead } from '../../api/leads';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadDetail'>;

export const LeadDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    channel: '',
    status: 'new' as LeadStatusCode,
    note: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLead(id);
        setLead(data);
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          country: data.country || '',
          channel: data.channel || '',
          status: data.status,
          note: data.meta?.note || '',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text>Лид не найден</Text>
      </View>
    );
  }

  const statusColor = useMemo(() => {
    const map: Record<LeadStatusCode, string> = {
      new: '#0ea5e9',
      in_progress: '#fbbf24',
      waiting: '#a78bfa',
      won: '#22c55e',
      lost: '#ef4444',
    };
    return map[lead.status] || '#0ea5e9';
  }, [lead.status]);

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await updateLead({
        id: lead.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        country: form.country,
        source: form.channel,
        status: form.status,
        meta: { ...(lead.meta || {}), note: form.note },
      });
      setLead(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!lead) return;
    Alert.alert('Удалить лид?', 'Действие необратимо', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLead(lead.id);
            Alert.alert('Удалено', 'Лид удалён', [{ text: 'Ок', onPress: () => route.params && (route as any).navigation?.goBack?.() }]);
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{editing ? 'Редактирование лида' : lead.name || 'Без имени'}</Text>
          <Text style={styles.sub}>{lead.channel || '—'} · {new Date(lead.createdAt).toLocaleDateString()}</Text>
        </View>
        {!editing && (
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}1a`, borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel(lead.status)}</Text>
          </View>
        )}
      </View>

      {editing ? (
        <>
          <Card>
            <Text style={styles.overline}>Контакты</Text>
            <EditInput label="Имя" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <EditInput label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" />
            <EditInput label="Телефон" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <EditInput label="Страна" value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
          </Card>
          <Card>
            <Text style={styles.overline}>Детали</Text>
            <EditInput label="Канал" value={form.channel} onChangeText={(v) => setForm({ ...form, channel: v })} />
            <EditInput label="Статус" value={form.status} onChangeText={(v) => setForm({ ...form, status: v as LeadStatusCode })} />
            <EditInput label="Заметка" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} multiline />
          </Card>
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={[styles.buttonText, { color: '#0ea5e9' }]}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? 'Сохраняю...' : 'Сохранить'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.overline}>Контакты</Text>
            <InfoRow label="Email" value={lead.email || '—'} />
            <InfoRow label="Телефон" value={lead.phone || '—'} />
            <InfoRow label="Страна" value={lead.country || '—'} />
          </Card>

          <Card>
            <Text style={styles.overline}>Детали</Text>
            <InfoRow label="Канал" value={lead.channel || '—'} />
            <InfoRow label="Ответственный" value={lead.assignedTo || '—'} />
            <InfoRow label="Создан" value={new Date(lead.createdAt).toLocaleString()} />
            {lead.updatedAt ? <InfoRow label="Обновлён" value={new Date(lead.updatedAt).toLocaleString()} /> : null}
          </Card>

          {lead.meta && Object.keys(lead.meta).length > 0 && (
            <Card>
              <Text style={styles.overline}>Дополнительно</Text>
              {Object.entries(lead.meta).map(([key, val]) => (
                <InfoRow key={key} label={key} value={String(val)} />
              ))}
            </Card>
          )}

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={handleDelete}>
              <Text style={[styles.buttonText, { color: '#ef4444' }]}>Удалить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setEditing(true)}>
              <Text style={styles.buttonText}>Редактировать</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const statusLabel = (code: string) => {
  const map: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    waiting: 'Ожидает',
    won: 'Выигран',
    lost: 'Проигран',
  };
  return map[code?.toLowerCase()] || code || '—';
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.card}>{children}</View>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const EditInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: any;
}> = ({ label, value, onChangeText, multiline, keyboardType }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  overline: { fontSize: 12, letterSpacing: 1, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  label: { fontSize: 13, color: '#6b7280' },
  value: { fontSize: 14, color: '#0f172a', fontWeight: '600', marginLeft: 12, flex: 1, textAlign: 'right' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonGhost: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12 },
});
