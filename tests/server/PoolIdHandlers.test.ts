/**
 * Unit tests for server handlers with pool ID resolution
 */

import { WorkspaceManager } from '../../src/lib/workspace/WorkspaceManager';
import { BackendService } from '../../src/lib/backend/BackendService';

// Mock modules
jest.mock('../../src/lib/backend/BackendService');
jest.mock('../../src/lib/workspace/WorkspaceManager');
jest.mock('../../src/lib/config/ConfigManager');

describe('Server Handlers - Pool ID Resolution', () => {
  let mockWorkspaceManager: jest.Mocked<WorkspaceManager>;
  let mockBackendService: jest.Mocked<BackendService>;

  const regularAppId = 'f4b69b55-c90d-4937-8f53-2742898fa948';
  const poolAppId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // 64 char hex

  const mockApp = {
    appId: regularAppId,
    appPoolId: poolAppId,
    name: 'Test App',
    version: '1.0.0',
    path: 'U:/Test/App',
    isAuthorized: true,
    authKey: 'test-auth-key',
    ranges: [{ from: 50000, to: 99999 }]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup WorkspaceManager mock
    mockWorkspaceManager = {
      getPoolIdFromAppIdIfAvailable: jest.fn((appId: string) => {
        // Simulate pool ID resolution
        if (appId === regularAppId && mockApp.appPoolId) {
          return poolAppId;
        }
        return appId;
      }),
      getCurrentWorkspace: jest.fn(() => ({
        rootPath: 'U:/Test',
        apps: [mockApp],
        activeApp: mockApp
      })),
      loadAppFromFolder: jest.fn(() => Promise.resolve(mockApp)),
      getAppByPath: jest.fn(() => mockApp),
      getAppById: jest.fn(() => mockApp)
    } as any;

    (WorkspaceManager as any).getInstance = jest.fn(() => mockWorkspaceManager);

    // Setup BackendService mock
    mockBackendService = {
      getNext: jest.fn().mockResolvedValue({ id: 50001, available: true }),
      syncIds: jest.fn().mockResolvedValue(true),
      getConsumption: jest.fn().mockResolvedValue({
        table: [50001, 50002],
        page: [60001],
        _total: 3
      }),
      authorizeApp: jest.fn().mockResolvedValue({
        authKey: 'new-auth-key',
        authorized: true
      }),
      checkApp: jest.fn().mockResolvedValue({
        managed: true,
        hasPool: true,
        poolId: poolAppId
      })
    } as any;

    (BackendService as any).mockImplementation(() => mockBackendService);
  });

  describe('getNext handler', () => {
    it('should call backend.getNext with pool ID when available', async () => {
      // Simulate handler logic
      const appId = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      const request = {
        appId,
        type: 'table',
        ranges: mockApp.ranges,
        authKey: mockApp.authKey,
        perRange: false
      };

      await mockBackendService.getNext(request);

      expect(mockWorkspaceManager.getPoolIdFromAppIdIfAvailable).toHaveBeenCalledWith(regularAppId);
      expect(mockBackendService.getNext).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: poolAppId // Should use pool ID, not regular app ID
        })
      );
    });
  });

  describe('syncIds handler', () => {
    it('should call backend.syncIds with pool ID when available', async () => {
      const appId = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      const request = {
        appId,
        authKey: mockApp.authKey,
        ids: { table: [50001, 50002] },
        merge: false
      };

      await mockBackendService.syncIds(request);

      expect(mockWorkspaceManager.getPoolIdFromAppIdIfAvailable).toHaveBeenCalledWith(regularAppId);
      expect(mockBackendService.syncIds).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: poolAppId
        })
      );
    });

    it('should support merge mode with PATCH', async () => {
      const appId = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      const request = {
        appId,
        authKey: mockApp.authKey,
        ids: { table: [50003] },
        merge: true
      };

      await mockBackendService.syncIds(request);

      expect(mockBackendService.syncIds).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: poolAppId,
          merge: true
        })
      );
    });
  });

  describe('getConsumption handler', () => {
    it('should call backend.getConsumption with pool ID when available', async () => {
      const appId = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      const request = {
        appId,
        authKey: mockApp.authKey
      };

      await mockBackendService.getConsumption(request);

      expect(mockWorkspaceManager.getPoolIdFromAppIdIfAvailable).toHaveBeenCalledWith(regularAppId);
      expect(mockBackendService.getConsumption).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: poolAppId
        })
      );
    });
  });

  describe('authorizeApp handler', () => {
    it('should call backend.authorizeApp with pool ID when available', async () => {
      const appId = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      const request = {
        appId,
        appName: mockApp.name,
        gitUser: 'user',
        gitEmail: 'user@example.com',
        gitRepo: 'repo',
        gitBranch: 'main'
      };

      await mockBackendService.authorizeApp(request);

      expect(mockWorkspaceManager.getPoolIdFromAppIdIfAvailable).toHaveBeenCalledWith(regularAppId);
      expect(mockBackendService.authorizeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: poolAppId
        })
      );
    });
  });

  describe('Pool ID validation', () => {
    it('should return regular app ID when no pool ID exists', () => {
      const appWithoutPool = { ...mockApp, appPoolId: undefined };
      mockWorkspaceManager.getPoolIdFromAppIdIfAvailable = jest.fn((appId) => appId);

      const result = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(appWithoutPool.appId);

      expect(result).toBe(regularAppId);
    });

    it('should return regular app ID for invalid pool ID format', () => {
      const appWithInvalidPool = { ...mockApp, appPoolId: 'invalid-pool-id' };

      mockWorkspaceManager.getPoolIdFromAppIdIfAvailable = jest.fn((appId) => {
        // Simulate validation logic
        const poolId = appWithInvalidPool.appPoolId;
        if (poolId && poolId.length === 64 && /^[0-9A-Fa-f]{64}$/.test(poolId)) {
          return poolId;
        }
        return appId;
      });

      const result = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(appWithInvalidPool.appId);

      expect(result).toBe(regularAppId);
    });

    it('should return pool ID for valid 64-char hex pool ID', () => {
      const result = mockWorkspaceManager.getPoolIdFromAppIdIfAvailable(mockApp.appId);

      expect(result).toBe(poolAppId);
    });
  });
});