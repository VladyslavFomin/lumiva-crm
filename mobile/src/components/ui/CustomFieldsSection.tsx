import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { fetchCustomFieldDefs, CustomFieldDef, CustomFieldEntityType, CustomFieldType } from '../../api/customFields';
import { AppBottomSheet, AppBottomSheetRef } from './AppBottomSheet';
import { FormField } from './FormField';
import { Button } from './Button';
import { showToast } from './Toast';

const TYPE_ICON: Record<CustomFieldType, keyof typeof Ionicons.glyphMap> = {
  text: 'text-outline',
  number: 'calculator-outline',
  email: 'mail-outline',
  phone: 'call-outline',
  date: 'calendar-outline',
  datetime: 'time-outline',
  daterange: 'calendar-outline',
  boolean: 'checkbox-outline',
  select: 'list-outline',
  multiselect: 'list-outline',
  textarea: 'document-text-outline',
  url: 'link-outline',
};

function formatValue(field: CustomFieldDef, raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  switch (field.type) {
    case 'boolean':
      return raw ? 'Да' : 'Нет';
    case 'select':
      return field.options?.find((o) => o.value === raw)?.label || String(raw);
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? raw.split(',').map((v) => v.trim()) : [];
      if (arr.length === 0) return '—';
      return arr.map((v) => field.options?.find((o) => o.value === v)?.label || v).join(', ');
    }
    case 'date':
      return new Date(raw).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    case 'datetime':
      return new Date(raw).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    case 'daterange': {
      if (raw && typeof raw === 'object' && (raw.from || raw.to)) {
        const f = raw.from ? new Date(raw.from).toLocaleDateString('ru-RU') : '—';
        const t = raw.to ? new Date(raw.to).toLocaleDateString('ru-RU') : '—';
        return `${f} – ${t}`;
      }
      return String(raw);
    }
    default:
      return String(raw);
  }
}

interface Props {
  entityType: CustomFieldEntityType;
  values: Record<string, any> | null | undefined;
  title?: string;
  /** Provide to allow editing — called with (key, newValue) on save; omit to keep the section read-only. */
  onUpdate?: (key: string, value: any) => Promise<void>;
}

/**
 * Витрина кастомных тенант-настраиваемых полей на детали сущности — общая для
 * Лидов/Проектов/Продаж/Контактов/Компаний (см. MOBILE_DATA_PARITY_PLAN.md §1.1). Значения уже
 * приходят вместе с самой сущностью (entity.customFields), схема (labels/типы/options)
 * подгружается отдельно и кэшируется на сессию — она одна на весь тенант, не меняется от записи
 * к записи. Read-only, если `onUpdate` не передан; иначе тап по строке открывает bottom sheet
 * редактирования, форма зависит от типа поля (текст/число/дата/чекбокс/select/multiselect и т.д.).
 * date/datetime редактируются как текст в формате ГГГГ-ММ-ДД — нативного date-picker пакета в
 * проекте нет, добавлять его ради одного поля не стали (см. план, раздел про custom fields).
 */
