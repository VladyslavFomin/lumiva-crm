import AsyncStorage from '@react-native-async-storage/async-storage';

const IDENTITY_KEY = 'last_identity';
const RECENTS_KEY = 'recent_workspaces';
const MAX_RECENTS = 4;

export interface LastIdentity {
  name: string;
  email: string;
  clientKey: string;
}

export interface RecentWorkspace {
  clientKey: string;
  email: string;
}

/** Non-sensitive display info for the last account that successfully signed in on this device — powers the Face ID row subtitle. Not cleared on logout (nothing to hide, no token stored here). */
export async function saveLastIdentity(identity: LastIdentity): Promise<void> {
  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export async function getLastIdentity(): Promise<LastIdentity | null> {
  const raw = await AsyncStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Real login history on this device (client keys actually used here before) — powers the "workspace" quick-fill chips. Never fabricated organization data. */
export async function pushRecentWorkspace(entry: RecentWorkspace): Promise<void> {
  const raw = await AsyncStorage.getItem(RECENTS_KEY);
  let list: RecentWorkspace[] = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  list = [entry, ...list.filter((r) => r.clientKey !== entry.clientKey)].slice(0, MAX_RECENTS);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const raw = await AsyncStorage.getItem(RECENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
