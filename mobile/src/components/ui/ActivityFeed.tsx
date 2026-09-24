import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AuditLogEntry } from '../../api/auditLog';
import { useLanguage } from '../../i18n/LanguageContext';

const ACTION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  create: 'flash-outline',
  update: 'create-outline',
  delete: 'trash-outline',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} д назад`;
}

interface Props {
  entries: AuditLogEntry[];
  title?: string;
}

/**
 * Read-only лента изменений записи из общего `audit_logs` (см. MOBILE_DATA_PARITY_PLAN.md §16) —
 * общая для Продаж/Контактов/Компаний. Лиды/Бронирования/Проекты используют свои собственные
 * per-entity журналы (LeadActivity/ReservationActivity/ProjectActivity) с чуть другой формой
 * данных, поэтому у них отдельная разметка на месте, не через этот компонент.
 */
export const ActivityFeed: React.FC<Props> = ({ entries, title = 'ИСТОРИЯ' }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  if (entries.length === 0) return null;

  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card }]}>
        {entries.map((e, i) => (
          <View key={e.id} style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < entries.length - 1 ? 1 : 0 }]}>
            <View style={[styles.icoWrap, { backgroundColor: colors.ink }]}>
              <Ionicons name={ACTION_ICON[e.action] || 'ellipse-outline'} size={14} color={colors.onInk} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.summary, { color: colors.text }]} numberOfLines={2}>{e.summary || e.action}</Text>
              {(e.changes || []).filter((c) => (c.oldValue ?? '') !== (c.newValue ?? '') && (c.oldValue || c.newValue)).slice(0, 4).map((c, ci) => {
                const key = `history.field.${c.field}`;
                const label = t(key) !== key ? t(key) : c.field;
                return <Text key={ci} style={[styles.actor, { color: colors.textSecondary }]} numberOfLines={2}>{`${label}: ${c.oldValue || '—'} → ${c.newValue || '—'}`}</Text>;
              })}
              {e.actorName && <Text style={[styles.actor, { color: colors.textSecondary }]} numberOfLines={1}>{e.actorName}</Text>}
            </View>
            <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relativeTime(e.createdAt)}</Text>
          </View>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: 12, paddingHorizontal: spacing.lg },
  icoWrap: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  summary: { fontSize: 13.5, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  actor: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  time: { fontSize: 11, flexShrink: 0 },
});
