import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProjectsListScreen } from './ProjectsListScreen';
import { ProjectDetailScreen } from './ProjectDetailScreen';
import { ProjectCreateScreen } from './ProjectCreateScreen';
import { ProjectEditScreen } from './ProjectEditScreen';
import { ProjectsAnalyticsScreen } from './ProjectsAnalyticsScreen';
import { ProjectSettingsScreen } from './ProjectSettingsScreen';
import { ProjectTaskBoardScreen } from './ProjectTaskBoardScreen';
import { ProjectsCalendarScreen } from './ProjectsCalendarScreen';
import { ProjectsBoardScreen } from './ProjectsBoardScreen';
import { OverdueScreen } from './OverdueScreen';
import { ProjectsArchiveScreen } from './ProjectsArchiveScreen';
import { AllTasksScreen } from './AllTasksScreen';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { id: string };
  ProjectCreate: undefined;
  ProjectEdit: { id: string };
  ProjectsAnalytics: undefined;
  ProjectSettings: undefined;
  ProjectTaskBoard: { id: string };
  ProjectsCalendar: undefined;
  ProjectsBoard: undefined;
  Overdue: undefined;
  ProjectsArchive: undefined;
  AllTasks: undefined;
};

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export const ProjectsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProjectsList" component={ProjectsListScreen} />
    <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    <Stack.Screen name="ProjectCreate" component={ProjectCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ProjectEdit" component={ProjectEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ProjectsAnalytics" component={ProjectsAnalyticsScreen} />
    <Stack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
    <Stack.Screen name="ProjectTaskBoard" component={ProjectTaskBoardScreen} />
    <Stack.Screen name="ProjectsCalendar" component={ProjectsCalendarScreen} />
    <Stack.Screen name="ProjectsBoard" component={ProjectsBoardScreen} />
    <Stack.Screen name="Overdue" component={OverdueScreen} />
    <Stack.Screen name="ProjectsArchive" component={ProjectsArchiveScreen} />
    <Stack.Screen name="AllTasks" component={AllTasksScreen} />
  </Stack.Navigator>
);
