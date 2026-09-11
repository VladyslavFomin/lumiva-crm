import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchProfile, UserProfile } from './../api/profile';
import { fetchTenantSettings, TenantSettings, tenantInitials } from '../api/tenant';
import { useTheme, fonts, spacing, radius } from '../theme/ThemeContext';
import { AuraBackground, GlassCard } from '../components/glass';
import { AvatarInitials, showToast } from '../components/ui';
import { Segmented, CurrencyChip, ThemeChip } from '../components/mg';

interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  route?: string;
  params?: Record<string, unknown>;
  desktopOnly?: boolean;
  soon?: boolean;
}
interface NavGroup {
  group: string;
  items: NavItem[];
}

export const MoreScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
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
    { group: 'Обзор', items: [
      { icon: 'analytics-outline', label: 'BI-дашборд', route: 'BiDashboard' },
      { icon: 'calendar-number-outline', label: 'Календарь команды', route: 'TeamCalendar' },
    ] },
    { group: 'Клиенты', items: [
      { icon: 'flash-outline', label: 'Лиды', route: 'Leads' },
      { icon: 'calendar-outline', label: 'Календарь лидов', route: 'App:Leads:LeadsCalendar' },
      { icon: 'bar-chart-outline', label: 'Аналитика и ROI лидов', route: 'App:AnalyticsTab' },
      { icon: 'people-outline', label: 'Компании', route: 'Clients:ClientsMain', params: { initialTab: 'companies' } },
      { icon: 'person-outline', label: 'Контакты', route: 'Clients:ClientsMain', params: { initialTab: 'contacts' } },
      { icon: 'checkbox-outline', label: 'Задачи компаний', route: 'Clients:CoTasks' },
      { icon: 'copy-outline', label: 'Дубликаты', route: 'Duplicates' },
    ] },
    { group: 'Проекты', items: [
      { icon: 'layers-outline', label: 'Проекты', route: 'Projects' },
      { icon: 'calendar-outline', label: 'Календарь проектов', route: 'Projects:ProjectsCalendar' },
      { icon: 'grid-outline', label: 'Доска проектов', route: 'Projects:ProjectsBoard' },
      { icon: 'checkbox-outline', label: 'Задачи', route: 'Projects:AllTasks' },
      { icon: 'alert-circle-outline', label: 'Просроченные задачи', route: 'Projects:Overdue' },
      { icon: 'archive-outline', label: 'Архив и корзина проектов', route: 'Projects:ProjectsArchive' },
    ] },
    { group: 'Продажи', items: [
      { icon: 'cash-outline', label: 'Продажи', route: 'Sales' },
      { icon: 'link-outline', label: 'Каналы продаж', route: 'Sales:SalesChannels' },
      { icon: 'wallet-outline', label: 'Платежи', route: 'Sales:Payments' },
      { icon: 'link-outline', label: 'Интеграции и импорт', desktopOnly: true },
    ] },
    { group: 'Товары', items: [
      { icon: 'cube-outline', label: 'Список товаров', route: 'Products' },
      { icon: 'pricetag-outline', label: 'Категории и локации', desktopOnly: true },
    ] },
    { group: 'Бронирование', items: [
      { icon: 'calendar-outline', label: 'Брони', route: 'Bookings' },
      { icon: 'stats-chart-outline', label: 'Обзор бронирования', route: 'Bookings:BookOverview' },
      { icon: 'people-outline', label: 'Доступность ресурсов', route: 'Bookings:Availability' },
      { icon: 'time-outline', label: 'Лист ожидания', route: 'Bookings:Waitlist' },
      { icon: 'settings-outline', label: 'Локации, услуги, кабинеты', desktopOnly: true },
    ] },
    { group: 'Резервации отелей', items: [
      { icon: 'bed-outline', label: 'Отели: загрузка и цены', route: 'Hotels' },
      { icon: 'stats-chart-outline', label: 'Аналитика отелей', route: 'Hotels:HotelsAnalytics' },
      { icon: 'settings-outline', label: 'Номера, тарифы, информация', desktopOnly: true },
    ] },
    { group: 'Коммуникации', items: [
      { icon: 'mail-outline', label: 'Почта · входящие', route: 'EmailInbox' },
      { icon: 'chatbubbles-outline', label: 'Диалоги: чат, Telegram, WhatsApp', route: 'Dialogs' },
      { icon: 'chatbox-ellipses-outline', label: 'Чат сайта', route: 'Chat' },
      { icon: 'help-buoy-outline', label: 'Helpdesk', route: 'Helpdesk' },
      { icon: 'document-text-outline', label: 'Подписание документов', route: 'Esign' },
      { icon: 'call-outline', label: 'Звонки и SMS', route: 'Telephony' },
      { icon: 'settings-outline', label: 'Настройки телефонии и почты', desktopOnly: true },
    ] },
    { group: 'Маркетинг', items: [
      { icon: 'trending-up-outline', label: 'Трафик, кампании, UTM', route: 'Marketing' },
      { icon: 'people-outline', label: 'Сегменты аудитории', route: 'Marketing:Marketing', params: { initialTab: 'audience' } },
      { icon: 'flash-outline', label: 'Автоматизации (вебхуки)', route: 'Marketing:Automations' },
      { icon: 'link-outline', label: 'SEO, SMM, интеграции', desktopOnly: true },
    ] },
    { group: 'ИИ и инструменты', items: [
      { icon: 'sparkles-outline', label: 'Чат с ИИ', route: 'AiChat' },
      { icon: 'people-circle-outline', label: 'ИИ-сотрудники', route: 'AiChat:AiAgentsList' },
      { icon: 'checkmark-done-outline', label: 'Согласования', route: 'AiChat:Approvals' },
      { icon: 'flash-outline', label: 'Автоматизации', route: 'Automations' },
    ] },
    { group: 'Счета клиентов', items: [
      { icon: 'wallet-outline', label: 'Счета и операции', route: 'Ccp' },
    ] },
    { group: 'Администрирование', items: [
      { icon: 'people-circle-outline', label: 'Сотрудники', route: 'Staff' },
      { icon: 'business-outline', label: 'Отделы', route: 'Departments' },
      { icon: 'time-outline', label: 'Журнал аудита', route: 'AuditLog' },
      { icon: 'settings-outline', label: 'Настройки компании', desktopOnly: true },
      { icon: 'wallet-outline', label: 'Тариф и оплата', desktopOnly: true },
    ] },
    { group: 'Настройка', items: [
      { icon: 'shield-outline', label: 'Права по разделам', desktopOnly: true },
      { icon: 'archive-outline', label: 'Экспорт и бэкап', desktopOnly: true },
    ] },
  ], []);

  const filteredNav = q.trim()
    ? NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())) })).filter((g) => g.items.length)
    : NAV;

  const act = (item: NavItem) => {
    if (item.desktopOnly) {
      showToast('Настраивается на сайте', { variant: 'default' });
      return;
    }
    if (item.soon || !item.route) {
      showToast('Появится в одном из следующих обновлений', { variant: 'default' });
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
        <Text style={[styles.title, { color: colors.text }]}>Ещё</Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CurrencyChip />
          <ThemeChip />
        </View>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Все разделы CRM</Text>

      <View style={styles.searchWrap}>
        <GlassCard variant="flat" style={styles.searchCard} contentStyle={styles.searchCardContent}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Найти раздел"
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
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{profile?.name || 'Профиль'}</Text>
              <Text style={[styles.profileSub, { color: colors.textSecondary }]} numberOfLines={1}>{profile?.role || '—'} · {tenant?.name || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </GlassCard>
        </TouchableOpacity>

        {filteredNav.map((g) => (
          <View key={g.group} style={{ marginBottom: 13 }}>
            <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>{g.group.toUpperCase()}</Text>
            <GlassCard variant="g" style={styles.listCard}>
              {g.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < g.items.length - 1 ? 1 : 0, opacity: item.desktopOnly ? 0.62 : 1 }]}
                  onPress={() => act(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
                    <Ionicons name={item.icon} size={15} color={colors.text} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                  {item.desktopOnly ? (
                    <View style={[styles.pill, { backgroundColor: colors.surfaceVariant }]}><Text style={[styles.pillTxt, { color: colors.textSecondary }]}>на ПК</Text></View>
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
            <Text style={[styles.rowLabel, { color: colors.text }]}>Тема оформления</Text>
            <Segmented
              compact
              options={[{ key: 'light', label: 'Светлая' }, { key: 'dark', label: 'Тёмная' }]}
              activeKey={isDark ? 'dark' : 'light'}
              onChange={toggleTheme}
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
