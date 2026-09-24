import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef, type NavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { GlobalTabBar, GlobalTabItem } from './GlobalTabBar';
import { AuthProvider } from '../auth/AuthContext';
import { CurrencyModeProvider } from '../context/CurrencyModeContext';
import { AccessProvider, useAccess, AccessRule } from '../context/AccessContext';
import { clearAuth } from '../api/client';
import { AuthStack } from '../screens/auth/AuthStack';
import { OfflineScreen } from '../screens/OfflineScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { LeadsStack } from '../screens/leads/LeadsStack';
import { ClientsStack } from '../screens/clients/ClientsStack';
import { ProjectsStack } from '../screens/projects/ProjectsStack';
import { SalesStack } from '../screens/sales/SalesStack';
import { ProductsStack } from '../screens/products/ProductsStack';
import { BookingsStack } from '../screens/bookings/BookingsStack';
import { ChatStack } from '../screens/chat/ChatStack';
import { HelpdeskStack } from '../screens/helpdesk/HelpdeskStack';
import { MarketingStack } from '../screens/marketing/MarketingStack';
import { ProfileStack } from '../screens/profile/ProfileStack';
import { AutomationsStack } from '../screens/automations/AutomationsStack';
import { StaffStack } from '../screens/staff/StaffStack';
import { DepartmentsStack } from '../screens/departments/DepartmentsStack';
import { TelephonyStack } from '../screens/telephony/TelephonyStack';
import { DuplicatesStack } from '../screens/duplicates/DuplicatesStack';
import { AuditLogStack } from '../screens/auditlog/AuditLogStack';
import { TeamCalendarStack } from '../screens/calendar/TeamCalendarStack';
import { AiChatStack } from '../screens/aichat/AiChatStack';
import { BiDashboardStack } from '../screens/bi/BiDashboardStack';
import { CcpStack } from '../screens/ccp/CcpStack';
import { EsignStack } from '../screens/esign/EsignStack';
import { HotelsStack } from '../screens/hotels/HotelsStack';
import { DialogsStack } from '../screens/dialogs/DialogsStack';
import { EmailInboxStack } from '../screens/emailinbox/EmailInboxStack';
import { MoreScreen } from '../screens/MoreScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { fetchLeadStats } from '../api/leads';

type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  Offline: undefined;
  Projects: undefined;
  Sales: undefined;
  Products: undefined;
  Bookings: undefined;
  Chat: undefined;
  Helpdesk: undefined;
  Automations: undefined;
  Staff: undefined;
  Departments: undefined;
  Telephony: undefined;
  Duplicates: undefined;
  AuditLog: undefined;
  TeamCalendar: undefined;
  AiChat: undefined;
  BiDashboard: undefined;
  Ccp: undefined;
  Esign: undefined;
  Hotels: undefined;
  Dialogs: undefined;
  EmailInbox: undefined;
  Clients: undefined;
  Marketing: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused, color }: { name: any; focused: boolean; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

function FabButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="add" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

// Tab content is never shown — tabPress is intercepted below to launch the corresponding root stack instead.
function LauncherTabScreen() {
  return null;
}

function MoreTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.moreIconWrap, focused && { backgroundColor: colors.ink }]}>
      <Ionicons name="apps" size={20} color={focused ? colors.onInk : color} />
    </View>
  );
}

