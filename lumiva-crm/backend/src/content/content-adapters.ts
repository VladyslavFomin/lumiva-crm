/**
 * Адаптеры сетей для движка публикаций. Движок один (ContentPublisherService), адаптер знает только
 * свою сеть: что она умеет, проверку поста до публикации, публикацию и метрики поста.
 * Учётные данные адаптер получает готовыми (ContentService.credentialsFor) — сам их не ищет.
 */
import axios from 'axios';
import { readFile } from 'fs/promises';
import { joinUploadsAbsolute } from '../common/uploads-root.util';

export type Network = 'instagram' | 'facebook' | 'telegram' | 'linkedin' | 'vk' | 'threads' | 'youtube' | 'tiktok';
export const NETWORKS: Network[] = ['instagram', 'facebook', 'telegram', 'linkedin', 'vk', 'threads', 'youtube', 'tiktok'];
export type PostFormat = 'post' | 'carousel' | 'story' | 'reel' | 'article';

export type MediaItem = { url: string; kind: 'image' | 'video'; approved?: boolean | null; size?: number; note?: string };

export type PublishInput = {
  text: string;
  media: MediaItem[];
  format: PostFormat;
};

export type Credentials =
  | { network: 'instagram'; igUserId: string; pageToken: string }
  | { network: 'facebook'; pageId: string; pageToken: string }
  | { network: 'telegram'; botToken: string; chatId: string; username: string | null }
  | { network: 'linkedin'; accessToken: string; authorUrn: string }
  | { network: 'vk'; accessToken: string; groupId: string }
  | { network: 'threads'; accessToken: string; userId: string }
  | { network: 'youtube'; accessToken: string; channelId: string }
  | { network: 'tiktok'; accessToken: string; openId: string; username: string | null };

export type PublishResult = { externalId: string; url: string | null };
export type Metrics = Record<string, number>;

export type Caps = {
  maxText: number;
  maxImages: number;
  /** публикация без картинки невозможна (Instagram) */
  requiresMedia: boolean;
  formats: PostFormat[];
  /** реализован ли адаптер в этой версии */
  ready: boolean;
  /** принимает ли видео (пост с видео = ровно одно видео) и до какого размера, МБ */
  video?: boolean;
  maxVideoMb?: number;
  /** только видео (YouTube, TikTok) */
  videoOnly?: boolean;
};

export interface NetworkAdapter {
  network: Network;
  caps: Caps;
  validate(input: PublishInput): string | null;
  publish(input: PublishInput, creds: Credentials): Promise<PublishResult>;
  metrics?(externalId: string, creds: Credentials): Promise<Metrics | null>;
}

export const GRAPH = 'https://graph.facebook.com/v23.0';
/** Base URL Bot API; override only for local test stands (mock server). */
export const TG_API = process.env.CONTENT_TG_API || 'https://api.telegram.org';
const LINKEDIN_VERSION = () => process.env.LINKEDIN_API_VERSION || '202509';

const errText = (e: any): string => {
  const d = e?.response?.data;
  return String(
    d?.error?.error_user_msg || d?.error?.message || d?.description || d?.message || (typeof d === 'string' ? d : '') || e?.message || 'request failed',
  ).slice(0, 500);
};

const baseValidate = (caps: Caps, input: PublishInput): string | null => {
  if (!caps.ready) return 'this network is not available yet';
  if (!caps.formats.includes(input.format)) return `format "${input.format}" is not supported here`;
  if (!input.text.trim() && !input.media.length) return 'empty post';
  if (input.text.length > caps.maxText) return `text is longer than ${caps.maxText} characters`;
  const videos = input.media.filter((m) => m.kind === 'video');
  if (caps.videoOnly && (videos.length !== 1 || input.media.length !== 1)) return 'needs exactly one video';
  if (videos.length) {
    if (!caps.video) return 'video is not supported here';
    if (videos.length > 1 || input.media.length > 1) return 'a video post has exactly one video and no images';
    if (caps.maxVideoMb && videos[0].size && videos[0].size > caps.maxVideoMb * 1024 * 1024) return `video is larger than ${caps.maxVideoMb} MB`;
  }
  if (input.format === 'reel' && !videos.length) return 'a reel needs a video';
  if (input.format === 'story' && input.media.length !== 1) return 'a story needs exactly one image or video';
  if (caps.requiresMedia && !input.media.length) return 'needs at least one image or video';
  if (input.media.length > caps.maxImages) return `at most ${caps.maxImages} images`;
  if (input.format === 'carousel' && input.media.length < 2) return 'a carousel needs 2+ images';
  return null;
};

