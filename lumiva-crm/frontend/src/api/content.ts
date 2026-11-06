import { api } from './client';

/** Контент и публикации (/marketing/smm) — единый движок, см. md/content_engine_plan.md. */
export type Network = 'instagram' | 'facebook' | 'telegram' | 'linkedin' | 'vk' | 'threads' | 'youtube' | 'tiktok';
export type Autonomy = 'suggest' | 'assisted' | 'auto';
export type PostFormat = 'post' | 'carousel' | 'story' | 'reel' | 'article';
export type PostStatus = 'draft' | 'review' | 'changes' | 'approved' | 'scheduled' | 'published' | 'partial' | 'failed' | 'rejected';
export type VariantStatus = 'pending' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'skipped';

export type Caps = { maxText: number; maxImages: number; requiresMedia: boolean; formats: PostFormat[]; ready: boolean; video?: boolean; maxVideoMb?: number; videoOnly?: boolean };

export type ContentChannel = {
  id: string;
  network: Network;
  accountId: string;
  accountName: string;
  accountHandle: string | null;
  avatarUrl: string | null;
  autonomy: Autonomy;
  rules: { dailyLimit?: number; timezone?: string | null; hashtags?: string; signature?: string; pageId?: string; kind?: string };
  enabled: boolean;
  status: 'ok' | 'error' | string;
  lastError: string | null;
  departmentIds: string[];
  caps: Caps | null;
};

export type MediaItem = { url: string; kind: 'image' | 'video'; approved?: boolean | null; note?: string; size?: number };

export type ContentVariant = {
  id: string;
  channelId: string;
  text: string | null;
  publishAt: string | null;
  status: VariantStatus;
  externalId: string | null;
  url: string | null;
  error: string | null;
  attempts: number;
  publishedAt: string | null;
  metrics: Record<string, number> | null;
};

export type PostComment = { id: string; kind: string; text: string | null; by: string | null; at: string };

export type ContentPost = {
  id: string;
  /** A/B-тест: общий id пары и метка варианта */
  abGroup?: string | null;
  abLabel?: 'A' | 'B' | null;
  planId: string | null;
  title: string;
  rubric: string | null;
  format: PostFormat;
  text: string;
  media: MediaItem[];
  status: PostStatus;
  textApproved: boolean | null;
  source: 'manual' | 'ai_office' | 'ai_employee';
  departmentId: string | null;
  agentId: string | null;
  comments: PostComment[];
  reviewNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ContentVariant[];
};

export type ContentPlan = { id: string; title: string; periodFrom: string | null; periodTo: string | null; status: 'draft' | 'review' | 'approved'; source: string; departmentId: string | null; approvedAt: string | null; createdAt: string; posts: number };

export type VideoAccount = { id: string; accountId: string; name: string | null; avatarUrl: string | null; username: string | null; added: boolean };

export type ConnectOptions = {
  meta: { connected: boolean; error: string | null; pages: Array<{ pageId: string; name: string; picture: string | null; instagram: { id: string; username: string | null; added: boolean } | null; facebookAdded: boolean }> };
  youtube: { configured: boolean; connections: VideoAccount[] };
  tiktok: { configured: boolean; connections: VideoAccount[] };
  threads: { configured: boolean; connections: Array<{ id: string; userId: string; name: string | null; avatarUrl: string | null; expiresAt: string | null; added: boolean }> };
  vk: { configured: boolean; connections: Array<{ id: string; name: string | null; avatarUrl: string | null; groups: Array<{ id: string; name: string; screenName: string | null; photo: string | null; added: boolean }> }> };
  telegram: { bots: Array<{ id: string; username: string | null }> };
  linkedin: { configured: boolean; orgEnabled: boolean; connections: Array<{ id: string; name: string | null; avatarUrl: string | null; expiresAt: string | null; targets: Array<{ urn: string; name: string; kind: 'person' | 'organization'; added: boolean }> }> };
};

export type CanvaStatus = { configured: boolean; connected: boolean; name: string | null; connectionId: string | null };
export type CanvaDesign = { id: string; title: string | null; thumbnail: string | null; pages: number | null; updatedAt: string | null };
export type CanvaTemplate = { id: string; title: string | null; thumbnail: string | null };
export type CanvaPreset = 'square' | 'portrait' | 'story' | 'landscape';

