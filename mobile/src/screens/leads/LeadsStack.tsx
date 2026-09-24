import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LeadsListScreen } from './LeadsListScreen';
import { LeadsCalendarScreen } from './LeadsCalendarScreen';
import { LeadDetailScreen } from './LeadDetailScreen';
import { LeadEditScreen } from './LeadEditScreen';
import { LeadCreateScreen } from './LeadCreateScreen';

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadsCalendar: undefined;
  LeadDetail: { id: string };
  LeadCreate: undefined;
  LeadEdit: { id: string };
};

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export const LeadsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
    <Stack.Screen name="LeadsList" component={LeadsListScreen} />
    <Stack.Screen name="LeadsCalendar" component={LeadsCalendarScreen} />
    <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ animation: 'slide_from_right' }} />
    <Stack.Screen name="LeadCreate" component={LeadCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="LeadEdit" component={LeadEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
);
