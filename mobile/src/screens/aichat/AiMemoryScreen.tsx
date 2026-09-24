import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchAiMemory, addAiMemory, deleteAiMemory, AiMemoryChunk } from '../../api/aiChat';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast, Button } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

/** RN port of `mglass-w5-ai.jsx`'s "Память" tab — free-text notes the AI mixes into every future
 * chat reply (`GET/POST/DELETE /ai/memory`, real and already storage-quota-aware server-side,
 * just never had a mobile surface). Standalone screen rather than a 3rd chat tab — this app's
 * AI chat is already split into a sessions list + thread screen, not one tabbed screen like the
 * design, so a linked screen fits that existing shape better than shoehorning in tabs. */
export const AiMemoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<AiMemoryChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchAiMemory()
      .then(setItems)
      .catch(() => showToast('Не удалось загрузить память', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addAiMemory({ title: title.trim() || undefined, content: content.trim() });
      setTitle('');
      setContent('');
      load();
      showToast('Сохранено в память', { variant: 'success' });
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось сохранить', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteAiMemory(id);
    } catch {
      showToast('Не удалось удалить', { variant: 'error' });
      load();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>ИИ-ассистент</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Память</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Ассистент подмешивает это в каждый ответ</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <GlassCard variant="g" style={styles.formCard} contentStyle={{ padding: spacing.lg }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ЗАГОЛОВОК</Text>
          <GlassCard variant="flat" style={styles.inputCard} contentStyle={{ paddingHorizontal: spacing.md }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Например: правило скидок"
              placeholderTextColor={colors.textTertiary}
              style={{ color: colors.text, fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular }}
            />
          </GlassCard>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>ТЕКСТ</Text>
          <GlassCard variant="flat" style={styles.inputCard} contentStyle={{ paddingHorizontal: spacing.md }}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Не согласовывать скидку ниже 20% маржи"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{ color: colors.text, fontSize: 14, paddingVertical: 11, minHeight: 70, fontFamily: fonts.regular, textAlignVertical: 'top' }}
            />
          </GlassCard>
          <Button label="Сохранить в память" variant="accent" fullWidth loading={saving} disabled={!content.trim()} onPress={handleSave} style={{ marginTop: spacing.md }} />
        </GlassCard>

        {loading ? (
          <SkeletonList count={3} />
        ) : items.length === 0 ? (
          <EmptyState icon="sparkles-outline" title="Памяти пока нет" subtitle="Добавьте первую заметку выше" />
        ) : (
          items.map((m) => (
            <GlassCard key={m.id} variant="g2" style={styles.memCard} contentStyle={{ padding: spacing.lg }}>
              <View style={styles.memHead}>
                <Text style={[styles.memTitle, { color: colors.text }]} numberOfLines={1}>{m.title || 'Без заголовка'}</Text>
                <TouchableOpacity onPress={() => handleDelete(m.id)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.memText, { color: colors.textSecondary }]}>{m.content}</Text>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  formCard: { borderRadius: radius.xxl },
  fieldLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, marginBottom: 6 },
  inputCard: { borderRadius: radius.lg },
  memCard: { borderRadius: radius.xxl },
  memHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  memTitle: { flex: 1, fontSize: 14, fontFamily: fonts.semibold },
  memText: { fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
