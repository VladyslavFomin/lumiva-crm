import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchProfile, UserProfile } from './../api/profile';
import { fetchTenantSettings, TenantSettings, tenantInitials } from '../api/tenant';
import { useTheme, fonts, spacing, radius } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES } from '../i18n/translations';
import { AuraBackground, GlassCard } from '../components/glass';
import { AvatarInitials, showToast } from '../components/ui';
import { Segmented, CurrencyChip, ThemeChip } from '../components/mg';
import { useAccess, AccessRule } from '../context/AccessContext';

interface NavItem extends AccessRule {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  badge?: string;
  route?: string;
  params?: Record<string, unknown>;
  desktopOnly?: boolean;
  soon?: boolean;
}
interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

export const MoreScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [q, setQ] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<TenantSettings | null>(null);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => {});
    fetchTenantSettings().then(setTenant).catch(() => {});
  }, []);

  const NAV = useMemo<NavGroup[]>(() => [
    { groupKey: 'overview', items: [
      { icon: 'analytics-outline', labelKey: 'biDashboard', perm: 'analytics', route: 'BiDashboard' },
      { icon: 'calendar-number-outline', labelKey: 'teamCalendar', route: 'TeamCalendar' },
    ] },
    { groupKey: 'clients', items: [
      { icon: 'flash-outline', labelKey: 'leads', component: 'leads', perm: 'leads', route: 'Leads' },
      { icon: 'calendar-outline', labelKey: 'leadsCalendar', component: 'leads', perm: 'leads', route: 'App:Leads:LeadsCalendar' },
      { icon: 'bar-chart-outline', labelKey: 'leadsAnalytics', perm: 'analytics', route: 'App:AnalyticsTab' },
      { icon: 'people-outline', labelKey: 'companies', component: 'companies', perm: 'companies', route: 'Clients:ClientsMain', params: { initialTab: 'companies' } },
      { icon: 'person-outline', labelKey: 'contacts', component: 'contacts', perm: 'contacts', route: 'Clients:ClientsMain', params: { initialTab: 'contacts' } },
      { icon: 'checkbox-outline', labelKey: 'companyTasks', component: 'companies', perm: 'companies', route: 'Clients:CoTasks' },
      { icon: 'copy-outline', labelKey: 'duplicates', component: 'deduplication', perm: 'settings', route: 'Duplicates' },
    ] },
    { groupKey: 'projects', items: [
      { icon: 'layers-outline', labelKey: 'projects', component: 'projects', perm: 'projects', route: 'Projects' },
      { icon: 'calendar-outline', labelKey: 'projectsCalendar', component: 'projects', perm: 'projects', route: 'Projects:ProjectsCalendar' },
      { icon: 'grid-outline', labelKey: 'projectsBoard', component: 'projects', perm: 'projects', route: 'Projects:ProjectsBoard' },
      { icon: 'checkbox-outline', labelKey: 'tasks', component: 'projects', perm: 'projects', route: 'Projects:AllTasks' },
      { icon: 'alert-circle-outline', labelKey: 'overdueTasks', component: 'projects', perm: 'projects', route: 'Projects:Overdue' },
      { icon: 'archive-outline', labelKey: 'projectsArchive', component: 'projects', perm: 'projects', route: 'Projects:ProjectsArchive' },
    ] },
    { groupKey: 'sales', items: [
      { icon: 'cash-outline', labelKey: 'sales', component: 'sales', perm: 'sales', route: 'Sales' },
      { icon: 'link-outline', labelKey: 'salesChannels', component: 'sales', perm: 'sales', route: 'Sales:SalesChannels' },
      { icon: 'wallet-outline', labelKey: 'payments', component: 'sales', perm: 'sales', route: 'Sales:Payments' },
      { icon: 'link-outline', labelKey: 'salesIntegrations', desktopOnly: true },
    ] },
    { groupKey: 'products', items: [
      { icon: 'cube-outline', labelKey: 'productsList', component: 'products', perm: 'products', route: 'Products' },
      { icon: 'cube-outline', labelKey: 'stock', component: 'products', perm: 'products', route: 'Products:Stock' },
      { icon: 'pricetag-outline', labelKey: 'productCategories', component: 'products', perm: 'products', route: 'Products:ProductCategories' },
      { icon: 'business-outline', labelKey: 'productLocations', component: 'products', perm: 'products', route: 'Products:ProductLocations' },
    ] },
    { groupKey: 'bookings', items: [
      { icon: 'calendar-outline', labelKey: 'bookings', component: 'bookings', perm: 'bookings', route: 'Bookings' },
      { icon: 'stats-chart-outline', labelKey: 'bookOverview', component: 'bookings', perm: 'bookings', route: 'Bookings:BookOverview' },
      { icon: 'people-outline', labelKey: 'availability', component: 'bookings', perm: 'bookings', route: 'Bookings:Availability' },
      { icon: 'time-outline', labelKey: 'waitlist', component: 'bookings', perm: 'bookings', route: 'Bookings:Waitlist' },
      { icon: 'settings-outline', labelKey: 'bookingSettings', desktopOnly: true },
    ] },
    { groupKey: 'hotels', items: [
      { icon: 'bed-outline', labelKey: 'hotels', component: 'hotels', perm: 'hotels', route: 'Hotels' },
      { icon: 'log-in-outline', labelKey: 'frontDesk', component: 'hotels', perm: 'hotels', route: 'Hotels:FrontDesk' },
      { icon: 'calendar-outline', labelKey: 'hotelCalendar', component: 'hotels', perm: 'hotels', route: 'Hotels:HotelCalendar' },
      { icon: 'stats-chart-outline', labelKey: 'hotelsAnalytics', component: 'hotels', perm: 'hotels', route: 'Hotels:HotelsAnalytics' },
      { icon: 'settings-outline', labelKey: 'hotelSettings', desktopOnly: true },
    ] },
    { groupKey: 'comms', items: [
      { icon: 'mail-outline', labelKey: 'emailInbox', component: 'email', perm: 'email', route: 'EmailInbox' },
      { icon: 'chatbubbles-outline', labelKey: 'dialogs', route: 'Dialogs' },
      { icon: 'chatbox-ellipses-outline', labelKey: 'chat', component: 'chat', perm: 'chat', route: 'Chat' },
      { icon: 'help-buoy-outline', labelKey: 'helpdesk', perm: 'helpdesk', route: 'Helpdesk' },
      { icon: 'document-text-outline', labelKey: 'esign', perm: 'esign', route: 'Esign' },
      { icon: 'call-outline', labelKey: 'telephony', perm: 'telephony', route: 'Telephony' },
      { icon: 'settings-outline', labelKey: 'commsSettings', desktopOnly: true },
    ] },
    { groupKey: 'marketing', items: [
      { icon: 'trending-up-outline', labelKey: 'traffic', component: 'marketing', perm: 'marketing', route: 'Marketing' },
      { icon: 'people-outline', labelKey: 'audience', component: 'marketing', perm: 'marketing', route: 'Marketing:Marketing', params: { initialTab: 'audience' } },
      { icon: 'flash-outline', labelKey: 'automationsWebhooks', component: 'tools_automation', perm: 'tools_automation', route: 'Marketing:Automations' },
      { icon: 'link-outline', labelKey: 'marketingSettings', desktopOnly: true },
    ] },
    { groupKey: 'ai', items: [
      { icon: 'sparkles-outline', labelKey: 'aiChat', route: 'AiChat' },
      { icon: 'people-circle-outline', labelKey: 'aiAgents', route: 'AiChat:AiAgentsList' },
      { icon: 'checkmark-done-outline', labelKey: 'approvals', route: 'AiChat:Approvals' },
      { icon: 'flash-outline', labelKey: 'automations', component: 'tools_automation', perm: 'tools_automation', route: 'Automations' },
    ] },
    { groupKey: 'accounts', items: [
      { icon: 'wallet-outline', labelKey: 'ccp', component: 'client_accounts', perm: 'client_accounts', route: 'Ccp' },
    ] },
    { groupKey: 'admin', items: [
      { icon: 'people-circle-outline', labelKey: 'staff', perm: 'staff', route: 'Staff' },
      { icon: 'business-outline', labelKey: 'departments', perm: 'staff', route: 'Departments' },
      { icon: 'time-outline', labelKey: 'auditLog', component: 'tools_settings', perm: 'settings', route: 'AuditLog' },
      { icon: 'settings-outline', labelKey: 'companySettings', desktopOnly: true },
      { icon: 'wallet-outline', labelKey: 'billing', desktopOnly: true },
    ] },
    { groupKey: 'settings', items: [
      { icon: 'shield-outline', labelKey: 'permissions', desktopOnly: true },
      { icon: 'archive-outline', labelKey: 'exportBackup', desktopOnly: true },
    ] },
  ], []);

  // Same visibility rules as the website's sidebar: hide what the tenant's plan doesn't include and what this
  // staff member has no permission for (empty groups disappear too).
  const { allowed } = useAccess();
  const visibleNav = useMemo(
    () => NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i)) })).filter((g) => g.items.length),
    [NAV, allowed],
  );
  const filteredNav = q.trim()
    ? visibleNav.map((g) => ({ ...g, items: g.items.filter((i) => t(`more.item.${i.labelKey}`).toLowerCase().includes(q.trim().toLowerCase())) })).filter((g) => g.items.length)
    : visibleNav;

  const act = (item: NavItem) => {
    if (item.desktopOnly) {
      showToast(t('more.toast.desktopOnly'), { variant: 'default' });
      return;
    }
    if (item.soon || !item.route) {
      showToast(t('more.toast.soon'), { variant: 'default' });
      return;
    }
    if (item.route.startsWith('App:')) {
      const [, tab, screen] = item.route.split(':');
      navigation.navigate('App', screen ? { screen: tab, params: { screen } } : { screen: tab });
    } else if (item.route.includes(':')) {
      const [root, screen] = item.route.split(':');
      navigation.navigate(root, { screen, params: item.params });
    } else {
      navigation.navigate(item.route, item.params);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.titleRow, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('more.title')}</Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CurrencyChip />
          <ThemeChip />
        </View>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('more.subtitle')}</Text>

      <View style={styles.searchWrap}>
        <GlassCard variant="flat" style={styles.searchCard} contentStyle={styles.searchCardContent}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('more.search')}
            placeholderTextColor={colors.textTertiary}
            value={q}
            onChangeText={setQ}
          />
        </GlassCard>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={[styles.profileRow, { }]} onPress={() => navigation.navigate('Account')} activeOpacity={0.8}>
          <GlassCard variant="g" style={styles.profileCard} contentStyle={styles.profileCardContent}>
            <AvatarInitials name={profile?.name || tenantInitials(tenant?.name)} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{profile?.name || t('more.profileFallback')}</Text>
              <Text style={[styles.profileSub, { color: colors.textSecondary }]} numberOfLines={1}>{profile?.role || '—'} · {tenant?.name || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </GlassCard>
        </TouchableOpacity>

        {filteredNav.map((g) => (
          <View key={g.groupKey} style={{ marginBottom: 13 }}>
            <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>{t(`more.group.${g.groupKey}`).toUpperCase()}</Text>
            <GlassCard variant="g" style={styles.listCard}>
              {g.items.map((item, i) => (
                <TouchableOpacity
                  key={item.labelKey}
                  style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < g.items.length - 1 ? 1 : 0, opacity: item.desktopOnly ? 0.62 : 1 }]}
                  onPress={() => act(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
                    <Ionicons name={item.icon} size={15} color={colors.text} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{t(`more.item.${item.labelKey}`)}</Text>
                  {item.desktopOnly ? (
                    <View style={[styles.pill, { backgroundColor: colors.surfaceVariant }]}><Text style={[styles.pillTxt, { color: colors.textSecondary }]}>{t('more.desktopOnly')}</Text></View>
                  ) : (
                    <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </GlassCard>
          </View>
        ))}

        <GlassCard variant="g" style={styles.listCard}>
          <View style={styles.themeRow}>
            <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={15} color={colors.text} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('more.theme.title')}</Text>
            <Segmented
              compact
              options={[{ key: 'light', label: t('more.theme.light') }, { key: 'dark', label: t('more.theme.dark') }]}
              activeKey={isDark ? 'dark' : 'light'}
              onChange={toggleTheme}
            />
          </View>
          <View style={[styles.themeRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line3 }]}>
            <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="language-outline" size={15} color={colors.text} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('more.language.title')}</Text>
            <Segmented
              compact
              options={LANGUAGES.map((l) => ({ key: l.code, label: l.code.toUpperCase() }))}
              activeKey={lang}
              onChange={(k) => setLang(k as typeof lang)}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 12.5, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: 4 },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
  searchCard: { borderRadius: radius.xl },
  searchCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  profileRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  profileCard: {},
  profileCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  profileName: { fontSize: 16, fontFamily: fonts.semibold },
  profileSub: { fontSize: 12, marginTop: 2 },
  groupTitle: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, paddingHorizontal: spacing.lg + 4, paddingBottom: 6 },
  listCard: { borderRadius: 22, marginHorizontal: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  rowIco: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, flex: 1 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillTxt: { fontSize: 10.5, fontFamily: fonts.medium },
});
