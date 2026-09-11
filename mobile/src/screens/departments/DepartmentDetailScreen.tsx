import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchDepartment, fetchDepartments, fetchDepartmentStats, fetchDepartmentStaffRecursive, deleteDepartment, Department, DepartmentStats } from '../../api/departments';
import { fetchStaff, Staff } from '../../api/staff';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { AvatarInitials, showToast } from '../../components/ui';
import { StatGrid2 } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

export const DepartmentDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const { fmt } = useCurrencyMode();
  const [department, setDepartment] = useState<Department | null>(null);
  const [manager, setManager] = useState<Staff | null>(null);
  const [parent, setParent] = useState<Department | null>(null);
  const [children, setChildren] = useState<Department[]>([]);
  const [members, setMembers] = useState<Staff[]>([]);
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, allDepts, allStaff, recursiveStaff, statsData] = await Promise.all([
          fetchDepartment(id),
          fetchDepartments().catch(() => []),
          fetchStaff().catch(() => []),
          fetchDepartmentStaffRecursive(id).catch(() => []),
          fetchDepartmentStats(id).catch(() => null),
        ]);
        setDepartment(data);
        setParent(data.parentId ? allDepts.find((d) => d.id === data.parentId) || null : null);
        setChildren(allDepts.filter((d) => d.parentId === id));
        setManager(data.managerId ? allStaff.find((s) => s.id === data.managerId) || null : null);
        setMembers(recursiveStaff);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load department:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleDelete = () => {
    if (!department) return;
    Alert.alert('Удалить отдел?', `«${department.name}» будет удалён без возможности восстановления.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: () => {
          navigation.goBack();
          deleteDepartment(department.id)
            .then(() => showToast('Отдел удалён', { variant: 'success' }))
            .catch(() => showToast('Не удалось удалить отдел', { variant: 'error' }));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!department) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <Text style={{ color: colors.text }}>Отдел не найден</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Отделы</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('Departments', { screen: 'DepartmentEdit', params: { id: department.id } })}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={department.name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{department.name}</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {manager?.fullName || 'Без руководителя'} · {members.length} {members.length === 1 ? 'сотрудник' : 'сотрудников'}
            </Text>
          </View>
        </View>

        {stats && (
          <View style={{ marginBottom: spacing.md }}>
            <StatGrid2 items={[
              { label: 'Сотрудников', value: String(stats.staffCountRecursive) },
              { label: 'Лидов в работе', value: String(stats.leadsInProgress) },
              { label: 'Продаж за 30 дн', value: String(stats.salesClosed30d) },
              { label: 'Сумма продаж', value: fmt(stats.salesClosed30dAmount, undefined, { short: true }) },
            ]} />
            {stats.conversionPct != null && (
              <Text style={[styles.conversionNote, { color: colors.textSecondary }]}>
                Конверсия лидов в продажу: {stats.conversionPct.toFixed(1).replace('.', ',')}%
              </Text>
            )}
          </View>
        )}

        {children.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>ПОДОТДЕЛЫ · {children.length}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {children.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.memberRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                  onPress={() => navigation.navigate('Departments', { screen: 'DepartmentDetail', params: { id: c.id } })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="git-branch-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.memberName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </GlassCard>
          </>
        )}

        {department.description && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>ОПИСАНИЕ</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.description, { color: colors.text }]}>{department.description}</Text>
            </GlassCard>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>ПРОФИЛЬ</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <View style={[styles.infoRow, { borderTopColor: colors.line3 }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Руководитель</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{manager?.fullName || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.line3, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Родительский отдел</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{parent?.name || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopColor: colors.line3, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Создан</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{new Date(department.createdAt).toLocaleDateString('ru-RU')}</Text>
          </View>
          {department.updatedAt && (
            <View style={[styles.infoRow, { borderTopColor: colors.line3, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Обновлён</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{new Date(department.updatedAt).toLocaleDateString('ru-RU')}</Text>
            </View>
          )}
        </GlassCard>

        {members.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>СОСТАВ · {members.length}</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {members.map((s, i) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.memberRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                  onPress={() => navigation.navigate('Staff', { screen: 'StaffDetail', params: { id: s.id } })}
                  activeOpacity={0.7}
                >
                  <AvatarInitials name={s.fullName} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{s.fullName}</Text>
                    <Text style={[styles.memberRole, { color: colors.textSecondary }]} numberOfLines={1}>{s.role}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  backTxt: { fontSize: 16 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 3 },
  conversionNote: { fontSize: 12, fontFamily: fonts.regular, marginTop: spacing.sm, textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { marginHorizontal: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  memberName: { fontSize: 14, fontFamily: fonts.medium },
  memberRole: { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  description: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 21 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  infoLabel: { fontSize: 13, fontFamily: fonts.regular },
  infoValue: { fontSize: 13.5, fontFamily: fonts.medium },
});
