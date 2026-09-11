import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '../../api/profile';
import { AuraBackground, GlassCard } from '../../components/glass';

export const ChangePasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleSave = async () => {
    if (!formData.currentPassword || !formData.newPassword) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    if (formData.newPassword.length < 6) {
      Alert.alert('Ошибка', 'Новый пароль должен содержать минимум 6 символов');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    setSaving(true);
    try {
      await changePassword({
        oldPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      Alert.alert('Успешно', 'Пароль изменен');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || error?.message || 'Не удалось изменить пароль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={styles.content}>
      <GlassCard variant="g" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Изменение пароля</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Введите текущий пароль и новый пароль для изменения
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Текущий пароль</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={formData.currentPassword}
              onChangeText={(text) => setFormData({ ...formData, currentPassword: text })}
              placeholder="Текущий пароль"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPasswords.current}
            />
            <TouchableOpacity onPress={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}>
              <Ionicons
                name={showPasswords.current ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Новый пароль</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={formData.newPassword}
              onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
              placeholder="Новый пароль (минимум 6 символов)"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPasswords.new}
            />
            <TouchableOpacity onPress={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}>
              <Ionicons
                name={showPasswords.new ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Подтвердите пароль</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="Подтвердите новый пароль"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPasswords.confirm}
            />
            <TouchableOpacity onPress={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}>
              <Ionicons
                name={showPasswords.confirm ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.ink }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.onInk} />
              <Text style={[styles.saveButtonText, { color: colors.onInk }]}>Изменить пароль</Text>
            </>
          )}
        </TouchableOpacity>
      </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  section: {
    borderRadius: 24,
    padding: 24,
  },
  sectionTitle: { fontSize: 19, fontFamily: fonts.bold, marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, fontFamily: fonts.regular, marginBottom: 24, lineHeight: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: fonts.semibold, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  saveButtonText: { fontFamily: fonts.bold, fontSize: 16 },
});



