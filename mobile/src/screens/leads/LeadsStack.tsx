import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LeadsListScreen } from './LeadsListScreen';
import { LeadDetailScreen } from './LeadDetailScreen';
import { LeadCreateScreen } from './LeadCreateScreen';
import { LeadsAnalyticsScreen } from './LeadsAnalyticsScreen';
import { LeadsRoiScreen } from './LeadsRoiScreen';

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { id: string };
  LeadCreate: undefined;
  LeadsAnalytics: undefined;
  LeadsRoi: undefined;
};

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export const LeadsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="LeadsList"
      component={LeadsListScreen}
      options={{ title: 'Лиды' }}
    />
    <Stack.Screen
      name="LeadDetail"
      component={LeadDetailScreen}
      options={{ title: 'Детали лида' }}
    />
    <Stack.Screen
      name="LeadCreate"
      component={LeadCreateScreen}
      options={{ title: 'Новый лид' }}
    />
    <Stack.Screen
      name="LeadsAnalytics"
      component={LeadsAnalyticsScreen}
      options={{ title: 'Аналитика лидов' }}
    />
    <Stack.Screen
      name="LeadsRoi"
      component={LeadsRoiScreen}
      options={{ title: 'ROI по лидам' }}
    />
  </Stack.Navigator>
);
