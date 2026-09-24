import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HotelsListScreen } from './HotelsListScreen';
import { HotelDetailScreen } from './HotelDetailScreen';
import { HotelReservationsScreen } from './HotelReservationsScreen';
import { HotelReservationDetailScreen } from './HotelReservationDetailScreen';
import { HotelsAnalyticsScreen } from './HotelsAnalyticsScreen';
import { FrontDeskScreen } from './FrontDeskScreen';
import { HotelCalendarScreen } from './HotelCalendarScreen';

// Mostly a read-only Hotels/PMS view — pricing, room types, availability, galleries and
// factsheets stay website-only by design. FrontDesk is a deliberate, narrow exception: same-day
// check-in/check-out is an at-the-counter operational action, not a back-office config edit, so
// it gets real write access (see api/hotels.ts).
export type HotelsStackParamList = {
  HotelsList: undefined;
  HotelDetail: { id: string };
  HotelReservations: { hotelId?: string } | undefined;
  HotelReservationDetail: { id: string };
  HotelsAnalytics: undefined;
  FrontDesk: undefined;
  HotelCalendar: undefined;
};

const Stack = createNativeStackNavigator<HotelsStackParamList>();

export const HotelsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HotelsList" component={HotelsListScreen} />
    <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
    <Stack.Screen name="HotelReservations" component={HotelReservationsScreen} />
    <Stack.Screen name="HotelReservationDetail" component={HotelReservationDetailScreen} />
    <Stack.Screen name="HotelsAnalytics" component={HotelsAnalyticsScreen} />
    <Stack.Screen name="FrontDesk" component={FrontDeskScreen} />
    <Stack.Screen name="HotelCalendar" component={HotelCalendarScreen} />
  </Stack.Navigator>
);
