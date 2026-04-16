import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProjectsListScreen } from './ProjectsListScreen';
import { ProjectDetailScreen } from './ProjectDetailScreen';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { id: string };
};

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export const ProjectsStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProjectsList" component={ProjectsListScreen} options={{ title: 'Проекты' }} />
    <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Детали проекта' }} />
  </Stack.Navigator>
);
