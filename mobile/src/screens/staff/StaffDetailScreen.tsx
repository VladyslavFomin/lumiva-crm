import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { fetchStaffMember, Staff } from '../../api/staff';

export const StaffDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const { id } = route.params;
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchStaffMember(id);
        setStaff(data);
      } catch (error) {
        console.error('Failed to load staff:', error);
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

  if (!staff) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.error }]}>Сотрудник не найден</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.info }]}>
          <Text style={styles.avatarText}>{staff.fullName[0]?.toUpperCase() || 'S'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{staff.fullName}</Text>
        {staff.position && <Text style={[styles.position, { color: colors.textSecondary }]}>{staff.position}</Text>}
        {staff.role && (
          <View style={[styles.roleBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>{staff.role}</Text>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Контактная информация</Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{staff.email}</Text>
        </View>
        {staff.phone && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Телефон:</Text>
            <Text style={[styles.value, { color: colors.text }]}>{staff.phone}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Статус:</Text>
          <Text style={[styles.value, { color: staff.isActive ? colors.success : colors.error }]}>
            {staff.isActive ? 'Активен' : 'Неактивен'}
          </Text>
        </View>
      </View>
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
  position: { fontSize: 16, marginBottom: 8 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
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
  error: { fontSize: 16 },
});








