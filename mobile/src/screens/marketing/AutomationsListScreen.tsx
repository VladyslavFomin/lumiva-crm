import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Switch, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchAutomations, updateAutomation, deleteAutomation, MarketingAutomation } from '../../api/marketing';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const TYPE_LABEL: Record<string, string> = { n8n_webhook: 'n8n · вебхук', n8n_schedule: 'n8n · по расписанию', other: 'Другое' };
const STATUS_TONE: Record<string, 'pos' | 'neg' | 'default'> = { success: 'pos', error: 'neg' };
const STATUS_LABEL: Record<string, string> = { success: 'успех', error: 'ошибка', pending: 'в очереди' };

function relTime(dateStr: string | null) {
  if (!dateStr) return 'ни разу не запускалась';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'запускалась только что';
  if (h < 24) return `запускалась ${h} ч назад`;
  return `запускалась ${Math.floor(h / 24)} дн назад`;
}

export const AutomationsListScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<MarketingAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setItems(await fetchAutomations());
    } catch {
      showToast('Не удалось загрузить автоматизации', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { const unsub = navigation.addListener('focus', () => load()); return unsub; }, [navigation, load]);

  const toggle = async (item: MarketingAutomation) => {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      await updateAutomation(item.id, { isActive: !item.isActive });
    } catch {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isActive: item.isActive } : x)));
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  };

  const confirmDelete = (item: MarketingAutomation) => {
    Alert.alert('Удалить автоматизацию?', `«${item.name}» будет удалена.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          setItems((prev) => prev.filter((x) => x.id !== item.id));
          try { await deleteAutomation(item.id); } catch { showToast('Не удалось удалить', { variant: 'error' }); load(); }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Маркетинг</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate('AutomationForm', {})}>
          <Ionicons name="add" size={18} color={colors.onInk} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Автоматизации</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{items.length} интеграций с вебхуками</Text>

      {loading ? (
        <SkeletonList count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="flash-outline" title="Автоматизаций нет" subtitle="Подключите первый вебхук (например, из n8n)" />
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(item: MarketingAutomation) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: MarketingAutomation }) => (
            <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
              <TouchableOpacity onPress={() => navigation.navigate('AutomationForm', { id: item.id })} activeOpacity={0.7} style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{TYPE_LABEL[item.type] || item.type} · {relTime(item.lastRunAt)}</Text>
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={() => toggle(item)}
                  trackColor={{ false: colors.line2, true: colors.success }}
                  thumbColor={colors.card}
                />
              </TouchableOpacity>
              <View style={styles.bottomRow}>
                {item.lastStatus && <Pill label={STATUS_LABEL[item.lastStatus] || item.lastStatus} tone={STATUS_TONE[item.lastStatus] || 'default'} />}
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: { borderRadius: 22 },
  cardInner: { padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 15, fontFamily: fonts.semibold },
  meta: { fontSize: 11.5, marginTop: 3 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
