import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchApiTokens, createApiToken, deleteApiToken, ApiToken } from '../../api/settings';
// Note: Clipboard functionality - if expo-clipboard is not available, use alternative method

export const ApiSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await fetchApiTokens();
      setTokens(data);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newToken = await createApiToken({ name: `Token ${new Date().toLocaleDateString()}` });
      Alert.alert(
        'Токен создан',
        `Ваш API токен:\n\n${newToken.token}\n\nСкопируйте его сейчас, он больше не будет показан!`,
        [
            {
              text: 'Скопировать',
              onPress: () => {
                // TODO: Implement clipboard copy if expo-clipboard is installed
                Alert.alert('Токен', `Скопируйте токен вручную:\n\n${newToken.token}`);
              },
            },
          { text: 'OK', onPress: () => load() },
        ]
      );
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось создать токен');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удаление токена', 'Вы уверены, что хотите удалить этот токен?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteApiToken(id);
            load();
          } catch (error: any) {
            Alert.alert('Ошибка', error?.message || 'Не удалось удалить токен');
          }
        },
      },
    ]);
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
      <FlatList
        data={tokens}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.addButtonText}>Создать API токен</Text>
              </>
            )}
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.tokenIcon, { backgroundColor: colors.secondary + '15' }]}>
                <Ionicons name="key" size={24} color={colors.secondary} />
              </View>
              <View style={styles.tokenInfo}>
                <Text style={[styles.tokenName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.tokenPreview, { color: colors.textSecondary }]}>
                  {item.token.substring(0, 20)}...
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={[styles.deleteButton, { backgroundColor: colors.error + '15' }]}
              >
                <Ionicons name="trash" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={[styles.tokenFooter, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.tokenDate, { color: colors.textTertiary }]}>
                Создан: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              {item.lastUsedAt && (
                <Text style={[styles.tokenDate, { color: colors.textTertiary }]}>
                  Использован: {new Date(item.lastUsedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="key-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет API токенов</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Создайте API токен для интеграции с внешними сервисами
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tokenInfo: { flex: 1 },
  tokenName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  tokenPreview: { fontSize: 13, fontFamily: 'monospace' },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 4,
  },
  tokenDate: { fontSize: 12 },
  emptyState: {
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 32,
  },
  emptyText: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});
