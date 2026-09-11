import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';

const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MONTH_NAME = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

interface Props {
  month: Date;
  eventsByDay: Record<number, number>;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

/** RN port of `.mg-cal`/`MonthGrid` — a real month grid with per-day event dots, not a horizontal day strip. */
export const MonthCalendar: React.FC<Props> = ({ month, eventsByDay, selectedDay, onSelectDay, onPrevMonth, onNextMonth }) => {
  const { colors } = useTheme();
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;
  const todayDate = isCurrentMonth ? today.getDate() : -1;

  const cells = useMemo(() => {
    const firstDow = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Monday-first offset
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    return [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  }, [year, monthIdx]);

  return (
    <View>
      <View style={styles.headRow}>
        <TouchableOpacity onPress={onPrevMonth} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{MONTH_NAME[monthIdx]} {year}</Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={8}>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {WD.map((wd) => (
          <Text key={wd} style={[styles.wd, { color: colors.textTertiary }]}>{wd}</Text>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <View key={`e${i}`} style={styles.cell} />;
          const count = eventsByDay[d] || 0;
          const isToday = d === todayDate;
          const isSelected = d === selectedDay;
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.cell,
                styles.day,
                count > 0 && !isSelected && { backgroundColor: colors.surfaceVariant },
                isSelected && { backgroundColor: colors.ink },
                isToday && !isSelected && { borderColor: colors.accent, borderWidth: 1.5 },
              ]}
              onPress={() => onSelectDay(isSelected ? null : d)}
            >
              <Text style={[styles.dayNum, { color: isSelected ? colors.onInk : isToday ? colors.accent : colors.text, fontFamily: isToday ? fonts.semibold : fonts.regular }]}>{d}</Text>
              {count > 0 && (
                <View style={styles.dots}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: isSelected ? colors.onInk : colors.accent }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const CELL = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.sm },
  monthTitle: { fontSize: 14.5, fontFamily: fonts.semibold, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: CELL, textAlign: 'center', fontSize: 9, fontFamily: fonts.mono, letterSpacing: 0.6, marginBottom: 4 },
  cell: { width: CELL, aspectRatio: 1, padding: 1.5 },
  day: { borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  dayNum: { fontSize: 13, letterSpacing: -0.2 },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
