import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SalesListScreen } from './SalesListScreen';
import { SaleDetailScreen } from './SaleDetailScreen';
import { SaleEditScreen } from './SaleEditScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { SalesChannelsScreen } from './SalesChannelsScreen';

export type SalesStackParamList = {
  SalesList: undefined;
  SaleDetail: { id: string };
  SaleEdit: { id: string };
  Payments: undefined;
  SalesChannels: undefined;
};

const Stack = createNativeStackNavigator<SalesStackParamList>();

export const SalesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SalesList" component={SalesListScreen} />
    <Stack.Screen name="SaleDetail" component={SaleDetailScreen} />
    <Stack.Screen name="SaleEdit" component={SaleEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="Payments" component={PaymentsScreen} />
    <Stack.Screen name="SalesChannels" component={SalesChannelsScreen} />
  </Stack.Navigator>
);
