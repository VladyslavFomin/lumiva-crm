import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const host = Constants.expoConfig?.extra?.apiHost || 'https://crm.lumiva.agency';
const base = Constants.expoConfig?.extra?.apiBase || '/v1';

export const api = axios.create({
  baseURL: `${host}${base}`,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  const tenantId = await AsyncStorage.getItem('tenant_id');
  const clientKey = await AsyncStorage.getItem('client_key');
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
  if (tenantId) {
    config.headers = {
      ...(config.headers || {}),
      'X-Tenant-Id': tenantId,
    };
  }
  if (clientKey) {
    config.headers = {
      ...(config.headers || {}),
      'X-Client-Key': clientKey,
    };
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.multiRemove(['auth_token', 'tenant_id', 'client_key']);
    }
    return Promise.reject(error);
  },
);

export async function saveAuth(token: string, tenantId?: string, clientKey?: string) {
  const tasks = [['auth_token', token]];
  if (tenantId) tasks.push(['tenant_id', tenantId]);
  if (clientKey) tasks.push(['client_key', clientKey]);
  await AsyncStorage.multiSet(tasks);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove(['auth_token', 'tenant_id', 'client_key']);
}
