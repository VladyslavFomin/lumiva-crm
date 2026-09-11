import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
// expo-file-system v19 (SDK 54) replaced downloadAsync()/cacheDirectory with a new File/Directory
// API — the old imperative API (still the simplest fit for "download to a temp file, then share
// it") lives on in this explicit legacy import path rather than the package root.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Call, getCallRecordingDownloadInfo } from '../../api/telephony';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const STATUS_LABEL: Record<string, string> = {
  queued: 'В очереди', ringing: 'Звонит', 'in-progress': 'В процессе', completed: 'Завершён',
  'no-answer': 'Без ответа', busy: 'Занято', failed: 'Ошибка', canceled: 'Отменён',
};
const SENTIMENT_LABEL: Record<string, string> = { positive: 'Положительный', neutral: 'Нейтральный', negative: 'Отрицательный' };
const SENTIMENT_TONE: Record<string, 'pos' | 'default' | 'neg'> = { positive: 'pos', neutral: 'default', negative: 'neg' };

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const CallDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const call: Call = route.params.call;
  const [downloading, setDownloading] = useState(false);

  const number = call.direction === 'inbound' ? call.fromNumber : call.toNumber;

  const openRecording = async () => {
    setDownloading(true);
    try {
      const { url, headers } = await getCallRecordingDownloadInfo(call.id);
      const dest = `${FileSystem.cacheDirectory}call-${call.id}.mp3`;
      const { uri } = await FileSystem.downloadAsync(url, dest, { headers });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        showToast('Нет доступного приложения для воспроизведения', { variant: 'error' });
      }
    } catch {
      showToast('Не удалось загрузить запись', { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Телефония</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <View style={[styles.heroIco, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name={call.direction === 'inbound' ? 'call-outline' : 'call-outline'} size={20} color={colors.text} style={call.direction === 'outbound' ? { transform: [{ rotate: '90deg' }] } : undefined} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>{number || 'Неизвестный номер'}</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              {call.direction === 'inbound' ? 'Входящий' : 'Исходящий'} · {STATUS_LABEL[call.status] || call.status} · {fmtDuration(call.durationSeconds)}
            </Text>
          </View>
          {number && (
            <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.success }]} onPress={() => Linking.openURL(`tel:${number}`)}>
              <Ionicons name="call" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {call.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {call.tags.map((t) => <Pill key={t} label={t} />)}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <View style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: 1 }]}>
            <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Дата</Text>
            <Text style={[styles.propValue, { color: colors.text }]}>{fmtDateTime(call.createdAt)}</Text>
          </View>
          {call.sentiment && (
            <View style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: call.linkedLeadId ? 1 : 0 }]}>
              <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Тональность (ИИ)</Text>
              <Pill label={SENTIMENT_LABEL[call.sentiment] || call.sentiment} tone={SENTIMENT_TONE[call.sentiment] || 'default'} />
            </View>
          )}
          {call.linkedLeadId && (
            <TouchableOpacity
              style={styles.propRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id: call.linkedLeadId } } })}
            >
              <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Связанный лид</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.propValue, { color: colors.accent }]}>Открыть</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
              </View>
            </TouchableOpacity>
          )}
        </GlassCard>

        {call.recordingUrl && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ЗАПИСЬ</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <TouchableOpacity style={[styles.recordingBtn, { backgroundColor: colors.surfaceVariant }]} onPress={openRecording} disabled={downloading} activeOpacity={0.7}>
                <Ionicons name={downloading ? 'hourglass-outline' : 'play-circle-outline'} size={20} color={colors.text} />
                <Text style={[styles.recordingBtnTxt, { color: colors.text }]}>{downloading ? 'Загрузка…' : 'Открыть запись'}</Text>
              </TouchableOpacity>
              <Text style={[styles.note, { color: colors.textTertiary }]}>Откроется во внешнем плеере — воспроизведение внутри приложения появится позже.</Text>
            </GlassCard>
          </>
        )}

        {call.transcript && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>РАСШИФРОВКА (ИИ)</Text>
            <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
              <Text style={[styles.transcript, { color: colors.text }]}>{call.transcript}</Text>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroIco: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 18, fontFamily: fonts.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: 12.5, fontFamily: fonts.regular, marginTop: 2 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propLabel: { fontSize: 13, fontFamily: fonts.regular },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  recordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.lg },
  recordingBtnTxt: { fontSize: 14, fontFamily: fonts.semibold },
  note: { fontSize: 11.5, marginTop: spacing.sm, textAlign: 'center' },
  transcript: { fontSize: 13.5, fontFamily: fonts.regular, lineHeight: 20 },
});
