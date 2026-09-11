import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { GlassCard, AuraBackground } from '../glass';
import { Button } from '../ui';

interface Props {
  title: string;
  kicker: string;
  sub: string;
  missing: string[];
  entityLabel: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

/** RN port of `FormShell` (mglass-w1-forms.jsx) — the shared create/edit form chrome: header with a
 * disabled-until-valid Save action, scrollable sectioned body, and a closing validation summary
 * card naming exactly which required fields are still missing. */
export const EntityFormShell: React.FC<Props> = ({ title, kicker, sub, missing, entityLabel, saving, onCancel, onSave, children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ok = missing.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onCancel} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.textTertiary }]}>{kicker.toUpperCase()}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.ink, opacity: ok ? 1 : 0.4 }]}
            onPress={() => ok && onSave()}
            disabled={!ok || saving}
          >
            <Text style={[styles.saveBtnTxt, { color: colors.onInk }]}>{saving ? '…' : 'Сохранить'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}

          <GlassCard variant="g" contentStyle={styles.summaryCard}>
            <View style={styles.summaryHead}>
              <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle-outline'} size={18} color={ok ? colors.success : colors.warning} />
              <Text style={[styles.summaryTitle, { color: colors.text }]}>{ok ? 'Готово к сохранению' : 'Не заполнено'}</Text>
            </View>
            <Text style={[styles.summarySub, { color: colors.textSecondary }]}>
              {ok ? 'Все обязательные поля заполнены.' : `Обязательные поля: ${missing.join(', ')}.`}
            </Text>
            <View style={styles.actionsRow}>
              <Button label="Отменить" variant="secondary" size="sm" style={{ flex: 1 }} onPress={onCancel} />
              <Button label={`Сохранить ${entityLabel}`} variant="accent" size="sm" style={{ flex: 1 }} loading={saving} disabled={!ok} onPress={onSave} />
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

export const FieldCard: React.FC<{ icon?: keyof typeof Ionicons.glyphMap; title?: string; children: React.ReactNode }> = ({ icon, title, children }) => {
  const { colors } = useTheme();
  return (
    <GlassCard variant="g" style={styles.fieldCard} contentStyle={styles.fieldCardContent}>
      {title && (
        <View style={styles.cardHeadRow}>
          {icon && <Ionicons name={icon} size={16} color={colors.text} />}
          <Text style={[styles.cardHeadTitle, { color: colors.text }]}>{title}</Text>
        </View>
      )}
      {children}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 6 },
  backBtn: { padding: 2 },
  kicker: { fontSize: 10, fontFamily: fonts.mono, letterSpacing: 0.6 },
  title: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  saveBtnTxt: { fontSize: 12.5, fontFamily: fonts.semibold },
  sub: { fontSize: 11.5, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: spacing.xs },
  fieldCard: { borderRadius: 22, marginBottom: spacing.sm },
  fieldCardContent: { padding: spacing.lg },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  cardHeadTitle: { fontSize: 15, fontFamily: fonts.semibold },
  summaryCard: { padding: spacing.lg },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  summaryTitle: { fontSize: 15, fontFamily: fonts.semibold },
  summarySub: { fontSize: 12.5, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
