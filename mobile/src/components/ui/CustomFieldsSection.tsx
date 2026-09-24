import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { fetchCustomFieldDefs, CustomFieldDef, CustomFieldEntityType, CustomFieldType } from '../../api/customFields';
import { AppBottomSheet, AppBottomSheetRef } from './AppBottomSheet';
import { FormField } from './FormField';
import { Button } from './Button';
import { showToast } from './Toast';
import { useLanguage } from '../../i18n/LanguageContext';
import { appLocale } from '../../i18n/format';
import { DateCalendar } from './DateCalendar';
import { normalizeRange, parseIsoDate, toIsoDate, toIsoDateTime, formatDay, formatDateTime, formatRange, rangeDays, DateRange } from '../../utils/dateValues';

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
  complex: 'albums-outline',
};

const isDateType = (type: CustomFieldType) => type === 'date' || type === 'datetime' || type === 'daterange';

type T = (key: string) => string;

/** Last-resort text for a value whose shape we don't know — never `String(object)` (that is the `[object Object]` bug). */
function safeText(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (Array.isArray(raw)) return raw.map(safeText).filter((x) => x !== '—').join(', ') || '—';
  if (typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>).filter((v) => v !== null && v !== undefined && v !== '' && typeof v !== 'object');
    return vals.length ? vals.join(' – ') : '—';
  }
  return String(raw);
}

function formatValue(field: CustomFieldDef, raw: any, t: T): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  switch (field.type) {
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 ? t('cf.yes') : t('cf.no');
    case 'select':
      return field.options?.find((o) => o.value === String(raw))?.label || safeText(raw);
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? raw.split(',').map((v) => v.trim()) : [];
      if (arr.length === 0) return '—';
      return arr.map((v) => field.options?.find((o) => o.value === String(v))?.label || String(v)).join(', ');
    }
    case 'date': {
      const d = parseIsoDate(raw);
      return d ? d.toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : safeText(raw);
    }
    case 'datetime': {
      const d = parseIsoDate(raw);
      return d ? formatDateTime(d) : safeText(raw);
    }
    case 'daterange': {
      const range = normalizeRange(raw);
      if (!range) return safeText(raw);
      const days = rangeDays(range);
      return `${formatRange(range, t('cf.rangeFrom'), t('cf.rangeTo'))}${days ? ` · ${days} ${t('cf.daysShort')}` : ''}`;
    }
    case 'complex': {
      if (Array.isArray(raw)) return raw.length ? `${raw.length} ${t('cf.items')}` : '—';
      if (raw && typeof raw === 'object') return (raw as any).url ? t('cf.image') : safeText(raw);
      return safeText(raw);
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
      return Number.isFinite(n) ? n.toLocaleString(appLocale()) : safeText(raw);
    }
    default:
      return safeText(raw);
  }
}

