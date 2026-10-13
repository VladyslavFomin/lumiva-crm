import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';

const BASE = 'https://api.apify.com/v2';

/** Apify: запуск готового актора (скрейпера) и забор результата из его датасета. */
@Injectable()
export class ApifyService {
  private actorPath(actorId: string) {
    // «user/actor» → «user~actor» (формат API)
    return encodeURIComponent(actorId.trim().replace('/', '~'));
  }

  /** Подстановка {{url}}/{{max}}/{{since}} в JSON-шаблон входа актора. */
  buildInput(template: string, vars: { url: string; max: number; since: string }): any {
    const json = template
      .replace(/\{\{url\}\}/g, JSON.stringify(vars.url).slice(1, -1))
      .replace(/\{\{max\}\}/g, String(Math.max(0, Math.round(vars.max))))
      .replace(/\{\{since\}\}/g, vars.since);
    return JSON.parse(json);
  }

  async startRun(token: string, actorId: string, input: any): Promise<{ runId: string; datasetId: string }> {
    try {
      const res = await axios.post(`${BASE}/acts/${this.actorPath(actorId)}/runs`, input, {
        params: { token },
        timeout: 30_000,
      });
      const d = res.data?.data;
      if (!d?.id) throw new Error('Apify returned no run id');
      return { runId: d.id, datasetId: d.defaultDatasetId };
    } catch (e: any) {
      throw new BadRequestException({
        code: 'APIFY_START',
        message: `Apify ${actorId}: ${e?.response?.data?.error?.message || e?.message || e}`,
      });
    }
  }

  async runStatus(token: string, runId: string): Promise<{ status: string; datasetId: string; statusMessage: string | null; usd: number | null }> {
    const res = await axios.get(`${BASE}/actor-runs/${encodeURIComponent(runId)}`, { params: { token }, timeout: 20_000 });
    const d = res.data?.data || {};
    return { status: d.status, datasetId: d.defaultDatasetId, statusMessage: d.statusMessage || null, usd: d.usageTotalUsd ?? null };
  }

  async datasetItems(token: string, datasetId: string, limit = 5000): Promise<any[]> {
    const out: any[] = [];
    for (let offset = 0; offset < limit; offset += 1000) {
      const res = await axios.get(`${BASE}/datasets/${encodeURIComponent(datasetId)}/items`, {
        params: { token, clean: 1, format: 'json', offset, limit: 1000 },
        timeout: 60_000,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }

  async verifyToken(token: string): Promise<{ username: string | null }> {
    try {
      const res = await axios.get(`${BASE}/users/me`, { params: { token }, timeout: 15_000 });
      return { username: res.data?.data?.username || null };
    } catch (e: any) {
      throw new BadRequestException({ code: 'APIFY_TOKEN', message: `Apify token rejected: ${e?.response?.data?.error?.message || e?.message}` });
    }
  }
}
