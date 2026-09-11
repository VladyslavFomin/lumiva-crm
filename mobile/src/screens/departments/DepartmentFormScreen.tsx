import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchDepartment, createDepartment, updateDepartment } from '../../api/departments';
import { AuraBackground, GlassCard } from '../../components/glass';

export const DepartmentFormScreen: React.FC = () => {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params || {};
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (isEdit) {
      const load = async () => {
        try {
          const data = await fetchDepartment(id);
          setFormData({
            name: data.name || '',
            description: data.description || '',
          });
        } catch (error) {
          console.error('Failed to load department:', error);
          Alert.alert('Ошибка', 'Не удалось загрузить отдел');
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  }, [id, isEdit]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Ошибка', 'Введите название отдела');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateDepartment({ id, ...formData });
        Alert.alert('Успешно', 'Отдел обновлен');
      } else {
        await createDepartment(formData);
        Alert.alert('Успешно', 'Отдел создан');
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось сохранить отдел');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={styles.content}>
      <GlassCard variant="g" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {isEdit ? 'Редактирование отдела' : 'Создание отдела'}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Название *</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="business" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Название отдела"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Описание</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="document-text" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputMultiline, { color: colors.text }]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Описание отдела"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.ink }]}
          onPress={handleSave}
          disabled={saving || !formData.name.trim()}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.onInk} />
              <Text style={[styles.saveButtonText, { color: colors.onInk }]}>{isEdit ? 'Сохранить' : 'Создать'}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  section: { borderRadius: 24, padding: 24 },
  sectionTitle: { fontSize: 19, fontFamily: fonts.bold, marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: fonts.semibold, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  inputIcon: { marginRight: 12, marginTop: 2 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  inputMultiline: {
    minHeight: 100,
    paddingBottom: 14,
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



