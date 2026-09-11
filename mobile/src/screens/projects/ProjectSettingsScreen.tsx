import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchProjectStatusDefs, createProjectStatusDef, deleteProjectStatusDef, reorderProjectStatusDefs, ProjectStatusDef,
  fetchProjectCurrencyDefs, createProjectCurrencyDef, updateProjectCurrencyDef, deleteProjectCurrencyDef, reorderProjectCurrencyDefs, ProjectCurrencyDef,
} from '../../api/projectSettings';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SwipeableRow, SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Tab = 'statuses' | 'currencies';
const PALETTE = ['#1769d1', '#1f8a5e', '#c08319', '#cc2f47', '#5a45a8', '#0e7490', '#777777'];

export const ProjectSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('statuses');
  const [statuses, setStatuses] = useState<ProjectStatusDef[]>([]);
  const [currencies, setCurrencies] = useState<ProjectCurrencyDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, cur] = await Promise.all([fetchProjectStatusDefs(), fetchProjectCurrencyDefs()]);
      setStatuses(st.sort((a, b) => a.order - b.order));
      setCurrencies(cur.sort((a, b) => a.order - b.order));
    } catch {
      showToast('Не удалось загрузить настройки', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const value = newValue.trim();
    if (!value) return;
    setAdding(true);
    try {
      if (tab === 'statuses') {
        const color = PALETTE[statuses.length % PALETTE.length];
        const created = await createProjectStatusDef(value, color);
        setStatuses((prev) => [...prev, created]);
      } else {
        const created = await createProjectCurrencyDef(value);
        setCurrencies((prev) => [...prev, created]);
      }
      setNewValue('');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось создать', { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const removeStatus = async (s: ProjectStatusDef) => {
    if (s.isBuiltIn) { showToast('Встроенный статус нельзя удалить', { variant: 'error' }); return; }
    setStatuses((prev) => prev.filter((x) => x.id !== s.id));
    try { await deleteProjectStatusDef(s.id); } catch { setStatuses((prev) => [...prev, s]); showToast('Не удалось удалить', { variant: 'error' }); }
  };
  const removeCurrency = async (c: ProjectCurrencyDef) => {
    setCurrencies((prev) => prev.filter((x) => x.id !== c.id));
    try { await deleteProjectCurrencyDef(c.id); } catch { setCurrencies((prev) => [...prev, c]); showToast('Не удалось удалить', { variant: 'error' }); }
  };

  const moveStatus = async (index: number, dir: -1 | 1) => {
    const arr = [...statuses];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setStatuses(arr);
    try { await reorderProjectStatusDefs(arr.map((s) => s.id)); } catch { showToast('Не удалось изменить порядок', { variant: 'error' }); load(); }
  };
  const moveCurrency = async (index: number, dir: -1 | 1) => {
    const arr = [...currencies];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setCurrencies(arr);
    try { await reorderProjectCurrencyDefs(arr.map((c) => c.id)); } catch { showToast('Не удалось изменить порядок', { variant: 'error' }); load(); }
  };

  const setDefaultCurrency = async (c: ProjectCurrencyDef) => {
    setCurrencies((prev) => prev.map((x) => ({ ...x, isDefault: x.id === c.id })));
    try { await updateProjectCurrencyDef(c.id, { isDefault: true }); } catch { showToast('Не удалось изменить', { variant: 'error' }); load(); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Настройка проектов</Text>
        </View>
      </View>

      <Segmented
        options={[{ key: 'statuses', label: 'Статусы' }, { key: 'currencies', label: 'Валюты' }]}
        activeKey={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      <View style={styles.addRow}>
        <View style={[styles.addInput, { backgroundColor: colors.surfaceVariant }]}>
          <TextInput
            style={[styles.addInputText, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={tab === 'statuses' ? 'Новый статус' : 'Код валюты (EUR, TRY…)'}
            placeholderTextColor={colors.textTertiary}
            value={newValue}
            onChangeText={setNewValue}
            autoCapitalize={tab === 'currencies' ? 'characters' : 'sentences'}
            maxLength={tab === 'currencies' ? 3 : 64}
          />
        </View>
        <Button label="Добавить" variant="primary" size="sm" loading={adding} disabled={!newValue.trim()} onPress={handleAdd} />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : tab === 'statuses' ? (
        statuses.length === 0 ? <EmptyState icon="flag-outline" title="Нет статусов" /> : (
          <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
            {statuses.map((s, i) => (
              <SwipeableRow key={s.id} rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeStatus(s) }}>
                <View style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < statuses.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.rowName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.value}</Text>
                  {s.isBuiltIn && <Text style={[styles.builtIn, { color: colors.textTertiary }]}>встроенный</Text>}
                  <View style={styles.reorderBtns}>
                    <TouchableOpacity onPress={() => moveStatus(i, -1)} disabled={i === 0} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.textTertiary : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveStatus(i, 1)} disabled={i === statuses.length - 1} hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={i === statuses.length - 1 ? colors.textTertiary : colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </SwipeableRow>
            ))}
          </GlassCard>
        )
      ) : (
        currencies.length === 0 ? <EmptyState icon="cash-outline" title="Нет валют" /> : (
          <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
            {currencies.map((c, i) => (
              <SwipeableRow key={c.id} rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeCurrency(c) }}>
                <View style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < currencies.length - 1 ? 1 : 0 }]}>
                  <TouchableOpacity onPress={() => setDefaultCurrency(c)} hitSlop={6}>
                    <Ionicons name={c.isDefault ? 'star' : 'star-outline'} size={18} color={c.isDefault ? colors.warning : colors.textTertiary} />
                  </TouchableOpacity>
                  <Text style={[styles.rowName, { color: colors.text, marginLeft: spacing.sm }]} numberOfLines={1}>{c.code}{c.label ? ` · ${c.label}` : ''}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.reorderBtns}>
                    <TouchableOpacity onPress={() => moveCurrency(i, -1)} disabled={i === 0} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.textTertiary : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveCurrency(i, 1)} disabled={i === currencies.length - 1} hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={i === currencies.length - 1 ? colors.textTertiary : colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </SwipeableRow>
            ))}
          </GlassCard>
        )
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
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, paddingBottom: spacing.sm },
  addInput: { flex: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 9 },
  addInputText: { fontSize: 14, padding: 0 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  builtIn: { fontSize: 10, fontFamily: fonts.regular },
  reorderBtns: { flexDirection: 'row', gap: 10, marginLeft: spacing.sm },
});
