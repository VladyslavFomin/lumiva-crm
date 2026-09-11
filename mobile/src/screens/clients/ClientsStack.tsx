import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClientsScreen } from './ClientsScreen';
import { ContactDetailScreen } from '../contacts/ContactDetailScreen';
import { ContactCreateScreen } from '../contacts/ContactCreateScreen';
import { CompanyDetailScreen } from '../companies/CompanyDetailScreen';
import { CompanyCreateScreen } from '../companies/CompanyCreateScreen';
import { CoTasksScreen } from '../companies/CoTasksScreen';

export type ClientsStackParamList = {
  ClientsMain: { initialTab?: 'contacts' | 'companies' } | undefined;
  ContactDetail: { id: string };
  ContactCreate: undefined;
  CompanyDetail: { id: string };
  CompanyCreate: undefined;
  CoTasks: undefined;
};

const Stack = createNativeStackNavigator<ClientsStackParamList>();

export const ClientsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ClientsMain" component={ClientsScreen} />
    <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
    <Stack.Screen name="ContactCreate" component={ContactCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
    <Stack.Screen name="CompanyCreate" component={CompanyCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="CoTasks" component={CoTasksScreen} />
  </Stack.Navigator>
);
