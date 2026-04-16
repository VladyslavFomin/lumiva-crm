import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchProject, Project } from '../../api/projects';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectDetail'>;

export const ProjectDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProject(id);
        setProject(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text>Проект не найден</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{project.name}</Text>
      <Text style={styles.label}>Статус: {project.status}</Text>
      <Text style={styles.label}>Сумма: {project.amount.toLocaleString('ru-RU')} {project.currency}</Text>
      <Text style={styles.label}>Категория: {project.category || '—'}</Text>
      <Text style={styles.label}>Ответственный: {project.owner || '—'}</Text>
      <Text style={styles.label}>Создан: {project.createdAt}</Text>
      <Text style={[styles.label, { marginTop: 10 }]}>Описание:</Text>
      <Text style={styles.desc}>{project.description || '—'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 14, color: '#374151', marginBottom: 6 },
  desc: { fontSize: 14, color: '#4b5563' },
});
