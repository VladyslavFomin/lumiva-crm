import { JiraApiService, type JiraConfig } from './jira-api.service';

describe('JiraApiService', () => {
  let svc: JiraApiService;

  const cfg: JiraConfig = {
    jiraUrl: 'https://mycompany.atlassian.net',
    email: 'dev@mycompany.com',
    apiToken: 'ATATT3xFfGF0abc123',
    projectKey: 'PROJ',
  };

  beforeEach(() => {
    svc = new JiraApiService();
    jest.restoreAllMocks();
  });

  describe('testConnection', () => {
    it('returns ok:true with display name on success', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({
        data: { displayName: 'Dev User', emailAddress: 'dev@mycompany.com' },
      });
      const result = await svc.testConnection(cfg);
      expect(result.ok).toBe(true);
      expect(result.displayName).toBe('Dev User');
    });

    it('returns ok:false with 401 message', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Unauthorized',
      });
      const result = await svc.testConnection(cfg);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('401');
    });

    it('uses Basic auth header with base64 credentials', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: {} });
      await svc.testConnection(cfg);
      const headers = spy.mock.calls[0][1]?.headers;
      const expected = 'Basic ' + Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64');
      expect(headers?.Authorization).toBe(expected);
    });

    it('calls /rest/api/3/myself endpoint', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: {} });
      await svc.testConnection(cfg);
      expect(spy.mock.calls[0][0]).toContain('/rest/api/3/myself');
    });

    it('strips trailing slash from jiraUrl', async () => {
      const spy = jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({ data: {} });
      await svc.testConnection({ ...cfg, jiraUrl: 'https://mycompany.atlassian.net/' });
      expect(spy.mock.calls[0][0]).not.toContain('//rest');
    });
  });

  describe('createIssue', () => {
    it('posts to /rest/api/3/issue', async () => {
      const spy = jest.spyOn(require('axios'), 'post').mockResolvedValueOnce({
        data: { id: '10001', key: 'PROJ-1', self: 'https://...' },
      });
      await svc.createIssue(cfg, { summary: 'Test issue', projectKey: 'PROJ' });
      expect(spy.mock.calls[0][0]).toContain('/rest/api/3/issue');
    });

    it('includes summary in request body', async () => {
      const spy = jest.spyOn(require('axios'), 'post').mockResolvedValueOnce({
        data: { id: '10001', key: 'PROJ-1' },
      });
      await svc.createIssue(cfg, { summary: 'Bug from CRM', projectKey: 'PROJ', issueType: 'Bug' });
      const body = spy.mock.calls[0][1];
      expect(body?.fields?.summary ?? JSON.stringify(body)).toContain('Bug from CRM');
    });

    it('returns issue key on success', async () => {
      jest.spyOn(require('axios'), 'post').mockResolvedValueOnce({
        data: { id: '10001', key: 'PROJ-42' },
      });
      const result = await svc.createIssue(cfg, { summary: 'Test', projectKey: 'PROJ' });
      expect(result.key).toBe('PROJ-42');
    });
  });

  describe('getProjects', () => {
    it('returns list of projects', async () => {
      jest.spyOn(require('axios'), 'get').mockResolvedValueOnce({
        data: { values: [{ id: '1', key: 'PROJ', name: 'My Project' }] },
      });
      const result = await svc.getProjects(cfg);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ');
    });
  });
});
