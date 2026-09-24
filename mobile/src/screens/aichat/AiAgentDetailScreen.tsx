import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  fetchAiAgentDetail,
  pauseAiAgent,
  resumeAiAgent,
  runAiAgentNow,
  updateAiAgentPermissions,
  fetchAiAgentLogs,
  fetchAiAgentReports,
  generateAiAgentReport,
  AiAgentDetail,
  AiAgentLog,
  AiAgentReport,
  AiAgentPermissionMap,
} from '../../api/aiAgents';
import { agentStatusLabel, permissionLabel, logEventLabel, logEventIcon } from './aiEmployeeLabels';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, Button, AppBottomSheet, AppBottomSheetRef, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildPermMap(keys: string[], values: AiAgentPermissionMap): AiAgentPermissionMap {
  return keys.reduce<AiAgentPermissionMap>((acc, k) => {
    acc[k] = !!values[k];
    return acc;
  }, {});
}

function statusTone(status?: string): 'pos' | 'warn' | 'default' {
  if (status === 'active') return 'pos';
  if (status === 'paused' || status === 'setup_required') return 'warn';
  return 'default';
}

export const AiAgentDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;

  const [detail, setDetail] = useState<AiAgentDetail | null>(null);
  const [logs, setLogs] = useState<AiAgentLog[]>([]);
  const [reports, setReports] = useState<AiAgentReport[]>([]);
  const [permMap, setPermMap] = useState<AiAgentPermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AiAgentReport | null>(null);
  const reportSheetRef = useRef<AppBottomSheetRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, logsRes, reportsRes] = await Promise.all([
        fetchAiAgentDetail(id),
        fetchAiAgentLogs(id, { limit: 30 }),
        fetchAiAgentReports(id, { limit: 20 }),
      ]);
      setDetail(d);
      setLogs(logsRes);
      setReports(reportsRes);
      setPermMap(buildPermMap(d.permissionKeys, d.permissions));
    } catch {
      showToast('Не удалось загрузить ИИ-сотрудника', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleToggleStatus = async () => {
    if (!detail) return;
    setStatusBusy(true);
    try {
      const next = detail.agent.status === 'active' ? await pauseAiAgent(id) : await resumeAiAgent(id);
      setDetail(next);
      setPermMap(buildPermMap(next.permissionKeys, next.permissions));
    } catch {
      showToast('Не удалось изменить статус', { variant: 'error' });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleRunNow = async () => {
    setRunBusy(true);
    try {
      await runAiAgentNow(id);
      showToast('Запуск выполнен', { variant: 'success' });
      const [logsRes, d] = await Promise.all([fetchAiAgentLogs(id, { limit: 30 }), fetchAiAgentDetail(id)]);
      setLogs(logsRes);
      setDetail(d);
    } catch {
      showToast('Не удалось запустить сотрудника', { variant: 'error' });
    } finally {
      setRunBusy(false);
    }
  };

  const handleTogglePermission = async (key: string) => {
    const next = { ...permMap, [key]: !permMap[key] };
    setPermMap(next);
    try {
      const res = await updateAiAgentPermissions(id, next);
      setPermMap(buildPermMap(detail?.permissionKeys || Object.keys(next), res.permissions));
    } catch {
      setPermMap(permMap);
      showToast('Не удалось изменить права', { variant: 'error' });
    }
  };

  const handleGenerateReport = async () => {
    setGenerateBusy(true);
    try {
      const res = await generateAiAgentReport(id);
      setReports((prev) => [res.report, ...prev]);
      showToast(res.usedFallback ? 'Отчёт сформирован (базовый шаблон)' : 'Отчёт сформирован', { variant: 'success' });
    } catch {
      showToast('Не удалось сформировать отчёт', { variant: 'error' });
    } finally {
      setGenerateBusy(false);
    }
  };

  const openReport = (report: AiAgentReport) => {
    setSelectedReport(report);
    reportSheetRef.current?.snapToIndex(0);
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={5} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>ИИ-сотрудник не найден</Text>
      </View>
    );
  }

  const { agent, permissionKeys } = detail;
  const isActive = agent.status === 'active';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>ИИ-сотрудники</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <AvatarInitials name={agent.name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: colors.text }]}>{agent.name}</Text>
            <Text style={[styles.roleTxt, { color: colors.textSecondary }]} numberOfLines={1}>
              {agent.roleTitle || agent.role}{agent.department ? ` · ${agent.department}` : ''}
            </Text>
            <View style={styles.badgeRow}>
              <Pill label={agentStatusLabel(agent.status || '')} tone={statusTone(agent.status)} />
            </View>
          </View>
        </View>

        {agent.roleDescription ? (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{agent.roleDescription}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Button
            label={isActive ? 'Приостановить' : 'Возобновить'}
            variant="secondary"
            loading={statusBusy}
            disabled={statusBusy}
            onPress={handleToggleStatus}
            style={{ flex: 1 }}
          />
          <Button
            label="Запустить сейчас"
            variant="primary"
            loading={runBusy}
            disabled={runBusy}
            onPress={handleRunNow}
            style={{ flex: 1 }}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПРАВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {permissionKeys.map((key, i) => (
            <View
              key={key}
              style={[styles.permRow, { borderBottomColor: colors.line3, borderBottomWidth: i < permissionKeys.length - 1 ? 1 : 0 }]}
            >
              <Text style={[styles.permLabel, { color: colors.text }]} numberOfLines={1}>{permissionLabel(key)}</Text>
              <Switch
                value={!!permMap[key]}
                onValueChange={() => handleTogglePermission(key)}
                trackColor={{ false: colors.line2, true: colors.success }}
                thumbColor={colors.card}
              />
            </View>
          ))}
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ЖУРНАЛ</Text>
        {logs.length === 0 ? (
          <Text style={[styles.emptyTxt, { color: colors.textTertiary }]}>Пока нет событий</Text>
        ) : (
          <GlassCard variant="g2" style={styles.listCard}>
            {logs.map((log, i) => (
              <View
                key={log.id}
                style={[styles.logRow, { borderBottomColor: colors.line3, borderBottomWidth: i < logs.length - 1 ? 1 : 0 }]}
              >
                <View style={[styles.logIco, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons
                    name={logEventIcon(log.eventType)}
                    size={15}
                    color={log.status === 'error' ? colors.error : log.status === 'warning' ? colors.warning : colors.info}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.logTitle, { color: colors.text }]} numberOfLines={1}>{logEventLabel(log.eventType)}</Text>
                  {log.outputSummary ? (
                    <Text style={[styles.logSummary, { color: colors.textSecondary }]} numberOfLines={2}>{log.outputSummary}</Text>
                  ) : null}
                </View>
                <Text style={[styles.logTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(log.createdAt)}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        <View style={styles.reportsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, paddingTop: 0 }]}>ОТЧЁТЫ</Text>
          <Button label="Сформировать отчёт" variant="secondary" size="sm" loading={generateBusy} disabled={generateBusy} onPress={handleGenerateReport} />
        </View>
        {reports.length === 0 ? (
          <Text style={[styles.emptyTxt, { color: colors.textTertiary }]}>Пока нет отчётов</Text>
        ) : (
          <GlassCard variant="g2" style={styles.listCard}>
            {reports.map((report, i) => (
              <TouchableOpacity
                key={report.id}
                style={[styles.reportRow, { borderBottomColor: colors.line3, borderBottomWidth: i < reports.length - 1 ? 1 : 0 }]}
                activeOpacity={0.7}
                onPress={() => openReport(report)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>{report.title}</Text>
                  <Text style={[styles.reportMeta, { color: colors.textTertiary }]}>{fmtDate(report.createdAt)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}
      </ScrollView>

      <AppBottomSheet ref={reportSheetRef} snapPoints={['85%']} onDismiss={() => setSelectedReport(null)}>
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {selectedReport ? (
            <>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedReport.title}</Text>
              <Text style={[styles.sheetMeta, { color: colors.textTertiary }]}>{fmtDate(selectedReport.createdAt)}</Text>
              <Text style={[styles.sheetBody, { color: colors.text }]}>{selectedReport.contentMd}</Text>
            </>
          ) : null}
        </BottomSheetScrollView>
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  name: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  roleTxt: { fontSize: 13, fontFamily: fonts.medium, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  description: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18, paddingHorizontal: spacing.lg, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  emptyTxt: { fontSize: 12.5, fontFamily: fonts.regular, paddingHorizontal: spacing.xxl },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  permLabel: { fontSize: 13.5, fontFamily: fonts.medium, flex: 1 },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  logIco: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  logTitle: { fontSize: 13.5, fontFamily: fonts.semibold },
  logSummary: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2, lineHeight: 16 },
  logTime: { fontSize: 10.5, flexShrink: 0, marginTop: 2 },
  reportsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  reportTitle: { fontSize: 13.5, fontFamily: fonts.semibold },
  reportMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold, marginTop: 4 },
  sheetMeta: { fontSize: 11.5, fontFamily: fonts.regular, marginTop: 4, marginBottom: spacing.md },
  sheetBody: { fontSize: 13.5, fontFamily: fonts.regular, lineHeight: 20 },
});
