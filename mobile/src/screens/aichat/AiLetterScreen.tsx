import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { sendAiChatMessage } from '../../api/aiChat';
import { fetchEmailAccounts, EmailAccount } from '../../api/email';
import { sendNewEmail } from '../../api/emailInbox';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { showToast, Button } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

const TONES = ['Деловой', 'Дружеский', 'Кратко и жёстко'];
const LENGTHS = ['Короткая', 'Средняя', 'Подробная'];

/** RN port of `mglass-w5-ai.jsx`'s "Письмо" tab. The design assumes a dedicated AI
 * email-drafting endpoint that doesn't exist on this backend (only lead-scoped
 * `outreach-email/:leadId`, which doesn't fit a standalone "write about anything" composer) —
 * built honestly on the real general-purpose `/ai/chat` instead: tone/length/subject/brief get
 * folded into one explicit prompt, the reply becomes the editable draft body, and "Отправить"
 * is a real send through the already-real `POST /email/send`, not a simulated action. */
export const AiLetterScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [length, setLength] = useState(LENGTHS[1]);
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchEmailAccounts().then((list) => {
      setAccounts(list);
      const active = list.find((a) => a.status === 'active') || list[0];
      if (active) setAccountId(active.id);
    }).catch(() => {});
  }, []);

  const generate = async () => {
    if (!brief.trim()) { showToast('Опишите, о чём письмо'); return; }
    setGenerating(true);
    try {
      const prompt = [
        `Напиши текст письма клиенту на тему «${subject.trim() || brief.trim()}».`,
        `Тон: ${tone}. Длина: ${length}.`,
        `О чём написать: ${brief.trim()}.`,
        'Ответь только текстом письма, без темы и приветствия "Тема:", без пояснений от себя.',
      ].join(' ');
      const res = await sendAiChatMessage(null, prompt);
      setBody(res.reply.trim());
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось сгенерировать письмо', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!accountId) { showToast('Нет подключённого почтового ящика'); return; }
    if (!to.trim() || !body.trim()) { showToast('Укажите получателя и текст письма'); return; }
    setSending(true);
    try {
      await sendNewEmail({ accountId, to: [to.trim()], subject: subject.trim() || undefined, textBody: body.trim() });
      showToast('Письмо отправлено', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось отправить письмо', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const fromAccount = accounts.find((a) => a.id === accountId);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>ИИ-ассистент</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Письмо</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Черновик пишет ИИ, редактируете и отправляете вы</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <GlassCard variant="g" style={styles.card} contentStyle={{ padding: spacing.lg }}>
          <Field label="КОМУ" colors={colors}>
            <TextInput value={to} onChangeText={setTo} placeholder="client@company.com" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { color: colors.text }]} />
          </Field>
          <Field label="ТЕМА" colors={colors}>
            <TextInput value={subject} onChangeText={setSubject} placeholder="Коммерческое предложение" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text }]} />
          </Field>
          <Field label="О ЧЁМ ПИСЬМО" colors={colors}>
            <TextInput value={brief} onChangeText={setBrief} placeholder="Например: напомнить про счёт и предложить скидку 10% за раннюю оплату" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, { color: colors.text, minHeight: 60, textAlignVertical: 'top' }]} />
          </Field>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ТОН</Text>
          <View style={styles.chipsRow}>
            {TONES.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: tone === t ? colors.ink : colors.surfaceVariant }]} onPress={() => setTone(t)}>
                <Text style={{ color: tone === t ? colors.onInk : colors.text, fontSize: 12.5, fontFamily: fonts.medium }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>ДЛИНА</Text>
          <View style={styles.chipsRow}>
            {LENGTHS.map((l) => (
              <TouchableOpacity key={l} style={[styles.chip, { backgroundColor: length === l ? colors.ink : colors.surfaceVariant }]} onPress={() => setLength(l)}>
                <Text style={{ color: length === l ? colors.onInk : colors.text, fontSize: 12.5, fontFamily: fonts.medium }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button label={body ? 'Перегенерировать' : 'Сгенерировать текст'} icon="sparkles-outline" variant="secondary" fullWidth loading={generating} onPress={generate} style={{ marginTop: spacing.lg }} />
        </GlassCard>

        <GlassCard variant="g" style={styles.card} contentStyle={{ padding: spacing.lg }}>
          <Field label="ТЕКСТ ПИСЬМА" colors={colors}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Появится здесь после генерации — можно редактировать вручную"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, { color: colors.text, minHeight: 160, textAlignVertical: 'top' }]}
            />
          </Field>
          {!!fromAccount && <Text style={[styles.fromNote, { color: colors.textTertiary }]}>Уйдёт с адреса {fromAccount.email}</Text>}
          <Button label="Отправить" icon="send-outline" variant="accent" fullWidth loading={sending} disabled={!to.trim() || !body.trim()} onPress={send} style={{ marginTop: spacing.md }} />
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const Field: React.FC<{ label: string; colors: any; children: React.ReactNode }> = ({ label, colors, children }) => (
  <View style={{ marginBottom: spacing.md }}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
    <GlassCard variant="flat" style={styles.inputCard} contentStyle={{ paddingHorizontal: spacing.md }}>
      {children}
    </GlassCard>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: { borderRadius: radius.xxl },
  fieldLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, marginBottom: 6 },
  inputCard: { borderRadius: radius.lg },
  input: { fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  fromNote: { fontSize: 11, marginTop: spacing.sm, textAlign: 'center' },
});
