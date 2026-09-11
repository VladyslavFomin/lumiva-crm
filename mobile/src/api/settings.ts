import { api } from './client';

export interface MarketingTokenPreview {
  preview: string;
  suffix: string;
}

export async function fetchMarketingApiToken(): Promise<MarketingTokenPreview> {
  const res = await api.get<MarketingTokenPreview>('/api-tokens/marketing');
  return res.data;
}

export async function revealMarketingApiToken(password: string): Promise<string> {
  const res = await api.post<{ token: string }>('/api-tokens/marketing/reveal', { password });
  return res.data.token;
}

export async function regenerateMarketingApiToken(password: string): Promise<string> {
  const res = await api.post<{ token: string }>('/api-tokens/marketing/regenerate', { password });
  return res.data.token;
}
