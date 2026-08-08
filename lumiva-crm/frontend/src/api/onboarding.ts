// src/api/onboarding.ts
import { api } from './client';

export interface OnboardingStateDto {
  onboardingCompletedAt: string | null;
  sampleDataSeededAt: string | null;
  teamInvited: boolean;
}

export function fetchOnboardingState(): Promise<OnboardingStateDto> {
  return api.get<OnboardingStateDto>('/onboarding/state');
}

export function completeOnboarding(): Promise<OnboardingStateDto> {
  return api.post<OnboardingStateDto>('/onboarding/complete');
}

export function seedSampleData(): Promise<OnboardingStateDto> {
  return api.post<OnboardingStateDto>('/onboarding/sample-data');
}

export function removeSampleData(): Promise<OnboardingStateDto> {
  return api.delete<OnboardingStateDto>('/onboarding/sample-data');
}
