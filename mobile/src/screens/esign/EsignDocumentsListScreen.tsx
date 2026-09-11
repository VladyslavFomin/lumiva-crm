import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchEsignDocuments, EsignDocumentRow } from '../../api/esign';
import type { EsignStackParamList } from './EsignStack';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import type { PillTone } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<EsignStackParamList, 'EsignDocumentsList'>;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', sent: 'Отправлен', viewed: 'Просмотрен', signed: 'Подписан', declined: 'Отклонён', expired: 'Истёк',
};
const STATUS_TONE: Record<string, PillTone> = {
  draft: 'default', sent: 'acc', viewed: 'warn', signed: 'pos', declined: 'neg', expired: 'neg',
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const EsignDocumentsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<EsignDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setItems(await fetchEsignDocuments());
    } catch {
      showToast('Не удалось загрузить документы', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>Мои документы</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => navigation.navigate('EsignTemplates')}>
            <Ionicons name="reader-outline" size={17} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate('EsignDocumentCreate')}>
            <Ionicons name="add" size={19} color={colors.onInk} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{items.length}</Text> документов
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : items.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Нет документов" subtitle="Здесь появятся договоры и документы на подпись" />
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(item: EsignDocumentRow) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: EsignDocumentRow }) => (
            <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardContent}>
              <TouchableOpacity
                onPress={() => navigation.navigate('EsignDocumentDetail', { id: item.id })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardName, { color: colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>
                      {item.contactName || 'Без клиента'}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.kind}{item.docNo ? ` · ${item.docNo}` : ''}
                    </Text>
                  </View>
                  <Pill label={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status] || 'default'} />
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[styles.amount, { color: colors.text, fontFamily: fonts.bold }]}>
                    {item.amount != null ? formatMoney(item.amount, item.currency) : '—'}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.date, { color: colors.textSecondary }]}>{fmtDate(item.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </View>
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  card: { borderRadius: radius.xxl },
  cardContent: { padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  cardName: { fontSize: 14.5 },
  cardMeta: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amount: { fontSize: 17 },
  date: { fontSize: 12, fontFamily: fonts.regular },
});
