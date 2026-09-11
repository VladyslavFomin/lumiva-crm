import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HelpdeskTicketsListScreen } from './HelpdeskTicketsListScreen';
import { HelpdeskTicketDetailScreen } from './HelpdeskTicketDetailScreen';

export type HelpdeskStackParamList = {
  HelpdeskTicketsList: undefined;
  HelpdeskTicketDetail: { id: string };
};

const Stack = createNativeStackNavigator<HelpdeskStackParamList>();

export const HelpdeskStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HelpdeskTicketsList" component={HelpdeskTicketsListScreen} />
    <Stack.Screen name="HelpdeskTicketDetail" component={HelpdeskTicketDetailScreen} />
  </Stack.Navigator>
);
