import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createProduct, fetchProductCategories, ProductCategory, ProductStatus } from '../../api/products';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityFormShell, FieldCard, EntityField, ChipPicker } from '../../components/mg';

const PickLabel: React.FC<{ label: string; marginTop?: number }> = ({ label, marginTop }) => {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11.5, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 6, marginTop }}>{label}</Text>;
};

const UNITS = ['шт', 'м²', 'м', 'ч', 'кг'];
const STATUS_OPTIONS: { key: ProductStatus; label: string }[] = [
  { key: 'active', label: 'Активен' },
  { key: 'draft', label: 'Черновик' },
  { key: 'archived', label: 'В архиве' },
  { key: 'out_of_stock', label: 'Нет в наличии' },
];

export const ProductCreateScreen: React.FC = () => {
  const navigation = useNavigation<any>();
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
    ...(!name.trim() ? ['название'] : []),
    ...(!sku.trim() ? ['артикул'] : []),
    ...(!price ? ['цена'] : []),
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
      showToast('Товар создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      showToast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Не удалось создать товар', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormShell
      title="Новый товар" kicker="Товары" sub="Артикул должен быть уникальным в тенанте"
      missing={missing} entityLabel="товар" saving={saving}
      onCancel={() => navigation.goBack()} onSave={submit}
    >
      <FieldCard>
        <EntityField label="Название" required value={name} onChangeText={setName} placeholder="Стеклопакет закалённый" />
        <EntityField label="Артикул (SKU)" required value={sku} onChangeText={(v) => setSku(v.toUpperCase())} placeholder="FS-GLS-CL" autoCapitalize="characters" help="латиница, цифры и дефис" />
        <PickLabel label="Категория" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker
            options={[{ key: '', label: 'Без категории' }, ...categories.map((c) => ({ key: c.id, label: c.name }))]}
            value={categoryId}
            onChange={setCategoryId}
          />
        </View>
        <EntityField label="Описание" value={description} onChangeText={setDescription} placeholder="Толщина, характеристики, условия монтажа" multiline />
      </FieldCard>

      <FieldCard icon="cash-outline" title="Цена">
        <EntityField label="Цена за единицу" required value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
        <PickLabel label="Валюта" />
        <View style={{ marginBottom: spacing.md }}>
          <ChipPicker options={codes.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
        </View>
        <PickLabel label="Единица" />
        <ChipPicker options={UNITS.map((u) => ({ key: u, label: u }))} value={unit} onChange={setUnit} />
      </FieldCard>

      <FieldCard icon="cube-outline" title="Склад">
        <EntityField label="Остаток" value={quantity} onChangeText={setQuantity} placeholder="0" keyboardType="numeric" />
        <PickLabel label="Статус" />
        <ChipPicker options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </FieldCard>
    </EntityFormShell>
  );
};