export type Overview = {
  review: number;
  changes: number;
  drafts: number;
  ready: number;
  scheduled7: number;
  published7: number;
  failedCount: number;
  channels: { n: number; broken: number };
  upcoming: Array<{ id: string; publishAt: string; status: string; network: Network; channelName: string; postId: string; title: string; excerpt: string; thumb: string | null }>;
  failedList: Array<{ id: string; error: string | null; network: Network; channelName: string; postId: string; title: string }>;
};

export type Analytics = {
  days: number;
  totals: { posts: number; measured: number; reach: number; likes: number; comments: number; shares: number; saved: number };
  byNetwork: Record<string, { posts: number; measured: number; reach: number; engagement: number }>;
  /** Лучшие слоты «день недели (1=пн) × час» по ER; только сети с ≥ 8 измеренными постами. */
  bestTimes: Record<string, Array<{ dow: number; hour: number; er: number; n: number }>>;
  abTests: AbTest[];
  top: Array<AnalyticsRow & { engagement: number }>;
  posts: AnalyticsRow[];
};
export type AbSide = { postId: string; title: string; excerpt: string; published: number; measured: number; reach: number; engagement: number; er: number | null };
export type AbTest = { group: string; A: AbSide; B: AbSide; winner: 'A' | 'B' | null };
export type AnalyticsRow = { id: string; postId: string; url: string | null; publishedAt: string; metrics: Record<string, number> | null; network: Network; channelName: string; title: string; rubric: string | null; excerpt: string; thumb: string | null };

export type SavePostBody = {
  title?: string;
  rubric?: string | null;
  format?: PostFormat;
  text?: string;
  media?: MediaItem[];
  planId?: string | null;
  variants?: Array<{ channelId: string; text?: string | null; publishAt?: string | null }>;
};

