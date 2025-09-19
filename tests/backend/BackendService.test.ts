import { BackendService } from '../../src/lib/backend/BackendService';
import { HttpClient } from '../../src/lib/backend/HttpClient';
import { Logger } from '../../src/lib/utils/Logger';
import { ConfigManager } from '../../src/lib/config/ConfigManager';

jest.mock('../../src/lib/backend/HttpClient');
jest.mock('../../src/lib/utils/Logger');
jest.mock('../../src/lib/config/ConfigManager');

describe('BackendService', () => {
  let backendService: BackendService;
  let mockHttpClient: any;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockHttpClient = {
      send: jest.fn()
    };

    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      verbose: jest.fn(),
      debug: jest.fn(),
      request: jest.fn(),
      response: jest.fn(),
      setLogLevel: jest.fn(),
    } as any;

    // Mock ConfigManager
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      loadConfig: jest.fn().mockReturnValue({
        backend: {
          url: 'https://test-backend.com',
          apiKey: 'test-api-key'
        },
        defaults: {
          verboseLogging: false
        }
      })
    });

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (HttpClient as jest.MockedClass<typeof HttpClient>).mockImplementation(() => mockHttpClient);

    backendService = new BackendService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkApp', () => {
    it('should successfully check a managed app', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: 'true'
      });

      const result = await backendService.checkApp(appId);

      expect(result).toEqual({
        managed: true,
        hasPool: false,
        poolId: undefined
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'test-backend.com',
          path: '/api/v2/checkApp',
          method: 'GET',
          data: { appId }
        })
      );
    });

    it('should return unmanaged for non-existing app', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: 'false'
      });

      const result = await backendService.checkApp(appId);

      expect(result.managed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockRejectedValue({
        status: 500,
        message: 'Internal server error'
      });

      const result = await backendService.checkApp(appId);

      expect(result).toEqual({ managed: false });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to check app ${appId}`,
        expect.any(Object)
      );
    }, 10000);
  });

  describe('getNext', () => {
    it('should get next object ID successfully', async () => {
      const request = {
        appId: 'test-app-id',
        type: 'table',
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'test-auth-key'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 50000,
          available: true,
          hasConsumption: false,
          updated: false
        }
      });

      const result = await backendService.getNext(request, true);

      expect(result).toEqual({
        id: 50000,
        available: true,
        hasConsumption: false,
        updated: false
      });

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            appId: request.appId,
            type: request.type,
            ranges: request.ranges
          })
        })
      );
    });

    it('should include user when provided', async () => {
      const request = {
        appId: 'test-app-id',
        type: 'table',
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'test-auth-key',
        user: 'test-user'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 50000,
          available: true,
          hasConsumption: false,
          updated: false
        }
      });

      await backendService.getNext(request, true);

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user: request.user
          })
        })
      );
    });

    it('should handle no available IDs', async () => {
      const request = {
        appId: 'test-app-id',
        type: 'table',
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'test-auth-key'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 0,
          available: false,
          hasConsumption: false,
          updated: false
        }
      });

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result!.available).toBe(false);
      expect(result!.id).toBe(0);
    });

    it('should handle API errors', async () => {
      const request = {
        appId: 'test-app-id',
        type: 'table',
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'test-auth-key'
      };

      mockHttpClient.send.mockRejectedValue({
        status: 400,
        message: 'Invalid request'
      });

      const result = await backendService.getNext(request);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('authorizeApp', () => {
    it('should successfully authorize an app', async () => {
      const request = {
        appId: 'test-app-id',
        appName: 'Test App',
        gitUser: 'git-user',
        gitEmail: 'git@email.com',
        gitRepo: 'test-repo',
        gitBranch: 'main'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          authKey: 'auth-key-123'
        }
      });

      const result = await backendService.authorizeApp(request);

      expect(result).toEqual({
        authKey: 'auth-key-123',
        authorized: true,
        error: undefined
      });

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: request
        })
      );
    });

    it('should handle authorization failure', async () => {
      const request = {
        appId: 'test-app-id',
        appName: 'Test App',
        gitUser: 'git-user',
        gitEmail: 'git@email.com',
        gitRepo: 'test-repo',
        gitBranch: 'main'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 403,
        error: { message: 'Forbidden' }
      });

      await expect(backendService.authorizeApp(request)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('syncIds', () => {
    it('should successfully sync object IDs', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        ids: {
          table: [50000, 50001, 50002]
        }
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {}
      });

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: request
        })
      );
    });

    it('should return false on sync failure', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        ids: {
          table: [50000, 50001, 50002]
        }
      };

      mockHttpClient.send.mockResolvedValue({
        status: 401,
        error: { message: 'Unauthorized' }
      });

      const result = await backendService.syncIds(request);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle empty ID list', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        ids: {
          table: []
        }
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {}
      });

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
    });
  });

  describe('getConsumption', () => {
    it('should successfully get consumption report', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          table: [50000, 50001, 50002],
          page: [60000, 60001]
        }
      });

      const result = await backendService.getConsumption(request);

      expect(result).toEqual({
        table: [50000, 50001, 50002],
        page: [60000, 60001],
        _total: 5
      });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/v2/getConsumption',
          data: request
        })
      );
    });

    it('should handle empty consumption', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {}
      });

      const result = await backendService.getConsumption(request);

      expect(result).toEqual({
        _total: 0
      });
    });

    it('should return undefined on error', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 404,
        error: { message: 'Not found' }
      });

      const result = await backendService.getConsumption(request);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('pool management', () => {
    it('should create pool successfully', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          poolId: 'pool-123',
          accessKey: 'access-key',
          validationKey: 'validation-key',
          managementKey: 'management-key',
          leaveKeys: {}
        }
      });

      const result = await backendService.createPool(
        'test-app-id',
        'auth-key-123',
        'Test Pool',
        'join-key',
        'management-secret',
        [{ appId: 'test-app-id', name: 'Test App' }],
        false
      );

      expect(result).toEqual({
        poolId: 'pool-123',
        accessKey: 'access-key',
        validationKey: 'validation-key',
        managementKey: 'management-key',
        leaveKeys: {}
      });
    });

    it('should join pool successfully', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { joined: true }
      });

      const result = await backendService.joinPool(
        'pool-123',
        'join-key',
        [{ appId: 'test-app-id', name: 'Test App' }]
      );

      expect(result).toEqual({ joined: true });
    });

    it('should leave pool successfully', async () => {
      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: undefined
      });

      const result = await backendService.leavePool('test-app-id', 'auth-key-123');

      expect(result).toBe(true);
    });
  });

  describe('checkUpdate', () => {
    it.skip('should check for updates successfully (requires polling backend)', async () => {
      const request = {
        appId: 'test-app-id',
        lastCheck: Date.now()
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          hasUpdates: true,
          updates: []
        }
      });

      const result = await backendService.checkUpdate(request);

      expect(result).toEqual({
        hasUpdates: true,
        updates: []
      });
    });
  });
});