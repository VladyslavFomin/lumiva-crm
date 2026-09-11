import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, StatusBar, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, fonts } from '../../theme/ThemeContext';
import Constants from 'expo-constants';
import { fetchTenantSettings } from '../../api/tenant';
import { AuraBackground, GlassCard } from '../../components/glass';

const APP_VERSION = Constants.expoConfig?.version || '—';

const NOTIF_PREFS_KEY = 'notif_prefs_v1';

const THEMES = [
  { l: 'Авто',    mode: 'auto'  as const },
  { l: 'Светлая', mode: 'light' as const },
  { l: 'Тёмная',  mode: 'dark'  as const },
];

const NOTIF_CONFIG = [
  { l: 'Push на телефон',   sub: 'Новые лиды и горящие задачи', on: true,  color: '#cc2f47', icon: 'notifications-outline' as const },
  { l: 'Email-дайджест',    sub: 'Ежедневно в 09:00',            on: true,  color: '#3b6cb6', icon: 'mail-outline' as const },
  { l: 'Telegram-бот',      sub: '@lumiva_alerts',                on: false, color: '#229ED9', icon: 'paper-plane-outline' as const },
  { l: 'Звук уведомлений',  sub: 'По умолчанию',                 on: true,  color: '#c08319', icon: 'volume-medium-outline' as const },
];

function colorWithAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

