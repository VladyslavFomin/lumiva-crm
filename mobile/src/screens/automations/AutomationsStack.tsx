import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AutomationsScreen } from './AutomationsScreen';
import { AutomationDetailScreen } from './AutomationDetailScreen';

export type AutomationsStackParamList = {
  AutomationsList: undefined;
  AutomationDetail: { id: string };
};

const Stack = createNativeStackNavigator<AutomationsStackParamList>();

export const AutomationsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AutomationsList" component={AutomationsScreen} />
    <Stack.Screen name="AutomationDetail" component={AutomationDetailScreen} />
  </Stack.Navigator>
);
