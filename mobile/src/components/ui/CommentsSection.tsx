import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { EntityComment } from '../../api/comments';
import { fetchProfile } from '../../api/profile';
import { fetchStaff, Staff } from '../../api/staff';
import { AvatarInitials } from './Avatar';
import { showToast } from './Toast';

// Список сотрудников тенанта не меняется от экрана к экрану за сессию — кэшируем, чтобы каждая
// открытая деталь (Лид/Проект/Продажа/Контакт/Компания) не дёргала /staff-users заново.
let staffCache: Promise<Staff[]> | null = null;
function loadStaff(): Promise<Staff[]> {
  if (!staffCache) staffCache = fetchStaff().catch((e) => { staffCache = null; throw e; });
  return staffCache;
}

function mentionLabels(staff: Staff[]): string[] {
  const labels = new Set<string>();
  staff.forEach((s) => {
    if (s.fullName?.trim()) labels.add(s.fullName.trim());
    if (s.email?.trim()) labels.add(s.email.trim());
  });
  return Array.from(labels).sort((a, b) => b.length - a.length);
}

/** Разбивает текст на куски для подсветки @упоминаний по реальным именам/email сотрудников. */
function renderTextWithMentions(text: string, labels: string[], colors: any) {
  if (labels.length === 0) return <Text>{text}</Text>;
  const pattern = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(@(?:${pattern}))`, 'giu');
  const parts = text.split(re);
  return (
    <Text>
      {parts.map((part, i) =>
        re.test(part) ? (
          <Text key={i} style={{ color: colors.info, fontFamily: fonts.semibold }}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

function extractMentions(text: string, labels: string[]): string[] {
  const lower = text.toLowerCase();
  return labels.filter((l) => lower.includes(`@${l.toLowerCase()}`));
}

function relativeTime(dateStr: string): string {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return dateStr;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} д назад`;
}

interface Props {
  entries: EntityComment[];
  onSave: (next: EntityComment[]) => Promise<void>;
  title?: string;
}

/**
 *Read-write тред комментариев с @упоминаниями/лайками/ответами — общий для Лидов/Проектов/
 * Продаж/Контактов/Компаний (см. MOBILE_DATA_PARITY_PLAN.md §17). На сайте это просто jsonb-массив
 * на самой сущности, без отдельного comments-эндпоинта — читаем-модифицируем-пишем целиком через
 * `onSave`, как и на сайте. Упоминания — не структурная фича даже на сайте: `@Имя`/`@email`
 * печатаются вручную, `mentions[]` только для подсветки; автокомплит по `@` — осознанное мобильное
 * улучшение сверх паритета (на сайте его тоже нет, но печатать точное ФИО пальцем неудобно).
 */
