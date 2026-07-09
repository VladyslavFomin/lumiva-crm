import { SapApiService } from './sap-api.service';

describe('SapApiService', () => {
  let svc: SapApiService;

  beforeEach(() => {
    svc = new SapApiService();
    jest.restoreAllMocks();
  });

  describe('testConnection', () => {
    it('rejects key shorter than 8 characters', async () => {
      const result = await svc.testConnection(undefined, 'short');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('8');
    });

    it('rejects empty key', async () => {
      const result = await svc.testConnection(undefined, '');
      expect(result.ok).toBe(false);
    });

    it('returns ok:true for valid key without apiUrl (inbound-only mode)', async () => {
      const result = await svc.testConnection(undefined, 'valid-token-12345');
      expect(result.ok).toBe(true);
      expect(result.message).toBeTruthy();
    });

    it('returns ok:true when SAP URL responds', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ status: 200 });
      const result = await svc.testConnection('https://sap.company.com/api', 'valid-token-12345');
      expect(result.ok).toBe(true);
    });

    it('returns ok:false when SAP URL unreachable', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce(
        new Error('connect ECONNREFUSED'),
      );
      const result = await svc.testConnection('https://sap.company.com/api', 'valid-token-12345');
      expect(result.ok).toBe(false);
    });

    it('includes PUBLIC_API_URL hint when env var is set', async () => {
      process.env.PUBLIC_API_URL = 'https://crm.example.com';
      const result = await svc.testConnection(undefined, 'valid-token-here');
      expect(result.message).toContain('crm.example.com');
      delete process.env.PUBLIC_API_URL;
    });
  });
});
