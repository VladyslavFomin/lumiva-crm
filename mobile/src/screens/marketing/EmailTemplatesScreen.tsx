import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchEmailTemplates, EmailTemplate } from '../../api/email';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { ToolbarButton, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const EmailTemplatesScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setTemplates(await fetchEmailTemplates());
    } catch {
      showToast('Не удалось загрузить шаблоны', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Email-шаблоны</Text>
        <View style={styles.toolbar}>
          <ToolbarButton icon="add" label="Создать шаблон" active onPress={() => navigation.navigate('EmailTemplateCreate')} />
        </View>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : templates.length === 0 ? (
        <EmptyState icon="mail-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет шаблонов" subtitle="Создайте первый email-шаблон" />
      ) : (
        <Animated.FlatList
          data={templates}
          keyExtractor={(item: EmailTemplate) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: EmailTemplate }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('EmailTemplateDetail', { id: item.id })}
              activeOpacity={0.7}
            >
              <GlassCard variant="flat" style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.icon, { backgroundColor: colors.infoBg }]}>
                    <Ionicons name="mail" size={18} color={colors.info} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {item.category ? <Text style={[styles.category, { color: colors.textTertiary }]}>{item.category}</Text> : null}
                  </View>
                  {!item.isActive && <Pill label="Неактивен" tone="default" />}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
                {item.subject ? <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>{item.subject}</Text> : null}
                {item.htmlBody ? <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>{stripHtml(item.htmlBody)}</Text> : null}
              </GlassCard>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  toolbar: { flexDirection: 'row', marginTop: spacing.sm, paddingBottom: spacing.sm },
  card: { borderRadius: radius.xxl, padding: spacing.md, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontFamily: fonts.semibold },
  category: { fontSize: 11, fontFamily: fonts.regular, marginTop: 1 },
  subject: { fontSize: 13, fontFamily: fonts.medium },
  preview: { fontSize: 12, fontFamily: fonts.regular, lineHeight: 17 },
});
