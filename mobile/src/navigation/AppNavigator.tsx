import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../theme/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { OfflineScreen } from '../screens/OfflineScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LeadsStack } from '../screens/leads/LeadsStack';
import { ProjectsStack } from '../screens/projects/ProjectsStack';
import { SalesStack } from '../screens/sales/SalesStack';
import { ChatStack } from '../screens/chat/ChatStack';
import { ContactsStack } from '../screens/contacts/ContactsStack';
import { CompaniesStack } from '../screens/companies/CompaniesStack';
import { StaffStack } from '../screens/staff/StaffStack';
import { MarketingStack } from '../screens/marketing/MarketingStack';
import { SettingsStack } from '../screens/settings/SettingsStack';
import { ProfileStack } from '../screens/profile/ProfileStack';
import { DepartmentsStack } from '../screens/departments/DepartmentsStack';
import { Header } from '../components/Header';
import { AppDrawerContent } from '../components/AppDrawerContent';

type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  Offline: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

const DrawerLayout = () => (
  <Drawer.Navigator
    screenOptions={({ navigation, route }) => ({
      header: () => (
        <Header
          title={drawerTitle(route.name)}
          onMenu={() => navigation.toggleDrawer()}
          onBell={() => navigation.navigate('Chat' as never)}
          unreadCount={0}
        />
      ),
    })}
    drawerContent={(props) => <AppDrawerContent {...props} />}
  >
    <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Главная' }} />
    <Drawer.Screen name="Leads" component={LeadsStack} options={{ title: 'Лиды' }} />
    <Drawer.Screen name="Projects" component={ProjectsStack} options={{ title: 'Проекты' }} />
    <Drawer.Screen name="Sales" component={SalesStack} options={{ title: 'Продажи' }} />
    <Drawer.Screen name="Contacts" component={ContactsStack} options={{ title: 'Контакты' }} />
    <Drawer.Screen name="Companies" component={CompaniesStack} options={{ title: 'Компании' }} />
    <Drawer.Screen name="Staff" component={StaffStack} options={{ title: 'Сотрудники' }} />
    <Drawer.Screen name="Departments" component={DepartmentsStack} options={{ title: 'Отделы' }} />
    <Drawer.Screen name="Marketing" component={MarketingStack} options={{ title: 'Маркетинг' }} />
    <Drawer.Screen name="Settings" component={SettingsStack} options={{ title: 'Настройки' }} />
    <Drawer.Screen name="Profile" component={ProfileStack} options={{ title: 'Профиль' }} />
    <Drawer.Screen name="Chat" component={ChatStack} options={{ title: 'Чат' }} />
  </Drawer.Navigator>
);

const drawerTitle = (name: string) => {
  const titles: Record<string, string> = {
    Dashboard: 'Главная',
    Leads: 'Лиды',
    Projects: 'Проекты',
    Sales: 'Продажи',
    Contacts: 'Контакты',
    Companies: 'Компании',
    Staff: 'Сотрудники',
    Departments: 'Отделы',
    Marketing: 'Маркетинг',
    Settings: 'Настройки',
    Profile: 'Профиль',
    Chat: 'Чат',
  };
  return titles[name] || name;
};

export const AppNavigator = () => {
  const { colors, isDark } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => sub();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('auth_token');
      setIsAuthed(!!token);
    };
    checkAuth();
  }, []);

  if (isAuthed === null) return null;

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnline && (
          <Stack.Screen name="Offline">
            {() => <OfflineScreen onRetry={() => setIsOnline(true)} />}
          </Stack.Screen>
        )}

        {!isAuthed ? (
          <Stack.Screen name="Auth">
            {(props) => <LoginScreen {...props} onSuccess={() => setIsAuthed(true)} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="App" component={DrawerLayout} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
