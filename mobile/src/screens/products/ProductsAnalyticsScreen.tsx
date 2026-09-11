import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts, fetchProductCategories, Product, ProductCategory } from '../../api/products';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useCurrencyMode } from '../../context/CurrencyModeContext';

const STATUS_LABEL: Record<string, string> = { active: 'Активен', draft: 'Черновик', archived: 'В архиве', out_of_stock: 'Нет в наличии' };

export const ProductsAnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProducts({ limit: 100 }), fetchProductCategories()])
      .then(([p, c]) => { setProducts(p.items); setTotal(p.total); setCategories(c); })
      .catch(() => showToast('Не удалось загрузить аналитику', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const totalValue = useMemo(() => products.reduce((s, p) => s + toDisplay((p.price || 0) * (p.quantity || 0), p.currency), 0), [products, toDisplay]);
  const lowStock = useMemo(() => products.filter((p) => p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold), [products]);

  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach((p) => { m[p.status] = (m[p.status] || 0) + 1; });
    const palette: Record<string, string> = { active: colors.success, draft: colors.fg3, archived: colors.fg3, out_of_stock: colors.error };
    return Object.entries(m).map(([status, value]) => ({ label: STATUS_LABEL[status] || status, value, color: palette[status] || colors.fg3 }));
  }, [products, colors]);

  const categoryBreakdown = useMemo(() => {
    const nameById: Record<string, string> = {};
    categories.forEach((c) => { nameById[c.id] = c.name; });
    const m: Record<string, number> = {};
    products.forEach((p) => {
      const name = (p.categoryId && nameById[p.categoryId]) || 'Без категории';
      m[name] = (m[name] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(m));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }));
  }, [products, categories]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Товары</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.largeTitle, { color: colors.text }]}>Аналитика</Text>
        {products.length < total && (
          <Text style={[styles.limitNote, { color: colors.textTertiary }]}>По первым {products.length} из {total} товаров</Text>
        )}

        {loading ? (
          <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ТОВАРОВ</Text>
                <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]}>{total}</Text>
              </GlassCard>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.error }]}>МАЛО НА СКЛАДЕ</Text>
                <Text style={[styles.kpiValue, { color: colors.error, fontFamily: fonts.bold }]}>{lowStock.length}</Text>
              </GlassCard>
            </View>
            <View style={styles.kpiGrid}>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>СТОИМОСТЬ СКЛАДА</Text>
                <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>{fmt(totalValue)}</Text>
              </GlassCard>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>КАТЕГОРИЙ</Text>
                <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]}>{categories.length}</Text>
              </GlassCard>
            </View>

            {statusBreakdown.length > 0 && (
              <GlassCard variant="g" style={styles.widget}>
                <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО СТАТУСУ</Text>
                <View style={styles.donutBars}>
                  {statusBreakdown.map((d, i) => (
                    <View key={i} style={{ height: 8, flex: d.value, backgroundColor: d.color, borderRadius: radius.sm }} />
                  ))}
                </View>
                <View style={{ gap: 7, marginTop: spacing.sm }}>
                  {statusBreakdown.map((d, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color }} />
                        <Text style={{ fontSize: 12, color: colors.text, flex: 1, fontFamily: fonts.regular }} numberOfLines={1}>{d.label}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.mono }}>{d.value}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            )}

            {categoryBreakdown.length > 0 && (
              <GlassCard variant="g" style={styles.widget}>
                <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО КАТЕГОРИЯМ</Text>
                {categoryBreakdown.map((c, i) => (
                  <View key={i} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < categoryBreakdown.length - 1 ? 1 : 0 }]}>
                    <Text style={[styles.srcName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{c.name}</Text>
                    <View style={[styles.srcTrack, { backgroundColor: colors.surfaceVariant }]}>
                      <View style={[styles.srcFill, { width: `${Math.max(c.pct, 8)}%`, backgroundColor: colors.ink }]}>
                        <Text style={[styles.srcFillTxt, { color: colors.onInk, fontFamily: fonts.semibold }]}>{c.count}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}

            <Text style={[styles.widgetOverline, { color: colors.textSecondary, paddingHorizontal: spacing.xxl, marginTop: spacing.sm }]}>МАЛО НА СКЛАДЕ</Text>
            {lowStock.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" title="Всё в достатке" subtitle="Товаров с низким остатком нет" />
            ) : (
              <GlassCard variant="g2" style={styles.listCard}>
                {lowStock.slice(0, 10).map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.stockRow, { borderBottomColor: colors.line3, borderBottomWidth: i < Math.min(lowStock.length, 10) - 1 ? 1 : 0 }]}
                    onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stockName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.stockQty, { color: colors.error, fontFamily: fonts.monoSemibold }]}>{p.quantity} {p.unit || 'шт'}</Text>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  limitNote: { fontSize: 11, fontFamily: fonts.regular, paddingHorizontal: spacing.lg },
  kpiGrid: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm },
  kpiTile: { flex: 1, borderRadius: radius.xxl, padding: 14 },
  kpiLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 20, letterSpacing: -0.4, marginTop: 4 },
  widget: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.lg },
  widgetOverline: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  donutBars: { flexDirection: 'row', gap: 3 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  srcName: { width: 100, fontSize: 13 },
  srcTrack: { flex: 1, height: 22, borderRadius: radius.sm, overflow: 'hidden' },
  srcFill: { height: '100%', borderRadius: radius.sm, justifyContent: 'center', paddingLeft: 8, minWidth: 30 },
  srcFillTxt: { fontSize: 11 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, marginBottom: spacing.sm, overflow: 'hidden' },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: spacing.sm },
  stockName: { fontSize: 13.5, fontFamily: fonts.medium, flex: 1 },
  stockQty: { fontSize: 12 },
});
