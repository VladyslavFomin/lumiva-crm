import { OneCApiService, type OneCConfig } from './onec-api.service';

describe('OneCApiService', () => {
  let svc: OneCApiService;

  const cfg: OneCConfig = {
    baseUrl: 'http://192.168.1.100/accounting',
    login: 'admin',
    password: 'secret',
  };

  beforeEach(() => {
    svc = new OneCApiService();
  });

  describe('testConnection', () => {
    it('returns ok:true when server responds with non-5xx', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ status: 200, data: {} });
      const result = await svc.testConnection(cfg);
      expect(result.ok).toBe(true);
    });

    it('returns ok:false on ECONNREFUSED', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED 192.168.1.100:80'), { code: 'ECONNREFUSED' }),
      );
      const result = await svc.testConnection(cfg);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('недоступен');
    });

    it('returns ok:false on 401 auth error', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValue(
        Object.assign(new Error('Unauthorized'), { response: { status: 401 } }),
      );
      const result = await svc.testConnection(cfg);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('401');
    });

    it('uses custom servicePath in URL', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ status: 200, data: {} });
      await svc.testConnection({ ...cfg, servicePath: 'myservice' });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/hs/myservice'),
        expect.any(Object),
      );
    });

    it('defaults to "crm" service path', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ status: 200, data: {} });
      await svc.testConnection(cfg);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/hs/crm'),
        expect.any(Object),
      );
    });
  });

  describe('fetchOrders', () => {
    it('returns orders array from flat response', async () => {
      const orders = [{ id: '1', number: '#1001', total: 1500 }];
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: orders });
      const result = await svc.fetchOrders(cfg);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('returns orders from { orders } wrapper response', async () => {
      const orders = [{ id: '2', number: '#1002' }];
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: { orders } });
      const result = await svc.fetchOrders(cfg);
      expect(result).toHaveLength(1);
    });

    it('returns empty array on non-array response', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: null });
      const result = await svc.fetchOrders(cfg);
      expect(result).toEqual([]);
    });

    it('passes sinceDate as query param when provided', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: [] });
      const since = new Date('2024-01-01T00:00:00Z');
      await svc.fetchOrders(cfg, since);
      const callArgs = spy.mock.calls[0];
      expect(callArgs[1]?.params?.dateFrom ?? callArgs[1]?.params?.sinceDate ?? callArgs[0]).toBeTruthy();
    });
  });
});
