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
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ChatSessions" component={ChatSessionsScreen} />
    <Stack.Screen name="ChatMessages" component={ChatMessagesScreen} />
  </Stack.Navigator>
);
