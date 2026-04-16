import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from './ChatStack';
import { fetchChatMessages, sendChatMessage, ChatMessage } from '../../api/chat';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatMessages'>;

export const ChatMessagesScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

  const load = async () => {
    const res = await fetchChatMessages(id);
    setMessages(res);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = await sendChatMessage(id, text.trim());
    setMessages((prev) => [...prev, msg]);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.sender === 'staff';
          return (
            <View style={[styles.msgWrap, mine ? styles.msgRight : styles.msgLeft]}>
              <View style={[styles.msg, mine ? styles.msgMine : styles.msgOther]}>
                <Text style={mine ? styles.msgTextMine : styles.msgText}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 12 }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Напишите сообщение…"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.send} onPress={handleSend}>
          <Text style={styles.sendText}>Отправить</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  msgWrap: { marginBottom: 8 },
  msgLeft: { alignItems: 'flex-start' },
  msgRight: { alignItems: 'flex-end' },
  msg: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
  },
  msgOther: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  msgMine: {
    backgroundColor: '#2563eb',
  },
  msgText: { color: '#111827' },
  msgTextMine: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    minHeight: 40,
    maxHeight: 120,
  },
  send: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