const B = '/content';
export const contentApi = {
  overview: () => api.get<Overview>(`${B}/overview`),
  analytics: (days: number) => {
    let tz = 'UTC';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      /* старый браузер — UTC */
    }
    return api.get<Analytics>(`${B}/analytics?days=${days}&tz=${encodeURIComponent(tz)}`);
  },
  channels: () => api.get<ContentChannel[]>(`${B}/channels`),
  options: () => api.get<ConnectOptions>(`${B}/channels/options`),
  addChannel: (body: Record<string, unknown>) => api.post<ContentChannel>(`${B}/channels`, body),
  updateChannel: (id: string, body: Partial<Pick<ContentChannel, 'autonomy' | 'enabled' | 'rules' | 'departmentIds'>>) => api.patch<ContentChannel>(`${B}/channels/${id}`, body),
  removeChannel: (id: string) => api.delete<{ ok: boolean }>(`${B}/channels/${id}`),
  linkedinAuthUrl: () => api.get<{ url: string }>(`${B}/linkedin/auth-url`),
  vkAuthUrl: () => api.get<{ url: string }>(`${B}/vk/auth-url`),
  threadsAuthUrl: () => api.get<{ url: string }>(`${B}/threads/auth-url`),
  youtubeAuthUrl: () => api.get<{ url: string }>(`${B}/youtube/auth-url`),
  tiktokAuthUrl: () => api.get<{ url: string }>(`${B}/tiktok/auth-url`),
  /** Видео — частями по 8 МБ (nginx пропускает ≤ 32 МБ за запрос); onProgress 0..1 */
  uploadVideo: async (file: File, onProgress?: (p: number) => void): Promise<MediaItem> => {
    const st = await api.post<{ uploadId: string; chunkSize: number }>(`${B}/media/video/start`, { name: file.name, size: file.size });
    let i = 0;
    for (let off = 0; off < file.size; off += st.chunkSize, i++) {
      const f = new FormData();
      f.append('chunk', file.slice(off, Math.min(off + st.chunkSize, file.size)), 'chunk');
      await api.postForm(`${B}/media/video/${st.uploadId}/chunk?index=${i}`, f);
      onProgress?.(Math.min(1, (off + st.chunkSize) / file.size));
    }
    return api.post<MediaItem>(`${B}/media/video/${st.uploadId}/finish`, {});
  },
  uploadMedia: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.postForm<{ url: string; path: string }>(`${B}/media`, f);
  },
  compose: (body: { brief: string; channelIds: string[]; format?: PostFormat; withImage?: boolean; imagePrompt?: string; lang?: string }) =>
    api.post<{ title: string; text: string; variants: Record<string, string>; media: MediaItem[]; imagePrompt: string; imageError: string | null }>(`${B}/ai/compose`, body),
  image: (prompt: string, size?: string) => api.post<MediaItem & { error?: string }>(`${B}/ai/image`, { prompt, size }),
  posts: (q: { status?: string; from?: string; to?: string; channelId?: string; planId?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return api.get<ContentPost[]>(`${B}/posts${p ? `?${p}` : ''}`);
  },
  post: (id: string) => api.get<ContentPost>(`${B}/posts/${id}`),
  create: (body: SavePostBody) => api.post<ContentPost>(`${B}/posts`, body),
  update: (id: string, body: SavePostBody) => api.put<ContentPost>(`${B}/posts/${id}`, body),
  remove: (id: string) => api.delete<{ ok: boolean }>(`${B}/posts/${id}`),
  submit: (id: string) => api.post<ContentPost>(`${B}/posts/${id}/submit`, {}),
  approve: (id: string) => api.post<ContentPost>(`${B}/posts/${id}/approve`, {}),
  changes: (id: string, note: string, reject = false) => api.post<ContentPost>(`${B}/posts/${id}/changes`, { note, reject }),
  mediaReview: (id: string, index: number, approved: boolean, note?: string) => api.post<ContentPost>(`${B}/posts/${id}/media-review`, { index, approved, note }),
  comment: (id: string, text: string) => api.post<ContentPost>(`${B}/posts/${id}/comments`, { text }),
  publishNow: (id: string) => api.post<ContentPost>(`${B}/posts/${id}/publish-now`, {}),
  duplicate: (id: string) => api.post<ContentPost>(`${B}/posts/${id}/duplicate`, {}),
  abVariant: (id: string) => api.post<ContentPost>(`${B}/posts/${id}/ab`, {}),
  canvaStatus: () => api.get<CanvaStatus>(`${B}/canva/status`),
  canvaAuthUrl: () => api.get<{ url: string }>(`${B}/canva/auth-url`),
  canvaDisconnect: () => api.delete<{ ok: boolean }>(`${B}/canva/connection`),
  canvaDesigns: (query?: string, continuation?: string) =>
    api.get<{ items: CanvaDesign[]; continuation: string | null }>(`${B}/canva/designs?${new URLSearchParams({ ...(query ? { query } : {}), ...(continuation ? { continuation } : {}) }).toString()}`),
  canvaTemplates: (query?: string) => api.get<CanvaTemplate[]>(`${B}/canva/templates${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  canvaTemplateFields: (id: string) => api.get<Array<{ name: string; type: string }>>(`${B}/canva/templates/${encodeURIComponent(id)}/fields`),
  canvaImport: (postId: string, designId: string) => api.post<ContentPost>(`${B}/posts/${postId}/canva/import`, { designId }),
  canvaOpen: (postId: string, preset: CanvaPreset) => api.post<{ designId: string; editUrl: string }>(`${B}/posts/${postId}/canva/open`, { preset }),
  canvaAutofill: (postId: string, templateId: string, fields: Record<string, string>) => api.post<ContentPost>(`${B}/posts/${postId}/canva/autofill`, { templateId, fields }),
  plans: () => api.get<ContentPlan[]>(`${B}/plans`),
  createPlan: (body: { title: string; periodFrom?: string; periodTo?: string }) => api.post<ContentPlan>(`${B}/plans`, body),
  approvePlan: (id: string) => api.post<ContentPlan>(`${B}/plans/${id}/approve`, {}),
  removePlan: (id: string) => api.delete<{ ok: boolean }>(`${B}/plans/${id}`),
};
