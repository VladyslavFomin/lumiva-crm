import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchProfile, UserProfile } from '../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export const ProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProfile();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = async () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['auth_token', 'tenant_id', 'client_key']);
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.error }]}>Не удалось загрузить профиль</Text>
      </View>
    );
  }

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{fullName[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{fullName}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{profile.email}</Text>
        {profile.role && (
          <View style={[styles.roleBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>{profile.role}</Text>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Личная информация</Text>
        {profile.firstName && (
          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="person" size={18} color={colors.textTertiary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Имя</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>{profile.firstName}</Text>
          </View>
        )}
        {profile.lastName && (
          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="person" size={18} color={colors.textTertiary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Фамилия</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>{profile.lastName}</Text>
          </View>
        )}
        {profile.phone && (
          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="call" size={18} color={colors.textTertiary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Телефон</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>{profile.phone}</Text>
          </View>
        )}
        {profile.position && (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="briefcase" size={18} color={colors.textTertiary} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Должность</Text>
            </View>
            <Text style={[styles.value, { color: colors.text }]}>{profile.position}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Profile', { screen: 'EditProfile' })}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.editButtonText}>Редактировать профиль</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
        onPress={() => navigation.navigate('Profile', { screen: 'ChangePassword' })}
        activeOpacity={0.9}
      >
        <View style={[styles.menuIcon, { backgroundColor: colors.info + '15' }]}>
          <Ionicons name="lock-closed" size={22} color={colors.info} />
        </View>
        <View style={styles.menuContent}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Изменить пароль</Text>
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Обновить пароль для входа</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
        onPress={handleLogout}
        activeOpacity={0.9}
      >
        <View style={[styles.menuIcon, { backgroundColor: colors.error + '15' }]}>
          <Ionicons name="log-out" size={22} color={colors.error} />
        </View>
        <View style={styles.menuContent}>
          <Text style={[styles.menuTitle, { color: colors.error }]}>Выйти</Text>
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Выйти из аккаунта</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  header: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 36 },
  name: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  email: { fontSize: 16, marginBottom: 12 },
  roleBadge: { borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  roleText: { fontSize: 13, fontWeight: '700' },
  section: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 15 },
  value: { fontSize: 16, fontWeight: '600' },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    gap: 8,
  },
  editButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  menuSubtitle: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 16 },
});



