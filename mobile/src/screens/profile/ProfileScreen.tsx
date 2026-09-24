import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { fetchProfile, UserProfile } from '../../api/profile';
import { fetchTenantSettings, planLabel, TenantSettings } from '../../api/tenant';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AuraBackground, GlassCard } from '../../components/glass';

const APP_VERSION = Constants.expoConfig?.version || '—';

function colorWithAlpha(hex: string, alpha: number): string {
  // handle rgba strings by just returning with low opacity background color
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return `${hex.replace(/[\d.]+\)$/, `${alpha})`)}`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initials(profile: UserProfile | null): string {
  if (!profile) return '?';
  if (profile.name) {
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return profile.email[0].toUpperCase();
}

function fullName(profile: UserProfile | null, t: (key: string) => string): string {
  if (!profile) return t('profile.fallbackUser');
  return profile.name?.trim() || profile.email;
}

interface MRowProps {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  last?: boolean;
  colors: any;
  rightElement?: React.ReactNode;
}

function MRow({ icon, iconColor, label, value, onPress, showChevron = true, last = false, colors, rightElement }: MRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.separator, borderBottomWidth: last ? 0 : 0.5 }]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.icoWrap, { backgroundColor: colorWithAlpha(iconColor, 0.1) }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value && <Text style={[styles.rowVal, { color: colors.textSecondary }]}>{value}</Text>}
      {rightElement}
      {showChevron && !rightElement && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

export const ProfileScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const ROLE_LABELS: Record<string, string> = {
    owner: t('profile.role.owner'), manager: t('profile.role.manager'), viewer: t('profile.role.viewer'),
    finance: t('profile.role.finance'), sales: t('profile.role.sales'), developer: t('profile.role.developer'), support: t('profile.role.support'),
  };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [tenant, setTenant] = useState<TenantSettings | null>(null);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => null);
    fetchTenantSettings().then(setTenant).catch(() => null);
    AsyncStorage.getItem('tenant_id').then((v) => setTenantId(v || ''));
  }, []);

  const { logout } = useAuth();

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.logout.title'), t('profile.logout.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout.action'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout, t]);

  const ava = initials(profile);
  const name = fullName(profile, t);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title */}
        <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.largeTitle, { color: colors.text }]}>{t('profile.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('profile.subtitle')}</Text>
        </View>

        {/* Identity card */}
        <GlassCard variant="g" style={styles.card}>
          <Text style={[styles.cardKicker, { color: colors.textSecondary }]}>{t('profile.card.identity')}</Text>
          <View style={styles.idRow}>
            <View style={[styles.avatar, { backgroundColor: colors.ink }]}>
              <Text style={[styles.avatarTxt, { color: colors.onInk }]}>{ava}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.idName, { color: colors.text }]}>{name}</Text>
              <Text style={[styles.idEmail, { color: colors.textSecondary }]}>{profile?.email || '…'}</Text>
              <View style={styles.badgesRow}>
                {profile?.role && (
                  <View style={[styles.badgeDark, { backgroundColor: colors.ink }]}>
                    <Text style={[styles.badgeDarkTxt, { color: colors.onInk }]}>{ROLE_LABELS[profile.role] || profile.role}</Text>
                  </View>
                )}
                <View style={styles.badgeActive}>
                  <View style={styles.badgeActiveDot} />
                  <Text style={styles.badgeActiveTxt}>{t('profile.active')}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.editIconBtn} onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Company card */}
        <GlassCard variant="g" style={styles.card}>
          <Text style={[styles.cardKicker, { color: colors.textSecondary }]}>{t('profile.card.company')}</Text>
          <Text style={[styles.companyName, { color: colors.text }]}>
            {tenant?.name || '…'}
          </Text>
          <View style={styles.badgesRow}>
            <View style={[styles.proBadge, { backgroundColor: colors.ink }]}>
              <Text style={[styles.proBadgeTxt, { color: colors.onInk }]}>{planLabel(tenant?.plan)}</Text>
            </View>
            {tenantId ? (
              <View style={[styles.keyPill, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.keyPillTxt, { color: colors.textSecondary, fontFamily: fonts.mono }]}>{tenantId.slice(0, 12)}</Text>
              </View>
            ) : null}
          </View>
        </GlassCard>

        {/* Quick links */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLinks}>
          {[
            { label: t('profile.quick.personal'), action: () => navigation.navigate('EditProfile') },
            { label: t('profile.quick.security'), action: () => navigation.navigate('ChangePassword') },
            { label: t('profile.quick.plan'), action: () => navigation.navigate('Billing') },
          ].map((q) => (
            <GlassCard key={q.label} variant="flat" style={styles.quickChip}>
              <TouchableOpacity onPress={q.action}>
                <Text style={[styles.quickChipTxt, { color: colors.text }]}>{q.label}</Text>
              </TouchableOpacity>
            </GlassCard>
          ))}
        </ScrollView>

        {/* Group: АККАУНТ */}
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{t('profile.group.account')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <MRow icon="person-outline" iconColor="#1769d1" label={t('profile.item.personal')} onPress={() => navigation.navigate('EditProfile')} colors={colors} />
          <MRow icon="card-outline" iconColor="#1f8a5e" label={t('profile.item.billing')} value={planLabel(tenant?.plan)} onPress={() => navigation.navigate('Billing')} colors={colors} />
          <MRow icon="settings-outline" iconColor="#3b6cb6" label={t('profile.item.companySettings')} onPress={() => navigation.navigate('CompanySettings')} colors={colors} />
          <MRow icon="link-outline" iconColor="#888" label={t('profile.item.apiKeys')} onPress={() => navigation.navigate('ApiSettings')} last colors={colors} />
        </GlassCard>

        {/* Group: БЕЗОПАСНОСТЬ */}
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{t('profile.group.security')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <MRow icon="lock-closed-outline" iconColor="#cc2f47" label={t('profile.item.changePassword')} onPress={() => navigation.navigate('ChangePassword')} last colors={colors} />
        </GlassCard>

        {/* Group: ПРИЛОЖЕНИЕ */}
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{t('profile.group.app')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {/* Dark theme Switch row */}
          <View style={[styles.row, { borderBottomColor: colors.separator, borderBottomWidth: 0.5 }]}>
            <View style={[styles.icoWrap, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="moon-outline" size={16} color={colors.text} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('profile.item.darkTheme')}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.ink, false: 'rgba(118,118,128,0.3)' }}
              thumbColor={colors.onInk}
            />
          </View>
          <MRow icon="notifications-outline" iconColor="#c08319" label={t('profile.item.notifications')} onPress={() => navigation.navigate('Settings')} colors={colors} />
          <MRow icon="language-outline" iconColor="#3b6cb6" label={t('profile.item.language')} value={tenant?.uiLanguage?.toUpperCase() || '—'} onPress={() => navigation.navigate('CompanySettings')} last colors={colors} />
        </GlassCard>

        {/* Group: О ПРИЛОЖЕНИИ */}
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{t('profile.group.about')}</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <MRow icon="information-circle-outline" iconColor="#888" label={t('profile.item.version')} value={APP_VERSION} showChevron={false} last colors={colors} />
        </GlassCard>

        {/* Logout */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <GlassCard variant="g2" style={styles.logoutCard}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#cc2f47" />
              <Text style={styles.logoutTxt}>{t('profile.logoutButton')}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>© 2026 LUMIVA CRM · v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  card: { borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, overflow: 'hidden' },
  cardKicker: { fontSize: 11, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  idRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.4 },
  editIconBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(60,60,67,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  idName: { fontSize: 16, fontFamily: fonts.bold, letterSpacing: -0.3 },
  idEmail: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badgeDark: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  badgeDarkTxt: { fontSize: 11, fontFamily: fonts.semibold },
  badgeActive: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(31,138,94,0.12)',
  },
  badgeActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1f8a5e' },
  badgeActiveTxt: { fontSize: 11, color: '#1f8a5e', fontFamily: fonts.semibold },

  companyName: { fontSize: 16, fontFamily: fonts.bold, letterSpacing: -0.3, marginBottom: 10 },
  proBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  proBadgeTxt: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.5 },
  keyPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  keyPillTxt: { fontSize: 11 },

  quickLinks: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
  },
  quickChipTxt: { fontSize: 13, fontFamily: fonts.medium },

  groupTitle: {
    fontSize: 13, fontFamily: fonts.medium, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingHorizontal: 32, paddingTop: 20, paddingBottom: 6,
  },
  listCard: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },

  // m-row pattern
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, minHeight: 50,
  },
  icoWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: fonts.regular, letterSpacing: -0.3 },
  rowVal: { fontSize: 14, fontFamily: fonts.regular, letterSpacing: -0.2 },

  logoutCard: { borderRadius: 16 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16,
  },
  logoutTxt: { fontSize: 16, fontFamily: fonts.semibold, color: '#cc2f47' },

  footer: { textAlign: 'center', fontSize: 11, fontFamily: fonts.regular, marginTop: 16, marginBottom: 8, letterSpacing: 0.3 },
});
