/**
 * Unit tests for Pool ID Resolution functionality
 */

import { BackendService } from '../../src/lib/backend/BackendService';
import { HttpClient } from '../../src/lib/backend/HttpClient';
import { WorkspaceManager } from '../../src/lib/workspace/WorkspaceManager';

// Mock HttpClient
jest.mock('../../src/lib/backend/HttpClient');

// Mock WorkspaceManager
jest.mock('../../src/lib/workspace/WorkspaceManager');

describe('Pool ID Resolution', () => {
  let backendService: BackendService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockWorkspaceManager: jest.Mocked<WorkspaceManager>;

  const regularAppId = 'f4b69b55-c90d-4937-8f53-2742898fa948';
  const poolAppId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // 64 char hex

  beforeEach(() => {
    backendService = new BackendService();
    mockHttpClient = (backendService as any).httpClient as jest.Mocked<HttpClient>;

    // Mock WorkspaceManager getInstance
    mockWorkspaceManager = {
      getPoolIdFromAppIdIfAvailable: jest.fn()
    } as any;

    (WorkspaceManager as any).getInstance = jest.fn(() => mockWorkspaceManager);

    // Mock the send method
    mockHttpClient.send = jest.fn();
  });

  describe('getNext with pool ID', () => {
    it('should use pool ID when available', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { id: 50001, available: true }
      });

      const request = {
        appId: poolAppId,
        type: 'table',
        ranges: [{ from: 50000, to: 99999 }],
        authKey: 'test-auth-key'
      };

      const result = await backendService.getNext(request);

      expect(result).toEqual({ id: 50001, available: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/getNext',
          data: expect.objectContaining({
            appId: poolAppId
          })
        })
      );
    });

    it('should apply limitRanges when committing with perRange and require', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { id: 50001, available: true }
      });

      const request = {
        appId: regularAppId,
        type: 'table',
        ranges: [
          { from: 50000, to: 59999 },
          { from: 60000, to: 69999 }
        ],
        authKey: 'test-auth-key',
        perRange: true,
        require: 65000
      };

      const result = await backendService.getNext(request, true);

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            ranges: [{ from: 60000, to: 69999 }] // Only the range containing 65000
          })
        })
      );
    });
  });

  describe('checkApp method', () => {
    it('should use GET method and parse string response', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'true' });

      const result = await backendService.checkApp(regularAppId);

      expect(result).toEqual({
        managed: true,
        hasPool: false,
        poolId: undefined
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/checkApp',
          data: { appId: regularAppId }
        })
      );
    });

    it('should handle false response', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'false' });

      const result = await backendService.checkApp(regularAppId);

      expect(result).toEqual({
        managed: false,
        hasPool: false,
        poolId: undefined
      });
    });
  });

  describe('authorizeApp', () => {
    it('should use POST method and return AuthorizationInfo', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { authKey: 'new-auth-key' }
      });

      const request = {
        appId: regularAppId,
        appName: 'Test App',
        gitUser: 'user',
        gitEmail: 'user@example.com',
        gitRepo: 'repo',
        gitBranch: 'main'
      };

      const result = await backendService.authorizeApp(request);

      expect(result).toEqual({
        authKey: 'new-auth-key',
        authorized: true,
        error: undefined
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/authorizeApp'
        })
      );
    });
  });

  describe('getAuthInfo', () => {
    it('should use GET method for authorization info', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          authorized: true,
          user: { name: 'Test User', email: 'test@example.com' },
          valid: true
        }
      });

      const result = await backendService.getAuthInfo(regularAppId, 'test-auth-key');

      expect(result).toEqual({
        authKey: 'test-auth-key',
        authorized: true,
        user: { name: 'Test User', email: 'test@example.com' },
        valid: true
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/authorizeApp',
          data: { appId: regularAppId, authKey: 'test-auth-key' }
        })
      );
    });
  });

  describe('deauthorizeApp', () => {
    it('should use DELETE method', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { deleted: true }
      });

      const result = await backendService.deauthorizeApp(regularAppId, 'test-auth-key');

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          path: '/api/v2/authorizeApp',
          data: { appId: regularAppId, authKey: 'test-auth-key' }
        })
      );
    });
  });

  describe('storeAssignment', () => {
    it('should use POST method for adding', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { updated: true }
      });

      const result = await backendService.storeAssignment(
        regularAppId,
        'test-auth-key',
        'table',
        50001,
        'POST'
      );

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/storeAssignment',
          data: {
            appId: regularAppId,
            authKey: 'test-auth-key',
            type: 'table',
            id: 50001
          }
        })
      );
    });

    it('should use DELETE method for removing', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { updated: true }
      });

      const result = await backendService.storeAssignment(
        regularAppId,
        'test-auth-key',
        'table',
        50001,
        'DELETE'
      );

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          path: '/api/v2/storeAssignment'
        })
      );
    });
  });

  describe('getConsumption', () => {
    it('should use GET method and add _total field', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          table: [50001, 50002, 50003],
          page: [60001, 60002],
          codeunit: []
        }
      });

      const request = {
        appId: regularAppId,
        authKey: 'test-auth-key'
      };

      const result = await backendService.getConsumption(request);

      expect(result).toEqual({
        table: [50001, 50002, 50003],
        page: [60001, 60002],
        codeunit: [],
        _total: 5
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/getConsumption'
        })
      );
    });

    it('should handle empty consumption', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {}
      });

      const request = {
        appId: regularAppId,
        authKey: 'test-auth-key'
      };

      const result = await backendService.getConsumption(request);

      expect(result).toEqual({
        _total: 0
      });
    });
  });

  describe('autoSyncIds', () => {
    it('should use POST method for replace mode', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { success: true }
      });

      const appFolders = [{
        appId: regularAppId,
        authKey: 'test-auth-key',
        ids: {
          table: [50001, 50002],
          page: [60001]
        }
      }];

      const result = await backendService.autoSyncIds(appFolders, false);

      expect(result).toEqual({ success: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/autoSyncIds',
          data: { appFolders }
        })
      );
    });

    it('should use PATCH method for merge mode', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { success: true }
      });

      const appFolders = [{
        appId: regularAppId,
        authKey: 'test-auth-key',
        ids: {
          table: [50003],
          page: []
        }
      }];

      const result = await backendService.autoSyncIds(appFolders, true);

      expect(result).toEqual({ success: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: '/api/v2/autoSyncIds'
        })
      );
    });
  });

  describe('pool management', () => {
    it('should create pool with correct parameters', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          poolId: 'new-pool-id',
          accessKey: 'access-key',
          validationKey: 'validation-key',
          managementKey: 'management-key',
          leaveKeys: {}
        }
      });

      const result = await backendService.createPool(
        regularAppId,
        'auth-key',
        'My Pool',
        'join-key',
        'management-secret',
        [{ appId: regularAppId, name: 'Test App' }],
        false
      );

      expect(result).toEqual({
        poolId: 'new-pool-id',
        accessKey: 'access-key',
        validationKey: 'validation-key',
        managementKey: 'management-key',
        leaveKeys: {}
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/createPool',
          data: {
            name: 'My Pool',
            joinKey: 'join-key',
            managementSecret: 'management-secret',
            apps: [{ appId: regularAppId, name: 'Test App' }],
            allowAnyAppToManage: false
          }
        })
      );
    });

    it('should join pool', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { joined: true }
      });

      const result = await backendService.joinPool(
        'pool-id',
        'join-key',
        [{ appId: regularAppId, name: 'Test App' }]
      );

      expect(result).toEqual({ joined: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/joinPool',
          data: {
            poolId: 'pool-id',
            joinKey: 'join-key',
            apps: [{ appId: regularAppId, name: 'Test App' }]
          }
        })
      );
    });

    it('should leave pool', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: undefined });

      const result = await backendService.leavePool(regularAppId, 'auth-key');

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/leavePool',
          data: {
            appId: regularAppId,
            authKey: 'auth-key'
          }
        })
      );
    });
  });

  describe('polling endpoints', () => {
    it('should check for updates with polling backend', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { hasUpdates: true }
      });

      const request = {
        appId: regularAppId,
        lastCheck: Date.now()
      };

      const result = await backendService.checkUpdate(request);

      expect(result).toEqual({ hasUpdates: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: expect.stringContaining('/api/v2/check?')
        })
      );
    });

    it('should check multiple apps', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { updates: [] }
      });

      const payload = [{
        appId: regularAppId,
        authKey: 'test-auth-key',
        authorization: {}
      }];

      const result = await backendService.check(payload);

      expect(result).toEqual({ updates: [] });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/check',
          data: payload
        })
      );
    });
  });
});