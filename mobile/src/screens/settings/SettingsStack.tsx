import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from './SettingsScreen';
import { CompanySettingsScreen } from './CompanySettingsScreen';
import { ApiSettingsScreen } from './ApiSettingsScreen';

export type SettingsStackParamList = {
  Settings: undefined;
  CompanySettings: undefined;
  ApiSettings: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'Настройки' }}
    />
    <Stack.Screen
      name="CompanySettings"
      component={CompanySettingsScreen}
      options={{ title: 'Настройки компании' }}
    />
    <Stack.Screen
      name="ApiSettings"
      component={ApiSettingsScreen}
      options={{ title: 'API токены' }}
    />
  </Stack.Navigator>
);



