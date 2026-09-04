import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationConnection } from '../integration-connection.entity';

export type JiraConfig = {
  jiraUrl: string;     // e.g. https://mycompany.atlassian.net
  email: string;       // Atlassian account email (classic mode)
  apiToken: string;    // API token from id.atlassian.com (classic mode)
  projectKey?: string; // default project key for issue creation
  /** Atlassian OAuth 3LO: свежий access_token (см. resolveConfigAndPersist) */
  oauthAccessToken?: string;
  /** Atlassian OAuth 3LO: cloudId сайта (из accessible-resources) */
  oauthCloudId?: string;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
};

export type JiraIssueParams = {
  summary: string;
  description?: string;
  issueType?: string;    // default 'Task'
  priority?: string;     // 'High' | 'Medium' | 'Low'
  projectKey: string;
  labels?: string[];
  dueDate?: string;      // ISO date string YYYY-MM-DD
};

const CATALOG_ID = 'jira';

@Injectable()
export class JiraApiService {
  private readonly log = new Logger(JiraApiService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    @InjectRepository(IntegrationConnection)
    private readonly repo: Repository<IntegrationConnection>,
  ) {}

  private authHeader(email: string, token: string): string {
    return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  }

  private apiBase(jiraUrl: string): string {
    return jiraUrl.replace(/\/$/, '') + '/rest/api/3';
  }

  /** Basic (email/apiToken) либо Bearer (Atlassian OAuth через api.atlassian.com/ex/jira/{cloudId}) */
  private resolveAuth(cfg: JiraConfig): { headers: Record<string, string>; base: string } {
    if (cfg.oauthAccessToken && cfg.oauthCloudId) {
      return {
        headers: { Authorization: `Bearer ${cfg.oauthAccessToken}` },
        base: `https://api.atlassian.com/ex/jira/${cfg.oauthCloudId}/rest/api/3`,
      };
    }
    return {
      headers: { Authorization: this.authHeader(cfg.email, cfg.apiToken) },
      base: this.apiBase(cfg.jiraUrl),
    };
  }

  /**
   * Atlassian OAuth 3LO: refresh_token ротируется на каждый обмен — старый становится
   * недействителен. Возвращаем новый refresh_token, чтобы вызывающий код его сохранил.
   * @see https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await axios.post(
      'https://auth.atlassian.com/oauth/token',
      {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken.trim(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    const accessToken = String(res.data?.access_token ?? '').trim();
    const newRefreshToken = String(res.data?.refresh_token ?? '').trim();
    if (res.status !== 200 || !accessToken || !newRefreshToken) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Jira OAuth refresh: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    return { accessToken, refreshToken: newRefreshToken };
  }

  async getAccessibleResources(
    accessToken: string,
  ): Promise<Array<{ id: string; url: string; name: string }>> {
    const res = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new Error(`Jira OAuth accessible-resources: HTTP ${res.status}`);
    }
    return res.data as Array<{ id: string; url: string; name: string }>;
  }

  /**
   * Собирает JiraConfig из сохранённого подключения. Для OAuth-подключений обновляет
   * access_token через refresh_token и — важно — сразу сохраняет обратно новый (ротированный)
   * refresh_token в entity.configJson, иначе следующее обновление token'а сломается.
   */
  async resolveConfigAndPersist(entity: IntegrationConnection): Promise<JiraConfig | null> {
    if (!entity.configJson) return null;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(entity.configJson) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (raw.catalogId !== CATALOG_ID) return null;

    const oauthRefreshToken =
      typeof raw.oauthRefreshToken === 'string' ? raw.oauthRefreshToken.trim() : '';
    const projectKey = typeof raw.projectKey === 'string' ? raw.projectKey : undefined;

    if (oauthRefreshToken) {
      const { clientId, clientSecret } =
        await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
      if (!clientId || !clientSecret) return null;
      let refreshed: { accessToken: string; refreshToken: string };
      try {
        refreshed = await this.refreshAccessToken(clientId, clientSecret, oauthRefreshToken);
      } catch (e) {
        this.log.warn(`Jira OAuth refresh failed for connection ${entity.id}: ${(e as Error).message}`);
        return null;
      }
      if (refreshed.refreshToken !== oauthRefreshToken) {
        raw.oauthRefreshToken = refreshed.refreshToken;
        entity.configJson = JSON.stringify(raw);
        await this.repo.save(entity);
      }
      const cloudId = typeof raw.oauthCloudId === 'string' ? raw.oauthCloudId : '';
      const jiraUrl = typeof raw.jiraUrl === 'string' ? raw.jiraUrl : '';
      if (!cloudId) return null;
      return {
        jiraUrl,
        email: '',
        apiToken: '',
        projectKey,
        oauthAccessToken: refreshed.accessToken,
        oauthCloudId: cloudId,
      };
    }

    const jiraUrl =
      (typeof raw.jiraUrl === 'string' ? raw.jiraUrl.trim() : '') ||
      (typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : '');
    const email =
      (typeof raw.jiraEmail === 'string' ? raw.jiraEmail.trim() : '') ||
      (typeof raw.accountEmail === 'string' ? raw.accountEmail.trim() : '');
    const apiToken = typeof raw.apiToken === 'string' ? raw.apiToken.trim() : '';
    if (!jiraUrl || !email || !apiToken) return null;
    return { jiraUrl, email, apiToken, projectKey };
  }

