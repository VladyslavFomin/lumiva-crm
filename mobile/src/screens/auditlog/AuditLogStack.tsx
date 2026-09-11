import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuditLogScreen } from './AuditLogScreen';

export type AuditLogStackParamList = {
  AuditLogMain: undefined;
};

const Stack = createNativeStackNavigator<AuditLogStackParamList>();

export const AuditLogStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AuditLogMain" component={AuditLogScreen} />
  </Stack.Navigator>
);
