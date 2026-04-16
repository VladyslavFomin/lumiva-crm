import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class GoogleSheetsTokenService {
  private readonly log = new Logger(GoogleSheetsTokenService.name);

  /**
   * Возвращает OAuth access token: либо из JSON service account (JWT grant),
   * либо считает, что строка уже есть access token (короткоживущий).
   */
  async resolveAccessToken(apiTokenRaw: string): Promise<string> {
    const raw = (apiTokenRaw || '').trim();
    if (!raw) throw new Error('Google Sheets: пустой API token');

    if (raw.startsWith('{')) {
      let sa: ServiceAccountJson;
      try {
        sa = JSON.parse(raw) as ServiceAccountJson;
      } catch {
        throw new Error('Google Sheets: API token не является валидным JSON');
      }
      if (!sa.client_email || !sa.private_key) {
        throw new Error('Google Sheets: в JSON service account нужны client_email и private_key');
      }
      return this.exchangeServiceAccountJwt(sa.client_email, sa.private_key);
    }

    if (raw.length < 30) {
      throw new Error('Google Sheets: слишком короткий access token');
    }
    return raw;
  }

  private async exchangeServiceAccountJwt(
    clientEmail: string,
    privateKey: string,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      {
        iss: clientEmail,
        sub: clientEmail,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
      },
      privateKey,
      { algorithm: 'RS256' },
    );

    try {
      const { data } = await axios.post<{
        access_token?: string;
        error?: string;
        error_description?: string;
      }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      if (!data.access_token) {
        throw new Error(
          data.error_description || data.error || 'Нет access_token от Google OAuth',
        );
      }
      return data.access_token;
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? `${e.response?.data?.error || e.message}: ${e.response?.data?.error_description || ''}`
        : (e as Error).message;
      this.log.warn(`Google OAuth token exchange failed: ${msg}`);
      throw new Error(`Google Sheets OAuth: ${msg}`);
    }
  }
}
