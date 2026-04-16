import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from './SalesStack';
import { fetchSale, Sale } from '../../api/sales';

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleDetail'>;

export const SaleDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const [item, setItem] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSale(id);
        setItem(data);
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

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Продажа не найдена</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Сделка #{item.id.slice(0, 8)}</Text>
      <Text style={styles.label}>
        Сумма: {(item.amount ?? 0).toLocaleString('ru-RU')} {item.currency || 'EUR'}
      </Text>
      <Text style={styles.label}>Статус: {item.status}</Text>
      <Text style={styles.label}>Дата: {item.saleDate || '—'}</Text>
      <Text style={styles.label}>Лид: {item.leadId || '—'}</Text>
      <Text style={styles.label}>Проект: {item.projectId || '—'}</Text>
      <Text style={styles.label}>Создан: {item.createdAt}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 14, color: '#374151', marginBottom: 6 },
});
