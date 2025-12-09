// src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Используем строковые роли:
 *  'owner' | 'manager' | 'viewer' | 'finance' | 'sales' | 'developer' | 'support'
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);