import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { fetchLeads, deleteLead, updateLead, Lead, LeadStatusCode } from '../../api/leads';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { CurrencyChip, Segmented, FunnelBars, Pill } from '../../components/mg';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import {
  ToolbarButton,
  SkeletonList,
  EmptyState,
  AvatarInitials,
  SwipeableRow,
  BulkActionBar,
  AppBottomSheet,
  AppBottomSheetRef,
  showToast,
  Button,
} from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadsList'>;
type Mode = 'board' | 'list' | 'lost';

interface KanbanColumn {
  status: LeadStatusCode;
  items: Lead[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_ORDER: LeadStatusCode[] = ['new', 'in_progress', 'waiting', 'won', 'lost'];
const STATUS_TONE: Record<LeadStatusCode, 'acc' | 'warn' | 'pos' | 'neg' | 'default'> = {
  new: 'acc',
  in_progress: 'default',
  waiting: 'warn',
  won: 'pos',
  lost: 'neg',
};

const STATUS_LABEL: Record<LeadStatusCode, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  waiting: 'Ожидает',
  won: 'Выиграно',
  lost: 'Проиграно',
};

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const LeadsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fmt, toDisplay } = useCurrencyMode();
  const filterSheetRef = useRef<AppBottomSheetRef>(null);
  const moveSheetRef = useRef<AppBottomSheetRef>(null);
  const boardRef = useRef<FlatList<KanbanColumn>>(null);
  const deleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<LeadStatusCode>>(new Set());
  const [draftFilter, setDraftFilter] = useState<Set<LeadStatusCode>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('board');
  const [manager, setManager] = useState<string>('all');
  const [moveTarget, setMoveTarget] = useState<Lead | null>(null);
  const [activeCol, setActiveCol] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setLeads(await fetchLeads());
    } catch {
      showToast('Не удалось загрузить лиды', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topManagers = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach((l) => (l.assignedToList || []).forEach((m) => counts.set(m, (counts.get(m) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  }, [leads]);

  const visible = useMemo(
    () => (manager === 'all' ? leads : leads.filter((l) => (l.assignedToList || []).includes(manager))),
    [leads, manager],
  );

  const openLeads = useMemo(() => visible.filter((l) => l.status !== 'won' && l.status !== 'lost'), [visible]);
  const openSum = useMemo(() => openLeads.reduce((a, l) => a + toDisplay(l.amount, l.currency), 0), [openLeads, toDisplay]);

  const filtered = useMemo(() => {
    let res = visible;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (l) => (l.name || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q) || (l.phone || '').includes(q),
      );
    }
    if (statusFilter.size > 0) res = res.filter((l) => statusFilter.has(l.status));
    return res;
  }, [visible, search, statusFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach((l) => (m[l.status] = (m[l.status] || 0) + 1));
    return m;
  }, [leads]);

  const columns = useMemo(
    () => STATUS_ORDER.map((status) => ({ status, items: visible.filter((l) => l.status === status) })),
    [visible],
  );

  const lostLeads = useMemo(() => visible.filter((l) => l.status === 'lost'), [visible]);
  const lostSum = useMemo(() => lostLeads.reduce((a, l) => a + toDisplay(l.amount, l.currency), 0), [lostLeads, toDisplay]);
  const lostByManager = useMemo(() => {
    const counts2 = new Map<string, number>();
    lostLeads.forEach((l) => (l.assignedToList || ['Без ответственного']).forEach((m) => counts2.set(m, (counts2.get(m) || 0) + 1)));
    return Array.from(counts2.entries()).sort((a, b) => b[1] - a[1]);
  }, [lostLeads]);

  const openFilterSheet = () => {
    setDraftFilter(new Set(statusFilter));
    filterSheetRef.current?.snapToIndex(0);
  };
  const applyFilter = () => {
    setStatusFilter(new Set(draftFilter));
    filterSheetRef.current?.close();
  };
  const toggleDraftStatus = (s: LeadStatusCode) => {
    setDraftFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLongPress = (id: string) => {
    if (selectedIds.size === 0) setSelectedIds(new Set([id]));
  };

  const handlePress = (id: string) => {
    if (selectedIds.size > 0) toggleSelect(id);
    else navigation.navigate('LeadDetail', { id });
  };

  const softDelete = useCallback((id: string) => {
    const removed = leads.find((l) => l.id === id);
    if (!removed) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const timer = setTimeout(() => {
      deleteLead(id).catch(() => {
        setLeads((prev) => [removed, ...prev]);
        showToast('Не удалось удалить лид', { variant: 'error' });
      });
      delete deleteTimers.current[id];
    }, 3200);
    deleteTimers.current[id] = timer;
    showToast('Лид удалён', {
      actionLabel: 'Отменить',
      onAction: () => {
        clearTimeout(deleteTimers.current[id]);
        delete deleteTimers.current[id];
        setLeads((prev) => [removed, ...prev]);
      },
    });
  }, [leads]);

  const softDeleteMany = useCallback((ids: string[]) => {
    ids.forEach((id) => softDelete(id));
  }, [softDelete]);

  const takeInProgress = useCallback(async (id: string) => {
    try {
      const updated = await updateLead({ id, status: 'in_progress' });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      showToast('Лид взят в работу', { variant: 'success' });
    } catch {
      showToast('Не удалось обновить лид', { variant: 'error' });
    }
  }, []);

  const openMoveSheet = useCallback((lead: Lead) => {
    setMoveTarget(lead);
    moveSheetRef.current?.snapToIndex(0);
  }, []);

  const moveTo = useCallback(async (status: LeadStatusCode) => {
    const lead = moveTarget;
    if (!lead || lead.status === status) {
      moveSheetRef.current?.close();
      return;
    }
    moveSheetRef.current?.close();
    try {
      const updated = await updateLead({ id: lead.id, status });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      showToast(`Перемещён в «${STATUS_LABEL[status]}»`, { variant: 'success' });
    } catch {
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  }, [moveTarget]);

  const renderListRow = (item: Lead) => {
    const name = item.name || 'Без имени';
    const isSelected = selectedIds.has(item.id);
    const inSelectionMode = selectedIds.size > 0;

    const row = (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.line3 }]}
        onPress={() => handlePress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        {inSelectionMode ? (
          <View
            style={[
              styles.checkbox,
              { borderColor: isSelected ? colors.ink : colors.line2, backgroundColor: isSelected ? colors.ink : 'transparent' },
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={13} color={colors.onInk} />}
          </View>
        ) : (
          <AvatarInitials name={name} size={36} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <Pill label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
            <Text style={[styles.meta, { color: colors.textTertiary, fontFamily: fonts.mono }]} numberOfLines={1}>
              {item.channel || '—'} · {relTime(item.createdAt)}
            </Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(item.amount, item.currency, { short: true })}</Text>
      </TouchableOpacity>
    );

    if (inSelectionMode) return row;

    return (
      <SwipeableRow
        leftAction={{ icon: 'person-add-outline', label: 'В работу', color: colors.info, onPress: () => takeInProgress(item.id) }}
        rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => softDelete(item.id) }}
      >
        {row}
      </SwipeableRow>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Лиды</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{openLeads.length} открытых · {fmt(openSum, undefined, { short: true })}</Text>
          </View>
          <CurrencyChip />
          <ToolbarButton icon="options-outline" badge={statusFilter.size || undefined} active={statusFilter.size > 0} onPress={openFilterSheet} />
          <ToolbarButton icon="add" active onPress={() => navigation.navigate('LeadCreate')} />
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <Segmented
            options={[{ key: 'board', label: 'Канбан' }, { key: 'list', label: 'Список' }, { key: 'lost', label: 'Утраченные' }]}
            activeKey={mode}
            onChange={(k) => setMode(k as Mode)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity style={[styles.chip, { backgroundColor: manager === 'all' ? colors.ink : colors.surfaceVariant }]} onPress={() => setManager('all')}>
            <Text style={[styles.chipTxt, { color: manager === 'all' ? colors.onInk : colors.text }]}>Все менеджеры</Text>
            <Text style={[styles.chipCount, { color: manager === 'all' ? colors.onInk : colors.textTertiary }]}>{leads.length}</Text>
          </TouchableOpacity>
          {topManagers.map((name) => (
            <TouchableOpacity key={name} style={[styles.chip, { backgroundColor: manager === name ? colors.ink : colors.surfaceVariant }]} onPress={() => setManager(name)}>
              <Text style={[styles.chipTxt, { color: manager === name ? colors.onInk : colors.text }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.chipCount, { color: manager === name ? colors.onInk : colors.textTertiary }]}>{leads.filter((l) => (l.assignedToList || []).includes(name)).length}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {mode === 'list' && (
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder="Имя, телефон, email…"
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <SkeletonList count={7} />
      ) : mode === 'board' ? (
        <>
          <FlatList
            ref={boardRef}
            data={columns}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.status}
            onMomentumScrollEnd={(e) => setActiveCol(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            renderItem={({ item: col }) => {
              const sum = col.items.reduce((a, l) => a + toDisplay(l.amount, l.currency), 0);
              return (
                <View style={{ width: SCREEN_WIDTH }}>
                  <View style={styles.colHeader}>
                    <Pill label={STATUS_LABEL[col.status]} tone={STATUS_TONE[col.status]} />
                    <Text style={[styles.colCount, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{col.items.length}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.colSum, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(sum, undefined, { short: true })}</Text>
                  </View>
                  {col.items.length === 0 ? (
                    <EmptyState icon="flash-outline" title="Пусто" />
                  ) : (
                    <FlatList
                      data={col.items}
                      keyExtractor={(l) => l.id}
                      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 24, gap: spacing.sm }}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardInner}>
                          <TouchableOpacity
                            style={styles.cardTouchable}
                            onPress={() => navigation.navigate('LeadDetail', { id: item.id })}
                            onLongPress={() => openMoveSheet(item)}
                            delayLongPress={280}
                            activeOpacity={0.8}
                          >
                            <AvatarInitials name={item.name || 'Без имени'} size={32} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name || 'Без имени'}</Text>
                              <Text style={[styles.cardMeta, { color: colors.textTertiary }]} numberOfLines={1}>{item.channel || '—'} · {fmt(item.amount, item.currency, { short: true })}</Text>
                            </View>
                            <TouchableOpacity style={[styles.advanceBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => openMoveSheet(item)} hitSlop={8}>
                              <Ionicons name="swap-horizontal" size={14} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        </GlassCard>
                      )}
                    />
                  )}
                </View>
              );
            }}
          />
          <View style={styles.dots}>
            {columns.map((c, i) => (
              <View key={c.status} style={[styles.dot, { backgroundColor: i === activeCol ? colors.ink : colors.line2 }]} />
            ))}
          </View>
        </>
      ) : mode === 'list' ? (
        filtered.length === 0 ? (
          <EmptyState
            icon="flash-outline"
            lottieSource={require('../../../assets/lottie/empty-pulse.json')}
            title="Нет лидов"
            subtitle={search || statusFilter.size > 0 ? 'Попробуйте изменить фильтры или запрос' : 'Здесь появятся новые лиды'}
          />
        ) : (
          <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
            <Animated.FlatList
              data={filtered}
              keyExtractor={(item: Lead) => item.id}
              renderItem={({ item }: { item: Lead }) => renderListRow(item)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
              contentContainerStyle={{ paddingBottom: selectedIds.size > 0 ? 100 : 8 }}
              showsVerticalScrollIndicator={false}
            />
          </GlassCard>
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <GlassCard variant="g" style={styles.lostCard} contentStyle={styles.lostCardContent}>
            <View style={styles.rowHead}>
              <Text style={[styles.kicker, { color: colors.textTertiary }]}>УТРАЧЕНО</Text>
              <View style={{ flex: 1 }} />
              <View style={[styles.pill, { backgroundColor: colors.errorBg }]}><Text style={{ color: colors.error, fontSize: 11, fontFamily: fonts.medium }}>{lostLeads.length}</Text></View>
            </View>
            <Text style={[styles.money, { color: colors.text, fontSize: 30 }]}>{fmt(lostSum, undefined, { short: true })}</Text>
            {lostByManager.length > 0 && (
              <View style={{ marginTop: spacing.md }}>
                <FunnelBars rows={lostByManager.map(([m, c]) => ({ label: m.split(' ')[0], value: c, displayValue: String(c) }))} />
              </View>
            )}
          </GlassCard>
          {lostLeads.length === 0 ? (
            <EmptyState icon="flag-outline" title="Нет утраченных лидов" />
          ) : (
            <GlassCard variant="g2" style={styles.listCard}>
              {lostLeads.map((l, i) => (
                <TouchableOpacity key={l.id} style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < lostLeads.length - 1 ? 1 : 0 }]} onPress={() => navigation.navigate('LeadDetail', { id: l.id })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{l.name || 'Без имени'}</Text>
                    <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>{(l.meta?.lostReason as string) || 'причина не указана'}</Text>
                  </View>
                  <Text style={[styles.amount, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(l.amount, l.currency, { short: true })}</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          )}
        </ScrollView>
      )}

      {mode === 'list' && (
        <BulkActionBar
          count={selectedIds.size}
          bottomOffset={insets.bottom + 16}
          onClose={() => setSelectedIds(new Set())}
          actions={[
            { icon: 'trash-outline', label: 'Удалить', danger: true, onPress: () => softDeleteMany(Array.from(selectedIds)) },
          ]}
        />
      )}

      <AppBottomSheet ref={filterSheetRef}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Статус лида</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {STATUS_ORDER.map((s) => {
            const checked = draftFilter.has(s);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.filterRow, { borderColor: colors.line2 }]}
                onPress={() => toggleDraftStatus(s)}
                activeOpacity={0.7}
              >
                <Pill label={STATUS_LABEL[s]} tone={STATUS_TONE[s]} />
                <Text style={[styles.filterCount, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{counts[s] || 0}</Text>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: checked ? colors.ink : colors.line2, backgroundColor: checked ? colors.ink : 'transparent', marginLeft: 'auto' },
                  ]}
                >
                  {checked && <Ionicons name="checkmark" size={13} color={colors.onInk} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Button label={`Показать ${leads.filter((l) => draftFilter.size === 0 || draftFilter.has(l.status)).length} результатов`} variant="primary" fullWidth onPress={applyFilter} style={{ marginTop: spacing.xl }} />
      </AppBottomSheet>

      <AppBottomSheet ref={moveSheetRef} snapPoints={['42%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Переместить лид</Text>
        {moveTarget && (
          <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{moveTarget.name || 'Без имени'}</Text>
        )}
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {STATUS_ORDER.map((s) => {
            const isCurrent = moveTarget?.status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.moveRow, { borderColor: colors.line2, opacity: isCurrent ? 0.5 : 1 }]}
                onPress={() => moveTo(s)}
                disabled={isCurrent}
                activeOpacity={0.7}
              >
                <Pill label={STATUS_LABEL[s]} tone={STATUS_TONE[s]} />
                {isCurrent && <Text style={[styles.sheetCurrentLabel, { color: colors.textTertiary }]}>текущий</Text>}
                {!isCurrent && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, maxWidth: 180 },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.medium, flexShrink: 1 },
  chipCount: { fontSize: 10.5, fontFamily: fonts.mono },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  name: { fontSize: 14.5, fontFamily: fonts.semibold, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 11, flexShrink: 1 },
  amount: { fontSize: 13 },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  colHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  colCount: { fontSize: 12 },
  colSum: { fontSize: 12.5 },
  card: { borderRadius: radius.xl },
  cardInner: { flex: 1 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2 },
  cardName: { fontSize: 13.5, fontFamily: fonts.semibold },
  cardMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 1 },
  advanceBtn: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },

  lostCard: { marginBottom: spacing.md },
  lostCardContent: { padding: spacing.lg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  money: { fontFamily: fonts.semibold, letterSpacing: -0.4 },

  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  filterCount: { fontSize: 11 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  sheetCurrentLabel: { fontSize: 11, fontFamily: fonts.regular, marginLeft: 'auto' },
});