const isVideo = (input: PublishInput) => input.media.length === 1 && input.media[0].kind === 'video';

/** Байты файла поста: свой файл читаем с диска (видео до сотен МБ не гоняем через HTTP), чужой — скачиваем. */
export async function mediaBytes(m: MediaItem): Promise<Buffer> {
  const base = `${(process.env.PUBLIC_API_URL || 'https://crm.lumiva.agency').replace(/\/$/, '')}/v1/uploads/`;
  if (m.url.startsWith(base)) {
    const rel = decodeURIComponent(m.url.slice(base.length));
    if (!rel.includes('..')) {
      try {
        return await readFile(joinUploadsAbsolute(rel));
      } catch {
        // нет на диске — скачаем по ссылке
      }
    }
  }
  const r = await axios.get(m.url, { responseType: 'arraybuffer', timeout: 300_000, maxContentLength: Infinity });
  return Buffer.from(r.data);
}

// ───────────────────────── Instagram (Graph API, бизнес/автор) ─────────────────────────

async function igWaitReady(containerId: string, token: string, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const r = await axios.get(`${GRAPH}/${containerId}`, { params: { fields: 'status_code,status', access_token: token }, timeout: 20_000 });
    const st = r.data?.status_code;
    if (st === 'FINISHED') return;
    if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Instagram could not process the media: ${r.data?.status || st}`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Instagram is still processing the media — try again later');
}

export const instagramAdapter: NetworkAdapter = {
  network: 'instagram',
  caps: { maxText: 2200, maxImages: 10, requiresMedia: true, formats: ['post', 'carousel', 'reel', 'story'], ready: true, video: true, maxVideoMb: 300 },
  validate(input) {
    const base = baseValidate(this.caps, input);
    if (base) return base;
    if ((input.text.match(/#[^\s#]+/g) || []).length > 30) return 'Instagram allows at most 30 hashtags';
    return null;
  },
  async publish(input, creds) {
    if (creds.network !== 'instagram') throw new Error('wrong credentials');
    const { igUserId, pageToken: token } = creds;
    try {
      let creationId: string;
      let tries = 20;
      if (input.format === 'story') {
        // сторис: без подписи (Instagram её не показывает), фото или видео
        const m = input.media[0];
        const r = await axios.post(`${GRAPH}/${igUserId}/media`, null, {
          params: { media_type: 'STORIES', ...(m.kind === 'video' ? { video_url: m.url } : { image_url: m.url }), access_token: token },
          timeout: 60_000,
        });
        creationId = r.data.id;
        if (m.kind === 'video') tries = 60;
      } else if (isVideo(input)) {
        // любое видео в ленте Instagram теперь Reels
        const r = await axios.post(`${GRAPH}/${igUserId}/media`, null, {
          params: { media_type: 'REELS', video_url: input.media[0].url, caption: input.text, share_to_feed: true, access_token: token },
          timeout: 60_000,
        });
        creationId = r.data.id;
        tries = 60;
      } else if (input.media.length === 1) {
        const r = await axios.post(`${GRAPH}/${igUserId}/media`, null, { params: { image_url: input.media[0].url, caption: input.text, access_token: token }, timeout: 60_000 });
        creationId = r.data.id;
      } else {
        const children: string[] = [];
        for (const m of input.media) {
          const r = await axios.post(`${GRAPH}/${igUserId}/media`, null, { params: { image_url: m.url, is_carousel_item: true, access_token: token }, timeout: 60_000 });
          await igWaitReady(r.data.id, token);
          children.push(r.data.id);
        }
        const r = await axios.post(`${GRAPH}/${igUserId}/media`, null, { params: { media_type: 'CAROUSEL', children: children.join(','), caption: input.text, access_token: token }, timeout: 60_000 });
        creationId = r.data.id;
      }
      await igWaitReady(creationId, token, tries);
      const pub = await axios.post(`${GRAPH}/${igUserId}/media_publish`, null, { params: { creation_id: creationId, access_token: token }, timeout: 60_000 });
      const mediaId = String(pub.data.id);
      let url: string | null = null;
      try {
        const p = await axios.get(`${GRAPH}/${mediaId}`, { params: { fields: 'permalink', access_token: token }, timeout: 20_000 });
        url = p.data?.permalink ?? null;
      } catch {
        url = null;
      }
      return { externalId: mediaId, url };
    } catch (e) {
      throw new Error(`Instagram: ${errText(e)}`);
    }
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'instagram') return null;
    try {
      const r = await axios.get(`${GRAPH}/${externalId}/insights`, {
        params: { metric: 'reach,likes,comments,saved,shares,total_interactions', access_token: creds.pageToken },
        timeout: 20_000,
      });
      const out: Metrics = {};
      for (const m of r.data?.data || []) out[m.name] = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0);
      return out;
    } catch {
      return null;
    }
  },
};

// ───────────────────────── Facebook Page ─────────────────────────

export const facebookAdapter: NetworkAdapter = {
  network: 'facebook',
  caps: { maxText: 60_000, maxImages: 10, requiresMedia: false, formats: ['post', 'carousel'], ready: true, video: true, maxVideoMb: 1000 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'facebook') throw new Error('wrong credentials');
    const { pageId, pageToken: token } = creds;
    try {
      let postId: string;
      if (isVideo(input)) {
        // Facebook сам скачивает видео по публичной ссылке
        const r = await axios.post(`${GRAPH}/${pageId}/videos`, null, { params: { file_url: input.media[0].url, description: input.text, access_token: token }, timeout: 120_000 });
        postId = `${pageId}_${r.data.id}`;
      } else if (!input.media.length) {
        const r = await axios.post(`${GRAPH}/${pageId}/feed`, null, { params: { message: input.text, access_token: token }, timeout: 60_000 });
        postId = r.data.id;
      } else if (input.media.length === 1) {
        const r = await axios.post(`${GRAPH}/${pageId}/photos`, null, { params: { url: input.media[0].url, caption: input.text, access_token: token }, timeout: 60_000 });
        postId = r.data.post_id || r.data.id;
      } else {
        const ids: string[] = [];
        for (const m of input.media) {
          const r = await axios.post(`${GRAPH}/${pageId}/photos`, null, { params: { url: m.url, published: false, access_token: token }, timeout: 60_000 });
          ids.push(r.data.id);
        }
        const r = await axios.post(
          `${GRAPH}/${pageId}/feed`,
          { message: input.text, attached_media: ids.map((id) => ({ media_fbid: id })) },
          { params: { access_token: token }, timeout: 60_000 },
        );
        postId = r.data.id;
      }
      let url: string | null = null;
      try {
        const p = await axios.get(`${GRAPH}/${postId}`, { params: { fields: 'permalink_url', access_token: token }, timeout: 20_000 });
        url = p.data?.permalink_url ?? null;
      } catch {
        url = `https://www.facebook.com/${postId}`;
      }
      return { externalId: String(postId), url };
    } catch (e) {
      throw new Error(`Facebook: ${errText(e)}`);
    }
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'facebook') return null;
    try {
      const r = await axios.get(`${GRAPH}/${externalId}`, {
        params: { fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares', access_token: creds.pageToken },
        timeout: 20_000,
      });
      const out: Metrics = {
        likes: Number(r.data?.reactions?.summary?.total_count ?? 0),
        comments: Number(r.data?.comments?.summary?.total_count ?? 0),
        shares: Number(r.data?.shares?.count ?? 0),
      };
      try {
        const ins = await axios.get(`${GRAPH}/${externalId}/insights`, { params: { metric: 'post_impressions_unique', access_token: creds.pageToken }, timeout: 20_000 });
        const v = ins.data?.data?.[0]?.values?.[0]?.value;
        if (v != null) out.reach = Number(v);
      } catch {
        // охват страницы доступен не всегда (мало подписчиков / нет read_insights)
      }
      return out;
    } catch {
      return null;
    }
  },
};

