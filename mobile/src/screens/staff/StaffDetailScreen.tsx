import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchStaffMember, Staff, StaffRole } from '../../api/staff';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Владелец', manager: 'Менеджер', viewer: 'Наблюдатель', finance: 'Финансы', sales: 'Продажи', developer: 'Разработчик', support: 'Поддержка',
};

export const StaffDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaffMember(id).then(setStaff).catch(() => showToast('Не удалось загрузить сотрудника', { variant: 'error' })).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Сотрудник не найден</Text>
      </View>
    );
  }

  const properties = [
    { label: 'Email', value: staff.email, icon: 'mail-outline' as const, iconColor: colors.secondary, onPress: () => Linking.openURL(`mailto:${staff.email}`) },
    staff.phone && { label: 'Телефон', value: staff.phone, icon: 'call-outline' as const, iconColor: colors.success, onPress: () => Linking.openURL(`tel:${staff.phone}`) },
    staff.department && { label: 'Отдел', value: staff.department, icon: 'business-outline' as const, iconColor: colors.fg3 },
    staff.lastLoginAt && { label: 'Последний вход', value: new Date(staff.lastLoginAt).toLocaleString(appLocale()), icon: 'time-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string; onPress?: () => void }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Сотрудники</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={staff.fullName} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: colors.text }]}>{staff.fullName}</Text>
            <View style={styles.badgeRow}>
              <Pill label={ROLE_LABELS[staff.role] || staff.role} tone="default" />
              <Pill label={staff.isActive ? 'Активен' : 'Неактивен'} tone={staff.isActive ? 'pos' : 'neg'} />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => {
            const Row = p.onPress ? TouchableOpacity : View;
            return (
              <Row key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]} onPress={p.onPress} activeOpacity={0.7}>
                <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                  <Ionicons name={p.icon} size={16} color={p.iconColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                  <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.value}</Text>
                </View>
              </Row>
            );
          })}
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  name: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
});
