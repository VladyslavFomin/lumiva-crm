import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();

  const menuItems = [
    {
      key: 'company',
      label: 'Настройки компании',
      icon: 'business',
      iconColor: colors.primary,
      route: 'CompanySettings',
    },
    {
      key: 'api',
      label: 'API токены',
      icon: 'key',
      iconColor: colors.secondary,
      route: 'ApiSettings',
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Общие настройки</Text>
        
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="color-palette" size={20} color={colors.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Тема оформления</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {isDark ? 'Темная' : 'Светлая'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Настройки системы</Text>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.settingItem,
              { borderBottomColor: colors.borderLight },
              index === menuItems.length - 1 && styles.settingItemLast,
            ]}
            onPress={() => navigation.navigate('Settings', { screen: item.route })}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: item.iconColor + '15' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>О приложении</Text>
        <View style={styles.aboutItem}>
          <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Версия</Text>
          <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
        </View>
        <View style={styles.aboutItem}>
          <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Разработчик</Text>
          <Text style={[styles.aboutValue, { color: colors.text }]}>Lumiva</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  section: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingItemLast: { borderBottomWidth: 0 },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  settingValue: { fontSize: 13, marginTop: 2 },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '600' },
});
