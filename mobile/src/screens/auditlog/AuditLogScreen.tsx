import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchGlobalAuditLog, AuditLogEntityType, AuditLogAction, GlobalAuditLogEntry } from '../../api/auditLog';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { ToolbarButton, SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

const ENTITY_LABEL: Record<AuditLogEntityType, string> = {
  lead: 'Лид', contact: 'Контакт', company: 'Компания', sale: 'Продажа', project: 'Проект',
  reservation: 'Бронь', hotel_reservation: 'Бронь отеля', product: 'Товар',
};
const ENTITY_ICON: Record<AuditLogEntityType, keyof typeof Ionicons.glyphMap> = {
  lead: 'flash-outline', contact: 'person-circle-outline', company: 'business-outline', sale: 'cash-outline',
  project: 'layers-outline', reservation: 'calendar-outline', hotel_reservation: 'bed-outline', product: 'cube-outline',
};
const ACTION_LABEL: Record<AuditLogAction, string> = { create: 'Создано', update: 'Изменено', delete: 'Удалено' };
const ACTION_COLOR: Record<AuditLogAction, 'success' | 'info' | 'error'> = { create: 'success', update: 'info', delete: 'error' };
const ENTITY_ORDER: AuditLogEntityType[] = ['lead', 'contact', 'company', 'sale', 'project', 'reservation', 'hotel_reservation', 'product'];

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} д назад`;
}

function navigateToEntity(navigation: any, e: GlobalAuditLogEntry) {
  switch (e.entityType) {
    case 'lead':
      return navigation.navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id: e.entityId } } });
    case 'contact':
      return navigation.navigate('Clients', { screen: 'ContactDetail', params: { id: e.entityId } });
    case 'company':
      return navigation.navigate('Clients', { screen: 'CompanyDetail', params: { id: e.entityId } });
    case 'sale':
      return navigation.navigate('Sales', { screen: 'SaleDetail', params: { id: e.entityId } });
    case 'project':
      return navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: e.entityId } });
    case 'reservation':
      return navigation.navigate('Bookings', { screen: 'BookingDetail', params: { id: e.entityId } });
    case 'hotel_reservation':
      return navigation.navigate('Hotels', { screen: 'HotelReservationDetail', params: { id: e.entityId } });
    case 'product':
      return navigation.navigate('Products', { screen: 'ProductDetail', params: { id: e.entityId } });
    default:
      return undefined;
  }
}

export const AuditLogScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const filterSheetRef = useRef<AppBottomSheetRef>(null);

  const [entries, setEntries] = useState<GlobalAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [entityFilter, setEntityFilter] = useState<AuditLogEntityType | null>(null);
  const [draftFilter, setDraftFilter] = useState<AuditLogEntityType | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetchGlobalAuditLog({ entityType: entityFilter || undefined, limit: 50 });
      setEntries(res.items);
      setTotal(res.total);
      setDenied(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setDenied(true);
      else showToast('Не удалось загрузить журнал', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityFilter]);

  useEffect(() => { load(); }, [load]);

  const openFilterSheet = () => {
    setDraftFilter(entityFilter);
    filterSheetRef.current?.snapToIndex(0);
  };
  const applyFilter = () => {
    setEntityFilter(draftFilter);
    filterSheetRef.current?.close();
  };

  if (denied) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Журнал аудита</Text>
          </View>
        </View>
        <EmptyState icon="lock-closed-outline" title="Недостаточно прав" subtitle="Общая лента изменений доступна только владельцу/разработчику тенанта" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Журнал аудита</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{total}</Text> событий
        </Text>
        <View style={styles.toolbar}>
          <ToolbarButton icon="options-outline" label={entityFilter ? ENTITY_LABEL[entityFilter] : 'Все разделы'} active={!!entityFilter} onPress={openFilterSheet} />
        </View>
      </View>

      {loading ? (
        <SkeletonList count={7} />
      ) : entries.length === 0 ? (
        <EmptyState icon="time-outline" title="Пока пусто" subtitle="Здесь появится лента изменений по всем модулям" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={entries}
            keyExtractor={(item: GlobalAuditLogEntry) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: GlobalAuditLogEntry }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.line3 }]}
                onPress={() => navigateToEntity(navigation, item)}
                activeOpacity={0.7}
              >
                <View style={[styles.ico, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name={ENTITY_ICON[item.entityType] || 'ellipse-outline'} size={16} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                      {ENTITY_LABEL[item.entityType]}{item.entityLabel ? `: ${item.entityLabel}` : ''}
                    </Text>
                    <Text style={[styles.actionTag, { color: colors[ACTION_COLOR[item.action]] }]}>{ACTION_LABEL[item.action]}</Text>
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                    {item.summary || item.actorName || '—'}
                  </Text>
                </View>
                <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(item.createdAt)}</Text>
              </TouchableOpacity>
            )}
          />
        </GlassCard>
      )}

      <AppBottomSheet ref={filterSheetRef} snapPoints={['55%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Раздел</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <TouchableOpacity style={[styles.filterRow, { borderColor: draftFilter === null ? colors.ink : colors.line2 }]} onPress={() => setDraftFilter(null)}>
            <Text style={[styles.filterTxt, { color: colors.text }]}>Все разделы</Text>
          </TouchableOpacity>
          {ENTITY_ORDER.map((t) => (
            <TouchableOpacity key={t} style={[styles.filterRow, { borderColor: draftFilter === t ? colors.ink : colors.line2 }]} onPress={() => setDraftFilter(t)}>
              <Ionicons name={ENTITY_ICON[t]} size={15} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[styles.filterTxt, { color: colors.text }]}>{ENTITY_LABEL[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button label="Применить" variant="primary" fullWidth onPress={applyFilter} style={{ marginTop: spacing.xl }} />
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  ico: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { fontSize: 13.5, fontFamily: fonts.semibold, flexShrink: 1 },
  actionTag: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase' },
  rowMeta: { fontSize: 11.5, fontFamily: fonts.regular, marginTop: 2 },
  time: { fontSize: 10.5, flexShrink: 0 },
  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  filterTxt: { fontSize: 13, fontFamily: fonts.medium },
});
