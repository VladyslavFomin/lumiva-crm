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
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DepartmentsList" component={DepartmentsListScreen} />
    <Stack.Screen name="DepartmentDetail" component={DepartmentDetailScreen} />
    <Stack.Screen name="DepartmentCreate" component={DepartmentFormScreen} />
    <Stack.Screen name="DepartmentEdit" component={DepartmentFormScreen} />
  </Stack.Navigator>
);



