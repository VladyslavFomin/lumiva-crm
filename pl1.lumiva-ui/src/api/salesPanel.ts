// src/api/salesPanel.ts
import { apiClient, getApiErrorMessage } from "./client";

export type SalesLanguage = "en" | "ru" | "tr";
export type SalesEmailStatus = "unknown" | "found" | "not_found";
export type SalesOutreachStatus = "not_contacted" | "sent" | "replied" | "skipped";
export type SalesInvitationStatus = "sent" | "failed" | "replied";

export interface SalesProspect {
  id: string;
  placeId: string;
  name: string;
  formattedAddress: string | null;
  searchCity: string | null;
  searchBusinessType: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  emailStatus: SalesEmailStatus;
  rating: string | null;
  userRatingsTotal: number | null;
  googleMapsUrl: string | null;
  outreachStatus: SalesOutreachStatus;
  lastContactedAt: string | null;
  lastRepliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesInvitation {
  id: string;
  prospectId: string | null;
  language: SalesLanguage;
  subject: string;
  bodyHtml: string;
  toEmail: string;
  trackingToken: string;
  status: SalesInvitationStatus;
  sentAt: string | null;
  failedReason: string | null;
  repliedAt: string | null;
  replySnippet: string | null;
  replyMatchedBy: "header" | "subject-token" | "manual" | null;
  attachments: Array<{ filename: string }> | null;
  createdAt: string;
}

export interface SalesAttachmentRef {
  filename: string;
  relativePath: string;
  sizeBytes: number;
}

export interface SalesSearchUsage {
  placesTextSearchCalls: number;
  placesDetailsCalls: number;
  dailyDetailsCap: number;
}

export interface SalesSearchResult {
  prospects: SalesProspect[];
  nextPageToken: string | null;
  quotaExceeded: boolean;
  usage: SalesSearchUsage;
}

export interface SalesListResult {
  items: SalesProspect[];
  total: number;
  page: number;
  pageSize: number;
}

export type SalesTemplates = Record<SalesLanguage, { subject: string; bodyHtml: string }>;

export async function searchSalesProspects(params: {
  city: string;
  businessType: string;
  pageToken?: string;
  refresh?: boolean;
}): Promise<SalesSearchResult> {
  try {
    const res = await apiClient.get<SalesSearchResult>("/platform/sales-panel/search", {
      params: {
        city: params.city,
        businessType: params.businessType,
        pageToken: params.pageToken,
        refresh: params.refresh ? "true" : undefined,
      },
      // Google Places Details + website scraping run per business — a first-time search
      // over ~20 results legitimately takes longer than the client's default 15s timeout.
      timeout: 60000,
    });
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchSalesProspects(params?: {
  status?: SalesOutreachStatus;
  city?: string;
  businessType?: string;
  search?: string;
  hasWebsite?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<SalesListResult> {
  try {
    const res = await apiClient.get<SalesListResult>("/platform/sales-panel/prospects", {
      params: {
        ...params,
        hasWebsite: params?.hasWebsite === undefined ? undefined : String(params.hasWebsite),
        hasEmail: params?.hasEmail === undefined ? undefined : String(params.hasEmail),
        hasPhone: params?.hasPhone === undefined ? undefined : String(params.hasPhone),
      },
    });
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchSalesProspect(id: string): Promise<SalesProspect> {
  try {
    const res = await apiClient.get<SalesProspect>(`/platform/sales-panel/prospects/${id}`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchInvitationsForProspect(
  prospectId: string,
): Promise<SalesInvitation[]> {
  try {
    const res = await apiClient.get<SalesInvitation[]>(
      `/platform/sales-panel/prospects/${prospectId}/invitations`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchSalesTemplates(): Promise<SalesTemplates> {
  try {
    const res = await apiClient.get<SalesTemplates>("/platform/sales-panel/templates");
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function sendSalesInvitation(
  prospectId: string,
  language: SalesLanguage,
  overrides?: { subject?: string; bodyHtml?: string; attachments?: SalesAttachmentRef[] },
): Promise<SalesInvitation> {
  try {
    const res = await apiClient.post<SalesInvitation>(
      `/platform/sales-panel/prospects/${prospectId}/invitations`,
      { language, ...overrides },
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function sendTestInvitation(params: {
  to: string;
  language: SalesLanguage;
  subject?: string;
  bodyHtml?: string;
  attachments?: SalesAttachmentRef[];
}): Promise<SalesInvitation> {
  try {
    const res = await apiClient.post<SalesInvitation>(
      "/platform/sales-panel/test-invitation",
      params,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function updateSalesTemplate(
  language: SalesLanguage,
  data: { subject: string; bodyHtml: string },
): Promise<void> {
  try {
    await apiClient.put(`/platform/sales-panel/templates/${language}`, data);
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function uploadSalesAttachment(file: File): Promise<SalesAttachmentRef> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post<SalesAttachmentRef>(
      "/platform/sales-panel/attachments",
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 },
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function markProspectContacted(id: string): Promise<SalesProspect> {
  try {
    const res = await apiClient.patch<SalesProspect>(
      `/platform/sales-panel/prospects/${id}/mark-contacted`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function markProspectSkipped(id: string): Promise<SalesProspect> {
  try {
    const res = await apiClient.patch<SalesProspect>(
      `/platform/sales-panel/prospects/${id}/mark-skipped`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function unmarkProspectSkipped(id: string): Promise<SalesProspect> {
  try {
    const res = await apiClient.patch<SalesProspect>(
      `/platform/sales-panel/prospects/${id}/unmark-skipped`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function markInvitationReplied(invitationId: string): Promise<SalesInvitation> {
  try {
    const res = await apiClient.patch<SalesInvitation>(
      `/platform/sales-panel/invitations/${invitationId}/mark-replied`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function runReplyPollNow(): Promise<{ scanned: number; matched: number }> {
  try {
    const res = await apiClient.post<{ scanned: number; matched: number }>(
      "/platform/sales-panel/reply-poll/run",
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}
