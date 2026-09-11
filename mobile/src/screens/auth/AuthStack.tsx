import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from './LoginScreen';
import { OtpScreen } from './OtpScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { SetPasswordScreen } from './SetPasswordScreen';
import { SignupScreen } from './SignupScreen';
import { SignupVerifyScreen } from './SignupVerifyScreen';
import { TenantSuspendedScreen } from './TenantSuspendedScreen';

export type AuthStackParamList = {
  Login: undefined;
  Otp: { challengeToken: string; email: string; clientKey: string };
  Forgot: { clientKey?: string } | undefined;
  SetPassword: { clientKey?: string; email?: string } | undefined;
  Signup: undefined;
  SignupVerify: { clientKey: string; email: string };
  TenantSuspended: { reason?: string; activeUntil?: string; clientKey?: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface Props {
  onSuccess: () => void;
}

export const AuthStack: React.FC<Props> = ({ onSuccess }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login">{(props) => <LoginScreen {...props} onSuccess={onSuccess} />}</Stack.Screen>
    <Stack.Screen name="Otp">{(props) => <OtpScreen {...props} onSuccess={onSuccess} />}</Stack.Screen>
    <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
    <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="SignupVerify">{(props) => <SignupVerifyScreen {...props} onSuccess={onSuccess} />}</Stack.Screen>
    <Stack.Screen name="TenantSuspended" component={TenantSuspendedScreen} />
  </Stack.Navigator>
);
