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
  <Stack.Navigator>
    <Stack.Screen
      name="StaffList"
      component={StaffListScreen}
      options={{ title: 'Сотрудники' }}
    />
    <Stack.Screen
      name="StaffDetail"
      component={StaffDetailScreen}
      options={{ title: 'Детали сотрудника' }}
    />
  </Stack.Navigator>
);








