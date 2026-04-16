import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DepartmentsListScreen } from './DepartmentsListScreen';
import { DepartmentDetailScreen } from './DepartmentDetailScreen';
import { DepartmentFormScreen } from './DepartmentFormScreen';

export type DepartmentsStackParamList = {
  DepartmentsList: undefined;
  DepartmentDetail: { id: string };
  DepartmentCreate: undefined;
  DepartmentEdit: { id: string };
};

const Stack = createNativeStackNavigator<DepartmentsStackParamList>();

export const DepartmentsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="DepartmentsList"
      component={DepartmentsListScreen}
      options={{ title: 'Отделы' }}
    />
    <Stack.Screen
      name="DepartmentDetail"
      component={DepartmentDetailScreen}
      options={{ title: 'Детали отдела' }}
    />
    <Stack.Screen
      name="DepartmentCreate"
      component={DepartmentFormScreen}
      options={{ title: 'Создание отдела' }}
    />
    <Stack.Screen
      name="DepartmentEdit"
      component={DepartmentFormScreen}
      options={{ title: 'Редактирование отдела' }}
    />
  </Stack.Navigator>
);



