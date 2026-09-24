import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CcpStackParamList } from './CcpStack';
import { ccpApi, CcpSite, CcpClient } from '../../api/ccp';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<CcpStackParamList, 'CcpClients'>;

function fmt(v: string | number) {
  const n = Number(v || 0);
  return n.toLocaleString(appLocale(), { maximumFractionDigits: 2 });
}

export const CcpClientsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sites, setSites] = useState<CcpSite[]>([]);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [clients, setClients] = useState<CcpClient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    ccpApi.sites().then(setSites).catch(() => {});
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await ccpApi.clients({ siteId, search: search || undefined, per: 50 });
      setClients(res.items);
      setTotal(res.total);
    } catch {
      showToast('Не удалось загрузить клиентов', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Счета клиентов</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{total}</Text> клиентов
        </Text>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Имя, email…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {sites.length > 1 && (
        <View style={styles.siteRow}>
          {[{ id: undefined, siteHost: 'Все сайты' } as any, ...sites].map((s) => (
            <TouchableOpacity
              key={s.id || 'all'}
              onPress={() => setSiteId(s.id)}
              style={[styles.siteChip, { backgroundColor: siteId === s.id ? colors.ink : colors.surfaceVariant, borderColor: siteId === s.id ? colors.ink : colors.glassBorder }]}
            >
              <Text style={{ color: siteId === s.id ? colors.onInk : colors.text, fontSize: 12, fontFamily: fonts.medium }} numberOfLines={1}>{s.siteHost || s.siteUrl || 'Сайт'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <SkeletonList count={6} />
      ) : clients.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Нет клиентов" subtitle="Клиентские аккаунты синхронизируются с подключённого сайта" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={clients}
            keyExtractor={(item: CcpClient) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: CcpClient }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.line3 }]}
                onPress={() => navigation.navigate('CcpClientDetail', { id: item.id })}
                activeOpacity={0.7}
              >
                <AvatarInitials name={item.name || item.email} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name || item.email}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>{item.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.balance, { color: colors.text, fontFamily: fonts.monoSemibold }]}>€{fmt(item.balanceEur)}</Text>
                  <Text style={[styles.balance, { color: colors.textTertiary, fontFamily: fonts.mono }]}>${fmt(item.balanceUsd)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </GlassCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  siteRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  siteChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  balance: { fontSize: 12.5 },
});
