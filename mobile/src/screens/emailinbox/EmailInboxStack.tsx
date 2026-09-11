import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EmailInboxScreen } from './EmailInboxScreen';
import { EmailMessageDetailScreen } from './EmailMessageDetailScreen';
import { EmailComposeScreen } from './EmailComposeScreen';

export type EmailInboxStackParamList = {
  EmailInbox: undefined;
  EmailMessageDetail: { id: string };
  EmailCompose: {
    accountId: string;
    contactId?: string;
    leadId?: string;
    companyId?: string;
    initialTo?: string;
    initialSubject?: string;
    initialBody?: string;
  };
};

const Stack = createNativeStackNavigator<EmailInboxStackParamList>();

export const EmailInboxStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EmailInbox" component={EmailInboxScreen} />
    <Stack.Screen name="EmailMessageDetail" component={EmailMessageDetailScreen} />
    <Stack.Screen name="EmailCompose" component={EmailComposeScreen} />
  </Stack.Navigator>
);
