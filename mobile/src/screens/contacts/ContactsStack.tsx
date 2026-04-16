import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsListScreen } from './ContactsListScreen';
import { ContactDetailScreen } from './ContactDetailScreen';

export type ContactsStackParamList = {
  ContactsList: undefined;
  ContactDetail: { id: string };
};

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export const ContactsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="ContactsList"
      component={ContactsListScreen}
      options={{ title: 'Контакты' }}
    />
    <Stack.Screen
      name="ContactDetail"
      component={ContactDetailScreen}
      options={{ title: 'Детали контакта' }}
    />
  </Stack.Navigator>
);








