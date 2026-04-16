import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { fetchProjects, Project } from '../../api/projects';
import type { ProjectsStackParamList } from './ProjectsStack';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectsList'>;

export const ProjectsListScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchProjects();
      setItems(res.items);
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
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProjectDetail', { id: item.id })}
            style={styles.card}
          >
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.channel}>{item.category || 'Без категории'}</Text>
            <Text style={styles.meta}>
              {item.amount.toLocaleString('ru-RU')} {item.currency}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Нет проектов</Text>
            </View>
          ) : null
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
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
  status: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase' },
  channel: { marginTop: 4, fontSize: 13, color: '#374151' },
  meta: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280' },
});
