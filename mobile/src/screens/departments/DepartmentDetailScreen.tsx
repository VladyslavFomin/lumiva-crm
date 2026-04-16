import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchDepartment, Department } from '../../api/departments';

export const DepartmentDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDepartment(id);
        setDepartment(data);
      } catch (error) {
        console.error('Failed to load department:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!department) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.error }]}>Отдел не найден</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '15' }]}>
          <Ionicons name="business" size={32} color={colors.secondary} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{department.name}</Text>
      </View>

      {department.description && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Описание</Text>
          <Text style={[styles.description, { color: colors.text }]}>{department.description}</Text>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Информация</Text>
        <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Создан</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {new Date(department.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {department.updatedAt && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Обновлен</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {new Date(department.updatedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.editButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Departments', { screen: 'DepartmentEdit', params: { id: department.id } })}
        activeOpacity={0.8}
      >
        <Ionicons name="pencil" size={18} color="#fff" />
        <Text style={styles.editButtonText}>Редактировать</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  header: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 26, fontWeight: '700' },
  section: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 24 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 16, fontWeight: '600' },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { fontSize: 16 },
});



