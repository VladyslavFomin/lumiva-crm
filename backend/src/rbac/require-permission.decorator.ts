// src/rbac/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission.types';

export const PERMISSION_META_KEY = 'rbac_permission';

export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSION_META_KEY, permissions);