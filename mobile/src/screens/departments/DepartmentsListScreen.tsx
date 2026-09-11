import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { fetchDepartmentsTree, fetchDepartmentsSummary, DepartmentNode, DepartmentsSummary } from '../../api/departments';
import { AuraBackground, GlassCard } from '../../components/glass';
import { StatGrid2 } from '../../components/mg';

const DEPT_COLORS = ['#1769d1', '#1f8a5e', '#c08319', '#3b6cb6', '#5a45a8', '#cc2f47', '#222'];

function getDeptColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length];
}

function colorWithAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

export const DepartmentsListScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tree, setTree] = useState<DepartmentNode[]>([]);
  const [summary, setSummary] = useState<DepartmentsSummary | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [treeData, summaryData] = await Promise.all([fetchDepartmentsTree(), fetchDepartmentsSummary()]);
      setTree(treeData);
      setSummary(summaryData);
      setCount(summaryData.departmentsCount);
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flatten = (nodes: DepartmentNode[], depth = 0): { node: DepartmentNode; depth: number }[] =>
    nodes.flatMap((n) => [{ node: n, depth }, ...flatten(n.children || [], depth + 1)]);
  const rows = flatten(tree);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.largeTitle, { color: colors.text }]}>Отделы</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.ink }]}
            onPress={() => navigation.navigate('Departments', { screen: 'DepartmentCreate' })}
          >
            <Ionicons name="add" size={20} color={colors.onInk} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{count}</Text>
          {' '}отделов
        </Text>
      </View>

      {summary && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <StatGrid2 items={[
            { label: 'Сотрудников в отделах', value: String(summary.staffInDepartments) },
            { label: 'Без отдела', value: String(summary.unassignedStaffCount) },
            { label: 'Без руководителя', value: String(summary.departmentsWithoutManager) },
            { label: 'Активных сотрудников', value: String(summary.totalActiveStaff) },
          ]} />
        </View>
      )}

      {/* Tree */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 8, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map(({ node: dept, depth }) => {
          const color = getDeptColor(dept.name);
          return (
            <GlassCard key={dept.id} variant="flat" style={[styles.card, depth > 0 && { marginLeft: depth * 20 }]}>
            <TouchableOpacity
              style={styles.cardTouchable}
              onPress={() => navigation.navigate('Departments', { screen: 'DepartmentDetail', params: { id: dept.id } })}
              activeOpacity={0.7}
            >
              <View style={[styles.deptIcon, { backgroundColor: colorWithAlpha(color, 0.1) }]}>
                <Ionicons name={depth > 0 ? 'git-branch-outline' : 'business-outline'} size={18} color={color} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.deptName, { color: colors.text }]}>{dept.name}</Text>
                {dept.description ? (
                  <Text style={[styles.deptDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                    {dept.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
            </GlassCard>
          );
        })}

        {count === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>Нет отделов</Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.ink }]}
              onPress={() => navigation.navigate('Departments', { screen: 'DepartmentCreate' })}
            >
              <Text style={[styles.createBtnTxt, { color: colors.onInk }]}>Создать отдел</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, fontFamily: fonts.regular, letterSpacing: -0.2 },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  card: { borderRadius: 16 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  deptIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardContent: { flex: 1, minWidth: 0 },
  deptName: { fontSize: 15, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  deptDesc: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 15, fontFamily: fonts.medium },
  createBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  createBtnTxt: { fontSize: 14, fontFamily: fonts.semibold },
});
