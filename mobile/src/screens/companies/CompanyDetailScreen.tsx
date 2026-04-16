import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { fetchCompany, Company } from '../../api/companies';

export const CompanyDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const { id } = route.params;
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCompany(id);
        setCompany(data);
      } catch (error) {
        console.error('Failed to load company:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.error }]}>Компания не найдена</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={styles.avatarText}>{company.name[0]?.toUpperCase() || 'C'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{company.name}</Text>
        {company.industry && <Text style={[styles.industry, { color: colors.textSecondary }]}>{company.industry}</Text>}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Контактная информация</Text>
        {company.email && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{company.email}</Text>
          </View>
        )}
        {company.phone && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Телефон:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{company.phone}</Text>
          </View>
        )}
        {company.website && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Сайт:</Text>
            <Text style={[styles.value, { color: colors.primary }]}>{company.website}</Text>
          </View>
        )}
        {company.address && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Адрес:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{company.address}</Text>
          </View>
        )}
      </View>

      {company.description && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Описание</Text>
          <Text style={[styles.description, { color: colors.text }]}>{company.description}</Text>
        </View>
      )}

      {company.tags.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Теги</Text>
          <View style={styles.tags}>
            {company.tags.map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  header: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 32 },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  industry: { fontSize: 16 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 8 },
  label: { fontSize: 14, marginRight: 8, width: 80 },
  value: { fontSize: 14, flex: 1 },
  description: { fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },
  error: { fontSize: 16 },
});








