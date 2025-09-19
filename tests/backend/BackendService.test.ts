import { BackendService } from '../../src/lib/backend/BackendService';
import { HttpClient } from '../../src/lib/backend/HttpClient';
import { Logger } from '../../src/lib/utils/Logger';
import { ALObjectType } from '../../src/lib/types/al';

jest.mock('../../src/lib/backend/HttpClient');
jest.mock('../../src/lib/utils/Logger');

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

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (HttpClient as jest.MockedClass<typeof HttpClient>).mockImplementation(() => mockHttpClient);

    backendService = new BackendService({
      backendUrl: 'test-backend.com',
      apiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkApp', () => {
    it('should successfully check a managed app', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { managed: true }
      });

      const result = await backendService.checkApp(appId);

      expect(result).toEqual({ managed: true });
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'test-backend.com',
          path: `/api/v2/checkApp?appId=${encodeURIComponent(appId)}`,
          method: 'GET'
        })
      );
    });

    it('should return unmanaged for non-existing app', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { managed: false }
      });

      const result = await backendService.checkApp(appId);

      expect(result.managed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const appId = 'test-app-id';

      mockHttpClient.send.mockResolvedValue({
        status: 500,
        error: { message: 'Internal server error' }
      });

      const result = await backendService.checkApp(appId);

      expect(result).toEqual({ managed: false });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to check app ${appId}`,
        expect.any(Object)
      );
    });
  });

  describe('getNext', () => {
    it('should get next object ID successfully', async () => {
      const appId = 'test-app-id';
      const ranges = [{ from: 50000, to: 50099 }];

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 50000,
          available: true,
          hasConsumption: false,
          updated: false
        }
      });

      const result = await backendService.getNext(appId, ALObjectType.table, ranges);

      expect(result).toEqual({
        id: 50000,
        available: true,
        hasConsumption: false,
        updated: false
      });

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            appId,
            type: ALObjectType.table,
            ranges
          }
        })
      );
    });

    it('should include user when configured', async () => {
      backendService = new BackendService({
        backendUrl: 'test-backend.com',
        apiKey: 'test-api-key',
        includeUserName: true
      });

      const appId = 'test-app-id';
      const ranges = [{ from: 50000, to: 50099 }];
      const user = 'test-user';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 50000,
          available: true,
          hasConsumption: false,
          updated: false
        }
      });

      await backendService.getNext(appId, ALObjectType.table, ranges, user);

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user
          })
        })
      );
    });

    it('should handle no available IDs', async () => {
      const appId = 'test-app-id';
      const ranges = [{ from: 50000, to: 50099 }];

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          id: 0,
          available: false,
          hasConsumption: false,
          updated: false
        }
      });

      const result = await backendService.getNext(appId, ALObjectType.table, ranges);

      expect(result.available).toBe(false);
      expect(result.id).toBe(0);
    });

    it('should handle API errors', async () => {
      const appId = 'test-app-id';
      const ranges = [{ from: 50000, to: 50099 }];

      mockHttpClient.send.mockResolvedValue({
        status: 400,
        error: { message: 'Invalid request' }
      });

      const result = await backendService.getNext(appId, ALObjectType.table, ranges);

      expect(result).toEqual({
        id: 0,
        available: false,
        hasConsumption: false,
        updated: false,
        error: 'Invalid request'
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('authorizeApp', () => {
    it('should successfully authorize an app', async () => {
      const request = {
        appId: 'test-app-id',
        gitUser: 'git-user',
        gitEmail: 'git@email.com'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          key: 'auth-key-123',
          valid: true
        }
      });

      const result = await backendService.authorizeApp(request);

      expect(result).toEqual({
        key: 'auth-key-123',
        valid: true
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
        gitUser: 'git-user',
        gitEmail: 'git@email.com'
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
        type: ALObjectType.table,
        ids: [50000, 50001, 50002]
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
        type: ALObjectType.table,
        ids: [50000, 50001, 50002]
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
        type: ALObjectType.table,
        ids: []
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
        page: [60000, 60001]
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

      expect(result).toEqual({});
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
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        name: 'Test Pool',
        type: ALObjectType.table,
        size: 100,
        startId: 50000
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { poolId: 'pool-123' }
      });

      const result = await backendService.createPool(request);

      expect(result).toEqual({ poolId: 'pool-123' });
    });

    it('should join pool successfully', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        poolId: 'pool-123'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { joined: true }
      });

      const result = await backendService.joinPool(request);

      expect(result).toEqual({ joined: true });
    });

    it('should leave pool successfully', async () => {
      const request = {
        appId: 'test-app-id',
        authKey: 'auth-key-123',
        poolId: 'pool-123'
      };

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: { left: true }
      });

      const result = await backendService.leavePool(request);

      expect(result).toEqual({ left: true });
    });
  });

  describe('checkUpdate', () => {
    it('should check for updates successfully', async () => {
      const version = '1.0.0';

      mockHttpClient.send.mockResolvedValue({
        status: 200,
        value: {
          updateAvailable: true,
          latestVersion: '1.1.0'
        }
      });

      const result = await backendService.checkUpdate(version);

      expect(result).toEqual({
        updateAvailable: true,
        latestVersion: '1.1.0'
      });
    });
  });
});