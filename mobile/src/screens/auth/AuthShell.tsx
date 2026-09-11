import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuraBackground } from '../../components/glass';

interface Props {
  children: React.ReactNode;
  foot?: React.ReactNode;
}

/** RN port of `.mg-auth` — the shared centered-column shell for every auth/onboarding screen. */
export const AuthShell: React.FC<Props> = ({ children, foot }) => {
  const { colors, isDark } = useTheme();
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>{children}</View>
      </ScrollView>
      {foot && <Text style={[styles.foot, { color: colors.textSecondary }]}>{foot}</Text>}
    </KeyboardAvoidingView>
  );
};

export const Mark: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.mark, { backgroundColor: colors.ink }]}>
      <Text style={[styles.markTxt, { color: colors.onInk }]}>L</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  stack: { gap: spacing.md },
  mark: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  markTxt: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -1 },
  foot: { textAlign: 'center', fontSize: 11.5, lineHeight: 16, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
});
