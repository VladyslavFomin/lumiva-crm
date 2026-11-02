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

/* ---------- ИИ-настройка ---------- */

export type OnboardingAiChannel = 'whatsapp' | 'instagram' | 'telegram' | 'website' | 'email' | 'phone' | 'google_reviews' | 'booking_sites';

export interface OnboardingAiPlan {
  businessKind: string;
  summary: string;
  currency: string | null;
  bookingType: 'salon' | 'restaurant' | 'fitness' | 'consultation' | 'rental' | null;
  services: Array<{ name: string; price: number | null; durationMinutes: number | null }>;
  leadFields: Array<{ label: string; type: 'text' | 'number' | 'date' | 'select' | 'boolean'; options: string[] }>;
  channels: OnboardingAiChannel[];
  allowed: { products: boolean; bookings: boolean };
}

export interface OnboardingAiApply {
  currency?: boolean;
  booking?: boolean;
  services?: number[];
  leadFields?: number[];
}

export function fetchOnboardingAiPlan(description: string, lang: string): Promise<OnboardingAiPlan> {
  return api.post<OnboardingAiPlan>('/onboarding/ai-plan', { description, lang });
}

export function applyOnboardingAiPlan(plan: OnboardingAiPlan, apply: OnboardingAiApply): Promise<Array<{ item: string; ok: boolean; error?: string }>> {
  return api.post('/onboarding/ai-apply', { plan, apply });
}
