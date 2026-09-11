import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EsignDocumentsListScreen } from './EsignDocumentsListScreen';
import { EsignDocumentDetailScreen } from './EsignDocumentDetailScreen';
import { EsignDocumentCreateScreen } from './EsignDocumentCreateScreen';
import { EsignTemplatesScreen } from './EsignTemplatesScreen';
import { EsignTemplateFormScreen } from './EsignTemplateFormScreen';

export type EsignStackParamList = {
  EsignDocumentsList: undefined;
  EsignDocumentDetail: { id: string };
  EsignDocumentCreate: undefined;
  EsignTemplates: undefined;
  EsignTemplateForm: { id?: string };
};

const Stack = createNativeStackNavigator<EsignStackParamList>();

export const EsignStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EsignDocumentsList" component={EsignDocumentsListScreen} />
    <Stack.Screen name="EsignDocumentDetail" component={EsignDocumentDetailScreen} />
    <Stack.Screen name="EsignDocumentCreate" component={EsignDocumentCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="EsignTemplates" component={EsignTemplatesScreen} />
    <Stack.Screen name="EsignTemplateForm" component={EsignTemplateFormScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  </Stack.Navigator>
);
