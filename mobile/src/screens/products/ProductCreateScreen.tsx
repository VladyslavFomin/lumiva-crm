import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createProduct, fetchProductCategories, ProductCategory, ProductStatus } from '../../api/products';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

// Free-text unit presets stored verbatim as `product.unit` — same reasoning as company
// industries: not a fixed backend enum, so intentionally left untranslated.
const UNITS = ['шт', 'м²', 'м', 'ч', 'кг'];

export const ProductCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const STATUS_OPTIONS: { key: ProductStatus; label: string }[] = [
    { key: 'active', label: t('productStatus.active') },
    { key: 'draft', label: t('productStatus.draft') },
    { key: 'archived', label: t('productStatus.archived') },
    { key: 'out_of_stock', label: t('productStatus.out_of_stock') },
  ];
  const { codes } = useCurrencyMode();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [unit, setUnit] = useState(UNITS[0]);
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProductCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => { if (codes[0]) setCurrency(codes[0]); }, [codes]);

  const missing = [
    ...(!name.trim() ? [t('productCreate.missing.name')] : []),
    ...(!sku.trim() ? [t('productCreate.missing.sku')] : []),
    ...(!price ? [t('productCreate.missing.price')] : []),
  ];

  const submit = async () => {
    setSaving(true);
    try {
      await createProduct({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        categoryId: categoryId || null,
        description: description || null,
        price: price ? Number(price) : undefined,
        currency,
        unit,
        quantity: quantity ? Number(quantity) : undefined,
        status,
      });
      showToast(t('productCreate.created'), { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || t('productCreate.createError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title={t('productCreate.title')} kicker={t('productCreate.kicker')} sub={t('productCreate.subHint')}
      missing={missing} entityLabel={t('productCreate.entityLabel')} saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label={t('productCreate.field.name')} required value={name} onChangeText={setName} placeholder={t('productCreate.field.namePlaceholder')} />
        <EntityField label={t('productCreate.field.sku')} required value={sku} onChangeText={(v) => setSku(v.toUpperCase())} placeholder="FS-GLS-CL" autoCapitalize="characters" help={t('productCreate.field.skuHelp')} />
        <PickLabel label={t('productCreate.field.category')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker
            options={[{ key: '', label: t('productCreate.field.noCategory') }, ...categories.map((c) => ({ key: c.id, label: c.name }))]}
            value={categoryId}
            onChange={setCategoryId}
          />
        </View>
        <EntityField label={t('productCreate.field.description')} value={description} onChangeText={setDescription} placeholder={t('productCreate.field.descriptionPlaceholder')} multiline />
      </FieldCard>

      <FieldCard icon="cash-outline" title={t('productCreate.section.price')}>
        <EntityField label={t('productCreate.field.price')} required value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
        <PickLabel label={t('productCreate.field.currency')} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
        </View>
        <PickLabel label={t('productCreate.field.unit')} />
        <ChipPicker options={UNITS.map((u) => ({ key: u, label: u }))} value={unit} onChange={setUnit} />
      </FieldCard>

      <FieldCard icon="cube-outline" title={t('productCreate.section.stock')}>
        <EntityField label={t('productCreate.field.stock')} value={quantity} onChangeText={setQuantity} placeholder="0" keyboardType="numeric" />
        <PickLabel label={t('productCreate.field.status')} />
        <ChipPicker options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </FieldCard>
    </EntityFormShell>
  );
};
