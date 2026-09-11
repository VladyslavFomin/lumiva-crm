import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchProductCategoriesWithCounts, createProductCategory, deleteProductCategory, ProductCategoryWithCount,
  fetchProductLocations, createProductLocation, deleteProductLocation, ProductLocation,
} from '../../api/products';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SwipeableRow, SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Tab = 'categories' | 'locations';

export const ProductCategoriesScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<ProductCategoryWithCount[]>([]);
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [cats, locs] = await Promise.all([fetchProductCategoriesWithCounts(), fetchProductLocations()]);
      setCategories(cats.categories);
      setLocations(locs);
    } catch {
      showToast('Не удалось загрузить', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      if (tab === 'categories') {
        const created = await createProductCategory(name);
        setCategories((prev) => [...prev, created]);
      } else {
        const created = await createProductLocation(name);
        setLocations((prev) => [...prev, created]);
      }
      setNewName('');
    } catch {
      showToast('Не удалось создать', { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const removeCategory = async (c: ProductCategoryWithCount) => {
    setCategories((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await deleteProductCategory(c.id);
    } catch {
      setCategories((prev) => [...prev, c]);
      showToast('Не удалось удалить категорию', { variant: 'error' });
    }
  };
  const removeLocation = async (l: ProductLocation) => {
    setLocations((prev) => prev.filter((x) => x.id !== l.id));
    try {
      await deleteProductLocation(l.id);
    } catch {
      setLocations((prev) => [...prev, l]);
      showToast('Не удалось удалить локацию', { variant: 'error' });
    }
  };

  const items = tab === 'categories' ? categories : locations;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Категории и склады</Text>
        </View>
      </View>

      <Segmented
        options={[
          { key: 'categories', label: 'Категории' },
          { key: 'locations', label: 'Локации' },
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      <View style={styles.addRow}>
        <View style={[styles.addInput, { backgroundColor: colors.surfaceVariant }]}>
          <TextInput
            style={[styles.addInputText, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={tab === 'categories' ? 'Новая категория' : 'Новая локация'}
            placeholderTextColor={colors.textTertiary}
            value={newName}
            onChangeText={setNewName}
          />
        </View>
        <Button label="Добавить" variant="primary" size="sm" loading={adding} disabled={!newName.trim()} onPress={handleAdd} />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="pricetags-outline" title={tab === 'categories' ? 'Нет категорий' : 'Нет локаций'} />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={items as any[]}
            keyExtractor={(item: any) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: any }) => (
              <SwipeableRow rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => (tab === 'categories' ? removeCategory(item) : removeLocation(item)) }}>
                <View style={[styles.row, { borderBottomColor: colors.line3 }]}>
                  {tab === 'categories' ? (
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                  ) : (
                    <View style={[styles.ico, { backgroundColor: colors.surfaceVariant }]}>
                      <Ionicons name="cube-outline" size={15} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {tab === 'categories'
                      ? <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>{item.productCount} товаров</Text>
                      : item.isDefault && <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>По умолчанию</Text>}
                  </View>
                </View>
              </SwipeableRow>
            )}
          />
        </GlassCard>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  ico: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
