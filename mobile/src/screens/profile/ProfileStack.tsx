import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from './ProfileScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { BillingScreen } from './BillingScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { CompanySettingsScreen } from '../settings/CompanySettingsScreen';
import { ApiSettingsScreen } from '../settings/ApiSettingsScreen';
import { CustomFieldsSettingsScreen } from '../settings/CustomFieldsSettingsScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Billing: undefined;
  Settings: undefined;
  CompanySettings: undefined;
  ApiSettings: undefined;
  CustomFieldsSettings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="Billing" component={BillingScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="CompanySettings" component={CompanySettingsScreen} />
    <Stack.Screen name="ApiSettings" component={ApiSettingsScreen} />
    <Stack.Screen name="CustomFieldsSettings" component={CustomFieldsSettingsScreen} />
  </Stack.Navigator>
);