// ───────────────────────── Telegram-канал ─────────────────────────

export const telegramAdapter: NetworkAdapter = {
  network: 'telegram',
  // по ссылке Bot API берёт файлы до 20 МБ
  caps: { maxText: 4096, maxImages: 10, requiresMedia: false, formats: ['post', 'carousel'], ready: true, video: true, maxVideoMb: 20 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'telegram') throw new Error('wrong credentials');
    const api = `${TG_API}/bot${creds.botToken}`;
    const linkOf = (id: number | undefined) => (creds.username && id ? `https://t.me/${creds.username}/${id}` : null);
    try {
      const longCaption = input.text.length > 1024;
      let firstId: number | undefined;
      if (!input.media.length) {
        const r = await axios.post(`${api}/sendMessage`, { chat_id: creds.chatId, text: input.text }, { timeout: 30_000 });
        firstId = r.data?.result?.message_id;
      } else if (isVideo(input)) {
        const r = await axios.post(`${api}/sendVideo`, { chat_id: creds.chatId, video: input.media[0].url, caption: longCaption ? undefined : input.text, supports_streaming: true }, { timeout: 120_000 });
        firstId = r.data?.result?.message_id;
      } else if (input.media.length === 1) {
        const r = await axios.post(`${api}/sendPhoto`, { chat_id: creds.chatId, photo: input.media[0].url, caption: longCaption ? undefined : input.text }, { timeout: 60_000 });
        firstId = r.data?.result?.message_id;
      } else {
        const r = await axios.post(
          `${api}/sendMediaGroup`,
          { chat_id: creds.chatId, media: input.media.map((m, i) => ({ type: 'photo', media: m.url, ...(i === 0 && !longCaption ? { caption: input.text } : {}) })) },
          { timeout: 90_000 },
        );
        firstId = r.data?.result?.[0]?.message_id;
      }
      // подпись к фото в Telegram — до 1024 символов: длинный текст уходит отдельным сообщением
      if (input.media.length && longCaption) {
        const r = await axios.post(`${api}/sendMessage`, { chat_id: creds.chatId, text: input.text }, { timeout: 30_000 });
        firstId = firstId ?? r.data?.result?.message_id;
      }
      return { externalId: String(firstId ?? ''), url: linkOf(firstId) };
    } catch (e) {
      throw new Error(`Telegram: ${errText(e)}`);
    }
  },
};

