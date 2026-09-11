import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchEsignTemplates, deleteEsignTemplate, EsignTemplate } from '../../api/esign';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const EsignTemplatesScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<EsignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setItems(await fetchEsignTemplates());
    } catch {
      showToast('Не удалось загрузить шаблоны', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { const unsub = navigation.addListener('focus', () => load()); return unsub; }, [navigation, load]);

  const confirmDelete = (t: EsignTemplate) => {
    Alert.alert('Удалить шаблон?', `«${t.name}» будет удалён без возможности восстановления.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          setItems((prev) => prev.filter((x) => x.id !== t.id));
          try {
            await deleteEsignTemplate(t.id);
          } catch {
            showToast('Не удалось удалить шаблон', { variant: 'error' });
            load();
          }
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
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Подписание</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate('EsignTemplateForm', {})}>
          <Ionicons name="add" size={18} color={colors.onInk} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Шаблоны документов</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{items.length} шаблонов</Text>

      {loading ? (
        <SkeletonList count={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Шаблонов нет" subtitle="Создайте первый шаблон договора" />
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(item: EsignTemplate) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: EsignTemplate }) => (
            <GlassCard variant="g" style={styles.card} contentStyle={styles.cardInner}>
              <TouchableOpacity onPress={() => navigation.navigate('EsignTemplateForm', { id: item.id })} activeOpacity={0.7}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>обновлён {fmtDate(item.updatedAt)}</Text>
                  </View>
                  <Pill label={item.kind} />
                </View>
              </TouchableOpacity>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('EsignTemplateForm', { id: item.id })}>
                  <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.actionTxt, { color: colors.textSecondary }]}>Изменить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item)}>
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <Text style={[styles.actionTxt, { color: colors.error }]}>Удалить</Text>
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
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: { fontSize: 15, fontFamily: fonts.semibold },
  cardMeta: { fontSize: 11.5, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionTxt: { fontSize: 12.5, fontFamily: fonts.medium },
});
