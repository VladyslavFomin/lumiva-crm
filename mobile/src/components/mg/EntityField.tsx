import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface Props extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'autoCapitalize' | 'keyboardType' | 'multiline' | 'editable'> {
  label: string;
  required?: boolean;
  error?: string | null;
  help?: string | null;
  aside?: React.ReactNode;
}

/** RN port of `Fld`/`.mg-in` (mglass-kit.jsx) — the shared labeled input for entity create/edit forms. */
export const EntityField: React.FC<Props> = ({ label, required, error, help, aside, ...input }) => {
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
      <TextInput
        style={[
          styles.in,
          { backgroundColor: colors.surfaceVariant, color: colors.text, fontFamily: fonts.regular, borderColor: error ? colors.error : 'transparent' },
          input.multiline && { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
        ]}
        placeholderTextColor={colors.textTertiary}
        autoCorrect={false}
        {...input}
      />
      {(error || help) ? <Text style={[styles.helpTxt, { color: error ? colors.error : colors.textTertiary }]}>{error || help}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { marginBottom: spacing.md },
  labRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  lab: { fontSize: 11.5, fontFamily: fonts.regular },
  in: { borderRadius: radius.lg, borderWidth: 1.5, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  helpTxt: { fontSize: 11, marginTop: 5, lineHeight: 15 },
});