// ───────────────────────── LinkedIn (профиль или страница компании) ─────────────────────────

/** Текст поста LinkedIn — «little text format»: служебные символы экранируются. */
const liEscape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);

async function liUploadImage(url: string, creds: Extract<Credentials, { network: 'linkedin' }>): Promise<string> {
  const headers = { Authorization: `Bearer ${creds.accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION(), 'X-Restli-Protocol-Version': '2.0.0' };
  const init = await axios.post(
    'https://api.linkedin.com/rest/images?action=initializeUpload',
    { initializeUploadRequest: { owner: creds.authorUrn } },
    { headers, timeout: 30_000 },
  );
  const uploadUrl: string = init.data?.value?.uploadUrl;
  const imageUrn: string = init.data?.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn did not return an upload URL');
  const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
  await axios.put(uploadUrl, img.data, { headers: { Authorization: `Bearer ${creds.accessToken}` }, timeout: 120_000, maxBodyLength: Infinity });
  return imageUrn;
}

/** Видео LinkedIn: initializeUpload → PUT частями (по инструкциям) → finalizeUpload с etag'ами частей. */
async function liUploadVideo(m: MediaItem, creds: Extract<Credentials, { network: 'linkedin' }>): Promise<string> {
  const headers = { Authorization: `Bearer ${creds.accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION(), 'X-Restli-Protocol-Version': '2.0.0' };
  const buf = await mediaBytes(m);
  const init = await axios.post(
    'https://api.linkedin.com/rest/videos?action=initializeUpload',
    { initializeUploadRequest: { owner: creds.authorUrn, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } },
    { headers, timeout: 30_000 },
  );
  const v = init.data?.value || {};
  const parts: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> = v.uploadInstructions || [];
  if (!v.video || !parts.length) throw new Error('LinkedIn did not return upload instructions');
  const etags: string[] = [];
  for (const part of parts) {
    const r = await axios.put(part.uploadUrl, buf.subarray(part.firstByte, part.lastByte + 1), {
      headers: { 'Content-Type': 'application/octet-stream' },
      timeout: 300_000,
      maxBodyLength: Infinity,
    });
    etags.push(String(r.headers?.etag || ''));
  }
  await axios.post(
    'https://api.linkedin.com/rest/videos?action=finalizeUpload',
    { finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || '', uploadedPartIds: etags } },
    { headers, timeout: 60_000 },
  );
  return v.video;
}

