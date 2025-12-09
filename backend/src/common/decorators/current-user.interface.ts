// src/common/decorators/current-user.interface.ts
export interface CurrentUserPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}