import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HotelsListScreen } from './HotelsListScreen';
import { HotelDetailScreen } from './HotelDetailScreen';
import { HotelReservationsScreen } from './HotelReservationsScreen';
import { HotelReservationDetailScreen } from './HotelReservationDetailScreen';
import { HotelsAnalyticsScreen } from './HotelsAnalyticsScreen';

// Read-only Hotels/PMS view — every editing/management action (pricing, room types,
// availability, galleries, factsheets) lives on the website only. This stack only ever displays
// data.
export type HotelsStackParamList = {
  HotelsList: undefined;
  HotelDetail: { id: string };
  HotelReservations: { hotelId?: string } | undefined;
  HotelReservationDetail: { id: string };
  HotelsAnalytics: undefined;
};

const Stack = createNativeStackNavigator<HotelsStackParamList>();

export const HotelsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HotelsList" component={HotelsListScreen} />
    <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
    <Stack.Screen name="HotelReservations" component={HotelReservationsScreen} />
    <Stack.Screen name="HotelReservationDetail" component={HotelReservationDetailScreen} />
    <Stack.Screen name="HotelsAnalytics" component={HotelsAnalyticsScreen} />
  </Stack.Navigator>
);
