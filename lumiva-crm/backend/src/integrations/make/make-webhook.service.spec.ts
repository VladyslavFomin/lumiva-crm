import { MakeWebhookService } from './make-webhook.service';

describe('MakeWebhookService', () => {
  let svc: MakeWebhookService;

  beforeEach(() => {
    svc = new MakeWebhookService();
  });

  describe('isMakeWebhookUrl', () => {
    it.each([
      'https://hook.make.com/abc123',
      'https://hook.eu1.make.com/webhook/xyz',
      'https://hook.eu2.make.com/abc',
      'https://hook.us1.make.com/abc',
      'https://hook.us2.make.com/abc',
      'https://hook.integromat.com/abc',
    ])('accepts valid Make domain: %s', (url) => {
      expect(svc.isMakeWebhookUrl(url)).toBe(true);
    });

    it.each([
      'https://hooks.zapier.com/hooks/catch/123/abc',
      'https://make.com/abc',
      'https://evil.hook.make.com.attacker.com/x',
      'not-a-url',
      '',
    ])('rejects non-Make URLs: %s', (url) => {
      expect(svc.isMakeWebhookUrl(url)).toBe(false);
    });

    it('handles URL with leading/trailing whitespace', () => {
      expect(svc.isMakeWebhookUrl('  https://hook.make.com/abc  ')).toBe(true);
    });
  });

  describe('postWebhook', () => {
    it('throws for non-HTTPS URL', async () => {
      await expect(
        svc.postWebhook('http://hook.make.com/abc', { test: 1 }),
      ).rejects.toThrow('HTTPS');
    });

    it('throws for non-Make domain', async () => {
      await expect(
        svc.postWebhook('https://hooks.zapier.com/x', { test: 1 }),
      ).rejects.toThrow('Make');
    });
  });
});
