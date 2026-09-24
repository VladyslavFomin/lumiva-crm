import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad' | 'numbers-and-punctuation';
  secureTextEntry?: boolean;
}

/** Shared text field for create/edit forms — matches `.base-input` on the web app. */
export const FormField: React.FC<Props> = ({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry }) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, fontFamily: fonts.regular },
          multiline && { height: 90, textAlignVertical: 'top', paddingTop: 10 },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14 },
});
