import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketingScreen } from './MarketingScreen';
import { TrafficScreen } from './TrafficScreen';
import { CampaignsScreen } from './CampaignsScreen';
import { UtmsScreen } from './UtmsScreen';
import { SegmentsScreen } from './SegmentsScreen';
import { EmailTemplatesScreen } from './EmailTemplatesScreen';

export type MarketingStackParamList = {
  Marketing: undefined;
  Traffic: undefined;
  Campaigns: undefined;
  Utms: undefined;
  Segments: undefined;
  EmailTemplates: undefined;
  EmailTemplateDetail: { id: string };
  EmailTemplateCreate: undefined;
};

const Stack = createNativeStackNavigator<MarketingStackParamList>();

export const MarketingStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Marketing"
      component={MarketingScreen}
      options={{ title: 'Маркетинг' }}
    />
    <Stack.Screen
      name="Traffic"
      component={TrafficScreen}
      options={{ title: 'Трафик' }}
    />
    <Stack.Screen
      name="Campaigns"
      component={CampaignsScreen}
      options={{ title: 'Кампании' }}
    />
    <Stack.Screen
      name="Utms"
      component={UtmsScreen}
      options={{ title: 'UTM метки' }}
    />
    <Stack.Screen
      name="Segments"
      component={SegmentsScreen}
      options={{ title: 'Сегменты' }}
    />
    <Stack.Screen
      name="EmailTemplates"
      component={EmailTemplatesScreen}
      options={{ title: 'Email шаблоны' }}
    />
  </Stack.Navigator>
);



