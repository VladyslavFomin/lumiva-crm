import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { fetchMenu, MenuGroup } from '../api/menu';

export const AppDrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation, state }) => {
  const { colors } = useTheme();
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: 'LUMIVA CRM', email: 'owner@demo.com', role: 'OWNER' });

  const currentRoute = state.routeNames[state.index];

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const tenantId = await AsyncStorage.getItem('tenant_id');
        if (tenantId) {
          const menu = await fetchMenu(tenantId);
          setMenuGroups(menu);
        } else {
          // Fallback menu
          setMenuGroups([
            {
              label: 'Основное',
              items: [
                { key: 'dashboard', label: 'Главная', route: 'Dashboard', enabled: true },
                { key: 'leads', label: 'Лиды', route: 'Leads', enabled: true },
                { key: 'projects', label: 'Проекты', route: 'Projects', enabled: true },
                { key: 'sales', label: 'Продажи', route: 'Sales', enabled: true },
                { key: 'chat', label: 'Чат', route: 'Chat', enabled: true },
              ],
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to load menu:', error);
        // Fallback menu on error
        setMenuGroups([
          {
            label: 'Основное',
            items: [
              { key: 'dashboard', label: 'Главная', route: 'Dashboard', enabled: true },
              { key: 'leads', label: 'Лиды', route: 'Leads', enabled: true },
              { key: 'projects', label: 'Проекты', route: 'Projects', enabled: true },
              { key: 'sales', label: 'Продажи', route: 'Sales', enabled: true },
              { key: 'chat', label: 'Чат', route: 'Chat', enabled: true },
            ],
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadMenu();
  }, []);

  const handleNavigate = (route: string) => {
    if (route) {
      navigation.navigate(route as never);
      navigation.closeDrawer();
    }
  };

  const renderItem = (item: any) => {
    if (!item.enabled) return null;
    const active = currentRoute === item.route;
    return (
      <TouchableOpacity
        key={item.key}
        style={[
          styles.item,
          { backgroundColor: active ? colors.primary + '15' : colors.surfaceVariant },
          active && { borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
        onPress={() => handleNavigate(item.route || '')}
      >
        <Text style={[styles.itemText, { color: active ? colors.primary : colors.text }]}>{item.label}</Text>
        {item.children?.length ? <Ionicons name="chevron-down" size={16} color={colors.textSecondary} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{userInfo.name?.[0] || 'C'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]}>{userInfo.name}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{userInfo.email}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.closeDrawer()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          menuGroups.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{group.label}</Text>
              {group.items.map(renderItem)}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={[styles.rolePill, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.roleText, { color: colors.textSecondary }]}>{userInfo.role}</Text>
        </View>
        <TouchableOpacity onPress={async () => {
          await AsyncStorage.multiRemove(['auth_token', 'tenant_id', 'client_key']);
          navigation.navigate('Auth' as never);
        }}>
          <Text style={[styles.logout, { color: colors.error }]}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, borderBottomWidth: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  name: { fontSize: 14, fontWeight: '700' },
  email: { fontSize: 12 },
  closeBtn: { padding: 8 },
  loading: { padding: 20, alignItems: 'center' },
  group: { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  itemText: { flex: 1, fontSize: 15, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  rolePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  roleText: { fontSize: 12, fontWeight: '700' },
  logout: { fontSize: 14, fontWeight: '700' },
});
