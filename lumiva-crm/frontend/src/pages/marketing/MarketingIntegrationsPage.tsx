import React from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { MarketingIntegrationsPanel } from './MarketingIntegrationsPanel';

export const MarketingIntegrationsPage: React.FC = () => {
  return (
    <MainLayout>
      <MarketingIntegrationsPanel variant="standalone" />
    </MainLayout>
  );
};
