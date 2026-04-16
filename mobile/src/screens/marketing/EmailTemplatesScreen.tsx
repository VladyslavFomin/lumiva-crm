import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchEmailTemplates, EmailTemplate } from '../../api/marketing';

export const EmailTemplatesScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await fetchEmailTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Marketing', { screen: 'EmailTemplateCreate' })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Создать шаблон</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={() => navigation.navigate('Marketing', { screen: 'EmailTemplateDetail', params: { id: item.id } })}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.templateIcon, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="mail" size={24} color={colors.info} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.templateType, { color: colors.textSecondary }]}>{item.type}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
            <View style={[styles.templatePreview, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.templateSubject, { color: colors.text }]} numberOfLines={1}>
                {item.subject}
              </Text>
              <Text style={[styles.templateBody, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.body.replace(/<[^>]*>/g, '')}
              </Text>
            </View>
            <View style={[styles.templateFooter, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.templateDate, { color: colors.textTertiary }]}>
                Обновлен: {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет шаблонов</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Создайте первый email шаблон</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  templateType: { fontSize: 13 },
  templatePreview: {
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  templateSubject: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  templateBody: { fontSize: 14, lineHeight: 20 },
  templateFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  templateDate: { fontSize: 12 },
  emptyState: {
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 32,
  },
  emptyText: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});



