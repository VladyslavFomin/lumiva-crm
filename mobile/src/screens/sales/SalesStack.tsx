import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SalesListScreen } from './SalesListScreen';
import { SaleDetailScreen } from './SaleDetailScreen';

export type SalesStackParamList = {
  SalesList: undefined;
  SaleDetail: { id: string };
};

const Stack = createNativeStackNavigator<SalesStackParamList>();

export const SalesStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="SalesList" component={SalesListScreen} options={{ title: 'Продажи' }} />
    <Stack.Screen name="SaleDetail" component={SaleDetailScreen} options={{ title: 'Детали продажи' }} />
  </Stack.Navigator>
);
