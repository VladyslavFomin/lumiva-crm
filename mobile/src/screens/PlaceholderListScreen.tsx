import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  description?: string;
}

export const PlaceholderListScreen: React.FC<Props> = ({ title, description }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.subtitle}>{description}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardText}>Здесь будет список и детали из API</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f7fb' },
  title: { fontSize: 20, fontWeight: '700', color: '#222' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardText: { color: '#6b7280', fontSize: 13 },
});