const MainTabs = () => {
  return (
    <Tab.Navigator
      // The visible bar now lives once at the root (see GlobalTabBar in AppNavigator below) so it
      // stays on-screen for module stacks (Sales, Products, Marketing, …) that live outside this
      // Tab.Navigator entirely — this internal bar would otherwise only ever show on these 5 tabs.
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          title: 'Главная',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Leads"
        component={LeadsStack}
        options={{
          title: 'Лиды',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'podium' : 'podium-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProjectsTab"
        component={LauncherTabScreen}
        options={{
          title: 'Проекты',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'folder' : 'folder-outline'} focused={focused} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Projects');
          },
        })}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsScreen}
        options={{
          title: 'Аналитика',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'Ещё',
          tabBarIcon: ({ focused, color }) => <MoreTabIcon focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

/** Root-stack screens with `presentation: 'modal'` — the persistent tab bar hides for these,
 * matching how a modal already covers the tab bar when nested inside a tab's own stack. */
const MODAL_SCREEN_NAMES = new Set([
  'EmailTemplateCreate', 'ContactCreate', 'CompanyCreate', 'ProductCreate', 'ProjectCreate', 'LeadCreate',
  'EsignDocumentCreate', 'EsignTemplateForm', 'SegmentCreate', 'AutomationForm',
]);
const MAIN_TAB_KEY_BY_ROUTE: Record<string, string> = {
  Dashboard: 'dashboard', Leads: 'leads', ProjectsTab: 'projects', AnalyticsTab: 'analytics', More: 'more',
};

function deepestRoute(route: { name: string; state?: NavigationState }): { name: string; state?: NavigationState } {
  if (route.state) {
    const nested = route.state.routes[route.state.index ?? route.state.routes.length - 1];
    return deepestRoute(nested as any);
  }
  return route;
}

/** Maps the current root-navigator state to which of the 5 global tab items should be
 * highlighted, and whether the bar should be hidden entirely (auth/offline/modals). */
function resolveTabBarState(state: NavigationState | undefined): { activeKey: string | null; hidden: boolean } {
  if (!state) return { activeKey: 'dashboard', hidden: false };
  const rootRoute = state.routes[state.index ?? state.routes.length - 1];
  if (rootRoute.name === 'Auth' || rootRoute.name === 'Offline') return { activeKey: null, hidden: true };

  const leaf = deepestRoute(rootRoute as any);
  if (MODAL_SCREEN_NAMES.has(leaf.name)) return { activeKey: null, hidden: true };

  if (rootRoute.name === 'App') {
    const tabState = (rootRoute as any).state as NavigationState | undefined;
    const tabRoute = tabState ? tabState.routes[tabState.index ?? tabState.routes.length - 1] : undefined;
    const key = tabRoute ? MAIN_TAB_KEY_BY_ROUTE[tabRoute.name] : undefined;
    return { activeKey: key || 'dashboard', hidden: false };
  }
  if (rootRoute.name === 'Projects') return { activeKey: 'projects', hidden: false };
  // Every other module stack (Sales, Products, Bookings, Marketing, Clients, Staff, …) is only
  // reachable via the "Ещё" list, so it makes sense to highlight that tab while inside one.
  return { activeKey: 'more', hidden: false };
}

/** Tab bar filtered by the same tenant-module + RBAC rules as the website's sidebar (needs to live inside AccessProvider). */
const AccessGatedTabBar: React.FC<{ items: (GlobalTabItem & AccessRule)[]; activeKey: string; onPress: (key: string) => void }> = ({ items, activeKey, onPress }) => {
  const { allowed } = useAccess();
  return <GlobalTabBar items={items.filter((i) => allowed(i))} activeKey={activeKey} onPress={onPress} />;
};

export const AppNavigator = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [tabBarState, setTabBarState] = useState<{ activeKey: string | null; hidden: boolean }>({ activeKey: 'dashboard', hidden: false });
  const navigationRef = useRef(createNavigationContainerRef<any>()).current;

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => sub();
  }, []);

  useEffect(() => {
    fetchLeadStats()
      .then((stats) => setNewLeadsCount(stats.byStatus.find((s) => s.status?.toLowerCase() === 'new')?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setIsAuthed(false);
        return;
      }
      // A saved token normally means "skip straight in" — but if this device can gate that with
      // Face ID/fingerprint, show the lock screen first (LoginScreen renders the Face ID card
      // whenever a token + cached identity exist) instead of granting silent access.
      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setIsAuthed(!(hasHardware && isEnrolled));
      } catch {
        setIsAuthed(true);
      }
    })();
  }, []);

  if (isAuthed === null) return null;

  const logout = async () => {
    await clearAuth();
    setIsAuthed(false);
  };

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  };

  const tabItems: (GlobalTabItem & AccessRule)[] = [
    { key: 'dashboard', label: t('tabs.dashboard'), icon: 'home-outline', iconFocused: 'home' },
    { key: 'leads', component: 'leads', perm: 'leads', label: t('tabs.leads'), icon: 'podium-outline', iconFocused: 'podium', badge: newLeadsCount > 0 ? newLeadsCount : undefined },
    { key: 'projects', component: 'projects', perm: 'projects', label: t('tabs.projects'), icon: 'folder-outline', iconFocused: 'folder' },
    { key: 'analytics', perm: 'analytics', label: t('tabs.analytics'), icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
    { key: 'more', label: t('tabs.more'), icon: 'apps-outline', iconFocused: 'apps' },
  ];

  const handleTabPress = (key: string) => {
    if (!navigationRef.isReady()) return;
    if (key === 'dashboard') navigationRef.navigate('App', { screen: 'Dashboard' });
    else if (key === 'leads') navigationRef.navigate('App', { screen: 'Leads' });
    else if (key === 'projects') navigationRef.navigate('Projects');
    else if (key === 'analytics') navigationRef.navigate('App', { screen: 'AnalyticsTab' });
    else if (key === 'more') navigationRef.navigate('App', { screen: 'More' });
  };

  return (
    <AuthProvider logout={logout}>
      {/* Both providers fetch tenant data — `enabled` makes them (re)load when the user actually logs in (a fetch at first
          mount, before login, fails and would otherwise stay failed until an app restart). */}
      <CurrencyModeProvider enabled={isAuthed}>
      <AccessProvider enabled={isAuthed}>
      {/* Neither of these had an explicit background before — fully transparent, so the gaps
          around the floating tab bar pill (its own horizontal/vertical padding) exposed
          Android's default window background, which is black, instead of the app's theme
          background. Read as a black outline hugging the pill. */}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => setTabBarState(resolveTabBarState(navigationRef.getRootState() as any))}
        onStateChange={(state) => setTabBarState(resolveTabBarState(state))}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isOnline && (
            <Stack.Screen name="Offline">
              {() => <OfflineScreen onRetry={() => setIsOnline(true)} />}
            </Stack.Screen>
          )}
          {!isAuthed ? (
            <Stack.Screen name="Auth">
              {() => <AuthStack onSuccess={() => setIsAuthed(true)} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="App" component={MainTabs} />
              <Stack.Screen name="Projects" component={ProjectsStack} />
              <Stack.Screen name="Sales" component={SalesStack} />
              <Stack.Screen name="Products" component={ProductsStack} />
              <Stack.Screen name="Bookings" component={BookingsStack} />
              <Stack.Screen name="Chat" component={ChatStack} />
              <Stack.Screen name="Helpdesk" component={HelpdeskStack} />
              <Stack.Screen name="Automations" component={AutomationsStack} />
              <Stack.Screen name="Staff" component={StaffStack} />
              <Stack.Screen name="Departments" component={DepartmentsStack} />
              <Stack.Screen name="Telephony" component={TelephonyStack} />
              <Stack.Screen name="Duplicates" component={DuplicatesStack} />
              <Stack.Screen name="AuditLog" component={AuditLogStack} />
              <Stack.Screen name="TeamCalendar" component={TeamCalendarStack} />
              <Stack.Screen name="AiChat" component={AiChatStack} />
              <Stack.Screen name="BiDashboard" component={BiDashboardStack} />
              <Stack.Screen name="Ccp" component={CcpStack} />
              <Stack.Screen name="Esign" component={EsignStack} />
              <Stack.Screen name="Hotels" component={HotelsStack} />
              <Stack.Screen name="Dialogs" component={DialogsStack} />
              <Stack.Screen name="EmailInbox" component={EmailInboxStack} />
              <Stack.Screen name="Clients" component={ClientsStack} />
              <Stack.Screen name="Marketing" component={MarketingStack} />
              <Stack.Screen name="Account" component={ProfileStack} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      </View>
      {isAuthed && isOnline && !tabBarState.hidden && (
        <AccessGatedTabBar items={tabItems} activeKey={tabBarState.activeKey || 'dashboard'} onPress={handleTabPress} />
      )}
      </View>
      </AccessProvider>
      </CurrencyModeProvider>
    </AuthProvider>
  );
};

export default AppNavigator;

const styles = StyleSheet.create({
  moreIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
});
