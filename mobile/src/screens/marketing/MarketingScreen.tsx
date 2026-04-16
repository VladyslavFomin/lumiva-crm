import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Card, Section } from '../../components/UI';

export const MarketingScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const menuItems = [
    { key: 'traffic', label: 'Трафик', icon: 'trending-up', description: 'Анализ источников трафика', route: 'Traffic' },
    { key: 'campaigns', label: 'Кампании', icon: 'megaphone', description: 'Управление рекламными кампаниями', route: 'Campaigns' },
    { key: 'utms', label: 'UTM метки', icon: 'link', description: 'Отслеживание UTM-меток', route: 'Utms' },
    { key: 'segments', label: 'Сегменты', icon: 'people', description: 'Сегментация аудитории', route: 'Segments' },
    { key: 'email-templates', label: 'Email шаблоны', icon: 'mail', description: 'Шаблоны email рассылок', route: 'EmailTemplates' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="megaphone" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Маркетинг</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Управление кампаниями, трафиком и маркетинговыми инструментами
        </Text>
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={() => navigation.navigate('Marketing', { screen: item.route })}
            activeOpacity={0.9}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={item.icon as any} size={28} color={colors.primary} />
            </View>
            <Text style={[styles.menuTitle, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  heroCard: {
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    width: '48%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  menuIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  menuDescription: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
});






