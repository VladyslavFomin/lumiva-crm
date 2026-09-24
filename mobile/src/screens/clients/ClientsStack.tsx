import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClientsScreen } from './ClientsScreen';
import { ContactDetailScreen } from '../contacts/ContactDetailScreen';
import { ContactEditScreen } from '../contacts/ContactEditScreen';
import { CompanyDetailScreen } from '../companies/CompanyDetailScreen';
import { CompanyEditScreen } from '../companies/CompanyEditScreen';
import { CoTasksScreen } from '../companies/CoTasksScreen';

export type ClientsStackParamList = {
  ClientsMain: { initialTab?: 'contacts' | 'companies' } | undefined;
  ContactDetail: { id: string };
  ContactCreate: undefined;
  ContactEdit: { id: string };
  CompanyDetail: { id: string };
  CompanyCreate: undefined;
  CompanyEdit: { id: string };
  CoTasks: undefined;
};

const Stack = createNativeStackNavigator<ClientsStackParamList>();

export const ClientsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ClientsMain" component={ClientsScreen} />
    <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
    <Stack.Screen name="ContactCreate" component={ContactEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ContactEdit" component={ContactEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
    <Stack.Screen name="CompanyCreate" component={CompanyEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="CompanyEdit" component={CompanyEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="CoTasks" component={CoTasksScreen} />
  </Stack.Navigator>
);
