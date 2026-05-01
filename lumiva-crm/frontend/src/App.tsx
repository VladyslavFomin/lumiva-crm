import React from 'react';
import { AppRouter } from './router/AppRouter';
import { AlertModalProvider } from './contexts/AlertModalContext';

export default function App() {
  return (
    <AlertModalProvider>
      <AppRouter />
    </AlertModalProvider>
  );
}