import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, radius } from '../../theme/ThemeContext';
import { appLocale } from '../../i18n/format';
import { parseIsoDate, toIsoDate } from '../../utils/dateValues';

interface Base {
  /** Month shown first (defaults to the selected date / today). */
  initialMonth?: Date;
}
interface Single extends Base {
  mode: 'single';
  value: string | null;
  onChange: (value: string | null) => void;
}
interface Range extends Base {
  mode: 'range';
  start: string | null;
  end: string | null;
  onChange: (range: { start: string | null; end: string | null }) => void;
}
type Props = Single | Range;

/** Month grid for picking a day or a day range — the mobile counterpart of the website's `DateFieldPicker` calendar. */
export const DateCalendar: React.FC<Props> = (props) => {
  const { colors } = useTheme();
  const anchor = props.mode === 'single' ? parseIsoDate(props.value) : parseIsoDate(props.start) || parseIsoDate(props.end);
  const [view, setView] = useState(() => {
    const d = props.initialMonth || anchor || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const weekdays = useMemo(() => {
    // 2024-01-01 is a Monday → Monday-first labels, localized by Intl.
    return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(appLocale(), { weekday: 'short' }));
  }, [appLocale()]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
  }, [view]);

  const startIso = props.mode === 'single' ? props.value : props.start;
  const endIso = props.mode === 'range' ? props.end : null;
  const todayIso = toIsoDate(new Date());

  const pick = (day: number) => {
    const iso = toIsoDate(new Date(view.getFullYear(), view.getMonth(), day));
    if (props.mode === 'single') {
      props.onChange(props.value === iso ? null : iso);
      return;
    }
    // Same interaction as the website: 1st tap = start, 2nd tap = end (swapped if earlier), 3rd tap restarts.
    if (!props.start || props.end) props.onChange({ start: iso, end: null });
    else if (iso < props.start) props.onChange({ start: iso, end: props.start });
    else props.onChange({ start: props.start, end: iso });
  };

  const title = view.toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' });

  return (
    <View>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <Text key={i} style={[styles.wd, { color: colors.textTertiary }]}>{w}</Text>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <View key={`e${i}`} style={styles.cell} />;
          const iso = toIsoDate(new Date(view.getFullYear(), view.getMonth(), d));
          const isStart = iso === startIso;
          const isEnd = iso === endIso;
          const between = !!startIso && !!endIso && iso > startIso && iso < endIso;
          const selected = isStart || isEnd;
          return (
            <TouchableOpacity key={iso} style={[styles.cell, between && { backgroundColor: colors.surfaceVariant }]} onPress={() => pick(d)} activeOpacity={0.7}>
              <View style={[styles.dayCircle, selected && { backgroundColor: colors.ink }, !selected && iso === todayIso && { borderWidth: 1, borderColor: colors.ink }]}>
                <Text style={[styles.day, { color: selected ? colors.onInk : colors.text }]}>{d}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  title: { fontSize: 15, fontFamily: fonts.semibold, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontFamily: fonts.medium, paddingBottom: 6, textTransform: 'uppercase' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: radius.xxl, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 14, fontFamily: fonts.medium },
});
