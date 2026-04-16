import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatSessionsScreen } from './ChatSessionsScreen';
import { ChatMessagesScreen } from './ChatMessagesScreen';

export type ChatStackParamList = {
  ChatSessions: undefined;
  ChatMessages: { id: string };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export const ChatStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ChatSessions" component={ChatSessionsScreen} options={{ title: 'Чаты' }} />
    <Stack.Screen name="ChatMessages" component={ChatMessagesScreen} options={{ title: 'Диалог' }} />
  </Stack.Navigator>
);
