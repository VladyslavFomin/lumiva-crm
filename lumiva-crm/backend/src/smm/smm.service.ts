// src/smm/smm.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { SmmProfile, SmmPlatform } from './smm-profile.entity';
import { SmmProfileStat } from './smm-profile-stat.entity';
import { SmmIntegration } from './smm-integration.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface ImportSmmStatItem {
  platform: SmmPlatform;
  handle: string;
  url?: string;

  // YYYY-MM-DD (UTC)
  date: string;

  followers?: number;
  following?: number;
  posts?: number;

  impressions?: number;
  reach?: number;
  profileViews?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  videoViews?: number;

  extra?: Record<string, any>;
}

@Injectable()
export class SmmService {
  constructor(
    @InjectRepository(SmmProfile)
    private readonly profilesRepo: Repository<SmmProfile>,
    @InjectRepository(SmmProfileStat)
    private readonly statsRepo: Repository<SmmProfileStat>,
    @InjectRepository(SmmIntegration)
    private readonly integrationsRepo: Repository<SmmIntegration>,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private signState(payload: Record<string, unknown>) {
    const secret = process.env.JWT_SECRET!;
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(raw).digest('base64url');
    return `${raw}.${sig}`;
  }

  private verifyState(state?: string | null): { tenantId?: string; redirect?: string } | null {
    if (!state) return null;
    const [raw, sig] = state.split('.');
    if (!raw || !sig) return null;
    const secret = process.env.JWT_SECRET!;
    const expected = createHmac('sha256', secret).update(raw).digest('base64url');
    if (expected !== sig) return null;
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
      return parsed;
    } catch {
      return null;
    }
  }

  private metaRedirectUri() {
    return (
      process.env.META_OAUTH_REDIRECT_URI ||
      'https://crm.lumiva.agency/v1/smm/meta/callback'
    );
  }

  private vkRedirectUri() {
    return (
      process.env.VK_OAUTH_REDIRECT_URI ||
      'https://crm.lumiva.agency/v1/smm/vk/callback'
    );
  }

