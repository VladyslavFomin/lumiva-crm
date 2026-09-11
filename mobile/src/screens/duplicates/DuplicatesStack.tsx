import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DuplicatesScreen } from './DuplicatesScreen';

export type DuplicatesStackParamList = {
  DuplicatesMain: undefined;
};

const Stack = createNativeStackNavigator<DuplicatesStackParamList>();

export const DuplicatesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DuplicatesMain" component={DuplicatesScreen} />
  </Stack.Navigator>
);
