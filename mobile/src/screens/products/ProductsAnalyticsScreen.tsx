import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProductsAnalytics, ProductsAnalytics } from '../../api/products';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Segmented, StatGrid2, FunnelBars, Sparkline, Pill } from '../../components/mg';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { appLocale, formatDecimal } from '../../i18n/format';

type Tab = 'sum' | 'top' | 'stock';

export const ProductsAnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, fxParams, fxKey, ready: fxReady, mode } = useCurrencyMode();
  const [tab, setTab] = useState<Tab>('sum');
  const [data, setData] = useState<ProductsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!fxReady) return;
    setLoading(true);
    // Native mode: no conversion requested, so send no rates (server then keeps raw amounts).
    fetchProductsAnalytics({ displayCurrency: fxParams.displayCurrency, ...(mode === 'converted' ? { rates: fxParams.rates } : {}) })
      .then(setData)
      .catch(() => showToast('Не удалось загрузить аналитику', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxKey]);

  useEffect(() => { load(); }, [load]);

  const cur = data?.displayCurrency;
  const money = (v: number) => fmt(v, cur, { short: true });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Товары</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.largeTitle, { color: colors.text }]}>Аналитика</Text>

      <View style={styles.segWrap}>
        <Segmented
          options={[
            { key: 'sum', label: 'Сводка' },
            { key: 'top', label: 'Топ' },
            { key: 'stock', label: 'Склад' },
          ]}
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </View>

      {loading || !data ? (
        <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {tab === 'sum' && (
            <>
              <GlassCard variant="g" style={styles.widget}>
                <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>СТОИМОСТЬ КАТАЛОГА</Text>
                <Text style={[styles.heroValue, { color: colors.text }]}>{money(data.kpis.totalCatalogValue)}</Text>
                {data.stockMovementTimeline.length > 1 && (
                  <View style={{ marginTop: spacing.sm, marginHorizontal: -2 }}>
                    <Sparkline data={data.stockMovementTimeline.map((t) => t.net)} height={70} />
                  </View>
                )}
              </GlassCard>

              <StatGrid2
                items={[
                  { label: 'Товаров', value: String(data.kpis.totalProducts) },
                  { label: 'Активных', value: String(data.kpis.activeProducts) },
                  { label: 'Средняя маржа', value: data.kpis.avgMarginPct != null ? `${formatDecimal(data.kpis.avgMarginPct, 1)}%` : '—' },
                  { label: 'Остаток, шт.', value: data.kpis.totalStockUnits.toLocaleString(appLocale()) },
                ]}
              />

              {data.marginBuckets.some((b) => b.count > 0) && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>МАРЖА ПО ТОВАРАМ</Text>
                  <FunnelBars rows={data.marginBuckets.filter((b) => b.count > 0).map((b) => ({ label: b.bucket, value: b.count, displayValue: String(b.count) }))} />
                </GlassCard>
              )}

              {data.byCategory.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО КАТЕГОРИЯМ</Text>
                  <FunnelBars rows={data.byCategory.slice(0, 8).map((c) => ({ label: c.name, value: c.value, displayValue: money(c.value), color: c.color || undefined }))} />
                </GlassCard>
              )}
            </>
          )}

          {tab === 'top' && (
            <>
              {data.topProducts.length === 0 ? (
                <EmptyState icon="pricetags-outline" title="Нет товаров" subtitle="Добавьте товары, чтобы увидеть лидеров каталога" />
              ) : (
                <GlassCard variant="g2" style={styles.listCard}>
                  {data.topProducts.map((p, i) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.stockRow, { borderBottomColor: colors.line3, borderBottomWidth: i < data.topProducts.length - 1 ? 1 : 0 }]}
                      onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.num, { color: colors.textTertiary, width: 18 }]}>{i + 1}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.stockName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={[styles.stockMeta, { color: colors.textTertiary }]} numberOfLines={1}>{p.sku || '—'} · {p.quantity} шт</Text>
                      </View>
                      <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold, fontSize: 13 }}>{money(p.value)}</Text>
                    </TouchableOpacity>
                  ))}
                </GlassCard>
              )}

              {data.byCurrency.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО ВАЛЮТАМ</Text>
                  {data.byCurrency.map((c, i) => (
                    <View key={c.currency} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < data.byCurrency.length - 1 ? 1 : 0 }]}>
                      <Text style={[styles.srcName, { color: colors.text, fontFamily: fonts.medium, width: 56 }]}>{c.currency}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{c.count} товаров</Text>
                      <Text style={{ fontSize: 13, color: colors.text, fontFamily: fonts.monoSemibold }}>{money(c.convertedValue)}</Text>
                    </View>
                  ))}
                </GlassCard>
              )}
            </>
          )}

          {tab === 'stock' && (
            <>
              <StatGrid2
                items={[
                  { label: 'Заканчивается', value: String(data.kpis.lowStockCount) },
                  { label: 'Нет в наличии', value: String(data.kpis.outOfStockCount) },
                  { label: 'Категорий', value: String(data.kpis.totalCategories) },
                  { label: 'Складов', value: String(data.kpis.totalWarehouses) },
                ]}
              />

              {data.byLocation.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО СКЛАДАМ</Text>
                  {data.byLocation.map((l, i) => (
                    <View key={l.locationId} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < data.byLocation.length - 1 ? 1 : 0 }]}>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontFamily: fonts.medium }} numberOfLines={1}>{l.name}</Text>
                      {l.lowStockCount > 0 && <Pill label={`${l.lowStockCount} мало`} tone="warn" />}
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginLeft: spacing.sm }}>{l.stockUnits} шт</Text>
                    </View>
                  ))}
                </GlassCard>
              )}

              <Text style={[styles.widgetOverline, { color: colors.textSecondary, paddingHorizontal: 2, marginTop: spacing.sm }]}>МАЛО НА СКЛАДЕ</Text>
              {data.lowStock.length === 0 ? (
                <EmptyState icon="checkmark-circle-outline" title="Всё в достатке" subtitle="Товаров с низким остатком нет" />
              ) : (
                <GlassCard variant="g2" style={styles.listCard}>
                  {data.lowStock.slice(0, 10).map((p, i) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.stockRow, { borderBottomColor: colors.line3, borderBottomWidth: i < Math.min(data.lowStock.length, 10) - 1 ? 1 : 0 }]}
                      onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stockName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.stockQty, { color: colors.error, fontFamily: fonts.monoSemibold }]}>{p.quantity} / {p.lowStockThreshold}</Text>
                    </TouchableOpacity>
                  ))}
                </GlassCard>
              )}

              {data.outOfStock.length > 0 && (
                <>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary, paddingHorizontal: 2, marginTop: spacing.sm }]}>НЕТ В НАЛИЧИИ</Text>
                  <GlassCard variant="g2" style={styles.listCard}>
                    {data.outOfStock.slice(0, 10).map((p, i) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.stockRow, { borderBottomColor: colors.line3, borderBottomWidth: i < Math.min(data.outOfStock.length, 10) - 1 ? 1 : 0 }]}
                        onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.stockName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={[styles.stockMeta, { color: colors.textTertiary }]}>{p.sku || '—'}</Text>
                      </TouchableOpacity>
                    ))}
                  </GlassCard>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  segWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  widget: { borderRadius: radius.xxl, marginBottom: spacing.sm, padding: spacing.lg },
  widgetOverline: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  heroValue: { fontSize: 30, fontFamily: fonts.semibold, letterSpacing: -0.5 },
  num: { fontSize: 11, fontFamily: fonts.mono },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  srcName: { fontSize: 13 },
  listCard: { borderRadius: radius.xxl, marginBottom: spacing.sm, overflow: 'hidden' },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: spacing.sm },
  stockName: { fontSize: 13.5, fontFamily: fonts.medium },
  stockMeta: { fontSize: 11.5, marginTop: 2 },
  stockQty: { fontSize: 12 },
});