  async getMetaAuthUrl(tenantId: string, redirect?: string) {
    const { appId } = await this.platformSettings.getMetaOAuthConfig();
    if (!appId) {
      throw new Error('Meta OAuth appId is not configured');
    }
    const state = this.signState({
      tenantId,
      redirect: redirect || '/app/marketing/smm',
      ts: Date.now(),
    });
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.metaRedirectUri(),
      response_type: 'code',
      state,
      scope: [
        'business_management',
        'pages_show_list',
        'pages_read_engagement',
        'read_insights',
        'instagram_basic',
        'instagram_manage_insights',
      ].join(','),
    });
    return { url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}` };
  }

  async handleMetaCallback(code?: string, state?: string) {
    const parsed = this.verifyState(state);
    if (!parsed?.tenantId || !code) {
      return this.safeRedirect('/app/marketing/smm?meta=invalid_state');
    }
    const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
    if (!appId || !appSecret) {
      return this.safeRedirect('/app/marketing/smm?meta=missing_oauth');
    }

    const redirectUri = this.metaRedirectUri();
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }).toString()}`,
    );

    if (!tokenRes.ok) {
      return this.safeRedirect('/app/marketing/smm?meta=oauth_error');
    }

    const tokenJson = await tokenRes.json();
    const shortToken = tokenJson?.access_token as string | undefined;
    if (!shortToken) {
      return this.safeRedirect('/app/marketing/smm?meta=oauth_error');
    }

    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      }).toString()}`,
    );

    if (!longRes.ok) {
      return this.safeRedirect('/app/marketing/smm?meta=oauth_error');
    }

    const longJson = await longRes.json();
    const accessToken = longJson?.access_token as string | undefined;
    const expiresIn = Number(longJson?.expires_in || 0);
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    let integration = await this.integrationsRepo.findOne({
      where: { tenantId: parsed.tenantId, provider: 'meta' },
    });

    if (!integration) {
      integration = this.integrationsRepo.create({
        tenantId: parsed.tenantId,
        provider: 'meta',
        accessToken: accessToken || null,
        expiresAt,
        meta: {},
      });
    } else {
      integration.accessToken = accessToken || null;
      integration.expiresAt = expiresAt;
    }

    await this.integrationsRepo.save(integration);
    const redirectUrl = parsed.redirect || '/app/marketing/smm';
    return this.safeRedirect(`${redirectUrl}?meta=connected`);
  }

  private async getMetaIntegration(tenantId: string) {
    return this.integrationsRepo.findOne({ where: { tenantId, provider: 'meta' } });
  }

  // ===== VK OAUTH =====

  async getVkAuthUrl(tenantId: string, redirect?: string) {
    const { clientId } = await this.platformSettings.getVkOAuthConfig();
    if (!clientId) {
      throw new Error('VK OAuth clientId is not configured');
    }
    const state = this.signState({
      tenantId,
      redirect: redirect || '/app/marketing/smm',
      ts: Date.now(),
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.vkRedirectUri(),
      response_type: 'code',
      scope: ['groups', 'stats', 'offline'].join(' '),
      display: 'page',
      v: '5.131',
      state,
    });
    return { url: `https://oauth.vk.com/authorize?${params.toString()}` };
  }

  async handleVkCallback(code?: string, state?: string) {
    const parsed = this.verifyState(state);
    if (!parsed?.tenantId || !code) {
      return this.safeRedirect('/app/marketing/smm?vk=invalid_state');
    }
    const { clientId, clientSecret } = await this.platformSettings.getVkOAuthConfig();
    if (!clientId || !clientSecret) {
      return this.safeRedirect('/app/marketing/smm?vk=missing_oauth');
    }

    const tokenRes = await fetch(
      `https://oauth.vk.com/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.vkRedirectUri(),
        code,
      }).toString()}`,
    );

    if (!tokenRes.ok) {
      return this.safeRedirect('/app/marketing/smm?vk=oauth_error');
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.access_token as string | undefined;
    const expiresIn = Number(tokenJson?.expires_in || 0);
    const vkUserId = tokenJson?.user_id ? Number(tokenJson.user_id) : null;

    if (!accessToken) {
      return this.safeRedirect('/app/marketing/smm?vk=oauth_error');
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    let integration = await this.integrationsRepo.findOne({
      where: { tenantId: parsed.tenantId, provider: 'vk' },
    });

    if (!integration) {
      integration = this.integrationsRepo.create({
        tenantId: parsed.tenantId,
        provider: 'vk',
        accessToken,
        expiresAt,
        meta: vkUserId ? { userId: vkUserId } : {},
      });
    } else {
      integration.accessToken = accessToken;
      integration.expiresAt = expiresAt;
      integration.meta = {
        ...(integration.meta || {}),
        ...(vkUserId ? { userId: vkUserId } : {}),
      };
    }

    await this.integrationsRepo.save(integration);
    const redirectUrl = parsed.redirect || '/app/marketing/smm';
    return this.safeRedirect(`${redirectUrl}?vk=connected`);
  }

  private async getVkIntegration(tenantId: string) {
    return this.integrationsRepo.findOne({ where: { tenantId, provider: 'vk' } });
  }

  private async getMetaAccounts(accessToken: string) {
    const url = new URL('https://graph.facebook.com/v19.0/me/accounts');
    url.searchParams.set(
      'fields',
      'id,name,username,link,access_token,instagram_business_account{id,username}',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  private async getMetaBusinesses(accessToken: string) {
    const url = new URL('https://graph.facebook.com/v19.0/me/businesses');
    url.searchParams.set('fields', 'id,name');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  private async vkRequest<T = any>(
    method: string,
    params: Record<string, string | number | boolean | undefined>,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`https://api.vk.com/method/${method}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('v', '5.131');

    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      const message = json?.error?.error_msg || 'VK API error';
      const code = json?.error?.error_code;
      throw new Error(`${message} (${code || res.status})`);
    }
    return json?.response as T;
  }

  private async listVkGroups(accessToken: string) {
    const response = await this.vkRequest<{
      count: number;
      items: Array<{
        id: number;
        name: string;
        screen_name?: string;
        type?: string;
        is_closed?: number;
        is_admin?: number;
        admin_level?: number;
        members_count?: number;
        photo_100?: string;
        photo_200?: string;
      }>;
    }>('groups.get', {
      extended: 1,
      filter: 'admin,editor,moder',
      fields: 'members_count,screen_name,type,is_closed,photo_100,photo_200',
    }, accessToken);

    return Array.isArray(response?.items) ? response.items : [];
  }

  private async getBusinessPages(accessToken: string, businessId: string) {
    const url = new URL(`https://graph.facebook.com/v19.0/${businessId}/owned_pages`);
    url.searchParams.set(
      'fields',
      'id,name,username,link,access_token,instagram_business_account{id,username}',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  private async getBusinessClientPages(accessToken: string, businessId: string) {
    const url = new URL(`https://graph.facebook.com/v19.0/${businessId}/client_pages`);
    url.searchParams.set(
      'fields',
      'id,name,username,link,access_token,instagram_business_account{id,username}',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  }

  private async listMetaPagesWithTokens(accessToken: string) {
    const accounts = await this.getMetaAccounts(accessToken);
    const businesses = await this.getMetaBusinesses(accessToken);
    const businessPages: any[] = [];
    for (const biz of businesses) {
      const pages = await this.getBusinessPages(accessToken, biz.id);
      const clientPages = await this.getBusinessClientPages(accessToken, biz.id);
      businessPages.push(...pages, ...clientPages);
    }

    const seen = new Set<string>();
    return [...accounts, ...businessPages].filter((p: any) => {
      if (!p?.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  private async metaFetchJson(url: string, accessToken?: string) {
    const target = new URL(url);
    if (accessToken) {
      target.searchParams.set('access_token', accessToken);
    }
    try {
      const res = await fetch(target.toString());
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data,
      };
    } catch (error: any) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: error?.message || 'fetch_failed',
      };
    }
  }

  private maskToken(token?: string | null) {
    if (!token) return null;
    const last4 = token.slice(-4);
    return `***${last4}`;
  }

  async listMetaAssets(tenantId: string) {
    const integration = await this.getMetaIntegration(tenantId);
    if (!integration?.accessToken) {
      throw new Error('Meta is not connected');
    }
    const merged = await this.listMetaPagesWithTokens(integration.accessToken);

    const pages = merged.map((p: any) => ({
      id: p.id,
      name: p.name,
      username: p.username || null,
      link: p.link || null,
      instagramBusinessId: p.instagram_business_account?.id || null,
      instagramUsername: p.instagram_business_account?.username || null,
    }));
    return { pages };
  }

  async debugMeta(tenantId: string) {
    const integration = await this.getMetaIntegration(tenantId);
    if (!integration?.accessToken) {
      throw new Error('Meta is not connected');
    }

    const { appId, appSecret } = await this.platformSettings.getMetaOAuthConfig();
    const tokenMasked = this.maskToken(integration.accessToken);

    const debugToken = appId && appSecret
      ? await this.metaFetchJson(
          `https://graph.facebook.com/debug_token?${new URLSearchParams({
            input_token: integration.accessToken,
            access_token: `${appId}|${appSecret}`,
          }).toString()}`,
        )
      : { ok: false, status: 0, data: null, error: 'missing_app_credentials' };

    const me = await this.metaFetchJson(
      'https://graph.facebook.com/v19.0/me?fields=id,name',
      integration.accessToken,
    );

    const accounts = await this.metaFetchJson(
      'https://graph.facebook.com/v19.0/me/accounts?fields=id,name,username,link,instagram_business_account{id,username}',
      integration.accessToken,
    );

    const businesses = await this.metaFetchJson(
      'https://graph.facebook.com/v19.0/me/businesses?fields=id,name',
      integration.accessToken,
    );

    const businessesData = Array.isArray(businesses.data?.data) ? businesses.data.data : [];
    const businessPages: any[] = [];

    for (const biz of businessesData) {
      const owned = await this.metaFetchJson(
        `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,username,link,instagram_business_account{id,username}`,
        integration.accessToken,
      );
      const client = await this.metaFetchJson(
        `https://graph.facebook.com/v19.0/${biz.id}/client_pages?fields=id,name,username,link,instagram_business_account{id,username}`,
        integration.accessToken,
      );
      businessPages.push({
        businessId: biz.id,
        businessName: biz.name,
        ownedPages: {
          ok: owned.ok,
          status: owned.status,
          count: Array.isArray(owned.data?.data) ? owned.data.data.length : 0,
        },
        clientPages: {
          ok: client.ok,
          status: client.status,
          count: Array.isArray(client.data?.data) ? client.data.data.length : 0,
        },
      });
    }

    const pagesWithTokens = await this.listMetaPagesWithTokens(integration.accessToken);
    const samplePage = pagesWithTokens.find((p: any) => p?.access_token) || null;
    const sampleDate = this.resolveTargetDate();
    let facebookSample: any = null;

    if (samplePage?.id && samplePage?.access_token) {
      const pageTokenDebug = appId && appSecret
        ? await this.metaFetchJson(
            `https://graph.facebook.com/debug_token?${new URLSearchParams({
              input_token: samplePage.access_token,
              access_token: `${appId}|${appSecret}`,
            }).toString()}`,
          )
        : { ok: false, status: 0, data: null, error: 'missing_app_credentials' };

      const pageFieldsWithPageToken = await this.metaFetchJson(
        `https://graph.facebook.com/v19.0/${samplePage.id}?${new URLSearchParams({
          fields: 'id,name,fan_count,followers_count,username',
        }).toString()}`,
        samplePage.access_token,
      );

      const pageFieldsWithUserToken = await this.metaFetchJson(
        `https://graph.facebook.com/v19.0/${samplePage.id}?${new URLSearchParams({
          fields: 'id,name,fan_count,followers_count,username',
        }).toString()}`,
        integration.accessToken,
      );

      let dailyStats: any = null;
      let dailyError: string | null = null;
      try {
        dailyStats = await this.fetchFacebookDailyStats(
          samplePage.id,
          samplePage.access_token,
          sampleDate,
        );
      } catch (err: any) {
        dailyError = err?.message || 'daily_insights_failed';
      }

      const snapshot = await this.fetchFacebookPageSnapshot(
        samplePage.id,
        samplePage.access_token,
      );

      const latest = await this.fetchFacebookLatestInsights(
        samplePage.id,
        samplePage.access_token,
      );

      const insightsSample: Record<string, number | null> = {};
      try {
        insightsSample.impressions = await this.fetchFacebookInsightMetric(
          samplePage.id,
          samplePage.access_token,
          'page_impressions',
          sampleDate,
        );
      } catch {
        insightsSample.impressions = null;
      }
      try {
        insightsSample.reach = await this.fetchFacebookInsightMetric(
          samplePage.id,
          samplePage.access_token,
          'page_impressions_unique',
          sampleDate,
        );
      } catch {
        insightsSample.reach = null;
      }
      try {
        insightsSample.profileViews = await this.fetchFacebookInsightMetric(
          samplePage.id,
          samplePage.access_token,
          'page_views_total',
          sampleDate,
        );
      } catch {
        insightsSample.profileViews = null;
      }
      try {
        insightsSample.videoViews = await this.fetchFacebookInsightMetric(
          samplePage.id,
          samplePage.access_token,
          'page_video_views',
          sampleDate,
        );
      } catch {
        insightsSample.videoViews = null;
      }
      try {
        insightsSample.engagedUsers = await this.fetchFacebookInsightMetric(
          samplePage.id,
          samplePage.access_token,
          'page_engaged_users',
          sampleDate,
        );
      } catch {
        insightsSample.engagedUsers = null;
      }

      facebookSample = {
        pageId: samplePage.id,
        name: samplePage.name,
        link: samplePage.link || null,
        date: sampleDate,
        pageTokenDebug,
        pageFieldsWithPageToken,
        pageFieldsWithUserToken,
        snapshot,
        dailyStats,
        dailyError,
        latest,
        insightsSample,
      };
    }

    return {
      token: {
        masked: tokenMasked,
        expiresAt: integration.expiresAt,
      },
      debugToken,
      me,
      accounts: {
        ok: accounts.ok,
        status: accounts.status,
        count: Array.isArray(accounts.data?.data) ? accounts.data.data.length : 0,
        sample: Array.isArray(accounts.data?.data)
          ? accounts.data.data.slice(0, 3).map((p: any) => ({
              id: p.id,
              name: p.name,
              instagramBusinessId: p.instagram_business_account?.id || null,
            }))
          : [],
      },
      businesses: {
        ok: businesses.ok,
        status: businesses.status,
        count: businessesData.length,
        items: businessesData,
      },
      businessPages,
      facebookSample,
    };
  }

  async listVkAssets(tenantId: string) {
    const integration = await this.getVkIntegration(tenantId);
    if (!integration?.accessToken) {
      throw new Error('VK is not connected');
    }
    const groups = await this.listVkGroups(integration.accessToken);
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        screenName: g.screen_name || null,
        type: g.type || null,
        isClosed: g.is_closed ?? null,
        membersCount: g.members_count ?? null,
        photo: g.photo_200 || g.photo_100 || null,
      })),
    };
  }

  private async upsertProfileStat(
    tenantId: string,
    profileId: string,
    date: string,
    payload: Partial<SmmProfileStat>,
  ) {
    const existing = await this.statsRepo.findOne({
      where: { tenantId, profileId, date },
    });
    if (existing) {
      await this.statsRepo.save({ ...existing, ...payload });
    } else {
      await this.statsRepo.save(this.statsRepo.create({ tenantId, profileId, date, ...payload } as any));
    }
  }

  async connectMetaProfile(
    tenantId: string,
    payload: { platform: 'facebook' | 'instagram'; pageId?: string; igUserId?: string },
  ) {
    const integration = await this.getMetaIntegration(tenantId);
    if (!integration?.accessToken) {
      throw new Error('Meta is not connected');
    }
    const accounts = await this.listMetaPagesWithTokens(integration.accessToken);

    if (payload.platform === 'facebook') {
      const page = accounts.find((p: any) => p.id === payload.pageId);
      if (!page?.access_token) {
        throw new Error('Page not found');
      }
      const profile = await this.createProfile(tenantId, {
        platform: 'facebook',
        handle: page.username || page.name,
        url: page.link,
        note: undefined,
      });
      profile.meta = {
        ...(profile.meta || {}),
        provider: 'meta',
        pageId: page.id,
        pageAccessToken: page.access_token,
      };
      await this.profilesRepo.save(profile);

      const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      try {
        const stats = await this.fetchFacebookDailyStats(
          page.id,
          page.access_token,
          date,
          integration.accessToken,
        );
        await this.upsertProfileStat(tenantId, profile.id, date, stats);
      } catch {
        // ignore initial stats failures
      }

      void this.syncMetaProfilesRange(tenantId, 7).catch(() => undefined);

      return profile;
    }

    const page = accounts.find((p: any) => p.instagram_business_account?.id === payload.igUserId);
    if (!page?.access_token || !page.instagram_business_account?.id) {
      throw new Error('Instagram account not found');
    }

    const igUserId = page.instagram_business_account.id;
    const userUrl = new URL(`https://graph.facebook.com/v19.0/${igUserId}`);
    userUrl.searchParams.set('fields', 'username,followers_count,media_count');
    userUrl.searchParams.set('access_token', page.access_token);
    const userRes = await fetch(userUrl.toString());
    const userJson = userRes.ok ? await userRes.json() : {};
    const handle = userJson?.username || page.instagram_business_account.username || 'instagram';

    const profile = await this.createProfile(tenantId, {
      platform: 'instagram',
      handle,
      url: `https://instagram.com/${handle}`,
      note: undefined,
    });
    profile.meta = {
      ...(profile.meta || {}),
      provider: 'meta',
      pageId: page.id,
      igUserId,
      pageAccessToken: page.access_token,
    };
    await this.profilesRepo.save(profile);

    const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      const stats = await this.fetchInstagramDailyStats(
        igUserId,
        page.access_token,
        date,
      );
      await this.upsertProfileStat(tenantId, profile.id, date, stats);
    } catch {
      // ignore initial stats failures
    }

    void this.syncMetaProfilesRange(tenantId, 7).catch(() => undefined);

    return profile;
  }

  async connectVkGroup(
    tenantId: string,
    payload: { groupId?: number; screenName?: string },
  ) {
    const integration = await this.getVkIntegration(tenantId);
    if (!integration?.accessToken) {
      throw new Error('VK is not connected');
    }
    const groups = await this.listVkGroups(integration.accessToken);
    const target = groups.find((g) =>
      payload.groupId ? g.id === payload.groupId : g.screen_name === payload.screenName,
    );
    if (!target) {
      throw new Error('VK group not found');
    }

    const handle = target.screen_name || target.name;
    const profile = await this.createProfile(tenantId, {
      platform: 'vk',
      handle,
      url: handle ? `https://vk.com/${handle}` : undefined,
      note: undefined,
    });

    profile.meta = {
      ...(profile.meta || {}),
      provider: 'vk',
      groupId: target.id,
      screenName: target.screen_name || null,
    };
    await this.profilesRepo.save(profile);

    const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      const stats = await this.fetchVkDailyStats(
        target.id,
        integration.accessToken,
        date,
      );
      await this.upsertProfileStat(tenantId, profile.id, date, stats);
    } catch {
      // ignore initial stats failures
    }

    void this.syncVkProfilesRange(tenantId, 7).catch(() => undefined);

    return profile;
  }

  private resolveTargetDate(date?: string) {
    if (date) return date;
    const target = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return target.toISOString().slice(0, 10);
  }

  private normalizeInsightValue(value: any): number {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    if (typeof value === 'object') {
      const numbers = Object.values(value).map((v) => Number(v) || 0);
      return numbers.reduce((sum, v) => sum + v, 0);
    }
    return 0;
  }

  private extractInsightValue(rows: any[], metric: string, targetDate?: string) {
    const row = rows.find((r) => r?.name === metric);
    if (row?.total_value?.value != null) {
      return this.normalizeInsightValue(row.total_value.value);
    }
    const values = Array.isArray(row?.values) ? row.values : [];
    if (!values.length) return 0;

    if (targetDate) {
      const byDate = values.find((v: any) =>
        String(v?.end_time || '').startsWith(targetDate),
      );
      if (byDate) return this.normalizeInsightValue(byDate.value);
    }

    const latest = values[values.length - 1];
    return this.normalizeInsightValue(latest?.value);
  }

  private sumInsightValues(rows: any[], metric: string) {
    const row = rows.find((r) => r?.name === metric);
    if (row?.total_value?.value != null) {
      return this.normalizeInsightValue(row.total_value.value);
    }
    const values = Array.isArray(row?.values) ? row.values : [];
    return values.reduce((sum: number, v: any) => sum + this.normalizeInsightValue(v?.value), 0);
  }

  private async fetchFacebookPageSnapshot(
    pageId: string,
    pageAccessToken: string,
  ) {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?${new URLSearchParams({
        fields: 'fan_count,followers_count',
        access_token: pageAccessToken,
      }).toString()}`,
    );
    if (!res.ok) return { followers: 0 };
    const json = await res.json();
    const followers = Number(json?.followers_count || json?.fan_count || 0);
    return { followers };
  }

  private async fetchFacebookInsightMetric(
    pageId: string,
    accessToken: string,
    metric: string,
    date?: string,
  ) {
    const url = new URL(`https://graph.facebook.com/v19.0/${pageId}/insights`);
    url.searchParams.set('metric', metric);
    url.searchParams.set('period', 'day');
    if (date) {
      const sinceTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
      const untilTs = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
      url.searchParams.set('since', String(sinceTs));
      url.searchParams.set('until', String(untilTs));
    }
    url.searchParams.set('access_token', accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      const message = errorJson?.error?.message || 'Facebook insights fetch failed';
      if (message.includes('valid insights metric')) {
        return null;
      }
      throw new Error(`${message} (${res.status})`);
    }
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    return this.extractInsightValue(rows, metric, date);
  }

  private extractPostInsightValue(rows: any[], metric: string) {
    const row = rows.find((r) => r?.name === metric);
    const values = Array.isArray(row?.values) ? row.values : [];
    if (!values.length) return 0;
    return this.normalizeInsightValue(values[0]?.value);
  }

  private async fetchFacebookPostsSummary(
    pageId: string,
    accessToken: string,
    sinceTs: number,
    untilTs: number,
  ) {
    const url = new URL(`https://graph.facebook.com/v19.0/${pageId}/posts`);
    url.searchParams.set(
      'fields',
      [
        'created_time',
        'likes.summary(true)',
        'comments.summary(true)',
        'insights.metric(post_impressions,post_impressions_unique,post_video_views)',
      ].join(','),
    );
    url.searchParams.set('since', String(sinceTs));
    url.searchParams.set('until', String(untilTs));
    url.searchParams.set('limit', '50');
    url.searchParams.set('access_token', accessToken);

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];

    let likes = 0;
    let comments = 0;
    let impressions = 0;
    let reach = 0;
    let videoViews = 0;

    for (const post of items) {
      likes += Number(post?.likes?.summary?.total_count || 0);
      comments += Number(post?.comments?.summary?.total_count || 0);
      const insightRows = Array.isArray(post?.insights?.data) ? post.insights.data : [];
      impressions += this.extractPostInsightValue(insightRows, 'post_impressions');
      reach += this.extractPostInsightValue(insightRows, 'post_impressions_unique');
      videoViews += this.extractPostInsightValue(insightRows, 'post_video_views');
    }

    return { likes, comments, impressions, reach, videoViews };
  }

  private async resolvePageAccessToken(
    pageId: string,
    userAccessToken: string,
  ) {
    const pages = await this.listMetaPagesWithTokens(userAccessToken);
    const page = pages.find((p: any) => p.id === pageId);
    return page?.access_token || null;
  }

  private async fetchFacebookDailyStats(
    pageId: string,
    pageAccessToken: string,
    date: string,
    userAccessToken?: string,
  ) {
    const sinceTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
    const untilTs = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
    const impressions = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_impressions',
      date,
    );
    const reach = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_impressions_unique',
      date,
    );
    const profileViews = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_views_total',
      date,
    );
    const videoViews = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_video_views',
      date,
    );
    const engagedUsers = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_engaged_users',
      date,
    );
    const postEngagements = await this.fetchFacebookInsightMetric(
      pageId,
      pageAccessToken,
      'page_post_engagements',
      date,
    );

    const fallback = await this.fetchFacebookPageSnapshot(pageId, pageAccessToken);
    const latest = await this.fetchFacebookLatestInsights(pageId, pageAccessToken);
    const postSummary = await this.fetchFacebookPostsSummary(
      pageId,
      pageAccessToken,
      sinceTs,
      untilTs,
    );

    if (!impressions && !reach && !profileViews && !videoViews && !engagedUsers) {
      return {
        followers: fallback.followers,
        impressions: postSummary?.impressions ?? latest.impressions,
        reach: postSummary?.reach ?? latest.reach,
        profileViews: latest.profileViews,
        videoViews: postSummary?.videoViews ?? latest.videoViews,
        likes: postSummary?.likes ?? latest.likes,
        comments: postSummary?.comments ?? 0,
      };
    }

    return {
      followers: fallback.followers,
      impressions: impressions ?? 0,
      reach: reach ?? 0,
      profileViews: profileViews ?? 0,
      videoViews: videoViews ?? 0,
      likes: postSummary?.likes ?? engagedUsers ?? postEngagements ?? 0,
      comments: postSummary?.comments ?? 0,
    };
  }

  private async fetchFacebookLatestInsights(
    pageId: string,
    pageAccessToken: string,
  ) {
    return {
      impressions: (await this.fetchFacebookInsightMetric(pageId, pageAccessToken, 'page_impressions')) ?? 0,
      reach: (await this.fetchFacebookInsightMetric(pageId, pageAccessToken, 'page_impressions_unique')) ?? 0,
      profileViews: (await this.fetchFacebookInsightMetric(pageId, pageAccessToken, 'page_views_total')) ?? 0,
      videoViews: (await this.fetchFacebookInsightMetric(pageId, pageAccessToken, 'page_video_views')) ?? 0,
      likes: (await this.fetchFacebookInsightMetric(pageId, pageAccessToken, 'page_engaged_users')) ?? 0,
    };
  }

  private async fetchInstagramDailyStats(
    igUserId: string,
    pageAccessToken: string,
    date: string,
  ) {
    const startDate = new Date(`${date}T00:00:00Z`);
    const fallbackStart = new Date(startDate);
    fallbackStart.setUTCDate(startDate.getUTCDate() - 6);
    const fallbackStartDate = fallbackStart.toISOString().slice(0, 10);

    const profileRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}?${new URLSearchParams({
        fields: 'followers_count,media_count,username',
        access_token: pageAccessToken,
      }).toString()}`,
    );
    if (!profileRes.ok) {
      const errorJson = await profileRes.json().catch(() => null);
      const message = errorJson?.error?.message || 'Instagram profile fetch failed';
      throw new Error(`${message} (${profileRes.status})`);
    }
    const profileJson = await profileRes.json();

    const rows = await this.fetchInstagramUserInsights(igUserId, pageAccessToken, date);

    const mediaRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media?${new URLSearchParams({
        fields: 'id,media_type,like_count,comments_count,timestamp',
        limit: '50',
        access_token: pageAccessToken,
      }).toString()}`,
    );
    if (!mediaRes.ok) {
      const errorJson = await mediaRes.json().catch(() => null);
      const message = errorJson?.error?.message || 'Instagram media fetch failed';
      throw new Error(`${message} (${mediaRes.status})`);
    }
    const mediaJson = await mediaRes.json();
    const mediaItems = Array.isArray(mediaJson?.data) ? mediaJson.data : [];

    let likes = 0;
    let comments = 0;
    let videoViews = 0;
    let mediaImpressions = 0;
    let mediaReach = 0;
    const targetDate = date;
    let useFallbackRange = false;

    for (const media of mediaItems) {
      const ts = media?.timestamp ? String(media.timestamp).slice(0, 10) : null;
      if (ts !== targetDate) continue;
      likes += Number(media?.like_count || 0);
      comments += Number(media?.comments_count || 0);

      const isVideo = media?.media_type === 'VIDEO' || media?.media_type === 'REELS';
      const metricList = isVideo
        ? 'impressions,reach,engagement,saved,video_views,plays'
        : 'impressions,reach,engagement,saved';

      const mediaInsightsRes = await fetch(
        `https://graph.facebook.com/v19.0/${media.id}/insights?${new URLSearchParams({
          metric: metricList,
          access_token: pageAccessToken,
        }).toString()}`,
      );
      if (mediaInsightsRes.ok) {
        const mediaInsightsJson = await mediaInsightsRes.json();
        const mediaRows = Array.isArray(mediaInsightsJson?.data)
          ? mediaInsightsJson.data
          : [];
        mediaImpressions += this.extractInsightValue(mediaRows, 'impressions');
        mediaReach += this.extractInsightValue(mediaRows, 'reach');

        if (isVideo) {
          const views = this.extractInsightValue(mediaRows, 'video_views');
          const plays = this.extractInsightValue(mediaRows, 'plays');
          videoViews += Math.max(views, plays);
        }
      } else if (isVideo) {
        const insightRes = await fetch(
          `https://graph.facebook.com/v19.0/${media.id}/insights?${new URLSearchParams({
            metric: 'video_views,plays',
            access_token: pageAccessToken,
          }).toString()}`,
        );
        if (insightRes.ok) {
          const insightJson = await insightRes.json();
          const rows = Array.isArray(insightJson?.data) ? insightJson.data : [];
          const views = this.extractInsightValue(rows, 'video_views');
          const plays = this.extractInsightValue(rows, 'plays');
          videoViews += Math.max(views, plays);
        }
      }
    }

    let accountImpressions = this.extractInsightValue(rows, 'impressions', date);
    let accountReach = this.extractInsightValue(rows, 'reach', date);
    let accountProfileViews = this.extractInsightValue(rows, 'profile_views', date);
    let accountViews =
      this.extractInsightValue(rows, 'views', date) ||
      this.extractInsightValue(rows, 'content_views', date);
    let accountVideoViews = 0;

    if (!accountViews) {
      try {
        const videoRows = await this.fetchInstagramUserVideoInsights(
          igUserId,
          pageAccessToken,
          date,
          date,
        );
        accountVideoViews =
          this.extractInsightValue(videoRows, 'video_views', date) ||
          this.extractInsightValue(videoRows, 'plays', date);
      } catch {
        accountVideoViews = 0;
      }
    }

    if (!accountImpressions && !accountReach && !accountProfileViews) {
      useFallbackRange = true;
    }

    if (useFallbackRange) {
      const rangeRows = await this.fetchInstagramUserInsightsRange(
        igUserId,
        pageAccessToken,
        fallbackStartDate,
        date,
      );
      accountImpressions = this.sumInsightValues(rangeRows, 'impressions');
      accountReach = this.sumInsightValues(rangeRows, 'reach');
      accountProfileViews = this.sumInsightValues(rangeRows, 'profile_views');
      accountViews =
        this.sumInsightValues(rangeRows, 'views') ||
        this.sumInsightValues(rangeRows, 'content_views');

      if (!accountViews) {
        try {
          const videoRows = await this.fetchInstagramUserVideoInsights(
            igUserId,
            pageAccessToken,
            fallbackStartDate,
            date,
          );
          accountVideoViews =
            this.sumInsightValues(videoRows, 'video_views') ||
            this.sumInsightValues(videoRows, 'plays');
        } catch {
          accountVideoViews = 0;
        }
      }
    }

    if (useFallbackRange) {
      likes = 0;
      comments = 0;
      videoViews = 0;
      mediaImpressions = 0;
      mediaReach = 0;

      for (const media of mediaItems) {
        const ts = media?.timestamp ? String(media.timestamp).slice(0, 10) : null;
        if (!ts || ts < fallbackStartDate || ts > targetDate) continue;
        likes += Number(media?.like_count || 0);
        comments += Number(media?.comments_count || 0);

        const isVideo = media?.media_type === 'VIDEO' || media?.media_type === 'REELS';
        const metricList = isVideo
          ? 'impressions,reach,engagement,saved,video_views,plays'
          : 'impressions,reach,engagement,saved';

        const mediaInsightsRes = await fetch(
          `https://graph.facebook.com/v19.0/${media.id}/insights?${new URLSearchParams({
            metric: metricList,
            access_token: pageAccessToken,
          }).toString()}`,
        );
        if (mediaInsightsRes.ok) {
          const mediaInsightsJson = await mediaInsightsRes.json();
          const mediaRows = Array.isArray(mediaInsightsJson?.data)
            ? mediaInsightsJson.data
            : [];
          mediaImpressions += this.sumInsightValues(mediaRows, 'impressions');
          mediaReach += this.sumInsightValues(mediaRows, 'reach');

          if (isVideo) {
            const views = this.extractInsightValue(mediaRows, 'video_views');
            const plays = this.extractInsightValue(mediaRows, 'plays');
            videoViews += Math.max(views, plays);
          }
        }
      }
    }

    return {
      followers: Number(profileJson?.followers_count || 0),
      impressions: accountImpressions || this.extractInsightValue(rows, 'views', date) || mediaImpressions,
      reach: accountReach || mediaReach,
      profileViews: accountProfileViews,
      likes,
      comments,
      videoViews: videoViews || accountVideoViews || accountViews || 0,
    };
  }

  private async fetchInstagramUserInsightsRange(
    igUserId: string,
    pageAccessToken: string,
    from: string,
    to: string,
  ) {
    const sinceTs = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    const untilTs = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);
    const metricCandidates = [
      'reach,profile_views,website_clicks,accounts_engaged,views,content_views',
      'reach,profile_views,views',
      'reach,profile_views',
    ];

    for (const metric of metricCandidates) {
      const useTotalValue = /profile_views|website_clicks|accounts_engaged|views|content_views/.test(metric);
      const insightsRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/insights?${new URLSearchParams({
          metric,
          period: 'day',
          since: String(sinceTs),
          until: String(untilTs),
          ...(useTotalValue ? { metric_type: 'total_value' } : {}),
          access_token: pageAccessToken,
        }).toString()}`,
      );
      if (insightsRes.ok) {
        const insightsJson = await insightsRes.json();
        return Array.isArray(insightsJson?.data) ? insightsJson.data : [];
      }

      const errorJson = await insightsRes.json().catch(() => null);
      const message = errorJson?.error?.message || 'Instagram insights fetch failed';
      if (message.includes('metric[0] must be one of')) {
        continue;
      }
      throw new Error(`${message} (${insightsRes.status})`);
    }

    return [];
  }

  private async fetchInstagramUserInsights(
    igUserId: string,
    pageAccessToken: string,
    date: string,
  ) {
    const sinceTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
    const untilTs = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
    const metricCandidates = [
      'reach,profile_views,website_clicks,accounts_engaged,views,content_views',
      'reach,profile_views,views',
      'reach,profile_views',
    ];

    for (const metric of metricCandidates) {
      const useTotalValue = /profile_views|website_clicks|accounts_engaged|views|content_views/.test(metric);
      const insightsRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/insights?${new URLSearchParams({
          metric,
          period: 'day',
          since: String(sinceTs),
          until: String(untilTs),
          ...(useTotalValue ? { metric_type: 'total_value' } : {}),
          access_token: pageAccessToken,
        }).toString()}`,
      );
      if (insightsRes.ok) {
        const insightsJson = await insightsRes.json();
        return Array.isArray(insightsJson?.data) ? insightsJson.data : [];
      }

      const errorJson = await insightsRes.json().catch(() => null);
      const message = errorJson?.error?.message || 'Instagram insights fetch failed';
      if (message.includes('metric[0] must be one of')) {
        continue;
      }
      throw new Error(`${message} (${insightsRes.status})`);
    }

    return [];
  }

  private async fetchInstagramUserVideoInsights(
    igUserId: string,
    pageAccessToken: string,
    from: string,
    to: string,
  ) {
    const sinceTs = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    const untilTs = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);
    const insightsRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/insights?${new URLSearchParams({
        metric: 'video_views,plays',
        period: 'day',
        since: String(sinceTs),
        until: String(untilTs),
        access_token: pageAccessToken,
      }).toString()}`,
    );
    if (!insightsRes.ok) {
      return [];
    }
    const insightsJson = await insightsRes.json().catch(() => null);
    return Array.isArray(insightsJson?.data) ? insightsJson.data : [];
  }

  async syncMetaProfiles(tenantId: string, date?: string) {
    const targetDate = this.resolveTargetDate(date);
    const integration = await this.getMetaIntegration(tenantId);
    const userAccessToken = integration?.accessToken || undefined;
    const profiles = await this.profilesRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere("p.meta ->> 'provider' = 'meta'")
      .getMany();

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ profileId: string; platform: string; message: string }> = [];

    for (const profile of profiles) {
      const meta = profile.meta || {};
      const pageAccessToken = meta.pageAccessToken as string | undefined;
      const pageId = meta.pageId as string | undefined;
      const igUserId = meta.igUserId as string | undefined;

      if (!pageAccessToken || (!pageId && !igUserId)) {
        skipped += 1;
        continue;
      }

      try {
        if (profile.platform === 'facebook' && pageId) {
          let pageToken = pageAccessToken;
          if (!pageToken && userAccessToken) {
            pageToken = await this.resolvePageAccessToken(pageId, userAccessToken);
            if (pageToken) {
              profile.meta = { ...(profile.meta || {}), pageAccessToken: pageToken };
              await this.profilesRepo.save(profile);
            }
          }
          if (!pageToken) {
            throw new Error('Missing Page Access Token');
          }
          let stats;
          try {
            stats = await this.fetchFacebookDailyStats(
              pageId,
              pageToken,
              targetDate,
              userAccessToken,
            );
          } catch (err: any) {
            if (String(err?.message || '').includes('Page Access Token') && userAccessToken) {
              const refreshed = await this.resolvePageAccessToken(pageId, userAccessToken);
              if (refreshed) {
                profile.meta = { ...(profile.meta || {}), pageAccessToken: refreshed };
                await this.profilesRepo.save(profile);
                stats = await this.fetchFacebookDailyStats(
                  pageId,
                  refreshed,
                  targetDate,
                  userAccessToken,
                );
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          await this.upsertProfileStat(tenantId, profile.id, targetDate, stats);
          synced += 1;
        } else if (profile.platform === 'instagram' && igUserId) {
          let igToken = pageAccessToken;
          if ((!igToken || igToken === '') && userAccessToken && pageId) {
            igToken = await this.resolvePageAccessToken(pageId, userAccessToken);
            if (igToken) {
              profile.meta = { ...(profile.meta || {}), pageAccessToken: igToken };
              await this.profilesRepo.save(profile);
            }
          }
          if (!igToken) {
            throw new Error('Missing Page Access Token');
          }
          let stats;
          try {
            stats = await this.fetchInstagramDailyStats(
              igUserId,
              igToken,
              targetDate,
            );
          } catch (err: any) {
            const message = String(err?.message || '');
            if (
              userAccessToken &&
              pageId &&
              (message.includes('Error validating access token') ||
                message.includes('session has been invalidated'))
            ) {
              const refreshed = await this.resolvePageAccessToken(pageId, userAccessToken);
              if (refreshed) {
                profile.meta = { ...(profile.meta || {}), pageAccessToken: refreshed };
                await this.profilesRepo.save(profile);
                stats = await this.fetchInstagramDailyStats(
                  igUserId,
                  refreshed,
                  targetDate,
                );
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          await this.upsertProfileStat(tenantId, profile.id, targetDate, stats);
          synced += 1;
        } else {
          skipped += 1;
        }
      } catch (err: any) {
        errors += 1;
        errorDetails.push({
          profileId: profile.id,
          platform: profile.platform,
          message: err?.message || 'sync_failed',
        });
      }
    }

    return {
      date: targetDate,
      synced,
      skipped,
      errors,
      errorDetails,
    };
  }

  async syncMetaProfilesRange(tenantId: string, days = 7) {
    const totalDays = Math.max(1, Math.min(days, 30));
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ profileId: string; platform: string; message: string }> = [];

    for (let i = totalDays - 1; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const result = await this.syncMetaProfiles(tenantId, date);
      synced += result.synced;
      skipped += result.skipped;
      errors += result.errors;
      errorDetails.push(...result.errorDetails);
    }

    return {
      days: totalDays,
      synced,
      skipped,
      errors,
      errorDetails,
    };
  }

  private async fetchVkDailyStats(
    groupId: number,
    accessToken: string,
    date: string,
  ) {
    let statsEntry: any = null;
    try {
      const stats = await this.vkRequest<any[]>(
        'stats.get',
        {
          group_id: groupId,
          interval: 'day',
          date_from: date,
          date_to: date,
        },
        accessToken,
      );
      statsEntry = Array.isArray(stats) ? stats[0] : null;
    } catch {
      statsEntry = null;
    }

    let followers = 0;
    try {
      const groupInfo = await this.vkRequest<any[]>(
        'groups.getById',
        { group_id: groupId, fields: 'members_count' },
        accessToken,
      );
      if (Array.isArray(groupInfo) && groupInfo[0]?.members_count != null) {
        followers = Number(groupInfo[0].members_count);
      }
    } catch {
      followers = 0;
    }

    const reachObj = statsEntry?.reach || {};
    const visitorsObj = statsEntry?.visitors || {};
    const activityObj = statsEntry?.activity || {};

    const impressions = Number(visitorsObj.views ?? 0);
    const reach = Number(
      reachObj.reach ??
      reachObj.reach_subscribers ??
      reachObj.reach_total ??
      0,
    );
    const profileViews = Number(visitorsObj.visitors ?? 0);
    const likes = Number(activityObj.likes ?? 0);
    const comments = Number(activityObj.comments ?? 0);
    const videoViews = Number(activityObj.video_views ?? activityObj.videos ?? 0);

    return {
      followers,
      impressions,
      reach,
      profileViews,
      likes,
      comments,
      videoViews,
    };
  }

  async syncVkProfiles(tenantId: string, date?: string) {
    const targetDate = this.resolveTargetDate(date);
    const integration = await this.getVkIntegration(tenantId);
    const accessToken = integration?.accessToken || undefined;
    if (!accessToken) {
      return { date: targetDate, synced: 0, skipped: 0, errors: 1, errorDetails: [
        { profileId: 'vk', platform: 'vk', message: 'VK is not connected' },
      ] };
    }

    const profiles = await this.profilesRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere("p.meta ->> 'provider' = 'vk'")
      .getMany();

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ profileId: string; platform: string; message: string }> = [];

    for (const profile of profiles) {
      const meta = profile.meta || {};
      const groupId = meta.groupId as number | undefined;
      if (!groupId) {
        skipped += 1;
        continue;
      }
      try {
        const stats = await this.fetchVkDailyStats(groupId, accessToken, targetDate);
        await this.upsertProfileStat(tenantId, profile.id, targetDate, stats);
        synced += 1;
      } catch (err: any) {
        errors += 1;
        errorDetails.push({
          profileId: profile.id,
          platform: profile.platform,
          message: err?.message || 'sync_failed',
        });
      }
    }

    return {
      date: targetDate,
      synced,
      skipped,
      errors,
      errorDetails,
    };
  }

  async syncVkProfilesRange(tenantId: string, days = 7) {
    const totalDays = Math.max(1, Math.min(days, 30));
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ profileId: string; platform: string; message: string }> = [];

    for (let i = totalDays - 1; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const result = await this.syncVkProfiles(tenantId, date);
      synced += result.synced;
      skipped += result.skipped;
      errors += result.errors;
      errorDetails.push(...result.errorDetails);
    }

    return {
      days: totalDays,
      synced,
      skipped,
      errors,
      errorDetails,
    };
  }

  async syncAllVkProfiles(date?: string) {
    const rows = await this.profilesRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.tenantId', 'tenantId')
      .where("p.meta ->> 'provider' = 'vk'")
      .getRawMany();

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const row of rows) {
      const result = await this.syncVkProfiles(row.tenantId, date);
      totalSynced += result.synced;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    return {
      tenants: rows.length,
      synced: totalSynced,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  }

  async syncAllMetaProfiles(date?: string) {
    const rows = await this.profilesRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.tenantId', 'tenantId')
      .where("p.meta ->> 'provider' = 'meta'")
      .getRawMany();

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const row of rows) {
      const result = await this.syncMetaProfiles(row.tenantId, date);
      totalSynced += result.synced;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    return {
      tenants: rows.length,
      synced: totalSynced,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  }

  private safeRedirect(path: string) {
    if (!path || typeof path !== 'string') return '/app/marketing/smm';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!path.startsWith('/')) return `/app/marketing/${path}`;
    return path;
  }

  // ===== ПРОФИЛИ =====

  async listProfilesWithLastStat(tenantId: string) {
    const profiles = await this.profilesRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (!profiles.length) return [];

    const ids = profiles.map((p) => p.id);

    const stats = await this.statsRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.profileId IN (:...ids)', { ids })
      .orderBy('s.date', 'DESC')
      .getMany();

    const byProfile = new Map<string, SmmProfileStat>();
    for (const s of stats) {
      if (!byProfile.has(s.profileId)) {
        byProfile.set(s.profileId, s);
      }
    }

    return profiles.map((p) => ({
      ...p,
      lastStat: byProfile.get(p.id) || null,
    }));
  }

  async createProfile(
    tenantId: string,
    payload: {
      platform: SmmPlatform;
      handle: string;
      url?: string;
      note?: string;
    },
  ) {
    const platform = payload.platform;
    const handle = payload.handle.trim();

    if (!handle) {
      throw new Error('Handle is required');
    }

    const existing = await this.profilesRepo.findOne({
      where: { tenantId, platform, handle },
    });
    if (existing) return existing;

    const profile = this.profilesRepo.create({
      tenantId,
      platform,
      handle,
      url: payload.url || null,
      isActive: true,
      meta: payload.note ? { note: payload.note } : null,
    });

    return this.profilesRepo.save(profile);
  }

  async deleteProfile(tenantId: string, id: string) {
    await this.profilesRepo.delete({ tenantId, id });
  }

  // ===== СТАТИСТИКА =====

  async getStatsForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ) {
    const where: any = { tenantId };

    if (from && to) {
      where.date = Between(from, to);
    } else if (from) {
      where.date = Between(from, from);
    } else if (to) {
      where.date = Between(to, to);
    }

    return this.statsRepo.find({
      where,
      relations: ['profile'],
      order: { date: 'ASC' },
    });
  }

  async importStats(tenantId: string, items: ImportSmmStatItem[]) {
    for (const raw of items) {
      const platform: SmmPlatform = raw.platform || 'other';
      const handle = raw.handle.trim();
      const date = raw.date;

      if (!handle || !date) {
        // пропускаем битые строки
        continue;
      }

      // 1) профиль (автосоздание)
      let profile = await this.profilesRepo.findOne({
        where: { tenantId, platform, handle },
      });

      if (!profile) {
        profile = this.profilesRepo.create({
          tenantId,
          platform,
          handle,
          url: raw.url || null,
          isActive: true,
        });
        profile = await this.profilesRepo.save(profile);
      } else if (!profile.url && raw.url) {
        profile.url = raw.url;
        await this.profilesRepo.save(profile);
      }

      // 2) статы на дату
      const existing = await this.statsRepo.findOne({
        where: {
          tenantId,
          profileId: profile.id,
          date,
        },
      });

      const base: Partial<SmmProfileStat> = {
        tenantId,
        profileId: profile.id,
        date,

        followers: raw.followers ?? 0,
        following: raw.following ?? 0,
        posts: raw.posts ?? 0,

        impressions: raw.impressions ?? 0,
        reach: raw.reach ?? 0,
        profileViews: raw.profileViews ?? 0,
        clicks: raw.clicks ?? 0,
        likes: raw.likes ?? 0,
        comments: raw.comments ?? 0,
        saves: raw.saves ?? 0,
        videoViews: raw.videoViews ?? 0,
        extra: raw.extra ?? null,
      };

      if (existing) {
        await this.statsRepo.save({ ...existing, ...base });
      } else {
        const row = this.statsRepo.create(base as SmmProfileStat);
        await this.statsRepo.save(row);
      }
    }
  }
}
