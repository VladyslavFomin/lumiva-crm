import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchProjects, unarchiveProject, moveProjectToTrash, restoreProject, permanentlyDeleteProject, emptyProjectsTrash,
  Project,
} from '../../api/projects';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Tab = 'archive' | 'trash';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export const ProjectsArchiveScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();

  const [tab, setTab] = useState<Tab>('archive');
  const [archived, setArchived] = useState<Project[]>([]);
  const [trashed, setTrashed] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        fetchProjects({ archived: true }),
        fetchProjects({ deleted: true }),
      ]);
      setArchived(a.items);
      setTrashed(t.items);
    } catch {
      showToast('Не удалось загрузить архив', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (id: string, action: () => Promise<void>, successMsg: string, remove: (list: Project[]) => Project[]) => {
    setBusyId(id);
    try {
      await action();
      setArchived(remove);
      setTrashed(remove);
      showToast(successMsg, { variant: 'success' });
    } catch {
      showToast('Не удалось выполнить действие', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmPermanentDelete = (p: Project) => {
    Alert.alert('Удалить навсегда?', `«${p.name}» будет удалена без возможности восстановления.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: () =>
          runAction(p.id, () => permanentlyDeleteProject(p.id), 'Проект удалён навсегда', (list) => list.filter((x) => x.id !== p.id)),
      },
    ]);
  };

  const confirmEmptyTrash = () => {
    if (trashed.length === 0) return;
    Alert.alert('Очистить корзину?', `Все ${trashed.length} проекта(ов) в корзине будут удалены без возможности восстановления.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Очистить', style: 'destructive', onPress: async () => {
          try {
            await emptyProjectsTrash();
            setTrashed([]);
            showToast('Корзина очищена', { variant: 'success' });
          } catch {
            showToast('Не удалось очистить корзину', { variant: 'error' });
          }
        },
      },
    ]);
  };

  const list = tab === 'archive' ? archived : trashed;

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Проекты</Text>
        </TouchableOpacity>
        {tab === 'trash' && trashed.length > 0 && (
          <TouchableOpacity onPress={confirmEmptyTrash}>
            <Text style={[styles.emptyTrashTxt, { color: colors.error }]}>Очистить</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{tab === 'archive' ? 'Архив' : 'Корзина'}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {tab === 'archive' ? 'Архив не участвует в аналитике и воронке' : 'Удалённые записи хранятся до ручного удаления навсегда'}
      </Text>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <Segmented
          options={[{ key: 'archive', label: `Архив ${archived.length}` }, { key: 'trash', label: `Корзина ${trashed.length}` }]}
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </View>

      {list.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title={tab === 'archive' ? 'В архиве ничего нет' : 'Корзина пуста'}
          subtitle={tab === 'archive' ? 'Архивируйте закрытые проекты, чтобы списки оставались рабочими' : 'Удалённые проекты появятся здесь'}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
          {list.map((p) => (
            <GlassCard key={p.id} variant="g" style={styles.card} contentStyle={styles.cardInner}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {tab === 'archive' ? `в архиве с ${p.archivedAt ? fmtDate(p.archivedAt) : '—'}` : `в корзине с ${p.deletedAt ? fmtDate(p.deletedAt) : '—'}`}
                  </Text>
                </View>
                {p.amount > 0 && <Text style={[styles.cardMoney, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(toDisplay(p.amount, p.currency), undefined, { short: true })}</Text>}
              </View>
              <View style={styles.actionsRow}>
                {tab === 'archive' ? (
                  <>
                    <Button label="Восстановить" variant="accent" size="sm" style={{ flex: 1 }} loading={busyId === p.id}
                      onPress={() => runAction(p.id, () => unarchiveProject(p.id), 'Проект восстановлен из архива', (list) => list.filter((x) => x.id !== p.id))} />
                    <Button label="В корзину" variant="secondary" size="sm" style={{ flex: 1 }} loading={busyId === p.id}
                      onPress={() => runAction(p.id, () => moveProjectToTrash(p.id), 'Проект перемещён в корзину', (list) => list.filter((x) => x.id !== p.id))} />
                  </>
                ) : (
                  <>
                    <Button label="Восстановить" variant="accent" size="sm" style={{ flex: 1 }} loading={busyId === p.id}
                      onPress={() => runAction(p.id, () => restoreProject(p.id), 'Проект восстановлен', (list) => list.filter((x) => x.id !== p.id))} />
                    <Button label="Удалить навсегда" variant="secondary" size="sm" style={{ flex: 1 }} loading={busyId === p.id}
                      onPress={() => confirmPermanentDelete(p)} />
                  </>
                )}
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  emptyTrashTxt: { fontSize: 13, fontFamily: fonts.medium },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: { borderRadius: 22 },
  cardInner: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontFamily: fonts.semibold },
  cardMeta: { fontSize: 11.5, marginTop: 3 },
  cardMoney: { fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