export const CommentsSection: React.FC<Props> = ({ entries, onSave, title = 'КОММЕНТАРИИ' }) => {
  const { colors } = useTheme();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchProfile().catch(() => null), loadStaff().catch(() => [])]).then(([profile, staffList]) => {
      if (!alive) return;
      setStaff(staffList);
      if (profile) {
        const match = staffList.find((s) => s.email?.toLowerCase() === profile.email?.toLowerCase());
        setMe({ id: match?.id || profile.id, name: match?.fullName || profile.name || profile.email });
      }
    });
    return () => { alive = false; };
  }, []);

  const labels = useMemo(() => mentionLabels(staff), [staff]);
  const topLevel = useMemo(() => [...entries].filter((c) => !c.parentId).sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)), [entries]);
  const repliesOf = (id: string) => entries.filter((c) => c.parentId === id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const mentionQuery = useMemo(() => {
    const atIdx = draft.lastIndexOf('@');
    if (atIdx === -1) return null;
    const after = draft.slice(atIdx + 1);
    if (after.includes(' ') || after.includes('\n')) return null;
    return after;
  }, [draft]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return staff.filter((s) => s.fullName?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)).slice(0, 5);
  }, [mentionQuery, staff]);

  const insertMention = (name: string) => {
    const atIdx = draft.lastIndexOf('@');
    setDraft(`${draft.slice(0, atIdx)}@${name} `);
  };

  const postComment = async () => {
    const text = draft.trim();
    if (!text || !me) return;
    const comment: EntityComment = {
      id: `c${Date.now()}`,
      author: me.name,
      createdAt: new Date().toISOString(),
      text,
      mentions: extractMentions(text, labels),
    };
    setSaving(true);
    try {
      await onSave([comment, ...entries]);
      setDraft('');
    } catch {
      showToast('Не удалось отправить комментарий', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const postReply = async (parentId: string) => {
    const text = replyDraft.trim();
    if (!text || !me) return;
    const comment: EntityComment = {
      id: `c${Date.now()}`,
      author: me.name,
      createdAt: new Date().toISOString(),
      text,
      mentions: extractMentions(text, labels),
      parentId,
    };
    setSaving(true);
    try {
      await onSave([...entries, comment]);
      setReplyDraft('');
      setReplyTo(null);
    } catch {
      showToast('Не удалось отправить ответ', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!me) return;
    const next = entries.map((c) => {
      if (c.id !== commentId) return c;
      const likedBy = c.likedBy || [];
      return { ...c, likedBy: likedBy.includes(me.id) ? likedBy.filter((x) => x !== me.id) : [...likedBy, me.id] };
    });
    try {
      await onSave(next);
    } catch {
      showToast('Не удалось поставить лайк', { variant: 'error' });
    }
  };

  const renderComment = (c: EntityComment, isReply: boolean) => {
    const liked = !!(me && c.likedBy?.includes(me.id));
    return (
      <View key={c.id} style={[styles.commentRow, isReply && styles.replyRow]}>
        <AvatarInitials name={c.author} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.commentHead}>
            <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>{c.author}</Text>
            <Text style={[styles.time, { color: colors.textTertiary }]}>{relativeTime(c.createdAt)}</Text>
          </View>
          <Text style={[styles.text, { color: colors.text }]}>{renderTextWithMentions(c.text, labels, colors)}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(c.id)} hitSlop={8}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={13} color={liked ? colors.error : colors.textTertiary} />
              {!!c.likedBy?.length && <Text style={[styles.actionTxt, { color: colors.textTertiary }]}>{c.likedBy.length}</Text>}
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setReplyTo(replyTo === c.id ? null : c.id)} hitSlop={8}>
                <Text style={[styles.actionTxt, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Ответить</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isReply && repliesOf(c.id).map((r) => renderComment(r, true))}

          {!isReply && replyTo === c.id && (
            <View style={styles.replyInputRow}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, flex: 1 }]}
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Ответить..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.ink }]} onPress={() => postReply(c.id)} disabled={saving}>
                <Ionicons name="arrow-up" size={14} color={colors.onInk} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}{entries.length > 0 ? ` (${entries.length})` : ''}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, flex: 1 }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Написать комментарий... (@ для упоминания)"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.ink, opacity: draft.trim() && !saving ? 1 : 0.4 }]} onPress={postComment} disabled={!draft.trim() || saving}>
            <Ionicons name="arrow-up" size={16} color={colors.onInk} />
          </TouchableOpacity>
        </View>

        {mentionMatches.length > 0 && (
          <View style={[styles.mentionList, { borderColor: colors.line3 }]}>
            {mentionMatches.map((s) => (
              <TouchableOpacity key={s.id} style={styles.mentionRow} onPress={() => insertMention(s.fullName)} activeOpacity={0.7}>
                <AvatarInitials name={s.fullName} size={22} />
                <Text style={[styles.mentionTxt, { color: colors.text }]} numberOfLines={1}>{s.fullName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {topLevel.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>Пока нет комментариев</Text>
        ) : (
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {topLevel.map((c) => renderComment(c, false))}
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  card: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, padding: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13.5, fontFamily: fonts.regular, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  mentionList: { marginTop: spacing.xs, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  mentionTxt: { fontSize: 13, fontFamily: fonts.medium },
  empty: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', paddingVertical: spacing.md },
  commentRow: { flexDirection: 'row', gap: spacing.sm },
  replyRow: { marginTop: spacing.sm, marginLeft: 34 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { fontSize: 13, fontFamily: fonts.semibold, flexShrink: 1 },
  time: { fontSize: 11 },
  text: { fontSize: 13.5, fontFamily: fonts.regular, marginTop: 2, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionTxt: { fontSize: 11 },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
});
