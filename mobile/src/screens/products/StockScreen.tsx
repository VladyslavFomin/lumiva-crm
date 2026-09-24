import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts, Product } from '../../api/products';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

/** RN port of `mglass-sales.jsx`'s `StockScreen`. The design also shows "резерв"/"свободно"
 * (reserved/free) per item — dropped, `Product` has no reserved-stock concept, only a single
 * `quantity`; showing a fake reservation split would be fabricated data. `lowStockThreshold` is
 * real though, so the bar turns warning-colored under it instead of the design's flat
 * red-at-zero rule — a small, honest improvement the real data supports. */
export const StockScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt } = useCurrencyMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts({ limit: 500 })
      .then(({ items }) => setProducts(items))
      .catch(() => showToast(t('stock.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [t]);

  const stocked = useMemo(() => products.filter((p) => !p.isVariable && p.quantity != null).sort((a, b) => b.quantity - a.quantity), [products]);
  const maxQty = Math.max(1, ...stocked.map((p) => p.quantity));
  const totalValue = useMemo(() => stocked.reduce((a, p) => a + p.quantity * (p.salePrice ?? p.price), 0), [stocked]);
  const zeroCount = stocked.filter((p) => p.quantity === 0).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('stock.backTitle')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('stock.title')}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{stocked.length} {t('stock.subtitle')}</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        <GlassCard variant="g" style={styles.valueCard} contentStyle={{ padding: spacing.lg }}>
          <View style={styles.valueHead}>
            <Text style={[styles.kicker, { color: colors.textTertiary }]}>{t('stock.stockValue')}</Text>
            {zeroCount > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.warningBg }]}>
                <Text style={[styles.pillTxt, { color: colors.warning }]}>{zeroCount} {t('stock.itemsAtZero')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.valueAmount, { color: colors.text }]}>{fmt(totalValue, undefined, { short: true })}</Text>
        </GlassCard>

        {loading ? (
          <SkeletonList count={5} />
        ) : stocked.length === 0 ? (
          <EmptyState icon="cube-outline" title={t('stock.empty.title')} subtitle={t('stock.empty.subtitle')} />
        ) : (
          <GlassCard variant="g" style={styles.listCard} contentStyle={{ padding: spacing.lg }}>
            <View style={styles.listHead}>
              <Ionicons name="cube-outline" size={16} color={colors.text} />
              <Text style={[styles.listTitle, { color: colors.text }]}>{t('stock.listTitle')}</Text>
            </View>
            {stocked.map((p, i) => {
              const low = p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold;
              const barColor = p.quantity === 0 ? colors.error : low ? colors.warning : colors.accent;
              return (
                <TouchableOpacity key={p.id} style={[styles.row, i > 0 && { marginTop: spacing.sm }]} onPress={() => navigation.navigate('ProductDetail', { id: p.id })} activeOpacity={0.7}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.rowQty, { color: colors.textSecondary, fontFamily: fonts.mono }]}>{p.quantity} {p.unit || t('stock.unit')}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={{ width: `${Math.max(2, (p.quantity / maxQty) * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: barColor }} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  valueCard: { borderRadius: radius.xxl },
  valueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8 },
  valueAmount: { fontSize: 30, fontFamily: fonts.bold, letterSpacing: -0.5, marginTop: 6 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  pillTxt: { fontSize: 10.5, fontFamily: fonts.semibold },
  listCard: { borderRadius: radius.xxl },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  listTitle: { fontSize: 15, fontFamily: fonts.semibold },
  row: {},
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { flex: 1, fontSize: 13, minWidth: 0 },
  rowQty: { fontSize: 12.5 },
  track: { height: 5, borderRadius: 999, overflow: 'hidden', marginTop: 5 },
});
