import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TeamCalendarScreen } from './TeamCalendarScreen';

export type TeamCalendarStackParamList = {
  TeamCalendarMain: undefined;
};

const Stack = createNativeStackNavigator<TeamCalendarStackParamList>();

export const TeamCalendarStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="TeamCalendarMain" component={TeamCalendarScreen} />
  </Stack.Navigator>
);