export const CustomFieldsSection: React.FC<Props> = ({ entityType, values, title = 'ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ', onUpdate }) => {
  const { colors } = useTheme();
  const [defs, setDefs] = useState<CustomFieldDef[] | null>(null);
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    let alive = true;
    fetchCustomFieldDefs(entityType).then((data) => { if (alive) setDefs(data); }).catch(() => { if (alive) setDefs([]); });
    return () => { alive = false; };
  }, [entityType]);

  if (!defs || defs.length === 0) return null;

  const openEdit = (field: CustomFieldDef) => {
    const raw = values?.[field.key];
    if (field.type === 'multiselect') {
      setDraft(Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? raw.split(',').map((v) => v.trim()) : []);
    } else if (field.type === 'boolean') {
      setDraft(Boolean(raw));
    } else if (field.type === 'daterange') {
      setDraft(raw && typeof raw === 'object' ? raw : { from: '', to: '' });
    } else {
      setDraft(raw ?? '');
    }
    setEditingField(field);
    sheetRef.current?.snapToIndex(0);
  };

  const closeEdit = () => sheetRef.current?.close();

  const save = async () => {
    if (!editingField || !onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(editingField.key, draft);
      showToast('Поле обновлено', { variant: 'success' });
      closeEdit();
    } catch {
      showToast('Не удалось сохранить поле', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMultiValue = (v: string) => {
    setDraft((prev: string[]) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card }]}>
        {defs.map((field, i) => {
          const raw = values?.[field.key];
          const displayValue = formatValue(field, raw);
          const linkPress =
            !onUpdate && field.type === 'email' && raw ? () => Linking.openURL(`mailto:${raw}`) :
            !onUpdate && field.type === 'phone' && raw ? () => Linking.openURL(`tel:${raw}`) :
            !onUpdate && field.type === 'url' && raw ? () => Linking.openURL(String(raw).startsWith('http') ? String(raw) : `https://${raw}`) :
            undefined;
          const onPress = onUpdate ? () => openEdit(field) : linkPress;
          const Row = onPress ? TouchableOpacity : View;
          return (
            <Row key={field.id} style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < defs.length - 1 ? 1 : 0 }]} onPress={onPress} activeOpacity={0.7}>
              <View style={[styles.icoWrap, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={TYPE_ICON[field.type] || 'ellipse-outline'} size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}</Text>
                <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>{displayValue}</Text>
              </View>
              {onPress && <Ionicons name={onUpdate ? 'create-outline' : 'chevron-forward'} size={14} color={colors.textTertiary} />}
            </Row>
          );
        })}
      </View>

      {onUpdate && (
        <AppBottomSheet ref={sheetRef} snapPoints={['45%']}>
          {editingField && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{editingField.label}</Text>

              {editingField.type === 'boolean' && (
                <View style={styles.switchRow}>
                  <Text style={[styles.value, { color: colors.text }]}>{draft ? 'Да' : 'Нет'}</Text>
                  <Switch value={!!draft} onValueChange={setDraft} trackColor={{ true: colors.ink, false: 'rgba(118,118,128,0.3)' }} thumbColor={colors.onInk} />
                </View>
              )}

              {editingField.type === 'select' && (
                <View style={{ gap: spacing.sm }}>
                  {(editingField.options || []).map((opt) => (
                    <TouchableOpacity key={opt.value} style={[styles.optRow, { borderColor: colors.line2 }]} onPress={() => setDraft(opt.value)} activeOpacity={0.7}>
                      <Text style={[styles.value, { color: colors.text }]}>{opt.label}</Text>
                      <View style={[styles.radio, { borderColor: draft === opt.value ? colors.ink : colors.line2, backgroundColor: draft === opt.value ? colors.ink : 'transparent' }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {editingField.type === 'multiselect' && (
                <View style={{ gap: spacing.sm }}>
                  {(editingField.options || []).map((opt) => {
                    const checked = (draft as string[]).includes(opt.value);
                    return (
                      <TouchableOpacity key={opt.value} style={[styles.optRow, { borderColor: colors.line2 }]} onPress={() => toggleMultiValue(opt.value)} activeOpacity={0.7}>
                        <Text style={[styles.value, { color: colors.text }]}>{opt.label}</Text>
                        <View style={[styles.checkbox, { borderColor: checked ? colors.ink : colors.line2, backgroundColor: checked ? colors.ink : 'transparent' }]}>
                          {checked && <Ionicons name="checkmark" size={12} color={colors.onInk} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {editingField.type === 'daterange' && (
                <View>
                  <FormField label="С" value={draft?.from || ''} onChangeText={(v) => setDraft((d: any) => ({ ...d, from: v }))} placeholder="ГГГГ-ММ-ДД" />
                  <FormField label="По" value={draft?.to || ''} onChangeText={(v) => setDraft((d: any) => ({ ...d, to: v }))} placeholder="ГГГГ-ММ-ДД" />
                </View>
              )}

              {(editingField.type === 'text' || editingField.type === 'textarea' || editingField.type === 'number' ||
                editingField.type === 'email' || editingField.type === 'phone' || editingField.type === 'url' ||
                editingField.type === 'date' || editingField.type === 'datetime') && (
                <FormField
                  label={editingField.label}
                  value={draft != null ? String(draft) : ''}
                  onChangeText={setDraft}
                  placeholder={editingField.type === 'date' || editingField.type === 'datetime' ? 'ГГГГ-ММ-ДД' : editingField.placeholder || undefined}
                  multiline={editingField.type === 'textarea'}
                  keyboardType={editingField.type === 'number' ? 'numeric' : editingField.type === 'email' ? 'email-address' : editingField.type === 'phone' ? 'phone-pad' : 'default'}
                />
              )}

              <Button label="Сохранить" variant="primary" fullWidth loading={saving} disabled={saving} onPress={save} style={{ marginTop: spacing.md }} />
            </>
          )}
        </AppBottomSheet>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  icoWrap: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  value: { fontSize: 14, fontFamily: fonts.medium },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
