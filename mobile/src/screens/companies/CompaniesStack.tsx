import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CompaniesListScreen } from './CompaniesListScreen';
import { CompanyDetailScreen } from './CompanyDetailScreen';

export type CompaniesStackParamList = {
  CompaniesList: undefined;
  CompanyDetail: { id: string };
};

const Stack = createNativeStackNavigator<CompaniesStackParamList>();

export const CompaniesStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="CompaniesList"
      component={CompaniesListScreen}
      options={{ title: 'Компании' }}
    />
    <Stack.Screen
      name="CompanyDetail"
      component={CompanyDetailScreen}
      options={{ title: 'Детали компании' }}
    />
  </Stack.Navigator>
);








