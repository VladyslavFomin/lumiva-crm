import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EsignStackParamList } from './EsignStack';
import { fetchEsignDocument, sendEsignDocument, duplicateEsignDocument, deleteEsignDocument, EsignDocument } from '../../api/esign';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { Button, SkeletonList, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import type { PillTone } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<EsignStackParamList, 'EsignDocumentDetail'>;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик', sent: 'Отправлен', viewed: 'Просмотрен', signed: 'Подписан', declined: 'Отклонён', expired: 'Истёк',
};
const STATUS_TONE: Record<string, PillTone> = {
  draft: 'default', sent: 'acc', viewed: 'warn', signed: 'pos', declined: 'neg', expired: 'neg',
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const EsignDocumentDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [item, setItem] = useState<EsignDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      setItem(await fetchEsignDocument(id));
    } catch {
      showToast('Не удалось загрузить документ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSend = async () => {
    if (!item) return;
    setActing(true);
    try {
      const updated = await sendEsignDocument(item.id);
      setItem(updated);
      showToast('Документ отправлен', { variant: 'success' });
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Не удалось отправить документ', { variant: 'error' });
    } finally {
      setActing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!item) return;
    setActing(true);
    try {
      const dup = await duplicateEsignDocument(item.id);
      showToast('Документ продублирован', { variant: 'success' });
      navigation.replace('EsignDocumentDetail', { id: dup.id });
    } catch {
      showToast('Не удалось продублировать документ', { variant: 'error' });
    } finally {
      setActing(false);
    }
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert('Удалить документ?', 'Черновик будет удалён без возможности восстановления.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await deleteEsignDocument(item.id);
            showToast('Документ удалён', { variant: 'success' });
            navigation.goBack();
          } catch {
            showToast('Не удалось удалить документ', { variant: 'error' });
            setActing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Документ не найден</Text>
      </View>
    );
  }

  const canSend = item.status !== 'signed' && item.status !== 'declined';
  const canDelete = item.status === 'draft';

  const properties = [
    { label: 'Тип', value: item.kind, icon: 'document-text-outline' as const, iconColor: colors.info },
    item.contactId && {
      label: 'Клиент',
      value: item.contactCompany ? `${item.contactName || `#${item.contactId.slice(0, 8)}`} · ${item.contactCompany}` : item.contactName || `#${item.contactId.slice(0, 8)}`,
      icon: 'person-outline' as const,
      iconColor: colors.secondary,
    },
    item.amount != null && { label: 'Сумма', value: formatMoney(item.amount, item.currency), icon: 'cash-outline' as const, iconColor: colors.success },
    item.entityLabel && { label: 'Связан с', value: item.entityLabel, icon: 'link-outline' as const, iconColor: colors.fg3 },
    { label: 'Страниц', value: String(item.pageCount), icon: 'copy-outline' as const, iconColor: colors.fg3 },
    item.fileName && { label: 'Файл', value: item.fileName, icon: 'document-outline' as const, iconColor: colors.fg3 },
    item.viewedAt && { label: 'Просмотрен', value: fmtDate(item.viewedAt), icon: 'eye-outline' as const, iconColor: colors.warning },
    item.sentAt && { label: 'Отправлен', value: fmtDate(item.sentAt), icon: 'paper-plane-outline' as const, iconColor: colors.info },
    { label: 'Создан', value: fmtDate(item.createdAt), icon: 'time-outline' as const, iconColor: colors.fg3 },
  ].filter(Boolean) as { label: string; value: string; icon: any; iconColor: string }[];

  const actions: { label: string; variant: 'primary' | 'secondary' | 'danger'; onPress: () => void }[] = [];
  if (canSend) {
    actions.push({ label: item.status === 'draft' ? 'Отправить' : 'Отправить повторно', variant: 'primary', onPress: handleSend });
  }
  actions.push({ label: 'Дублировать', variant: 'secondary', onPress: handleDuplicate });
  if (canDelete) {
    actions.push({ label: 'Удалить', variant: 'danger', onPress: handleDelete });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: actions.length ? 110 : 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Мои документы</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Pill label={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status] || 'default'} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>СВОЙСТВА</Text>
        <GlassCard variant="g2" style={styles.listCard}>
          {properties.map((p, i) => (
            <View key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < properties.length - 1 ? 1 : 0 }]}>
              <View style={[styles.propIco, { backgroundColor: p.iconColor + '22' }]}>
                <Ionicons name={p.icon} size={16} color={p.iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={2}>{p.value}</Text>
              </View>
            </View>
          ))}
        </GlassCard>

        {item.items && item.items.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПОЗИЦИИ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {item.items.map((line, i) => (
                <View key={i} style={[styles.itemRow, { borderBottomColor: colors.line3, borderBottomWidth: i < item.items!.length - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{line.name}</Text>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[line.sku, line.durationMinutes ? `${line.durationMinutes} мин` : null, line.masterName].filter(Boolean).join(' · ') || (line.kind === 'product' ? 'Товар' : 'Услуга')}
                    </Text>
                  </View>
                  <Text style={[styles.itemPrice, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{formatMoney(line.price, line.currency)}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>

      {actions.length > 0 && (
        <View style={[styles.ctaBar, { bottom: insets.bottom + 16 }]}>
          {actions.map((a, i) => (
            <Button key={i} label={a.label} variant={a.variant} fullWidth loading={acting} disabled={acting} onPress={a.onPress} style={{ flex: 1 }} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroTitle: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  propLabel: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 2 },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  itemName: { fontSize: 14, fontFamily: fonts.medium },
  itemMeta: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  itemPrice: { fontSize: 13 },
  ctaBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', gap: 10 },
});
