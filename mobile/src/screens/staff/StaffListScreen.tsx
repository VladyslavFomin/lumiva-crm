import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchStaff, Staff, StaffRole } from '../../api/staff';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Владелец', manager: 'Менеджер', viewer: 'Наблюдатель', finance: 'Финансы', sales: 'Продажи', developer: 'Разработчик', support: 'Поддержка',
};

export const StaffListScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'all' | 'active' | 'inactive'>('active');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setStaff(await fetchStaff());
    } catch {
      showToast('Не удалось загрузить сотрудников', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = staff;
    if (segment === 'active') res = res.filter((s) => s.isActive);
    if (segment === 'inactive') res = res.filter((s) => !s.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((s) => s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.department || '').toLowerCase().includes(q));
    }
    return res;
  }, [staff, search, segment]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Сотрудники</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{filtered.length}</Text> из {staff.length}
        </Text>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Имя, отдел, email…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Segmented
        options={[
          { key: 'active', label: 'Активные' },
          { key: 'inactive', label: 'Неактивные' },
          { key: 'all', label: 'Все' },
        ]}
        activeKey={segment}
        onChange={(key) => setSegment(key as typeof segment)}
      />

      {loading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="people-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет сотрудников" subtitle={search ? 'Попробуйте изменить запрос' : undefined} />
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={(item: Staff) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Staff }) => (
            <GlassCard variant="flat" style={[styles.row, { opacity: item.isActive ? 1 : 0.6 }]}>
            <TouchableOpacity
              style={styles.rowContent}
              onPress={() => navigation.navigate('Staff', { screen: 'StaffDetail', params: { id: item.id } })}
              activeOpacity={0.7}
            >
              <AvatarInitials name={item.fullName} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.fullName}</Text>
                {item.department ? <Text style={[styles.department, { color: colors.textSecondary }]} numberOfLines={1}>{item.department}</Text> : null}
              </View>
              <Pill label={ROLE_LABELS[item.role] || item.role} tone="default" />
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
            </GlassCard>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  row: { borderRadius: radius.xxl },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 14.5, fontFamily: fonts.semibold },
  department: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
});
