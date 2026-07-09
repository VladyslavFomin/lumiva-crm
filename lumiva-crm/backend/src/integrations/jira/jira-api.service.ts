import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type JiraConfig = {
  jiraUrl: string;     // e.g. https://mycompany.atlassian.net
  email: string;       // Atlassian account email
  apiToken: string;    // API token from id.atlassian.com
  projectKey?: string; // default project key for issue creation
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

@Injectable()
export class JiraApiService {
  private readonly log = new Logger(JiraApiService.name);

  private authHeader(email: string, token: string): string {
    return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  }

  private apiBase(jiraUrl: string): string {
    return jiraUrl.replace(/\/$/, '') + '/rest/api/3';
  }

  async testConnection(cfg: JiraConfig): Promise<{ ok: boolean; displayName?: string; message: string }> {
    const base = this.apiBase(cfg.jiraUrl);
    try {
      const res = await axios.get<{ displayName?: string; emailAddress?: string }>(
        `${base}/myself`,
        {
          headers: {
            Authorization: this.authHeader(cfg.email, cfg.apiToken),
            Accept: 'application/json',
          },
          timeout: 10000,
        },
      );
      const name = res.data?.displayName || res.data?.emailAddress || cfg.email;
      return {
        ok: true,
        displayName: name,
        message: `Jira: подключение к ${cfg.jiraUrl} проверено. Аккаунт: ${name}`,
      };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) return { ok: false, message: 'Jira: неверный email или API token (401).' };
      if (status === 403) return { ok: false, message: 'Jira: доступ запрещён (403). Проверьте права токена.' };
      if (status === 404) return { ok: false, message: `Jira: URL не найден (404). Проверьте адрес: ${cfg.jiraUrl}` };
      return { ok: false, message: `Jira: ошибка подключения: ${(e as Error).message}` };
    }
  }

  async getProjects(cfg: JiraConfig): Promise<JiraProject[]> {
    const base = this.apiBase(cfg.jiraUrl);
    try {
      const res = await axios.get<{ values?: JiraProject[] }>(
        `${base}/project/search?maxResults=50&orderBy=name`,
        {
          headers: {
            Authorization: this.authHeader(cfg.email, cfg.apiToken),
            Accept: 'application/json',
          },
          timeout: 10000,
        },
      );
      return (res.data?.values ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name }));
    } catch (e) {
      this.log.warn(`Jira getProjects: ${(e as Error).message}`);
      return [];
    }
  }

  async createIssue(cfg: JiraConfig, params: JiraIssueParams): Promise<{ id: string; key: string; url: string }> {
    const base = this.apiBase(cfg.jiraUrl);
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
      {
        headers: {
          Authorization: this.authHeader(cfg.email, cfg.apiToken),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      },
    );
    return {
      id: res.data.id,
      key: res.data.key,
      url: `${cfg.jiraUrl.replace(/\/$/, '')}/browse/${res.data.key}`,
    };
  }
}
