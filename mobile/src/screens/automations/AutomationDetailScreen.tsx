import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchAutomation, setAutomationActive, deleteAutomation, runAutomationNow, Automation } from '../../api/automations';
import { triggerLabel, actionTypeLabel } from './triggerLabels';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, Button, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function fmtDate(d: string | null) {
  if (!d) return 'ещё не запускалась';
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const AutomationDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchAutomation(id).then(setAutomation).catch(() => showToast('Не удалось загрузить автоматизацию', { variant: 'error' })).finally(() => setLoading(false));
  }, [id]);

  const toggle = async () => {
    if (!automation) return;
    const next = !automation.isActive;
    setAutomation({ ...automation, isActive: next });
    try {
      await setAutomationActive(automation.id, next);
    } catch {
      setAutomation({ ...automation, isActive: !next });
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  };

  const handleRunNow = async () => {
    if (!automation) return;
    setRunning(true);
    try {
      await runAutomationNow(automation.id);
      showToast('Автоматизация запущена', { variant: 'success' });
    } catch {
      showToast('Не удалось запустить', { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = () => {
    if (!automation) return;
    navigation.goBack();
    deleteAutomation(automation.id).then(() => showToast('Автоматизация удалена', { variant: 'success' })).catch(() => showToast('Не удалось удалить', { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!automation) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Автоматизация не найдена</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Автоматизации</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={17} color={colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: colors.text }]}>{automation.name}</Text>
            {automation.description ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{automation.description}</Text> : null}
          </View>
          <Switch value={automation.isActive} onValueChange={toggle} trackColor={{ false: colors.line2, true: colors.success }} thumbColor={colors.card} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <Pill label={automation.isActive ? 'Активна' : 'Выключена'} tone={automation.isActive ? 'pos' : 'default'} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ТРИГГЕР</Text>
        <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
          <View style={styles.triggerRow}>
            <Ionicons name="flash-outline" size={16} color={colors.info} />
            <Text style={[styles.triggerTxt, { color: colors.text }]}>{triggerLabel(automation.triggerEvent)}</Text>
          </View>
          {automation.conditions && automation.conditions.length > 0 && (
            <View style={{ marginTop: spacing.sm, gap: 4 }}>
              {automation.conditions.map((c, i) => (
                <Text key={i} style={[styles.conditionTxt, { color: colors.textSecondary, fontFamily: fonts.mono }]}>
                  {c.field} {c.operator} {c.value != null ? JSON.stringify(c.value) : ''}
                </Text>
              ))}
            </View>
          )}
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ДЕЙСТВИЯ ({automation.actions.length})</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {automation.actions.map((a, i) => (
            <View key={i} style={[styles.actionRow, { borderBottomColor: colors.line3, borderBottomWidth: i < automation.actions.length - 1 ? 1 : 0 }]}>
              <View style={[styles.actionNum, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.actionNumTxt, { color: colors.textSecondary, fontFamily: fonts.monoSemibold }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.actionTxt, { color: colors.text }]}>{actionTypeLabel(a.type)}</Text>
            </View>
          ))}
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СТАТИСТИКА</Text>
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flexDirection: 'row' }}>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ВЫПОЛНЕНО</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{automation.executionCount}</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.line3 }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ОШИБОК</Text>
            <Text style={[styles.statValue, { color: automation.errorCount > 0 ? colors.error : colors.text }]}>{automation.errorCount}</Text>
          </View>
        </GlassCard>
        <Text style={[styles.lastRun, { color: colors.textTertiary }]}>Последний запуск: {fmtDate(automation.lastExecutedAt)}</Text>
        {automation.lastError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorBg, marginHorizontal: spacing.lg }]}>
            <Text style={[styles.errorTxt, { color: colors.error }]}>{automation.lastError}</Text>
          </View>
        ) : null}

        <Button label="Запустить сейчас" variant="secondary" fullWidth loading={running} onPress={handleRunNow} style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg },
  name: { fontSize: 19, fontFamily: fonts.bold, letterSpacing: -0.3 },
  desc: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  triggerTxt: { fontSize: 14, fontFamily: fonts.semibold },
  conditionTxt: { fontSize: 11.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  actionNum: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  actionNumTxt: { fontSize: 11 },
  actionTxt: { fontSize: 14, fontFamily: fonts.medium, flex: 1 },
  statCol: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statDiv: { width: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 10, fontFamily: fonts.semibold, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: fonts.bold },
  lastRun: { fontSize: 11, fontFamily: fonts.regular, paddingHorizontal: spacing.xxl, paddingTop: 6 },
  errorBox: { borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm },
  errorTxt: { fontSize: 12, fontFamily: fonts.medium },
});
