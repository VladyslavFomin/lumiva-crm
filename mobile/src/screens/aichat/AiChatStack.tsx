import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AiChatSessionsScreen } from './AiChatSessionsScreen';
import { AiChatThreadScreen } from './AiChatThreadScreen';
import { ApprovalsScreen } from './ApprovalsScreen';
import { AiAgentsListScreen } from './AiAgentsListScreen';
import { AiAgentDetailScreen } from './AiAgentDetailScreen';

export type AiChatStackParamList = {
  AiChatSessions: undefined;
  AiChatThread: { sessionId: string | null };
  Approvals: undefined;
  AiAgentsList: undefined;
  AiAgentDetail: { id: string };
};

const Stack = createNativeStackNavigator<AiChatStackParamList>();

export const AiChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AiChatSessions" component={AiChatSessionsScreen} />
    <Stack.Screen name="AiChatThread" component={AiChatThreadScreen} />
    <Stack.Screen name="Approvals" component={ApprovalsScreen} />
    <Stack.Screen name="AiAgentsList" component={AiAgentsListScreen} />
    <Stack.Screen name="AiAgentDetail" component={AiAgentDetailScreen} />
  </Stack.Navigator>
);
