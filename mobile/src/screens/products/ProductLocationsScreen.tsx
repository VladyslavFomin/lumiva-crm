import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProductLocations, createProductLocation, deleteProductLocation, ProductLocation } from '../../api/products';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SkeletonList, EmptyState, showToast, Button } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

/** RN port of `mglass-w3-ops.jsx`'s `ProdLocationsScreen`, scaled down to what's real: the
 * backend's `ProductLocation` is just `{name, code, isDefault}` — no per-location stock
 * allocation, fill %, value, or shelf breakdown like the design shows (that would need real
 * per-location inventory tracking, which doesn't exist here; showing it would be fabricated). A
 * plain named-locations list with create/delete is the honest version of this screen. */
export const ProductLocationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchProductLocations()
      .then(setLocations)
      .catch(() => showToast(t('productLocations.loadError'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createProductLocation(name.trim(), code.trim() || undefined);
      setName('');
      setCode('');
      load();
      showToast(t('productLocations.createdToast'), { variant: 'success' });
    } catch (e: any) {
      showToast(e?.response?.data?.message || t('productLocations.createError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc: ProductLocation) => {
    setLocations((prev) => prev.filter((l) => l.id !== loc.id));
    try {
      await deleteProductLocation(loc.id);
    } catch (e: any) {
      showToast(e?.response?.data?.message || t('productLocations.deleteError'), { variant: 'error' });
      load();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.nav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>{t('productLocations.backTitle')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('productLocations.title')}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{locations.length} {t('productLocations.subtitle')}</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <GlassCard variant="g" style={styles.formCard} contentStyle={{ padding: spacing.lg }}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('productLocations.fieldName')}</Text>
          <GlassCard variant="flat" style={styles.inputCard} contentStyle={{ paddingHorizontal: spacing.md }}>
            <TextInput value={name} onChangeText={setName} placeholder={t('productLocations.namePlaceholder')} placeholderTextColor={colors.textTertiary} style={{ color: colors.text, fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular }} />
          </GlassCard>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>{t('productLocations.fieldCode')}</Text>
          <GlassCard variant="flat" style={styles.inputCard} contentStyle={{ paddingHorizontal: spacing.md }}>
            <TextInput value={code} onChangeText={setCode} placeholder="IST-01" placeholderTextColor={colors.textTertiary} autoCapitalize="characters" style={{ color: colors.text, fontSize: 14, paddingVertical: 11, fontFamily: fonts.regular }} />
          </GlassCard>
          <Button label={t('productLocations.addButton')} variant="accent" fullWidth loading={saving} disabled={!name.trim()} onPress={handleCreate} style={{ marginTop: spacing.md }} />
        </GlassCard>

        {loading ? (
          <SkeletonList count={3} />
        ) : locations.length === 0 ? (
          <EmptyState icon="cube-outline" title={t('productLocations.empty.title')} subtitle={t('productLocations.empty.subtitle')} />
        ) : (
          <GlassCard variant="g" style={styles.listCard}>
            {locations.map((l, i) => (
              <View key={l.id} style={[styles.row, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={[styles.icoWrap, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name="cube-outline" size={15} color={colors.text} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{l.name}</Text>
                  {!!l.code && <Text style={[styles.rowCode, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{l.code}</Text>}
                </View>
                {l.isDefault && (
                  <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.pillTxt, { color: colors.accent }]}>{t('productLocations.default')}</Text>
                  </View>
                )}
                {!l.isDefault && (
                  <TouchableOpacity onPress={() => handleDelete(l)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginTop: 4 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg, marginTop: 2 },
  formCard: { borderRadius: radius.xxl },
  fieldLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, marginBottom: 6 },
  inputCard: { borderRadius: radius.lg },
  listCard: { borderRadius: radius.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  icoWrap: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.medium },
  rowCode: { fontSize: 11, marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  pillTxt: { fontSize: 10, fontFamily: fonts.semibold },
});