export const SettingsScreen: React.FC = () => {
  const { colors, mode, setMode, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [notifs, setNotifs] = useState(NOTIF_CONFIG.map((n) => n.on));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [search, setSearch] = useState('');
  const [uiLanguage, setUiLanguage] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.notifs)) setNotifs(saved.notifs);
        if (typeof saved.reduceMotion === 'boolean') setReduceMotion(saved.reduceMotion);
      } catch {}
    });
    fetchTenantSettings().then((t) => {
      setUiLanguage(t.uiLanguage);
      setCurrency(t.primaryCurrency);
    }).catch(() => {});
  }, []);

  const persistPrefs = (nextNotifs: boolean[], nextReduceMotion: boolean) => {
    AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify({ notifs: nextNotifs, reduceMotion: nextReduceMotion })).catch(() => {});
  };

  const toggleNotif = (index: number, value: boolean) => {
    setNotifs((arr) => {
      const next = arr.map((x, j) => (j === index ? value : x));
      persistPrefs(next, reduceMotion);
      return next;
    });
  };

  const toggleReduceMotion = (value: boolean) => {
    setReduceMotion(value);
    persistPrefs(notifs, value);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Nav */}
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text }]}>Аккаунт</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Настройки</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Уведомления, внешний вид, интеграции</Text>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: 'rgba(118,118,128,0.12)', marginHorizontal: 16, marginBottom: 8 }]}>
          <Ionicons name="search-outline" size={16} color="rgba(60,60,67,0.5)" />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Найти настройку"
            placeholderTextColor="rgba(60,60,67,0.5)"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* ВНЕШНИЙ ВИД */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>ВНЕШНИЙ ВИД</Text>
        <GlassCard variant="g2" style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Тема приложения</Text>
          <View style={styles.themeGrid}>
            {THEMES.map((t, i) => {
              const active = mode === t.mode;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.themeOption, { borderColor: active ? colors.ink : 'rgba(60,60,67,0.12)', borderWidth: active ? 2 : 1 }]}
                  onPress={() => setMode(t.mode)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.themePreview, { overflow: 'hidden' }]}>
                    {t.mode === 'auto' ? (
                      <>
                        <View style={{ position: 'absolute', left: 0, top: 0, right: '50%', bottom: 0, backgroundColor: '#fff' }} />
                        <View style={{ position: 'absolute', right: 0, top: 0, left: '50%', bottom: 0, backgroundColor: '#222' }} />
                      </>
                    ) : (
                      <View style={{ flex: 1, backgroundColor: t.mode === 'light' ? '#fff' : '#222' }} />
                    )}
                  </View>
                  <Text style={[styles.themeLabel, { color: colors.text }]}>{t.l}</Text>
                  {active && <View style={[styles.themeActiveDot, { backgroundColor: colors.ink }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.toggleRow, { borderTopColor: colors.separator, borderTopWidth: 0.5, marginTop: 12, paddingTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Уменьшить движение</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Отключить анимации интерфейса</Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={toggleReduceMotion}
              trackColor={{ true: colors.ink, false: 'rgba(118,118,128,0.3)' }}
              thumbColor={colors.onInk}
            />
          </View>
        </GlassCard>

        {/* УВЕДОМЛЕНИЯ */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>УВЕДОМЛЕНИЯ</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {NOTIF_CONFIG.map((n, i) => (
            <View
              key={i}
              style={[styles.settingsRow, { borderBottomColor: colors.separator, borderBottomWidth: i < NOTIF_CONFIG.length - 1 ? 0.5 : 0 }]}
            >
              <View style={[styles.rowIco, { backgroundColor: colorWithAlpha(n.color, 0.1) }]}>
                <Ionicons name={n.icon} size={16} color={n.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{n.l}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{n.sub}</Text>
              </View>
              <Switch
                value={notifs[i]}
                onValueChange={(v) => toggleNotif(i, v)}
                trackColor={{ true: colors.success, false: 'rgba(118,118,128,0.3)' }}
                thumbColor={colors.onInk}
              />
            </View>
          ))}
        </GlassCard>

        {/* ЯЗЫК И РЕГИОН */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>ЯЗЫК И РЕГИОН</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {[
            { icon: 'globe-outline' as const, color: '#3b6cb6', label: 'Язык интерфейса', value: uiLanguage ? uiLanguage.toUpperCase() : '—' },
            { icon: 'diamond-outline' as const, color: '#1f8a5e', label: 'Валюта', value: currency || '—' },
          ].map((r, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingsRow, { borderBottomColor: colors.separator, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0 }]}
              onPress={() => navigation.navigate('CompanySettings')}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIco, { backgroundColor: colorWithAlpha(r.color, 0.1) }]}>
                <Ionicons name={r.icon} size={16} color={r.color} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{r.label}</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{r.value}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* РАБОЧЕЕ ПРОСТРАНСТВО */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>РАБОЧЕЕ ПРОСТРАНСТВО</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {[
            { icon: 'business-outline' as const, color: colors.ink,          label: 'Реквизиты компании', value: '', route: 'CompanySettings' },
            { icon: 'key-outline' as const,      color: colors.textTertiary, label: 'API ключи',          value: '', route: 'ApiSettings' },
            { icon: 'options-outline' as const,  color: colors.ink,          label: 'Кастомные поля',     value: '', route: 'CustomFieldsSettings' },
          ].map((r, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingsRow, { borderBottomColor: colors.separator, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0 }]}
              onPress={() => navigation.navigate(r.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={r.icon} size={16} color={r.color} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{r.label}</Text>
              {r.value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{r.value}</Text> : null}
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* О ПРИЛОЖЕНИИ */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>О ПРИЛОЖЕНИИ</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {[
            { icon: 'help-circle-outline' as const, color: colors.ink, label: 'Центр поддержки', value: '', chevron: true, onPress: () => navigation.navigate('Helpdesk') },
            { icon: 'information-circle-outline' as const, color: colors.textTertiary, label: 'Версия', value: APP_VERSION, chevron: false, onPress: undefined },
          ].map((r, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingsRow, { borderBottomColor: colors.separator, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0 }]}
              activeOpacity={r.chevron ? 0.7 : 1}
              disabled={!r.chevron}
              onPress={r.onPress}
            >
              <View style={[styles.rowIco, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={r.icon} size={16} color={r.color} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{r.label}</Text>
              {r.value ? <Text style={[styles.rowValue, { color: colors.textSecondary, fontFamily: fonts.mono }]}>{r.value}</Text> : null}
              {r.chevron && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
            </TouchableOpacity>
          ))}
        </GlassCard>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>© 2026 LUMIVA CRM</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular },
  titleBlock: { paddingHorizontal: 20, paddingBottom: 12 },
  pageTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: fonts.regular, padding: 0 },

  groupLabel: {
    fontSize: 13, fontFamily: fonts.medium, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingHorizontal: 32, paddingTop: 20, paddingBottom: 6,
  },

  card: { marginHorizontal: 16, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 13, fontFamily: fonts.medium, marginBottom: 12 },

  themeGrid: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center' },
  themePreview: {
    width: '100%', height: 50, borderRadius: 8,
    borderWidth: 0.5, borderColor: 'rgba(60,60,67,0.12)',
    marginBottom: 8, position: 'relative',
  },
  themeLabel: { fontSize: 12, fontFamily: fonts.semibold },
  themeActiveDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 13, fontFamily: fonts.medium },
  toggleSub: { fontSize: 11, fontFamily: fonts.regular, marginTop: 1 },

  listCard: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, minHeight: 50,
  },
  rowIco: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: fonts.medium, letterSpacing: -0.2 },
  rowSub: { fontSize: 11, fontFamily: fonts.regular, marginTop: 1 },
  rowValue: { fontSize: 13, fontFamily: fonts.regular, letterSpacing: -0.2 },

  footer: { textAlign: 'center', fontSize: 11, fontFamily: fonts.regular, marginTop: 24, marginBottom: 8, letterSpacing: 0.3 },
});
