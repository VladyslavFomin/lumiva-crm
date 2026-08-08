// src/rbac/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission.types';

export const PERMISSION_META_KEY = 'rbac_permission';

// Поддержка двух форматов:
// 1. RequirePermission('leads') - старый формат
// 2. RequirePermission('contacts', 'read') - новый формат (resource, action)
export const RequirePermission = (
  resource: PermissionKey,
  action?: 'read' | 'write' | 'delete',
) => {
  if (action) {
    // Новый формат: resource:action
    return SetMetadata(PERMISSION_META_KEY, { resource, action });
  }
  // Старый формат: просто PermissionKey
  return SetMetadata(PERMISSION_META_KEY, resource);
};