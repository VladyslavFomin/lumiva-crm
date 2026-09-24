import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { appLocale } from '../../i18n/format';
import { fetchNotes, createNote, deleteNote, Note, NoteEntityType } from '../../api/notes';
import { showToast } from './Toast';

interface Props {
  entityType: NoteEntityType;
  entityId: string;
}

/** Notes list + composer for a record (the website's booking card "Notes" tab). */
export const NotesSection: React.FC<Props> = ({ entityType, entityId }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchNotes(entityType, entityId).then(setNotes).catch(() => setNotes([]));
  }, [entityType, entityId]);
  useEffect(load, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const n = await createNote(entityType, entityId, text);
      setNotes((p) => [n, ...p]);
      setDraft('');
    } catch {
      showToast(t('notes.addError'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes((p) => p.filter((n) => n.id !== id));
    } catch {
      showToast(t('notes.deleteError'), { variant: 'error' });
    }
  };

  return (
    <>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{t('notes.title')}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.composer}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('notes.placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
          />
          <TouchableOpacity style={[styles.send, { backgroundColor: colors.ink, opacity: draft.trim() && !busy ? 1 : 0.4 }]} onPress={add} disabled={!draft.trim() || busy}>
            <Ionicons name="arrow-up" size={18} color={colors.onInk} />
          </TouchableOpacity>
        </View>
        {notes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>{t('notes.empty')}</Text>
        ) : notes.map((n, i) => (
          <View key={n.id} style={[styles.note, { borderTopColor: colors.line3, borderTopWidth: i === 0 ? 0 : 1 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.body, { color: colors.text }]}>{n.content}</Text>
              <Text style={[styles.meta, { color: colors.textTertiary }]}>
                {[n.createdBy, new Date(n.createdAt).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => remove(n.id)} hitSlop={10}><Ionicons name="trash-outline" size={16} color={colors.textTertiary} /></TouchableOpacity>
          </View>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  card: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, padding: spacing.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  input: { flex: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, fontFamily: fonts.regular, maxHeight: 110 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', fontSize: 12.5, paddingVertical: 14 },
  note: { flexDirection: 'row', gap: spacing.md, paddingVertical: 10 },
  body: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  meta: { fontSize: 11, marginTop: 4 },
});
