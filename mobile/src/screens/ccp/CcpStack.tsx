import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CcpClientsScreen } from './CcpClientsScreen';
import { CcpClientDetailScreen } from './CcpClientDetailScreen';

export type CcpStackParamList = {
  CcpClients: undefined;
  CcpClientDetail: { id: string };
};

const Stack = createNativeStackNavigator<CcpStackParamList>();

export const CcpStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CcpClients" component={CcpClientsScreen} />
    <Stack.Screen name="CcpClientDetail" component={CcpClientDetailScreen} />
  </Stack.Navigator>
);
