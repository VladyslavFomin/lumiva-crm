import { Injectable } from '@nestjs/common';
import axios, { type AxiosError } from 'axios';

function formatSheetsAxiosError(e: AxiosError): string {
  const status = e.response?.status;
  const data = e.response?.data as
    | { error?: { message?: string; status?: string }; message?: string }
    | undefined;
  const g =
    data?.error?.message ||
    (typeof data?.message === 'string' ? data.message : null) ||
    e.message ||
    'Sheets API error';
  return status ? `Google Sheets API ${status}: ${g}` : `Google Sheets: ${g}`;
}

@Injectable()
export class GoogleSheetsHttpService {
  private escapeRange(tabName: string, a1: string): string {
    const safeTab = tabName.includes(' ') || /[^A-Za-z0-9_]/.test(tabName)
      ? `'${tabName.replace(/'/g, "''")}'`
      : tabName;
    return `${safeTab}!${a1}`;
  }

  /**
   * Читает диапазон (A1 notation внутри вкладки), возвращает массив строк (каждая — массив ячеек).
   */
  async getValues(
    accessToken: string,
    spreadsheetId: string,
    tabName: string,
    a1Range: string,
  ): Promise<string[][]> {
    const range = this.escapeRange(tabName, a1Range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`;
    try {
      const { data } = await axios.get<{ values?: string[][] }>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return Array.isArray(data.values) ? data.values : [];
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const err = new Error(formatSheetsAxiosError(e));
        (err as Error & { httpStatus?: number }).httpStatus = e.response?.status;
        throw err;
      }
      throw e;
    }
  }
}
