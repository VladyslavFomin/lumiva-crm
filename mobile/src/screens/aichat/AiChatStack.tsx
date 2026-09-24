import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AiChatSessionsScreen } from './AiChatSessionsScreen';
import { AiChatThreadScreen } from './AiChatThreadScreen';
import { ApprovalsScreen } from './ApprovalsScreen';
import { AiAgentsListScreen } from './AiAgentsListScreen';
import { AiAgentDetailScreen } from './AiAgentDetailScreen';
import { AiMemoryScreen } from './AiMemoryScreen';
import { AiLetterScreen } from './AiLetterScreen';

export type AiChatStackParamList = {
  AiChatSessions: undefined;
  AiChatThread: { sessionId: string | null };
  Approvals: undefined;
  AiAgentsList: undefined;
  AiAgentDetail: { id: string };
  AiMemory: undefined;
  AiLetter: undefined;
};

const Stack = createNativeStackNavigator<AiChatStackParamList>();

export const AiChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AiChatSessions" component={AiChatSessionsScreen} />
    <Stack.Screen name="AiChatThread" component={AiChatThreadScreen} />
    <Stack.Screen name="Approvals" component={ApprovalsScreen} />
    <Stack.Screen name="AiAgentsList" component={AiAgentsListScreen} />
    <Stack.Screen name="AiAgentDetail" component={AiAgentDetailScreen} />
    <Stack.Screen name="AiMemory" component={AiMemoryScreen} />
    <Stack.Screen name="AiLetter" component={AiLetterScreen} />
  </Stack.Navigator>
);
