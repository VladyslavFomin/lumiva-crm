import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StaffListScreen } from './StaffListScreen';
import { StaffDetailScreen } from './StaffDetailScreen';

export type StaffStackParamList = {
  StaffList: undefined;
  StaffDetail: { id: string };
};

const Stack = createNativeStackNavigator<StaffStackParamList>();

export const StaffStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="StaffList" component={StaffListScreen} />
    <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
  </Stack.Navigator>
);








