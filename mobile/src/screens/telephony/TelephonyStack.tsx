import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelephonyScreen } from './TelephonyScreen';
import { CallDetailScreen } from './CallDetailScreen';
import { TelephonyAnalyticsScreen } from './TelephonyAnalyticsScreen';
import type { Call } from '../../api/telephony';

export type TelephonyStackParamList = {
  TelephonyMain: undefined;
  CallDetail: { call: Call };
  TelephonyAnalytics: undefined;
};

const Stack = createNativeStackNavigator<TelephonyStackParamList>();

export const TelephonyStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="TelephonyMain" component={TelephonyScreen} />
    <Stack.Screen name="CallDetail" component={CallDetailScreen} />
    <Stack.Screen name="TelephonyAnalytics" component={TelephonyAnalyticsScreen} />
  </Stack.Navigator>
);
