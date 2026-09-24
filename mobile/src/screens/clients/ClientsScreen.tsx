import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchContacts, deleteContact, Contact } from '../../api/contacts';
import { fetchCompanies, deleteCompany, Company } from '../../api/companies';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ToolbarButton, SwipeableRow, AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

export const ClientsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const deleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [activeTab, setActiveTab] = useState<'contacts' | 'companies'>(route.params?.initialTab === 'companies' ? 'companies' : 'contacts');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.initialTab === 'companies' || route.params?.initialTab === 'contacts') {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const loadAll = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [c, co] = await Promise.all([fetchContacts(), fetchCompanies()]);
      setContacts(c);
      setCompanies(co);
    } catch {
      showToast(t('clients.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const q = search.toLowerCase().trim();

  const filteredContacts = useMemo(
    () => (q ? contacts.filter((c) => (c.fullName || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q)) : contacts),
    [contacts, q],
  );
  const filteredCompanies = useMemo(
    () => (q ? companies.filter((c) => c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q)) : companies),
    [companies, q],
  );

  const removeContact = useCallback((c: Contact) => {
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    const timer = setTimeout(() => {
      deleteContact(c.id).catch(() => {
        setContacts((prev) => [c, ...prev]);
        showToast(t('clients.contact.deleteError'), { variant: 'error' });
      });
      delete deleteTimers.current[c.id];
    }, 3200);
    deleteTimers.current[c.id] = timer;
    showToast(t('clients.contact.deletedToast'), { actionLabel: t('common.undo'), onAction: () => { clearTimeout(deleteTimers.current[c.id]); delete deleteTimers.current[c.id]; setContacts((prev) => [c, ...prev]); } });
  }, [t]);

  const removeCompany = useCallback((c: Company) => {
    setCompanies((prev) => prev.filter((x) => x.id !== c.id));
    const timer = setTimeout(() => {
      deleteCompany(c.id).catch(() => {
        setCompanies((prev) => [c, ...prev]);
        showToast(t('clients.company.deleteError'), { variant: 'error' });
      });
      delete deleteTimers.current[c.id];
    }, 3200);
    deleteTimers.current[c.id] = timer;
    showToast(t('clients.company.deletedToast'), { actionLabel: t('common.undo'), onAction: () => { clearTimeout(deleteTimers.current[c.id]); delete deleteTimers.current[c.id]; setCompanies((prev) => [c, ...prev]); } });
  }, [t]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('clients.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{contacts.length}</Text> {t('clients.contacts')} ·{' '}
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{companies.length}</Text> {t('clients.companies')}
        </Text>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('clients.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.toolbar}>
          <ToolbarButton
            icon="add"
            label={activeTab === 'contacts' ? t('clients.addContact') : t('clients.addCompany')}
            active
            onPress={() => navigation.navigate(activeTab === 'contacts' ? 'ContactCreate' : 'CompanyCreate')}
          />
        </View>
      </View>

      <Segmented
        options={[
          { key: 'contacts', label: t('clients.tab.contacts') },
          { key: 'companies', label: t('clients.tab.companies') },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'contacts' | 'companies')}
      />

      {loading ? (
        <SkeletonList count={7} />
      ) : activeTab === 'contacts' ? (
        filteredContacts.length === 0 ? (
          <EmptyState icon="people-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title={t('clients.empty.noContacts')} subtitle={q ? t('clients.empty.tryQuery') : t('clients.empty.contactsHere')} />
        ) : (
          <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={filteredContacts}
            keyExtractor={(item: Contact) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.ink} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item: c }: { item: Contact }) => (
              <SwipeableRow rightAction={{ icon: 'trash-outline', label: t('common.delete'), color: colors.error, onPress: () => removeContact(c) }}>
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.line3 }]}
                  onPress={() => navigation.navigate('ContactDetail', { id: c.id })}
                  activeOpacity={0.7}
                >
                  <AvatarInitials name={c.fullName} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{c.fullName}</Text>
                    <View style={styles.rowMeta}>
                      {c.position && <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>{c.position}</Text>}
                      {c.phone && <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{c.phone}</Text>}
                    </View>
                  </View>
                  {c.tags?.length > 0 && (
                    <View style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                      <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{c.tags[0]}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </SwipeableRow>
            )}
          />
          </GlassCard>
        )
      ) : filteredCompanies.length === 0 ? (
        <EmptyState icon="business-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title={t('clients.empty.noCompanies')} subtitle={q ? t('clients.empty.tryQuery') : t('clients.empty.companiesHere')} />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
        <Animated.FlatList
          data={filteredCompanies}
          keyExtractor={(item: Company) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          renderItem={({ item: c }: { item: Company }) => (
            <SwipeableRow rightAction={{ icon: 'trash-outline', label: t('common.delete'), color: colors.error, onPress: () => removeCompany(c) }}>
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.line3 }]}
                onPress={() => navigation.navigate('CompanyDetail', { id: c.id })}
                activeOpacity={0.7}
              >
                <AvatarInitials name={c.name} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                  <View style={styles.rowMeta}>
                    {c.industry && <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{c.industry}</Text>}
                    {c.size && <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{c.size}</Text>}
                  </View>
                </View>
                {c.website && <Ionicons name="globe-outline" size={14} color={colors.textTertiary} style={{ marginRight: 4 }} />}
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
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
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  rowName: { fontSize: 14.5, fontFamily: fonts.semibold },
  rowMeta: { flexDirection: 'row', gap: 6, marginTop: 2 },
  rowSub: { fontSize: 12, fontFamily: fonts.regular },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  tagTxt: { fontSize: 11, fontFamily: fonts.medium },
});
