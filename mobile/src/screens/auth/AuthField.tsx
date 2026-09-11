import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface Props extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'autoCapitalize' | 'keyboardType' | 'maxLength' | 'inputMode' | 'editable'> {
  label: string;
  required?: boolean;
  error?: string | null;
  help?: string;
  aside?: React.ReactNode;
  rightIcon?: React.ReactNode;
  mono?: boolean;
  textAlign?: 'left' | 'center';
  fontSize?: number;
}

/** RN port of `.mg-fldbox`/`.mg-in` — the shared labeled input used across the auth flow. */
export const AuthField: React.FC<Props> = ({
  label, required, error, help, aside, rightIcon, mono, textAlign, fontSize, ...input
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.labRow}>
        <Text style={[styles.lab, { color: colors.textSecondary }]}>
          {label}{required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
        <View style={{ flex: 1 }} />
        {aside}
      </View>
      <View style={[styles.inWrap, { backgroundColor: colors.surfaceVariant, borderColor: error ? colors.error : 'transparent' }]}>
        <TextInput
          style={[
            styles.in,
            { color: colors.text, fontFamily: mono ? fonts.mono : fonts.regular, textAlign: textAlign || 'left', fontSize: fontSize || 15 },
          ]}
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          {...input}
        />
        {rightIcon}
      </View>
      {(error || help) ? (
        <Text style={[styles.helpTxt, { color: error ? colors.error : colors.textTertiary }]}>{error || help}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { marginBottom: 0 },
  labRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  lab: { fontSize: 11.5, fontFamily: fonts.regular },
  inWrap: { borderRadius: radius.lg, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center' },
  in: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 12, letterSpacing: -0.1 },
  helpTxt: { fontSize: 11, marginTop: 5, lineHeight: 15 },
});
