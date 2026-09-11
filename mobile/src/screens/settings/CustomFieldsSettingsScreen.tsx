import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchAllCustomFieldDefs, createCustomFieldDef, deleteCustomFieldDef,
  CustomFieldDef, CustomFieldEntityType, CustomFieldType,
} from '../../api/customFields';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SwipeableRow, SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, FormField, showToast } from '../../components/ui';
import { Chips } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const ENTITY_TABS: { key: CustomFieldEntityType; label: string }[] = [
  { key: 'lead', label: 'Лиды' }, { key: 'project', label: 'Проекты' }, { key: 'sale', label: 'Продажи' },
  { key: 'contact', label: 'Контакты' }, { key: 'company', label: 'Компании' },
];
const TYPE_OPTIONS: { key: CustomFieldType; label: string }[] = [
  { key: 'text', label: 'Текст' }, { key: 'textarea', label: 'Многострочный' }, { key: 'number', label: 'Число' },
  { key: 'email', label: 'Email' }, { key: 'phone', label: 'Телефон' }, { key: 'url', label: 'Ссылка' },
  { key: 'date', label: 'Дата' }, { key: 'datetime', label: 'Дата и время' }, { key: 'daterange', label: 'Период' },
  { key: 'boolean', label: 'Да/Нет' }, { key: 'select', label: 'Список' }, { key: 'multiselect', label: 'Мультисписок' },
];
const TYPE_LABEL: Record<CustomFieldType, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.key, t.label])) as any;

export const CustomFieldsSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const [entityType, setEntityType] = useState<CustomFieldEntityType>('lead');
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllCustomFieldDefs();
      setFields(all.sort((a, b) => a.order - b.order));
    } catch {
      showToast('Не удалось загрузить кастомные поля', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fieldsForTab = fields.filter((f) => f.entityType === entityType);

  const openCreate = () => {
    setLabel(''); setKey(''); setType('text'); setOptionsText('');
    sheetRef.current?.snapToIndex(0);
  };

  const handleCreate = async () => {
    const lbl = label.trim();
    const k = (key.trim() || lbl.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_')).slice(0, 100);
    if (!lbl || !k) { showToast('Укажите название поля', { variant: 'error' }); return; }
    setSaving(true);
    try {
      const options = (type === 'select' || type === 'multiselect')
        ? optionsText.split(',').map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v }))
        : undefined;
      const created = await createCustomFieldDef({ entityType, key: k, label: lbl, type, options });
      setFields((prev) => [...prev, created]);
      sheetRef.current?.close();
      showToast('Поле создано', { variant: 'success' });
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось создать поле', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeField = async (f: CustomFieldDef) => {
    setFields((prev) => prev.filter((x) => x.id !== f.id));
    try {
      await deleteCustomFieldDef(f.id, f.entityType);
    } catch {
      setFields((prev) => [...prev, f]);
      showToast('Не удалось удалить поле', { variant: 'error' });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Кастомные поля</Text>
        </View>
      </View>

      <Chips
        options={ENTITY_TABS.map((t) => ({ key: t.key, label: t.label, count: fields.filter((f) => f.entityType === t.key).length }))}
        activeKey={entityType}
        onChange={(k) => setEntityType(k as CustomFieldEntityType)}
      />

      <View style={styles.toolbar}>
        <Button label="Добавить поле" variant="secondary" size="sm" onPress={openCreate} />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : fieldsForTab.length === 0 ? (
        <EmptyState icon="options-outline" title="Нет кастомных полей" subtitle="Добавьте поле для этого раздела" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          {fieldsForTab.map((f, i) => (
            <SwipeableRow key={f.id} rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeField(f) }}>
              <View style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < fieldsForTab.length - 1 ? 1 : 0 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{f.label}{f.required ? ' *' : ''}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>{TYPE_LABEL[f.type] || f.type} · {f.key}</Text>
                </View>
              </View>
            </SwipeableRow>
          ))}
        </GlassCard>
      )}

      <AppBottomSheet ref={sheetRef} snapPoints={['70%', '90%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Новое поле · {ENTITY_TABS.find((t) => t.key === entityType)?.label}</Text>
        <FormField label="Название" value={label} onChangeText={setLabel} placeholder="Например, Источник заявки" />
        <FormField label="Ключ (необязательно)" value={key} onChangeText={setKey} placeholder="auto из названия" />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Тип поля</Text>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((t) => (
            <TouchableOpacity key={t.key} onPress={() => setType(t.key)} style={[styles.typeChip, { borderColor: type === t.key ? colors.ink : colors.line2, backgroundColor: type === t.key ? colors.ink : 'transparent' }]}>
              <Text style={{ color: type === t.key ? colors.onInk : colors.text, fontFamily: fonts.medium, fontSize: 12 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {(type === 'select' || type === 'multiselect') && (
          <FormField label="Варианты (через запятую)" value={optionsText} onChangeText={setOptionsText} placeholder="Новый, В работе, Готово" />
        )}
        <Button label="Создать поле" variant="primary" fullWidth loading={saving} onPress={handleCreate} style={{ marginTop: spacing.md }} />
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.4 },
  toolbar: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.sm, paddingBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold, marginBottom: spacing.sm },
  label: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  typeChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5 },
});
