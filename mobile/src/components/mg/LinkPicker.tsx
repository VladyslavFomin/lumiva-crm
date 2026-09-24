import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export interface LinkOption {
  id: string;
  label: string;
  sub?: string | null;
}

interface Props {
  label: string;
  value: string | null | undefined;
  options: LinkOption[];
  onChange: (id: string | null) => void;
  placeholder?: string;
}

/**
 * Searchable single-record picker (company / contact / lead …). Replaces the old `ChipPicker` + `slice(0, 20)` pattern,
 * which silently made every record past the 20th impossible to link — the website's selects list all of them.
 */
export const LinkPicker: React.FC<Props> = ({ label, value, options, onChange, placeholder }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s)) : options;
  }, [options, q]);

  const close = () => { setOpen(false); setQ(''); };

  return (
    <View style={styles.box}>
      <Text style={[styles.lab, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity style={[styles.field, { backgroundColor: colors.surfaceVariant }]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.fieldTxt, { color: selected ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {selected ? selected.label : (value ? '…' : placeholder || t('linkPicker.none'))}
        </Text>
        {selected ? (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top > 24 ? 12 : insets.top + 12 }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={q}
              onChangeText={setQ}
              placeholder={t('linkPicker.search')}
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <TouchableOpacity style={styles.row} onPress={() => { onChange(null); close(); }}>
                <Text style={[styles.rowTxt, { color: colors.textSecondary }]}>{t('linkPicker.none')}</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textTertiary }]}>{t('linkPicker.empty')}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => { onChange(item.id); close(); }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTxt, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                  {!!item.sub && <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>{item.sub}</Text>}
                </View>
                {item.id === value && <Ionicons name="checkmark" size={18} color={colors.ink} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { marginBottom: spacing.md },
  lab: { fontSize: 11.5, fontFamily: fonts.regular, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 13 },
  fieldTxt: { flex: 1, fontSize: 15, fontFamily: fonts.regular },
  modal: { flex: 1, paddingHorizontal: spacing.lg },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md },
  modalTitle: { fontSize: 17, fontFamily: fonts.bold },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: spacing.md },
  rowTxt: { fontSize: 15, fontFamily: fonts.medium },
  rowSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 13 },
});

interface MultiProps {
  label: string;
  value: string[];
  options: LinkOption[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

/** Searchable multi-record picker (e.g. related projects) — same modal as `LinkPicker`, stays open while toggling. */
export const LinkMultiPicker: React.FC<MultiProps> = ({ label, value, options, onChange, placeholder }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = options.filter((o) => value.includes(o.id));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s)) : options;
  }, [options, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const close = () => { setOpen(false); setQ(''); };

  return (
    <View style={styles.box}>
      <Text style={[styles.lab, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity style={[styles.field, { backgroundColor: colors.surfaceVariant }]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.fieldTxt, { color: selected.length ? colors.text : colors.textTertiary }]} numberOfLines={2}>
          {selected.length ? selected.map((o) => o.label).join(', ') : placeholder || t('linkPicker.none')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top > 24 ? 12 : insets.top + 12 }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{label}{value.length ? ` (${value.length})` : ''}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 }}>{t('common.done')}</Text></TouchableOpacity>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput style={[styles.searchInput, { color: colors.text }]} value={q} onChangeText={setQ} placeholder={t('linkPicker.search')} placeholderTextColor={colors.textTertiary} autoCorrect={false} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textTertiary }]}>{t('linkPicker.empty')}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTxt, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                  {!!item.sub && <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>{item.sub}</Text>}
                </View>
                {value.includes(item.id) && <Ionicons name="checkmark-circle" size={20} color={colors.ink} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};
