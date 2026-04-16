import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { createLead } from '../../api/leads';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadCreate'>;

export const LeadCreateScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState<'new' | 'in_progress' | 'waiting' | 'won' | 'lost'>('new');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name && !email && !phone) {
      Alert.alert('Ошибка', 'Укажите хотя бы имя или контакт');
      return;
    }
    setLoading(true);
    try {
      await createLead({
        name: name || 'Без имени',
        email: email || null,
        phone: phone || null,
        source: channel || null,
        status,
        meta: note ? { note } : {},
      });
      Alert.alert('Успех', 'Лид создан', [
        { text: 'Ок', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = normalizeMessage(e?.response?.data?.message || e?.message);
      Alert.alert('Ошибка', msg || 'Не удалось создать лид');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Новый лид</Text>

      <LabelInput label="Имя" value={name} onChangeText={setName} placeholder="Имя клиента" />
      <LabelInput label="Email" value={email} onChangeText={setEmail} placeholder="example@site.com" keyboardType="email-address" />
      <LabelInput label="Телефон" value={phone} onChangeText={setPhone} placeholder="+1 000 000" keyboardType="phone-pad" />
      <LabelInput label="Канал/Источник" value={channel} onChangeText={setChannel} placeholder="online-chat, ads, seo..." />
      <LabelInput label="Статус" value={status} onChangeText={(t) => setStatus(t as any)} placeholder="new | in_progress | waiting | won | lost" />
      <LabelInput label="Заметка" value={note} onChangeText={setNote} placeholder="Комментарий" multiline />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Создать</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const LabelInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}> = ({ label, value, onChangeText, placeholder, multiline, keyboardType }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { height: 100, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

function normalizeMessage(msg: any): string | undefined {
  if (Array.isArray(msg)) return msg.join('\n');
  if (msg && typeof msg === 'object') return JSON.stringify(msg);
  if (typeof msg === 'string') return msg;
  return undefined;
}
