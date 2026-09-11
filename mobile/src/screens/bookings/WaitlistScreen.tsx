import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import {
  fetchWaitlist, removeWaitlistEntry, offerWaitlistSlot, convertWaitlistEntry, fetchBookingServices,
  WaitlistEntry, BookingService,
} from '../../api/bookings';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SwipeableRow, SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { Pill, EntityField } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const PRIORITY_LABEL: Record<string, string> = { normal: 'Обычный', high: 'Высокий', vip: 'VIP' };

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function backendError(e: any, fallback: string): string {
  return e?.response?.data?.message || fallback;
}

export const WaitlistScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const sheetRef = React.useRef<AppBottomSheetRef>(null);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offerTarget, setOfferTarget] = useState<WaitlistEntry | null>(null);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // No status filter: shows both entries still waiting for a slot and ones already offered
      // one, so a real "offer → confirm" flow can be worked end-to-end from this one screen.
      const [w, s] = await Promise.all([fetchWaitlist(), fetchBookingServices().catch(() => [])]);
      setEntries(w.filter((e) => e.status === 'waiting' || e.status === 'offer'));
      setServices(s);
    } catch {
      showToast('Не удалось загрузить лист ожидания', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback((entry: WaitlistEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    removeWaitlistEntry(entry.id).catch(() => {
      setEntries((prev) => [entry, ...prev]);
      showToast('Не удалось удалить заявку', { variant: 'error' });
    });
  }, []);

  const openOffer = (entry: WaitlistEntry) => {
    setOfferTarget(entry);
    setStartAt(entry.offeredStartAt ? entry.offeredStartAt.slice(0, 16).replace('T', ' ') : '');
    setEndAt(entry.offeredEndAt ? entry.offeredEndAt.slice(0, 16).replace('T', ' ') : '');
    sheetRef.current?.snapToIndex(0);
  };

  const submitOffer = async () => {
    if (!offerTarget || !startAt.trim() || !endAt.trim()) return;
    setSaving(true);
    try {
      const iso = (v: string) => new Date(v.trim().replace(' ', 'T')).toISOString();
      const updated = await offerWaitlistSlot(offerTarget.id, { startAt: iso(startAt), endAt: iso(endAt) });
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      sheetRef.current?.close();
      showToast('Слот предложен', { variant: 'success' });
    } catch (e: any) {
      showToast(backendError(e, 'Не удалось предложить слот'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const convert = async (entry: WaitlistEntry) => {
    setConvertingId(entry.id);
    try {
      const reservation = await convertWaitlistEntry(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      showToast('Заявка превращена в бронь', { variant: 'success' });
      navigation.navigate('BookingDetail', { id: reservation.id });
    } catch (e: any) {
      showToast(backendError(e, 'Не удалось создать бронь'), { variant: 'error' });
    } finally {
      setConvertingId(null);
    }
  };

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || 'Без услуги';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.semibold }]}>Лист ожидания</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{entries.length} заявки без подтверждённой брони</Text>

      {loading ? (
        <SkeletonList count={5} />
      ) : entries.length === 0 ? (
        <EmptyState icon="time-outline" title="Лист ожидания пуст" subtitle="Здесь появятся заявки без свободного слота" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={entries}
            keyExtractor={(item: WaitlistEntry) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: WaitlistEntry }) => (
              <SwipeableRow rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => remove(item) }}>
                <View style={[styles.row, { borderBottomColor: colors.line3 }]}>
                  <View style={styles.rowTop}>
                    <View style={[styles.icoWrap, { backgroundColor: colors.surfaceVariant }]}>
                      <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.customerName || 'Без имени'}</Text>
                      <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{serviceName(item.serviceId)}{item.preferredWindow ? ` · ${item.preferredWindow}` : ''}</Text>
                      {item.status === 'offer' && item.offeredStartAt && item.offeredEndAt && (
                        <Text style={[styles.meta, { color: colors.accent, marginTop: 2 }]} numberOfLines={1}>
                          предложено: {fmtDateTime(item.offeredStartAt)} – {fmtDateTime(item.offeredEndAt)}
                        </Text>
                      )}
                    </View>
                    {item.priority !== 'normal' && <Pill label={PRIORITY_LABEL[item.priority]} tone={item.priority === 'vip' ? 'acc' : 'neg'} />}
                  </View>
                  <View style={styles.actionsRow}>
                    <Button label={item.status === 'offer' ? 'Изменить слот' : 'Предложить слот'} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => openOffer(item)} />
                    {item.status === 'offer' && (
                      <Button label="Записать" variant="accent" size="sm" style={{ flex: 1 }} loading={convertingId === item.id} onPress={() => convert(item)} />
                    )}
                  </View>
                </View>
              </SwipeableRow>
            )}
          />
        </GlassCard>
      )}

      <AppBottomSheet ref={sheetRef} snapPoints={['48%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Предложить слот</Text>
        {offerTarget && <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{offerTarget.customerName || 'Без имени'}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <EntityField label="Начало" value={startAt} onChangeText={setStartAt} placeholder="ГГГГ-ММ-ДД ЧЧ:ММ" help="формат: ГГГГ-ММ-ДД ЧЧ:ММ" />
          <EntityField label="Окончание" value={endAt} onChangeText={setEndAt} placeholder="ГГГГ-ММ-ДД ЧЧ:ММ" />
          <Button label="Сохранить" variant="accent" fullWidth loading={saving} disabled={!startAt.trim() || !endAt.trim()} onPress={submitOffer} />
        </View>
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { paddingHorizontal: spacing.lg, paddingBottom: 2 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backTxt: { fontSize: 17 },
  subtitle: { fontSize: 12.5, fontFamily: fonts.regular, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icoWrap: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontFamily: fonts.semibold },
  meta: { fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
});
