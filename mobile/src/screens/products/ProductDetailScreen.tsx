import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { formatRange } from '../../utils/dateValues';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  fetchProduct, updateProduct, fetchProductFieldDefs, deleteProduct, fetchProductCategories, fetchProductAttributes, fetchProductVariants, describeVariant,
  Product, ProductStatus, ProductAttribute, ProductVariant,
} from '../../api/products';
import { formatMoney } from '../../utils/money';
import type { CustomFieldDef } from '../../api/customFields';
import { SkeletonList, showToast, CustomFieldsSection } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_TONE: Record<ProductStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  active: 'pos', draft: 'default', archived: 'default', out_of_stock: 'neg',
};

export const ProductDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const STATUS_LABEL: Record<ProductStatus, string> = { active: t('productStatus.active'), draft: t('productStatus.draft'), archived: t('productStatus.archived'), out_of_stock: t('productStatus.out_of_stock') };
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Refetch on focus so edits saved in the edit modal show up immediately.
  useFocusEffect(useCallback(() => {
    fetchProduct(id)
      .then((data) => {
        setProduct(data);
        fetchProductFieldDefs().then(setFieldDefs).catch(() => {});
        if (data.categoryId) fetchProductCategories().then((cats) => setCategoryName(cats.find((c) => c.id === data.categoryId)?.name || null)).catch(() => {});
        if (data.isVariable) {
          Promise.all([fetchProductVariants(id), fetchProductAttributes()])
            .then(([v, a]) => { setVariants(v); setAttributes(a); })
            .catch(() => {});
        }
      })
      .catch(() => showToast(t('productDetail.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  const handleDelete = () => {
    if (!product) return;
    navigation.goBack();
    deleteProduct(product.id).then(() => showToast(t('productDetail.deletedToast'), { variant: 'success' })).catch(() => showToast(t('productDetail.deleteError'), { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('productDetail.notFound')}</Text>
      </View>
    );
  }

  const lowStock = product.lowStockThreshold != null && product.quantity <= product.lowStockThreshold;

  const d = product.dimensions;
  const dims = d && (d.length || d.width || d.height) ? `${d.length ?? '–'} × ${d.width ?? '–'} × ${d.height ?? '–'} ${d.unit || 'cm'}` : null;

  const properties = [
    product.sku && { label: t('productDetail.prop.sku'), value: product.sku, icon: 'barcode-outline' as const, iconColor: colors.fg3 },
    product.barcode && { label: t('productDetail.prop.barcode'), value: product.barcode, icon: 'scan-outline' as const, iconColor: colors.fg3 },
    categoryName && { label: t('productDetail.prop.category'), value: categoryName, icon: 'pricetag-outline' as const, iconColor: colors.secondary },
    { label: t('productDetail.prop.stock'), value: `${product.quantity} ${product.unit || t('productDetail.unit')}`, icon: 'cube-outline' as const, iconColor: lowStock ? colors.error : colors.success },
    product.weight != null && { label: t('productDetail.prop.weight'), value: `${product.weight.toLocaleString(appLocale())} ${t('productDetail.weightUnit')}`, icon: 'barbell-outline' as const, iconColor: colors.fg3 },
    dims && { label: t('productDetail.prop.dimensions'), value: dims, icon: 'resize-outline' as const, iconColor: colors.fg3 },
    (product.saleStartAt || product.saleEndAt) && { label: t('productDetail.prop.salePeriod'), value: formatRange({ start: (product.saleStartAt || '').slice(0, 10) || null, end: (product.saleEndAt || '').slice(0, 10) || null }, t('cf.rangeFrom'), t('cf.rangeTo')), icon: 'pricetag-outline' as const, iconColor: colors.error },
    product.quantity > 0 && { label: t('productDetail.prop.stockValue'), value: formatMoney(product.price * product.quantity, product.currency), icon: 'wallet-outline' as const, iconColor: colors.info },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('productDetail.backTitle')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ProductEdit', { id: product.id })}>
              <Ionicons name="create-outline" size={17} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {product.images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              scrollEventThrottle={16}
            >
              {product.images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={[styles.hero, { width: SCREEN_WIDTH }]} resizeMode="cover" />
              ))}
            </ScrollView>
            {product.images.length > 1 && (
              <View style={styles.dots}>
                {product.images.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i === activeImage ? colors.onInk : 'rgba(255,255,255,0.5)' }]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
          <View style={styles.priceRow}>
            {product.salePrice != null ? (
              <>
                <Text style={[styles.price, { color: colors.error }]}>{product.salePrice.toLocaleString(appLocale())} {product.currency}</Text>
                <Text style={[styles.priceOld, { color: colors.textTertiary }]}>{product.price.toLocaleString(appLocale())} {product.currency}</Text>
              </>
            ) : (
              <Text style={[styles.price, { color: colors.text }]}>{product.price.toLocaleString(appLocale())} {product.currency}</Text>
            )}
          </View>
          <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}>
            <Pill label={STATUS_LABEL[product.status]} tone={STATUS_TONE[product.status]} />
          </View>
        </View>

        {product.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {product.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('productDetail.section.properties')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => (
            <View key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]}>
              <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                <Ionicons name={p.icon} size={16} color={p.iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{p.value}</Text>
              </View>
            </View>
          ))}
        </GlassCard>

        {product.description ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('productDetail.section.description')}</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.desc, { color: colors.text }]}>{product.description}</Text>
            </GlassCard>
          </>
        ) : null}

        <CustomFieldsSection
          entityType="product"
          defs={fieldDefs}
          values={product.customFields}
          onUpdate={async (key, value) => {
            // The server rebuilds product custom fields from what it receives, so always send the whole object (empty value → key removed).
            const next = { ...(product.customFields || {}), [key]: value };
            if (value === null || value === '') delete next[key];
            setProduct(await updateProduct(product.id, { customFields: next }));
          }}
        />

        {product.isVariable && variants.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('productDetail.section.variants')} ({variants.length})</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {variants.map((v, i) => (
                <View key={v.id} style={[styles.variantRow, { borderBottomColor: colors.line3, borderBottomWidth: i < variants.length - 1 ? 1 : 0, opacity: v.isActive ? 1 : 0.5 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{describeVariant(v, attributes)}</Text>
                    {v.sku && <Text style={[styles.variantSku, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{v.sku}</Text>}
                  </View>
                  <Text style={[styles.propValue, { color: v.quantity <= 0 ? colors.error : colors.textSecondary }]}>{v.quantity} {t('productDetail.unit')}</Text>
                  {v.priceOverride != null && (
                    <Text style={[styles.propValue, { color: colors.text, marginLeft: spacing.sm }]}>{formatMoney(v.priceOverride, product.currency)}</Text>
                  )}
                </View>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 220 },
  heroPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  name: { fontSize: 19, fontFamily: fonts.bold, letterSpacing: -0.3, lineHeight: 24 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 20, fontFamily: fonts.bold },
  priceOld: { fontSize: 14, fontFamily: fonts.regular, textDecorationLine: 'line-through' },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  tagTxt: { fontSize: 11, fontFamily: fonts.medium },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  desc: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  variantSku: { fontSize: 11, marginTop: 2 },
});
