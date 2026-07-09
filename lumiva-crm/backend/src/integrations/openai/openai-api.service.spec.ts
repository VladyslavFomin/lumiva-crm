import { OpenAiApiService } from './openai-api.service';

describe('OpenAiApiService', () => {
  let svc: OpenAiApiService;

  beforeEach(() => {
    svc = new OpenAiApiService();
  });

  describe('verifyApiKey', () => {
    it('returns ok:false for empty API key', async () => {
      // We stub axios by mocking the module. For pure-unit tests without network,
      // we verify the error handling path by using an invalid key that will fail.
      // We mock axios at the module level:
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce({
        response: { status: 401 },
      } as any);
      const result = await svc.verifyApiKey('');
      expect(result.ok).toBe(false);
    });

    it('returns ok:false and meaningful message for 401', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Request failed',
      });
      const result = await svc.verifyApiKey('sk-invalid');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('401');
    });

    it('returns ok:false with rate limit message for 429', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Too many requests',
      });
      const result = await svc.verifyApiKey('sk-valid-but-throttled');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('429');
    });

    it('returns ok:true with model count on success', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({
        data: { data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }] },
      });
      const result = await svc.verifyApiKey('sk-test');
      expect(result.ok).toBe(true);
      expect(result.modelCount).toBe(2);
    });

    it('uses custom baseUrl when provided', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({
        data: { data: [] },
      });
      await svc.verifyApiKey('sk-test', 'https://custom.proxy.example.com');
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('custom.proxy.example.com'),
        expect.any(Object),
      );
    });

    it('strips trailing slash from baseUrl', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({
        data: { data: [] },
      });
      await svc.verifyApiKey('sk-test', 'https://custom.proxy.example.com/');
      expect(spy).toHaveBeenCalledWith(
        expect.not.stringContaining('//v1'),
        expect.any(Object),
      );
    });
  });
});
