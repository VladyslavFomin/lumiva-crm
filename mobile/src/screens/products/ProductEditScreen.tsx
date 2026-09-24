import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchProduct, updateProduct, fetchProductCategories, Product, ProductCategory, ProductStatus } from '../../api/products';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { DateCalendar } from '../../components/ui/DateCalendar';
import { formatRange } from '../../utils/dateValues';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const STATUSES: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const bad = (v: string) => v.trim() !== '' && !Number.isFinite(Number(v.replace(',', '.')));

const PickLabel: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>;
};

/** Product edit form — the commerce fields the website's product form saves through the same `PATCH /products/:id`:
 *  identity (name / SKU / barcode), description, category, status, price + sale price and its date window, unit, stock alert,
 *  weight and dimensions, tags. Stock quantity is deliberately not editable here — it is driven by stock movements / locations. */
export const ProductEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { codes } = useCurrencyMode();

  const [original, setOriginal] = useState<Product | null>(null);
  const [f, setF] = useState({ name: '', sku: '', barcode: '', description: '', price: '', salePrice: '', unit: '', lowStock: '', weight: '', dimL: '', dimW: '', dimH: '', tags: '' });
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [categoryId, setCategoryId] = useState('');
  const [sale, setSale] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [saleOpen, setSaleOpen] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([fetchProduct(id), fetchProductCategories().catch(() => [] as ProductCategory[])])
      .then(([p, cats]) => {
        setOriginal(p);
        const d = p.dimensions;
        setF({
          name: p.name, sku: p.sku || '', barcode: p.barcode || '', description: p.description, price: String(p.price), salePrice: p.salePrice != null ? String(p.salePrice) : '',
          unit: p.unit || '', lowStock: p.lowStockThreshold != null ? String(p.lowStockThreshold) : '', weight: p.weight != null ? String(p.weight) : '',
          dimL: d?.length != null ? String(d.length) : '', dimW: d?.width != null ? String(d.width) : '', dimH: d?.height != null ? String(d.height) : '', tags: p.tags.join(', '),
        });
        setCurrency(p.currency); setStatus(p.status); setCategoryId(p.categoryId || '');
        setSale({ start: p.saleStartAt ? p.saleStartAt.slice(0, 10) : null, end: p.saleEndAt ? p.saleEndAt.slice(0, 10) : null });
        setCategories(cats);
      })
      .catch(() => { showToast(t('productDetail.loadError'), { variant: 'error' }); navigation.goBack(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currencyOptions = useMemo(() => (codes.includes(currency) ? codes : [...codes, currency]).map((c) => ({ key: c, label: c })), [codes, currency]);

  const missing = [
    ...(!f.name.trim() ? [t('productCreate.field.name')] : []),
    ...(bad(f.price) || f.price.trim() === '' ? [t('productCreate.field.price')] : []),
    ...([f.salePrice, f.lowStock, f.weight, f.dimL, f.dimW, f.dimH].some(bad) ? [t('productEdit.numbersInvalid')] : []),
  ];

  const submit = async () => {
    if (!original) return;
    setSaving(true);
    try {
      const hasDims = [f.dimL, f.dimW, f.dimH].some((v) => v.trim() !== '');
      await updateProduct(id, {
        name: f.name.trim(),
        sku: f.sku.trim() || null,
        barcode: f.barcode.trim() || null,
        description: f.description.trim() || null,
        categoryId: categoryId || null,
        status,
        price: num(f.price) ?? 0,
        currency,
        salePrice: num(f.salePrice),
        saleStartAt: sale.start,
        saleEndAt: sale.end,
        unit: f.unit.trim() || null,
        lowStockThreshold: num(f.lowStock),
        weight: num(f.weight),
        dimensions: hasDims ? { length: num(f.dimL) ?? undefined, width: num(f.dimW) ?? undefined, height: num(f.dimH) ?? undefined, unit: original.dimensions?.unit || 'cm' } : null,
        tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
      });
      showToast(t('productEdit.saved'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('productEdit.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.ink} /></View>;

  return (
    <EntityFormShell
      title={t('productEdit.title')} kicker={t('more.item.productsList')} sub={original?.name || ''}
      missing={missing} entityLabel={t('productEdit.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('productCreate.field.name')} required value={f.name} onChangeText={set('name')} />
        <EntityField label={t('productCreate.field.sku')} value={f.sku} onChangeText={set('sku')} autoCapitalize="none" />
        <EntityField label={t('productEdit.field.barcode')} value={f.barcode} onChangeText={set('barcode')} autoCapitalize="none" />
        <EntityField label={t('productCreate.field.description')} value={f.description} onChangeText={set('description')} multiline />
      </FieldCard>

      <FieldCard icon="cash-outline" title={t('productEdit.section.pricing')}>
        <EntityField label={t('productCreate.field.price')} required value={f.price} onChangeText={set('price')} keyboardType="numeric" />
        <PickLabel label={t('leadCreate.field.currency')} />
        <View style={{ marginBottom: 12 }}><ChipPicker options={currencyOptions} value={currency} onChange={setCurrency} /></View>
        <EntityField label={t('productEdit.field.salePrice')} value={f.salePrice} onChangeText={set('salePrice')} keyboardType="numeric" />
        <PickLabel label={t('productEdit.field.salePeriod')} />
        <TouchableOpacity onPress={() => setSaleOpen((o) => !o)} style={{ backgroundColor: colors.surfaceVariant, borderRadius: 10, padding: 13, marginBottom: 8 }}>
          <Text style={{ color: sale.start || sale.end ? colors.text : colors.textTertiary, fontSize: 15, fontFamily: fonts.regular }}>
            {sale.start || sale.end ? formatRange(sale, t('cf.rangeFrom'), t('cf.rangeTo')) : t('productEdit.salePeriodNone')}
          </Text>
        </TouchableOpacity>
        {saleOpen && (
          <View style={{ marginBottom: 8 }}>
            <DateCalendar mode="range" start={sale.start} end={sale.end} onChange={setSale} />
            <TouchableOpacity onPress={() => setSale({ start: null, end: null })} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium }}>{t('cf.clear')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </FieldCard>

      <FieldCard icon="flag-outline" title={t('projectCreate.section.classification')}>
        <PickLabel label={t('productEdit.field.status')} />
        <View style={{ marginBottom: 12 }}>
          <ChipPicker options={STATUSES.map((s) => ({ key: s, label: t(`productStatus.${s}`) }))} value={status} onChange={(v: ProductStatus) => setStatus(v)} />
        </View>
        {categories.length > 0 && (
          <>
            <PickLabel label={t('productEdit.field.category')} />
            <View style={{ marginBottom: 12 }}>
              <ChipPicker options={[{ key: '', label: t('linkPicker.none') }, ...categories.map((c) => ({ key: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
            </View>
          </>
        )}
        <EntityField label={t('contactEdit.field.tags')} value={f.tags} onChangeText={set('tags')} help={t('contactEdit.field.tagsHelp')} />
      </FieldCard>

      <FieldCard icon="cube-outline" title={t('productEdit.section.logistics')}>
        <EntityField label={t('productEdit.field.unit')} value={f.unit} onChangeText={set('unit')} />
        <EntityField label={t('productEdit.field.lowStock')} value={f.lowStock} onChangeText={set('lowStock')} keyboardType="numeric" />
        <EntityField label={t('productEdit.field.weight')} value={f.weight} onChangeText={set('weight')} keyboardType="numeric" />
        <EntityField label={t('productEdit.field.dimL')} value={f.dimL} onChangeText={set('dimL')} keyboardType="numeric" />
        <EntityField label={t('productEdit.field.dimW')} value={f.dimW} onChangeText={set('dimW')} keyboardType="numeric" />
        <EntityField label={t('productEdit.field.dimH')} value={f.dimH} onChangeText={set('dimH')} keyboardType="numeric" />
      </FieldCard>
    </EntityFormShell>
  );
};
