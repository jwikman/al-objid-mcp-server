/**
 * Unit tests for Authorization Tools
 * Testing: check-authorization, authorize-app
 */

import { MockBackendService } from '../mocks/MockBackendService';
import { MockWorkspaceManager, MockApp } from '../mocks/MockWorkspaceManager';

describe('Authorization Tools', () => {
  let backend: MockBackendService;
  let workspace: MockWorkspaceManager;
  let testApp: MockApp;

  beforeEach(() => {
    backend = new MockBackendService({
      authorizedApps: ['pre-authorized-app']
    });

    workspace = new MockWorkspaceManager();

    testApp = {
      path: '/test/workspace/TestApp',
      id: 'test-app-id',
      name: 'Test App',
      publisher: 'Test Publisher',
      version: '1.0.0.0',
      idRanges: [{ from: 50000, to: 50099 }]
    };

    workspace.addApp(testApp);
    workspace.scanWorkspace('/test/workspace');
    workspace.setActiveApp('/test/workspace/TestApp');
  });

  afterEach(() => {
    backend.reset();
    workspace.reset();
  });

  describe('check-authorization', () => {
    it('should check authorization for active app', async () => {
      const isAuthorized = await backend.checkAuthorization(testApp.id);
      expect(isAuthorized).toBe(false);
    });

    it('should return true for authorized app', async () => {
      backend.setConfig({ authorizedApps: ['test-app-id'] });
      const isAuthorized = await backend.checkAuthorization('test-app-id');
      expect(isAuthorized).toBe(true);
    });

    it('should return false for unauthorized app', async () => {
      const isAuthorized = await backend.checkAuthorization('unauthorized-app');
      expect(isAuthorized).toBe(false);
    });

    it('should check with explicit appPath', async () => {
      const explicitApp = workspace.getApp('/test/workspace/TestApp');
      if (explicitApp) {
        const isAuthorized = await backend.checkAuthorization(explicitApp.id);
        expect(isAuthorized).toBe(false);
      }
    });

    it('should handle network failures gracefully', async () => {
      backend.setConfig({ failNetwork: true });

      await expect(
        backend.checkAuthorization('test-app-id')
      ).rejects.toThrow('Network error');
    });

    it('should track authorization check history', async () => {
      await backend.checkAuthorization('app1');
      await backend.checkAuthorization('app2');
      await backend.checkAuthorization('app3');

      const history = backend.getCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toMatchObject({
        method: 'checkAuthorization',
        appId: 'app1'
      });
    });
  });

  describe('authorize-app', () => {
    it('should authorize app with valid key', async () => {
      await backend.authorizeApp('test-app-id', 'valid-key-123');

      const isAuthorized = await backend.checkAuthorization('test-app-id');
      expect(isAuthorized).toBe(true);
    });

    it('should fail with invalid key', async () => {
      await expect(
        backend.authorizeApp('test-app-id', 'invalid-key')
      ).rejects.toThrow('Invalid authorization key');
    });

    it('should fail when backend auth fails', async () => {
      backend.setConfig({ failAuth: true });

      await expect(
        backend.authorizeApp('test-app-id', 'valid-key-123')
      ).rejects.toThrow('Invalid authorization key');
    });

    it('should authorize with explicit appPath', async () => {
      const app = workspace.getApp('/test/workspace/TestApp');
      if (app) {
        await backend.authorizeApp(app.id, 'valid-key-123');
        const isAuthorized = await backend.checkAuthorization(app.id);
        expect(isAuthorized).toBe(true);
      }
    });

    it('should handle empty auth key', async () => {
      await expect(
        backend.authorizeApp('test-app-id', '')
      ).rejects.toThrow('Invalid authorization key');
    });

    it('should track authorization attempts', async () => {
      try {
        await backend.authorizeApp('app1', 'key1');
      } catch {}

      try {
        await backend.authorizeApp('app2', 'key2');
      } catch {}

      const history = backend.getCallHistory();
      const authCalls = history.filter(h => h.method === 'authorizeApp');
      expect(authCalls).toHaveLength(2);
      expect(authCalls[0]).toMatchObject({
        appId: 'app1',
        authKey: 'key1'
      });
    });

    it('should not re-authorize already authorized app', async () => {
      // First authorization
      await backend.authorizeApp('new-app', 'valid-key-123');

      // Check it's authorized
      const isAuthorized1 = await backend.checkAuthorization('new-app');
      expect(isAuthorized1).toBe(true);

      // Try to authorize again (should still work)
      await backend.authorizeApp('new-app', 'valid-key-123');

      const isAuthorized2 = await backend.checkAuthorization('new-app');
      expect(isAuthorized2).toBe(true);
    });
  });

  describe('Authorization workflow', () => {
    it('should complete full authorization flow', async () => {
      // 1. Check initial status (unauthorized)
      const initialStatus = await backend.checkAuthorization(testApp.id);
      expect(initialStatus).toBe(false);

      // 2. Authorize the app
      await backend.authorizeApp(testApp.id, 'valid-key-123');

      // 3. Verify authorization
      const finalStatus = await backend.checkAuthorization(testApp.id);
      expect(finalStatus).toBe(true);

      // 4. Verify in history
      const history = backend.getCallHistory();
      expect(history).toContainEqual(
        expect.objectContaining({
          method: 'checkAuthorization',
          appId: testApp.id
        })
      );
      expect(history).toContainEqual(
        expect.objectContaining({
          method: 'authorizeApp',
          appId: testApp.id,
          authKey: 'valid-key-123'
        })
      );
    });

    it('should require authorization for protected operations', async () => {
      // Try to get next ID without authorization
      await expect(
        backend.getNextId(testApp.id, 'table', testApp.idRanges)
      ).rejects.toThrow('App not authorized');

      // Authorize
      await backend.authorizeApp(testApp.id, 'valid-key-123');

      // Now it should work
      const nextId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(nextId).toBeGreaterThanOrEqual(50000);
      expect(nextId).toBeLessThanOrEqual(50099);
    });
  });

  describe('Performance', () => {
    it('should handle authorization checks quickly', async () => {
      backend.setConfig({ latency: 10 }); // 10ms latency

      const start = Date.now();
      await backend.checkAuthorization('test-app');
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent authorization checks', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        backend.checkAuthorization(`app-${i}`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(r => typeof r === 'boolean')).toBe(true);
    });
  });
});