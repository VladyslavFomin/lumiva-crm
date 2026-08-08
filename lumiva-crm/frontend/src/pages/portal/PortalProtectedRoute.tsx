// src/pages/portal/PortalProtectedRoute.tsx
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getPortalSession } from '../../portal/portalSession';

export const PortalProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { clientKey = '' } = useParams<{ clientKey: string }>();
  const session = getPortalSession();
  if (!session || session.clientKey !== clientKey) {
    return <Navigate to={`/portal/${clientKey}/login`} replace />;
  }
  return children;
};

export default PortalProtectedRoute;
