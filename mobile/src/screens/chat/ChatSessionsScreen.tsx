import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { fetchChatSessions, ChatSession } from '../../api/chat';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from './ChatStack';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatSessions'>;

export const ChatSessionsScreen: React.FC<Props> = ({ navigation }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchChatSessions({ status: 'open' });
      setSessions(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatMessages', { id: item.id })}
            style={styles.card}
          >
            <View style={styles.row}>
              <Text style={styles.name}>{item.visitorName || item.visitorEmail || 'Гость'}</Text>
              {item.unread ? <Text style={styles.badge}>NEW</Text> : null}
            </View>
            <Text style={styles.meta}>{item.siteHost}</Text>
            <Text style={styles.meta}>Статус: {item.status}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Нет активных чатов</Text>
            </View>
          ) : null
        }
        contentContainerStyle={sessions.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  badge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  meta: { marginTop: 4, fontSize: 13, color: '#374151' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280' },
});
