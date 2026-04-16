import { apiClient, getApiErrorMessage } from "./client";

export interface PlatformSettings {
  telegramBotToken: string | null;
  telegramChatId: string | null;
  googleOauthClientId: string | null;
  googleOauthClientSecret: string | null;
  metaOauthAppId: string | null;
  metaOauthAppSecret: string | null;
  vkOauthClientId: string | null;
  vkOauthClientSecret: string | null;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  stripeWebhookSecret: string | null;
  stripePriceStandard: string | null;
  stripePriceProfessional: string | null;
  stripePriceEnterprise: string | null;
  stripePriceUltimate: string | null;
  billingPlans: BillingPlanContent[] | null;
  openAiApiKey: string | null;
  openAiBaseUrl: string | null;
  openAiModel: string | null;
  openAiImageModel: string | null;
  aiPriceInputPerMtokUsd: string | null;
  aiPriceOutputPerMtokUsd: string | null;
  aiImageCostCents: number | null;
  stripePriceAiCredits: string | null;
  stripePriceStoragePack: string | null;
  aiCreditsPackAmountCents: number | null;
  storagePackBytes: string | null;
  /** OAuth-приложения платформы для CRM-интеграций (Slack, Teams, …) */
  integrationOAuthApps: Record<
    string,
    { clientId?: string | null; clientSecret?: string | null }
  > | null;
}

export interface BillingPlanContent {
  code: "standard" | "professional" | "enterprise" | "ultimate";
  title: string;
  price: string;
  subtitle: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  i18n?: {
    en?: {
      subtitle?: string;
      description?: string;
      features?: string[];
    };
    tr?: {
      subtitle?: string;
      description?: string;
      features?: string[];
    };
  };
}

export interface BillingHealth {
  configured: boolean;
  missing: string[];
  prices: Array<{
    code: string;
    configured: boolean;
    validFormat: boolean;
    value: string;
  }>;
  hasPublishableKey: boolean;
  hasPlanContent: boolean;
  updatedAt: string | null;
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  try {
    const res = await apiClient.get<PlatformSettings>(`/platform/settings`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function updatePlatformSettings(
  payload: Partial<PlatformSettings>,
): Promise<PlatformSettings> {
  try {
    const res = await apiClient.patch<PlatformSettings>(`/platform/settings`, payload);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function sendTelegramTest(message?: string): Promise<{ ok: boolean }> {
  try {
    const res = await apiClient.post<{ ok: boolean }>(
      `/platform/settings/telegram-test`,
      message ? { message } : undefined,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function sendStripeTest(): Promise<{ ok: boolean }> {
  try {
    const res = await apiClient.post<{ ok: boolean }>(`/platform/settings/stripe-test`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchBillingHealth(): Promise<BillingHealth> {
  try {
    const res = await apiClient.get<BillingHealth>(`/platform/settings/billing-health`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}