interface Props {
  entityType: CustomFieldEntityType;
  values: Record<string, any> | null | undefined;
  title?: string;
  /** Definitions to show instead of loading the tenant's `custom_fields` for `entityType` (used for product fields, a separate system). */
  defs?: CustomFieldDef[];
  /** Fallback shown (read-only text) while a field has no value of its own — the website fills project email/phone/url from the linked lead / company / files. */
  autoValue?: (field: CustomFieldDef) => string | undefined;
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
 * date/datetime/daterange редактируются встроенным календарём (`DateCalendar`) и хранятся в тех же форматах,
 * что и на сайте: 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:mm' / { start, end } (см. utils/dateValues.ts).
 */
export const CustomFieldsSection: React.FC<Props> = ({ entityType, values, title, onUpdate, defs: defsProp, autoValue }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [timeDraft, setTimeDraft] = useState('12:00');
  const [defs, setDefs] = useState<CustomFieldDef[] | null>(null);
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    if (defsProp) { setDefs(defsProp); return; }
    let alive = true;
    fetchCustomFieldDefs(entityType).then((data) => { if (alive) setDefs(data); }).catch(() => { if (alive) setDefs([]); });
    return () => { alive = false; };
  }, [entityType, defsProp]);

  if (!defs || defs.length === 0) return null;

  const openEdit = (field: CustomFieldDef) => {
    const raw = values?.[field.key];
    if (field.type === 'multiselect') {
      setDraft(Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' && raw ? raw.split(',').map((v) => v.trim()) : []);
    } else if (field.type === 'boolean') {
      setDraft(raw === true || raw === 'true');
    } else if (field.type === 'daterange') {
      const r = normalizeRange(raw);
      setDraft({ start: r?.start ?? null, end: r?.end ?? null });
    } else if (field.type === 'date') {
      const d = parseIsoDate(raw);
      setDraft(d ? toIsoDate(d) : null);
    } else if (field.type === 'datetime') {
      const d = parseIsoDate(raw);
      setDraft(d ? toIsoDate(d) : null);
      setTimeDraft(d ? toIsoDateTime(d).slice(11) : '12:00');
    } else {
      setDraft(raw == null ? '' : String(raw));
    }
    setEditingField(field);
    sheetRef.current?.snapToIndex(isDateType(field.type) ? 1 : 0);
  };

  const closeEdit = () => sheetRef.current?.close();

  const save = async () => {
    if (!editingField || !onUpdate) return;
    let value: any = draft;
    switch (editingField.type) {
      case 'number': {
        const txt = String(draft ?? '').trim().replace(',', '.');
        value = txt === '' ? null : Number(txt);
        if (value !== null && !Number.isFinite(value)) { showToast(t('cf.invalidNumber'), { variant: 'error' }); return; }
        break;
      }
      case 'datetime': {
        if (!draft) { value = null; break; }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeDraft)) { showToast(t('cf.invalidTime'), { variant: 'error' }); return; }
        value = `${draft}T${timeDraft}`;
        break;
      }
      case 'daterange': {
        // Same stored shape as the website's DateFieldPicker: { start, end|null }, or null when cleared.
        value = draft?.start ? { start: draft.start, end: draft.end || null } : null;
        break;
      }
      case 'multiselect':
        value = (draft as string[]).length ? draft : [];
        break;
      case 'select': case 'text': case 'textarea': case 'email': case 'phone': case 'url':
        value = String(draft ?? '').trim() === '' ? null : draft;
        break;
      default:
        break;
    }
    if (editingField.required && (value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      showToast(t('cf.required'), { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await onUpdate(editingField.key, value);
      showToast(t('cf.updated'), { variant: 'success' });
      closeEdit();
    } catch {
      showToast(t('cf.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMultiValue = (v: string) => {
    setDraft((prev: string[]) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title || t('cf.title')}</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card }]}>
        {defs.map((field, i) => {
          const raw = values?.[field.key];
          const auto = (raw === null || raw === undefined || raw === '') ? autoValue?.(field) : undefined;
          const displayValue = auto ?? formatValue(field, raw, t);
          const linkPress =
            !onUpdate && field.type === 'email' && raw ? () => Linking.openURL(`mailto:${raw}`) :
            !onUpdate && field.type === 'phone' && raw ? () => Linking.openURL(`tel:${raw}`) :
            !onUpdate && field.type === 'url' && raw ? () => Linking.openURL(String(raw).startsWith('http') ? String(raw) : `https://${raw}`) :
            undefined;
          const onPress = onUpdate && !field.readOnly ? () => openEdit(field) : linkPress;
          const Row = onPress ? TouchableOpacity : View;
          return (
            <Row key={field.id} style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < defs.length - 1 ? 1 : 0 }]} onPress={onPress} activeOpacity={0.7}>
              <View style={[styles.icoWrap, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={TYPE_ICON[field.type] || 'ellipse-outline'} size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{field.label}{field.required ? ' *' : ''}</Text>
                <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>{displayValue}</Text>
              </View>
              {onPress && <Ionicons name={onUpdate && !field.readOnly ? 'create-outline' : 'chevron-forward'} size={14} color={colors.textTertiary} />}
            </Row>
          );
        })}
      </View>

      {onUpdate && (
        <AppBottomSheet ref={sheetRef} snapPoints={['50%', '88%']}>
          {editingField && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{editingField.label}</Text>
              {!!editingField.helpText && <Text style={[styles.hint, { color: colors.textSecondary, textAlign: 'left', paddingTop: 0 }]}>{editingField.helpText}</Text>}

              {editingField.type === 'boolean' && (
                <View style={styles.switchRow}>
                  <Text style={[styles.value, { color: colors.text }]}>{draft ? t('cf.yes') : t('cf.no')}</Text>
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
                  <DateCalendar mode="range" start={draft?.start ?? null} end={draft?.end ?? null} onChange={setDraft} />
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    {draft?.start ? formatRange(draft as DateRange, t('cf.rangeFrom'), t('cf.rangeTo')) : t('cf.pickRange')}
                    {draft?.start && draft?.end && rangeDays(draft as DateRange) ? ` · ${rangeDays(draft as DateRange)} ${t('cf.daysShort')}` : ''}
                  </Text>
                </View>
              )}

              {(editingField.type === 'date' || editingField.type === 'datetime') && (
                <View>
                  <DateCalendar mode="single" value={draft} onChange={setDraft} />
                  {editingField.type === 'datetime' && (
                    <FormField label={t('cf.time')} value={timeDraft} onChangeText={setTimeDraft} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
                  )}
                </View>
              )}

              {(editingField.type === 'text' || editingField.type === 'textarea' || editingField.type === 'number' ||
                editingField.type === 'email' || editingField.type === 'phone' || editingField.type === 'url') && (
                <FormField
                  label={editingField.label}
                  value={draft != null ? String(draft) : ''}
                  onChangeText={setDraft}
                  placeholder={editingField.placeholder || undefined}
                  multiline={editingField.type === 'textarea'}
                  keyboardType={editingField.type === 'number' ? 'decimal-pad' : editingField.type === 'email' ? 'email-address' : editingField.type === 'phone' ? 'phone-pad' : 'default'}
                />
              )}

              {isDateType(editingField.type) && (
                <TouchableOpacity onPress={() => setDraft(editingField.type === 'daterange' ? { start: null, end: null } : null)} style={{ alignSelf: 'center', paddingVertical: 6 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium }}>{t('cf.clear')}</Text>
                </TouchableOpacity>
              )}

              <Button label={t('common.save')} variant="primary" fullWidth loading={saving} disabled={saving} onPress={save} style={{ marginTop: spacing.md }} />
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
  hint: { fontSize: 12.5, fontFamily: fonts.medium, textAlign: 'center', paddingVertical: 8 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