export const linkedinAdapter: NetworkAdapter = {
  network: 'linkedin',
  caps: { maxText: 3000, maxImages: 9, requiresMedia: false, formats: ['post', 'carousel'], ready: true, video: true, maxVideoMb: 500 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'linkedin') throw new Error('wrong credentials');
    const headers = {
      Authorization: `Bearer ${creds.accessToken}`,
      'LinkedIn-Version': LINKEDIN_VERSION(),
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
    try {
      const images: string[] = [];
      let video: string | null = null;
      if (isVideo(input)) video = await liUploadVideo(input.media[0], creds);
      else for (const m of input.media) images.push(await liUploadImage(m.url, creds));
      const body: Record<string, unknown> = {
        author: creds.authorUrn,
        commentary: liEscape(input.text),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };
      if (video) body.content = { media: { id: video, title: input.text.split('\n')[0].slice(0, 200) } };
      if (images.length === 1) body.content = { media: { id: images[0] } };
      if (images.length > 1) body.content = { multiImage: { images: images.map((id) => ({ id })) } };
      const r = await axios.post('https://api.linkedin.com/rest/posts', body, { headers, timeout: 60_000 });
      const urn = String(r.headers?.['x-restli-id'] || r.headers?.['x-linkedin-id'] || '');
      return { externalId: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
    } catch (e) {
      throw new Error(`LinkedIn: ${errText(e)}`);
    }
  },
  async metrics(externalId, creds) {
    // статистика есть только у постов страниц компании (Community Management API)
    if (creds.network !== 'linkedin' || !creds.authorUrn.startsWith('urn:li:organization:')) return null;
    try {
      const key = externalId.startsWith('urn:li:ugcPost:') ? 'ugcPosts' : 'shares';
      const r = await axios.get('https://api.linkedin.com/rest/organizationalEntityShareStatistics', {
        params: { q: 'organizationalEntity', organizationalEntity: creds.authorUrn, [`${key}[0]`]: externalId },
        headers: { Authorization: `Bearer ${creds.accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION(), 'X-Restli-Protocol-Version': '2.0.0' },
        timeout: 20_000,
      });
      const s = r.data?.elements?.[0]?.totalShareStatistics;
      if (!s) return null;
      return { impressions: Number(s.impressionCount || 0), reach: Number(s.uniqueImpressionsCount || 0), clicks: Number(s.clickCount || 0), likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0), shares: Number(s.shareCount || 0) };
    } catch {
      return null;
    }
  },
};

// ───────────────────────── VK (сообщество, токен VK ID) ─────────────────────────

/** Base URL VK API; override only for local test stands (mock server). */
export const VK_API = process.env.CONTENT_VK_API || 'https://api.vk.com/method';
const VK_V = '5.199';
/** Коды VK, после которых повтор не поможет: токен/доступ (переподключить) или права в сообществе. */
const VK_REAUTH = new Set([5, 27, 28]);
const VK_DENIED = new Set([7, 15, 203, 214, 219]);

/** Вызов VK API: ошибки приходят с HTTP 200 в `error`, поэтому проверяем тело, а не статус. */
export async function vkCall(method: string, params: Record<string, string>, token: string): Promise<any> {
  const body = new URLSearchParams({ ...params, access_token: token, v: VK_V });
  const r = await axios.post(`${VK_API}/${method}`, body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30_000 });
  const err = r.data?.error;
  if (err) {
    const code = Number(err.error_code);
    const msg = String(err.error_msg || 'error').slice(0, 300);
    if (VK_REAUTH.has(code)) throw new Error(`VK: reconnect VK in Channels — ${msg} (#${code})`);
    if (VK_DENIED.has(code)) throw new Error(`VK: no permission to post in this community — ${msg} (#${code})`);
    throw new Error(`VK: ${msg} (#${code})`);
  }
  return r.data?.response;
}

async function vkUploadPhoto(groupId: string, url: string, token: string): Promise<string> {
  const srv = await vkCall('photos.getWallUploadServer', { group_id: groupId }, token);
  const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
  const type = String(img.headers['content-type'] || 'image/jpeg');
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const fd = new FormData();
  fd.append('photo', new Blob([img.data], { type }), `photo.${ext}`);
  const up = await fetch(srv.upload_url, { method: 'POST', body: fd }).then((x) => x.json() as Promise<any>);
  if (!up?.photo || up.photo === '[]') throw new Error('VK: the image was not accepted');
  const saved = await vkCall('photos.saveWallPhoto', { group_id: groupId, photo: String(up.photo), server: String(up.server), hash: String(up.hash) }, token);
  const ph = Array.isArray(saved) ? saved[0] : saved;
  return `photo${ph.owner_id}_${ph.id}`;
}

/** Видео в сообщество: video.save → загрузка файла на выданный адрес → вложение video{owner}_{id}. */
async function vkUploadVideo(groupId: string, m: MediaItem, text: string, token: string): Promise<string> {
  const srv = await vkCall('video.save', { group_id: groupId, name: (text.split('\n')[0] || 'Video').slice(0, 120), wallpost: '0' }, token);
  const buf = await mediaBytes(m);
  const fd = new FormData();
  fd.append('video_file', new Blob([new Uint8Array(buf)], { type: 'video/mp4' }), 'video.mp4');
  const up = await fetch(srv.upload_url, { method: 'POST', body: fd }).then((x) => x.json() as Promise<any>);
  if (up?.error) throw new Error(`VK: video upload failed — ${up.error}`);
  const owner = srv.owner_id ?? `-${groupId}`;
  const id = up?.video_id ?? srv.video_id;
  if (!id) throw new Error('VK: video id is missing');
  return `video${owner}_${id}`;
}

export const vkAdapter: NetworkAdapter = {
  network: 'vk',
  caps: { maxText: 15_000, maxImages: 10, requiresMedia: false, formats: ['post', 'carousel'], ready: true, video: true, maxVideoMb: 1000 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'vk') throw new Error('wrong credentials');
    const attachments: string[] = [];
    if (isVideo(input)) attachments.push(await vkUploadVideo(creds.groupId, input.media[0], input.text, creds.accessToken));
    else for (const m of input.media) attachments.push(await vkUploadPhoto(creds.groupId, m.url, creds.accessToken));
    const r = await vkCall(
      'wall.post',
      { owner_id: `-${creds.groupId}`, from_group: '1', message: input.text, ...(attachments.length ? { attachments: attachments.join(',') } : {}) },
      creds.accessToken,
    );
    const postId = r?.post_id;
    if (!postId) throw new Error('VK: no post id in the response');
    return { externalId: `-${creds.groupId}_${postId}`, url: `https://vk.com/wall-${creds.groupId}_${postId}` };
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'vk') return null;
    const r = await vkCall('wall.getById', { posts: externalId }, creds.accessToken);
    const it = Array.isArray(r) ? r[0] : r?.items?.[0];
    if (!it) return null;
    // VK отдаёт просмотры (не уникальный охват) — их и считаем «охватом»
    return {
      reach: Number(it.views?.count || 0),
      likes: Number(it.likes?.count || 0),
      comments: Number(it.comments?.count || 0),
      shares: Number(it.reposts?.count || 0),
    };
  },
};

// ───────────────────────── Threads (Meta, отдельное приложение Threads) ─────────────────────────

/** Base URL Threads Graph API; override only for local test stands (mock server). */
export const THREADS_API = (process.env.CONTENT_THREADS_API || 'https://graph.threads.net').replace(/\/$/, '');

async function threadsWait(id: string, token: string, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const r = await axios.get(`${THREADS_API}/v1.0/${id}`, { params: { fields: 'status,error_message', access_token: token }, timeout: 20_000 });
    const st = r.data?.status;
    if (st === 'FINISHED' || st === 'PUBLISHED' || !st) return;
    if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Threads could not process the media: ${r.data?.error_message || st}`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Threads is still processing the media — try again later');
}

export const threadsAdapter: NetworkAdapter = {
  network: 'threads',
  caps: { maxText: 500, maxImages: 20, requiresMedia: false, formats: ['post', 'carousel'], ready: true, video: true, maxVideoMb: 1000 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'threads') throw new Error('wrong credentials');
    const base = `${THREADS_API}/v1.0/${creds.userId}`;
    const tok = creds.accessToken;
    try {
      let creationId: string;
      if (input.media.length > 1) {
        const children: string[] = [];
        for (const m of input.media) {
          const c = await axios.post(`${base}/threads`, null, { params: { media_type: 'IMAGE', image_url: m.url, is_carousel_item: true, access_token: tok }, timeout: 30_000 });
          children.push(c.data.id);
        }
        for (const id of children) await threadsWait(id, tok);
        const c = await axios.post(`${base}/threads`, null, { params: { media_type: 'CAROUSEL', children: children.join(','), text: input.text, access_token: tok }, timeout: 30_000 });
        creationId = c.data.id;
      } else if (isVideo(input)) {
        const c = await axios.post(`${base}/threads`, null, { params: { media_type: 'VIDEO', video_url: input.media[0].url, text: input.text, access_token: tok }, timeout: 30_000 });
        creationId = c.data.id;
      } else if (input.media.length === 1) {
        const c = await axios.post(`${base}/threads`, null, { params: { media_type: 'IMAGE', image_url: input.media[0].url, text: input.text, access_token: tok }, timeout: 30_000 });
        creationId = c.data.id;
      } else {
        const c = await axios.post(`${base}/threads`, null, { params: { media_type: 'TEXT', text: input.text, access_token: tok }, timeout: 30_000 });
        creationId = c.data.id;
      }
      await threadsWait(creationId, tok, isVideo(input) ? 80 : 20);
      const pub = await axios.post(`${base}/threads_publish`, null, { params: { creation_id: creationId, access_token: tok }, timeout: 30_000 });
      const id = String(pub.data?.id || '');
      let url: string | null = null;
      try {
        const pl = await axios.get(`${THREADS_API}/v1.0/${id}`, { params: { fields: 'permalink', access_token: tok }, timeout: 15_000 });
        url = pl.data?.permalink || null;
      } catch {
        // ссылка не критична
      }
      return { externalId: id, url };
    } catch (e: any) {
      throw new Error(`Threads: ${errText(e)}`);
    }
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'threads') return null;
    const r = await axios.get(`${THREADS_API}/v1.0/${externalId}/insights`, { params: { metric: 'views,likes,replies,reposts,quotes', access_token: creds.accessToken }, timeout: 20_000 });
    const v = (name: string) => Number(((r.data?.data as any[]) || []).find((x) => x.name === name)?.values?.[0]?.value ?? 0);
    // Threads даёт просмотры (не уникальный охват) — как у VK, считаем их «охватом»
    return { reach: v('views'), likes: v('likes'), comments: v('replies'), shares: v('reposts') + v('quotes') };
  },
};

// ───────────────────────── YouTube (Shorts и обычные видео) ─────────────────────────

export const YT_API = (process.env.CONTENT_YT_API || 'https://www.googleapis.com').replace(/\/$/, '');

const ytErr = (e: any) => {
  const d = e?.response?.data?.error;
  const reason = d?.errors?.[0]?.reason || '';
  if (e?.response?.status === 401) return 'YouTube: reconnect YouTube in Channels — access expired';
  if (reason === 'quotaExceeded') return 'YouTube: daily API quota is exhausted — try tomorrow';
  if (reason === 'uploadLimitExceeded') return 'YouTube: the channel reached its upload limit';
  return `YouTube: ${d?.message || errText(e)}`;
};

export const youtubeAdapter: NetworkAdapter = {
  network: 'youtube',
  // текст поста — описание, первая строка — заголовок (≤ 100); «Reels» = Shorts (вертикальное ≤ 3 мин)
  caps: { maxText: 5000, maxImages: 1, requiresMedia: true, formats: ['post', 'reel'], ready: true, video: true, videoOnly: true, maxVideoMb: 2000 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'youtube') throw new Error('wrong credentials');
    const buf = await mediaBytes(input.media[0]);
    let title = (input.text.split('\n').find((l) => l.trim()) || 'Video').trim().slice(0, 100);
    if (input.format === 'reel' && !/#shorts/i.test(title) && title.length <= 92) title = `${title} #Shorts`;
    try {
      const init = await axios.post(
        `${YT_API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
        { snippet: { title, description: input.text.slice(0, 5000), categoryId: '22' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } },
        {
          headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(buf.length), 'X-Upload-Content-Type': 'video/*' },
          timeout: 60_000,
        },
      );
      const loc = init.headers?.location;
      if (!loc) throw new Error('no upload location');
      const up = await axios.put(loc, buf, { headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'video/*' }, timeout: 1_800_000, maxBodyLength: Infinity });
      const id = String(up.data?.id || '');
      if (!id) throw new Error('no video id');
      return { externalId: id, url: input.format === 'reel' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}` };
    } catch (e: any) {
      throw new Error(e?.response ? ytErr(e) : `YouTube: ${e.message}`);
    }
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'youtube') return null;
    const r = await axios.get(`${YT_API}/youtube/v3/videos`, { params: { part: 'statistics', id: externalId }, headers: { Authorization: `Bearer ${creds.accessToken}` }, timeout: 20_000 });
    const st = r.data?.items?.[0]?.statistics;
    if (!st) return null;
    // YouTube отдаёт просмотры — считаем их «охватом», как у VK/Threads
    return { reach: Number(st.viewCount || 0), likes: Number(st.likeCount || 0), comments: Number(st.commentCount || 0) };
  },
};

// ───────────────────────── TikTok (Content Posting API) ─────────────────────────

export const TIKTOK_API = (process.env.CONTENT_TIKTOK_API || 'https://open.tiktokapis.com').replace(/\/$/, '');
const TT_CHUNK = 10 * 1024 * 1024;

async function ttCall(path: string, token: string, body: unknown): Promise<any> {
  const r = await axios.post(`${TIKTOK_API}${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    timeout: 60_000,
    validateStatus: () => true,
  });
  const err = r.data?.error;
  if (r.status === 401 || err?.code === 'access_token_invalid') throw new Error('TikTok: reconnect TikTok in Channels — access expired');
  if (err && err.code && err.code !== 'ok') {
    if (/scope|permission|unaudited|privacy/i.test(`${err.code} ${err.message}`)) throw new Error(`TikTok: no permission — ${err.message || err.code}`);
    throw new Error(`TikTok: ${err.message || err.code}`);
  }
  if (r.status >= 400) throw new Error(`TikTok: HTTP ${r.status}`);
  return r.data?.data;
}

export const tiktokAdapter: NetworkAdapter = {
  network: 'tiktok',
  caps: { maxText: 2200, maxImages: 1, requiresMedia: true, formats: ['post', 'reel'], ready: true, video: true, videoOnly: true, maxVideoMb: 1000 },
  validate(input) {
    return baseValidate(this.caps, input);
  },
  async publish(input, creds) {
    if (creds.network !== 'tiktok') throw new Error('wrong credentials');
    const tok = creds.accessToken;
    // TikTok требует перед публикацией узнать, какие уровни доступа доступны автору; неаудированное приложение — только «Только я»
    const info = await ttCall('/v2/post/publish/creator_info/query/', tok, {});
    const opts: string[] = info?.privacy_level_options || [];
    const privacy = opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0] || 'SELF_ONLY';
    const buf = await mediaBytes(input.media[0]);
    const single = buf.length <= 64 * 1024 * 1024;
    const chunk = single ? buf.length : TT_CHUNK;
    const count = single ? 1 : Math.floor(buf.length / TT_CHUNK);
    const init = await ttCall('/v2/post/publish/video/init/', tok, {
      post_info: { title: input.text.slice(0, 2200), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: 'FILE_UPLOAD', video_size: buf.length, chunk_size: chunk, total_chunk_count: count },
    });
    const publishId: string = init?.publish_id;
    if (!publishId || !init?.upload_url) throw new Error('TikTok: no upload url');
    for (let i = 0; i < count; i++) {
      const start = i * chunk;
      const end = i === count - 1 ? buf.length - 1 : start + chunk - 1; // последняя часть забирает остаток
      await axios.put(init.upload_url, buf.subarray(start, end + 1), {
        headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': String(end - start + 1) },
        timeout: 600_000,
        maxBodyLength: Infinity,
      });
    }
    for (let i = 0; i < 60; i++) {
      const st = await ttCall('/v2/post/publish/status/fetch/', tok, { publish_id: publishId });
      if (st?.status === 'PUBLISH_COMPLETE') {
        const postId = String((st.publicaly_available_post_id || st.publicly_available_post_id || [])[0] || '');
        const url = postId && creds.username ? `https://www.tiktok.com/@${creds.username}/video/${postId}` : null;
        return { externalId: postId || publishId, url };
      }
      if (st?.status === 'FAILED') throw new Error(`TikTok: ${st.fail_reason || 'publishing failed'}`);
      await new Promise((res) => setTimeout(res, 5000));
    }
    // TikTok ещё обрабатывает — пост выйдет, но ссылки пока нет
    return { externalId: publishId, url: null };
  },
  async metrics(externalId, creds) {
    if (creds.network !== 'tiktok' || !/^\d+$/.test(externalId)) return null;
    const d = await ttCall('/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count', creds.accessToken, { filters: { video_ids: [externalId] } });
    const v = d?.videos?.[0];
    if (!v) return null;
    return { reach: Number(v.view_count || 0), likes: Number(v.like_count || 0), comments: Number(v.comment_count || 0), shares: Number(v.share_count || 0) };
  },
};

export const ADAPTERS: Record<Network, NetworkAdapter> = {
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  telegram: telegramAdapter,
  linkedin: linkedinAdapter,
  vk: vkAdapter,
  threads: threadsAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
};
