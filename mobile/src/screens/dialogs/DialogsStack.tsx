import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UnifiedDialogsScreen } from './UnifiedDialogsScreen';
import { DialogThreadScreen } from './DialogThreadScreen';

export type DialogChannel = 'chat' | 'telegram' | 'whatsapp' | 'email';

export type DialogsStackParamList = {
  Dialogs: undefined;
  DialogThread: {
    channel: DialogChannel;
    id: string;
    name: string;
    extra?: { botId?: string | null; telegramUserId?: string; connectionId?: string | null; accountId?: string; counterpartEmail?: string };
  };
};

const Stack = createNativeStackNavigator<DialogsStackParamList>();

export const DialogsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dialogs" component={UnifiedDialogsScreen} />
    <Stack.Screen name="DialogThread" component={DialogThreadScreen} />
  </Stack.Navigator>
);
