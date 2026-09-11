import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { fetchProfile, updateProfile, UserProfile } from '../../api/profile';
import { AuraBackground, GlassCard } from '../../components/glass';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  viewer: 'Наблюдатель',
  finance: 'Финансы',
  sales: 'Продажи',
  developer: 'Разработчик',
  support: 'Поддержка',
};

const AVATAR_PRESETS = ['#fde68a', '#bae6fd', '#fecaca', '#bbf7d0', '#fbcfe8', '#ddd6fe'];

function initials(profile: UserProfile | null): string {
  if (!profile) return '?';
  if (profile.name) {
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return profile.email?.[0]?.toUpperCase() || '?';
}

export const EditProfileScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [selectedPreset, setSelectedPreset] = useState(0);

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setProfile(data);
        setFormData({ name: data.name || '', phone: data.phone || '' });
      })
      .catch(() => Alert.alert('Ошибка', 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: formData.name, phone: formData.phone });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AuraBackground />
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const ava = initials(profile);
  const avatarBg = AVATAR_PRESETS[selectedPreset];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Nav */}
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text }]}>Аккаунт</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.ink }]} onPress={handleSave} disabled={saving}>
            <Text style={[styles.doneTxt, { color: colors.onInk }]}>{saving ? 'Сохранение...' : 'Готово'}</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Личные данные</Text>
          <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Аватар, имя, телефон. Email менять нельзя</Text>
        </View>

        {/* Avatar block */}
        <GlassCard variant="g" style={styles.avatarCard}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarTxt}>{ava}</Text>
            </View>
            <TouchableOpacity style={[styles.camBtn, { backgroundColor: colors.ink, borderColor: colors.background }]}>
              <Ionicons name="camera-outline" size={16} color={colors.onInk} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.ink }]}>
            <Text style={[styles.uploadTxt, { color: colors.onInk }]}>Загрузить фото</Text>
          </TouchableOpacity>
          <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>PNG, JPG, WebP · до 2 МБ</Text>
          <View style={styles.presetsRow}>
            <Text style={[styles.presetsLabel, { color: colors.textSecondary }]}>ИЛИ ВЫБЕРИТЕ ПРЕСЕТ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {AVATAR_PRESETS.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.presetBtn, { backgroundColor: c, borderColor: i === selectedPreset ? colors.ink : 'transparent' }]}
                    onPress={() => setSelectedPreset(i)}
                  >
                    {i === selectedPreset && (
                      <View style={[styles.presetCheck, { backgroundColor: colors.ink, borderColor: colors.background }]}>
                        <Ionicons name="checkmark" size={10} color={colors.onInk} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </GlassCard>

        {/* Fields */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>ОСНОВНОЕ</Text>
        <GlassCard variant="g2" style={styles.fieldsCard}>
          <View style={[styles.fieldRow, { borderBottomColor: colors.separator, borderBottomWidth: 0.5 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ИМЯ И ФАМИЛИЯ</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={formData.name}
              onChangeText={(v) => setFormData((f) => ({ ...f, name: v }))}
              placeholder="Имя Фамилия"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={[styles.fieldRow, { borderBottomColor: colors.separator, borderBottomWidth: 0.5 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EMAIL · ТОЛЬКО ПРОСМОТР</Text>
            <Text style={[styles.fieldInputReadOnly, { color: colors.textSecondary }]}>{profile?.email || '—'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ТЕЛЕФОН</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={formData.phone}
              onChangeText={(v) => setFormData((f) => ({ ...f, phone: v }))}
              placeholder="+7 000 000 00 00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />
          </View>
        </GlassCard>

        {/* Workspace */}
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>РАБОЧЕЕ МЕСТО</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          <View style={styles.workRow}>
            <View style={[styles.workIco, { backgroundColor: colors.secondary + '18' }]}>
              <Ionicons name="person-outline" size={16} color={colors.secondary} />
            </View>
            <Text style={[styles.workLabel, { color: colors.text, flex: 1 }]}>Роль</Text>
            <Text style={[styles.workValue, { color: colors.textSecondary }]}>
              {profile?.role ? (ROLE_LABELS[profile.role] || profile.role) : '—'}
            </Text>
          </View>
        </GlassCard>

        {/* Danger */}
        <View style={{ height: 20 }} />
        <GlassCard variant="g2" style={styles.listCard}>
          <TouchableOpacity style={styles.dangerRow}>
            <Text style={styles.dangerTxt}>Удалить аккаунт</Text>
          </TouchableOpacity>
        </GlassCard>
        <Text style={[styles.dangerHint, { color: colors.textTertiary }]}>
          Перед удалением — экспортируйте данные. Это действие нельзя отменить.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  doneTxt: { fontSize: 14, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  titleBlock: { paddingHorizontal: 20, paddingBottom: 12 },
  pageTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  avatarCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 20, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 104, height: 104, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 38, fontFamily: fonts.bold, color: '#222', letterSpacing: -0.5 },
  camBtn: { position: 'absolute', bottom: -4, right: -4, width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  uploadBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginBottom: 8 },
  uploadTxt: { fontSize: 13, fontFamily: fonts.semibold },
  uploadHint: { fontSize: 11, fontFamily: fonts.regular, textAlign: 'center', marginBottom: 16 },
  presetsRow: { width: '100%' },
  presetsLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  presetBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  presetCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },

  groupLabel: { fontSize: 13, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 32, paddingTop: 8, paddingBottom: 6 },
  fieldsCard: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  fieldRow: { padding: 14, paddingHorizontal: 16 },
  fieldLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  fieldInput: { fontSize: 17, fontFamily: fonts.regular, letterSpacing: -0.3, padding: 0 },
  fieldInputReadOnly: { fontSize: 17, fontFamily: fonts.regular, letterSpacing: -0.3 },

  listCard: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  workIco: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  workLabel: { fontSize: 14, fontFamily: fonts.medium },
  workValue: { fontSize: 13, fontFamily: fonts.regular },

  dangerRow: { paddingVertical: 16, alignItems: 'center' },
  dangerTxt: { fontSize: 16, color: '#cc2f47', fontFamily: fonts.medium },
  dangerHint: { fontSize: 11, fontFamily: fonts.regular, textAlign: 'center', paddingHorizontal: 32, paddingTop: 10, paddingBottom: 24, lineHeight: 18 },
});
