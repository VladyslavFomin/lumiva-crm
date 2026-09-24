import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchStaffAvailabilityGrid, fetchBookingLocations, StaffAvailabilityRow, BookingLocation } from '../../api/bookings';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useLanguage } from '../../i18n/LanguageContext';

const CELL_W = 40;

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }

export const AvailabilityScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const WEEKDAY = [t('weekday.sun'), t('weekday.mon'), t('weekday.tue'), t('weekday.wed'), t('weekday.thu'), t('weekday.fri'), t('weekday.sat')];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<StaffAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 10 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  useEffect(() => {
    fetchBookingLocations().then(setLocations).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStaffAvailabilityGrid(selectedDay, locationId));
    } catch {
      showToast(t('availability.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedDay, locationId, t]);

  useEffect(() => { load(); }, [load]);

  const hours = rows[0]?.slots.map((s) => s.hour) || Array.from({ length: 12 }, (_, i) => 9 + i);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('availability.title')}</Text>
        </View>
      </View>

      {locations.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locStrip} style={{ flexGrow: 0 }}>
          <TouchableOpacity onPress={() => setLocationId(undefined)} style={[styles.locChip, { backgroundColor: !locationId ? colors.ink : colors.surfaceVariant, borderColor: !locationId ? colors.ink : colors.glassBorder }]}>
            <Text style={{ color: !locationId ? colors.onInk : colors.text, fontFamily: fonts.medium, fontSize: 12.5 }}>{t('availability.allLocations')}</Text>
          </TouchableOpacity>
          {locations.map((l) => (
            <TouchableOpacity key={l.id} onPress={() => setLocationId(l.id)} style={[styles.locChip, { backgroundColor: locationId === l.id ? colors.ink : colors.surfaceVariant, borderColor: locationId === l.id ? colors.ink : colors.glassBorder }]}>
              <Text style={{ color: locationId === l.id ? colors.onInk : colors.text, fontFamily: fonts.medium, fontSize: 12.5 }}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip} style={{ flexGrow: 0 }}>
        {days.map((d) => {
          const k = dayKey(d);
          const isSelected = k === selectedDay;
          return (
            <GlassCard key={k} variant="flat" style={[styles.dayCell, isSelected && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.dayCellInner}>
              <TouchableOpacity onPress={() => setSelectedDay(k)} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 9.5, fontFamily: fonts.medium, color: isSelected ? colors.onInk : colors.textTertiary }}>{WEEKDAY[d.getDay()]}</Text>
                <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: isSelected ? colors.onInk : colors.text, marginTop: 2 }}>{d.getDate()}</Text>
              </TouchableOpacity>
            </GlassCard>
          );
        })}
      </ScrollView>

      {loading ? (
        <SkeletonList count={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon="people-outline" title={t('availability.empty.title')} subtitle={t('availability.empty.subtitle')} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.gridHeaderRow}>
              <View style={{ width: 96 }} />
              {hours.map((h) => (
                <View key={h} style={{ width: CELL_W, alignItems: 'center' }}>
                  <Text style={[styles.hourLabel, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{h}:00</Text>
                </View>
              ))}
            </View>
            {rows.map((r) => (
              <View key={r.staffUserId} style={styles.gridRow}>
                <View style={styles.staffCell}>
                  <AvatarInitials name={r.name} size={26} />
                  <Text style={[styles.staffName, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                </View>
                {r.slots.map((s) => (
                  <TouchableOpacity
                    key={s.hour}
                    style={[styles.cell, { backgroundColor: s.busy ? colors.errorBg : colors.successBg }]}
                    onPress={() => s.busy && showToast(`${s.customerName || t('availability.client')} · ${s.serviceName || t('availability.service')}`)}
                    disabled={!s.busy}
                  >
                    {s.busy && <Ionicons name="person" size={12} color={colors.error} />}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.4 },
  locStrip: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm },
  locChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1 },
  dayStrip: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.md },
  dayCell: { width: 44, borderRadius: radius.lg },
  dayCellInner: { paddingVertical: 8 },
  gridHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  hourLabel: { fontSize: 9 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  staffCell: { width: 96, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  staffName: { fontSize: 11, fontFamily: fonts.medium, flexShrink: 1 },
  cell: { width: CELL_W - 4, height: 32, marginRight: 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