  async testConnection(cfg: JiraConfig): Promise<{ ok: boolean; displayName?: string; message: string }> {
    const { headers, base } = this.resolveAuth(cfg);
    try {
      const res = await axios.get<{ displayName?: string; emailAddress?: string }>(
        `${base}/myself`,
        { headers: { ...headers, Accept: 'application/json' }, timeout: 10000 },
      );
      const name = res.data?.displayName || res.data?.emailAddress || cfg.email || 'Jira';
      return {
        ok: true,
        displayName: name,
        message: `Jira: подключение к ${cfg.jiraUrl || base} проверено. Аккаунт: ${name}`,
      };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) return { ok: false, message: 'Jira: неверный email/API token или истёкший OAuth-доступ (401).' };
      if (status === 403) return { ok: false, message: 'Jira: доступ запрещён (403). Проверьте права токена.' };
      if (status === 404) return { ok: false, message: `Jira: URL не найден (404). Проверьте адрес: ${cfg.jiraUrl}` };
      return { ok: false, message: `Jira: ошибка подключения: ${(e as Error).message}` };
    }
  }

  async getProjects(cfg: JiraConfig): Promise<JiraProject[]> {
    const { headers, base } = this.resolveAuth(cfg);
    try {
      const res = await axios.get<{ values?: JiraProject[] }>(
        `${base}/project/search?maxResults=50&orderBy=name`,
        { headers: { ...headers, Accept: 'application/json' }, timeout: 10000 },
      );
      return (res.data?.values ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name }));
    } catch (e) {
      this.log.warn(`Jira getProjects: ${(e as Error).message}`);
      return [];
    }
  }

  async createIssue(cfg: JiraConfig, params: JiraIssueParams): Promise<{ id: string; key: string; url: string }> {
    const { headers, base } = this.resolveAuth(cfg);
    const body: Record<string, unknown> = {
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        issuetype: { name: params.issueType || 'Task' },
        ...(params.description
          ? {
              description: {
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description }] }],
              },
            }
          : {}),
        ...(params.priority ? { priority: { name: params.priority } } : {}),
        ...(params.labels?.length ? { labels: params.labels } : {}),
        ...(params.dueDate ? { duedate: params.dueDate } : {}),
      },
    };
    const res = await axios.post<{ id: string; key: string; self: string }>(
      `${base}/issue`,
      body,
      { headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 },
    );
    const browseBase = cfg.jiraUrl ? cfg.jiraUrl.replace(/\/$/, '') : '';
    return {
      id: res.data.id,
      key: res.data.key,
      url: browseBase ? `${browseBase}/browse/${res.data.key}` : res.data.self,
    };
  }
}
