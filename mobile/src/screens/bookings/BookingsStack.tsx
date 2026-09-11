import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookingsCalendarScreen } from './BookingsCalendarScreen';
import { BookingDetailScreen } from './BookingDetailScreen';
import { AvailabilityScreen } from './AvailabilityScreen';
import { WaitlistScreen } from './WaitlistScreen';
import { BookOverviewScreen } from './BookOverviewScreen';

export type BookingsStackParamList = {
  BookingsCalendar: undefined;
  BookingDetail: { id: string };
  Availability: undefined;
  Waitlist: undefined;
  BookOverview: undefined;
};

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export const BookingsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="BookingsCalendar" component={BookingsCalendarScreen} />
    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    <Stack.Screen name="Availability" component={AvailabilityScreen} />
    <Stack.Screen name="Waitlist" component={WaitlistScreen} />
    <Stack.Screen name="BookOverview" component={BookOverviewScreen} />
  </Stack.Navigator>
);
