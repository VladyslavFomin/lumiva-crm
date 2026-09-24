import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, StatusBar, Image, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts, Product, ProductStatus } from '../../api/products';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ToolbarButton, Skeleton, EmptyState, showToast } from '../../components/ui';
import { Chips } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const STATUS_ORDER: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];
const STATUS_TONE: Record<ProductStatus, 'info' | 'neutral' | 'warning' | 'success' | 'error'> = {
  active: 'success', draft: 'neutral', archived: 'neutral', out_of_stock: 'error',
};

function ProductSkeletonCard() {
  return (
    <GlassCard variant="flat" style={gridStyles.card}>
      <Skeleton width="100%" height={110} radius={radius.lg} />
      <View style={{ padding: spacing.sm, gap: 6 }}>
        <Skeleton width="80%" height={12} />
        <Skeleton width="40%" height={12} />
      </View>
    </GlassCard>
  );
}

export const ProductsListScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const STATUS_LABEL: Record<ProductStatus, string> = { active: t('productStatus.active'), draft: t('productStatus.draft'), archived: t('productStatus.archived'), out_of_stock: t('productStatus.out_of_stock') };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { items, total: totalCount } = await fetchProducts({ status: statusFilter || undefined, search: search || undefined });
      setProducts(items);
      setTotal(totalCount);
    } catch {
      showToast(t('productsList.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [all, ...perStatus] = await Promise.all([
          fetchProducts({ limit: 1 }),
          ...STATUS_ORDER.map((s) => fetchProducts({ status: s, limit: 1 })),
        ]);
        const m: Record<string, number> = { all: all.total };
        STATUS_ORDER.forEach((s, i) => { m[s] = perStatus[i].total; });
        setStatusCounts(m);
      } catch {}
    })();
  }, []);

  const renderCard = ({ item: p }: { item: Product }) => {
    const lowStock = p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold;
    return (
      <GlassCard variant="flat" style={gridStyles.card}>
      <TouchableOpacity
        onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
        activeOpacity={0.8}
      >
        {p.coverImage ? (
          <Image source={{ uri: p.coverImage }} style={gridStyles.image} resizeMode="cover" />
        ) : (
          <View style={[gridStyles.image, gridStyles.imagePlaceholder, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="cube-outline" size={28} color={colors.textTertiary} />
          </View>
        )}
        <View style={{ padding: spacing.sm, gap: 4 }}>
          <Text style={[gridStyles.name, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
          <View style={gridStyles.priceRow}>
            {p.salePrice != null ? (
              <>
                <Text style={[gridStyles.price, { color: colors.error, fontFamily: fonts.bold }]}>{p.salePrice.toLocaleString(appLocale())} {p.currency}</Text>
                <Text style={[gridStyles.priceOld, { color: colors.textTertiary }]}>{p.price.toLocaleString(appLocale())}</Text>
              </>
            ) : (
              <Text style={[gridStyles.price, { color: colors.text, fontFamily: fonts.bold }]}>{p.price.toLocaleString(appLocale())} {p.currency}</Text>
            )}
          </View>
          <Text style={[gridStyles.stock, { color: lowStock ? colors.error : colors.textTertiary, fontFamily: fonts.mono }]}>
            {p.quantity} {p.unit || t('productsList.unit')} {lowStock ? `· ${t('productsList.lowStock')}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('productsList.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{total}</Text> {t('productsList.items')}
              {(statusCounts.out_of_stock || 0) > 0 && <Text style={{ color: colors.error, fontFamily: fonts.monoSemibold }}> · {statusCounts.out_of_stock} {t('productsList.outOfStock')}</Text>}
            </Text>
          </View>
          <ToolbarButton icon="add" active onPress={() => navigation.navigate('ProductCreate')} />
          <ToolbarButton icon="cube-outline" onPress={() => navigation.navigate('Stock')} />
          <ToolbarButton icon="pricetags-outline" onPress={() => navigation.navigate('ProductCategories')} />
          <ToolbarButton icon="stats-chart-outline" onPress={() => navigation.navigate('ProductsAnalytics')} />
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('productsList.searchPlaceholder')}
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

        <View style={{ marginTop: spacing.sm }}>
          <Chips
            options={[
              { key: 'all', label: t('productsList.all'), count: statusCounts.all || 0 },
              ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s], count: statusCounts[s] || 0, dotColor: toneColor(colors, STATUS_TONE[s]) })),
            ]}
            activeKey={statusFilter || 'all'}
            onChange={(k) => setStatusFilter(k === 'all' ? null : (k as ProductStatus))}
          />
        </View>
      </View>

      {loading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          numColumns={2}
          keyExtractor={(i) => String(i)}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={() => <ProductSkeletonCard />}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          lottieSource={require('../../../assets/lottie/empty-pulse.json')}
          title={t('productsList.empty.title')}
          subtitle={search || statusFilter ? t('productsList.empty.subtitleFiltered') : t('productsList.empty.subtitleDefault')}
        />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
          renderItem={renderCard}
        />
      )}

    </View>
  );
};

function toneColor(colors: ReturnType<typeof useTheme>['colors'], tone: 'info' | 'neutral' | 'warning' | 'success' | 'error'): string {
  const map = { info: colors.info, neutral: colors.fg3, warning: colors.warning, success: colors.success, error: colors.error };
  return map[tone];
}

const styles = StyleSheet.create({
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.sm },
});

const gridStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.xxl },
  image: { width: '100%', height: 110 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12.5, fontFamily: fonts.semibold, lineHeight: 16, minHeight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 13 },
  priceOld: { fontSize: 11, textDecorationLine: 'line-through' },
  stock: { fontSize: 10.5 },
});
