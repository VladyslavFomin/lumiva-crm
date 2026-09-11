import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketingScreen } from './MarketingScreen';
import { EmailTemplatesScreen } from './EmailTemplatesScreen';
import { EmailTemplateDetailScreen } from './EmailTemplateDetailScreen';
import { EmailTemplateCreateScreen } from './EmailTemplateCreateScreen';
import { ChannelDetailScreen } from './ChannelDetailScreen';
import { SegmentCreateScreen } from './SegmentCreateScreen';
import { SegmentDetailScreen } from './SegmentDetailScreen';
import { AutomationsListScreen } from './AutomationsListScreen';
import { AutomationFormScreen } from './AutomationFormScreen';

export type MarketingStackParamList = {
  Marketing: { initialTab?: 'traffic' | 'campaigns' | 'utm' | 'audience' } | undefined;
  EmailTemplates: undefined;
  EmailTemplateDetail: { id: string };
  EmailTemplateCreate: undefined;
  ChannelDetail: { channelKey: string };
  SegmentCreate: undefined;
  SegmentDetail: { id: string };
  Automations: undefined;
  AutomationForm: { id?: string };
};

const Stack = createNativeStackNavigator<MarketingStackParamList>();

export const MarketingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Marketing" component={MarketingScreen} />
    <Stack.Screen name="EmailTemplates" component={EmailTemplatesScreen} />
    <Stack.Screen name="EmailTemplateDetail" component={EmailTemplateDetailScreen} />
    <Stack.Screen name="EmailTemplateCreate" component={EmailTemplateCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ChannelDetail" component={ChannelDetailScreen} />
    <Stack.Screen name="SegmentCreate" component={SegmentCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="SegmentDetail" component={SegmentDetailScreen} />
    <Stack.Screen name="Automations" component={AutomationsListScreen} />
    <Stack.Screen name="AutomationForm" component={AutomationFormScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  </Stack.Navigator>
);
