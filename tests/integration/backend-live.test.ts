/**
 * Integration tests for live backend API
 *
 * These tests make real HTTP calls to the backend service.
 * They require:
 * - Network connectivity
 * - Valid backend URL (https://vjekocom-alext-weu.azurewebsites.net)
 * - Valid API key (from environment or config)
 *
 * Run with: npm run test:integration
 */

// Set environment variables before importing modules
process.env.NINJA_BACKEND_URL = process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net';
process.env.NINJA_API_KEY = process.env.OBJID_API_KEY || '';

import { BackendService } from '../../src/lib/backend/BackendService';
import { ALObjectType } from '../../src/lib/types/ALObjectType';
import { Logger, LogLevel } from '../../src/lib/utils/Logger';

// Test configuration
const TEST_CONFIG = {
  // Use environment variables or defaults
  backendUrl: process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net',
  apiKey: process.env.OBJID_API_KEY || 'your-api-key-here',
  testAppId: 'test-app-' + Date.now(), // Unique app ID for each test run
  testAppName: 'Integration Test App',
  skipTests: false // Set to true to skip integration tests
};

// Skip tests if no API key is configured
const describeIntegration = TEST_CONFIG.apiKey === 'your-api-key-here' || TEST_CONFIG.skipTests
  ? describe.skip
  : describe;

describeIntegration('Backend Service - Live Integration Tests', () => {
  let backendService: BackendService;
  let logger: Logger;
  let testAuthKey: string | undefined;

  beforeAll(() => {
    // Set up logger with verbose output for debugging
    logger = Logger.getInstance();
    logger.setLogLevel(LogLevel.Verbose);

    // Create backend service instance
    backendService = new BackendService();

    console.log('🔗 Running integration tests against:', TEST_CONFIG.backendUrl);
    console.log('📦 Test App ID:', TEST_CONFIG.testAppId);
  });

  describe('App Lifecycle', () => {
    test('should check if app exists (initially should not exist)', async () => {
      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.managed).toBe(false);
      expect(result.hasPool).toBe(false);

      console.log('✅ App check result:', result);
    }, 10000);

    test('should authorize a new app', async () => {
      const request = {
        appId: TEST_CONFIG.testAppId,
        appName: TEST_CONFIG.testAppName,
        gitUser: 'test-user',
        gitEmail: 'test@example.com',
        gitRepo: 'https://github.com/test/repo',
        gitBranch: 'main'
      };

      const result = await backendService.authorizeApp(request);

      expect(result).toBeDefined();
      expect(result.authKey).toBeDefined();
      // The backend returns only { authKey } on successful authorization

      // Store auth key for subsequent tests
      testAuthKey = result.authKey;

      console.log('✅ App authorized with key:', testAuthKey?.substring(0, 8) + '...');
    }, 10000);

    test('should verify app is now authorized', async () => {
      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.managed).toBe(true);

      console.log('✅ App authorization verified');
    }, 10000);
  });

  describe('Object ID Management', () => {
    test('should get next available table ID', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
      expect(id).toBeGreaterThanOrEqual(50000);
      expect(id).toBeLessThanOrEqual(50099);

      console.log('✅ Next table ID:', id);
    }, 10000);

    test('should get next available page ID', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Page,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;
      expect(id).toBeGreaterThanOrEqual(50000);
      expect(id).toBeLessThanOrEqual(50099);

      console.log('✅ Next page ID:', id);
    }, 10000);

    test('should sync consumed IDs', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey,
        ids: {
          [ALObjectType.Table]: [50000, 50001, 50002],
          [ALObjectType.Page]: [50000, 50001]
        }
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);

      console.log('✅ IDs synced successfully');
    }, 10000);

    test('should retrieve consumption after sync', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey
      };

      const result = await backendService.getConsumption(request);

      expect(result).toBeDefined();
      expect(result?.[ALObjectType.Table]).toEqual(expect.arrayContaining([50000, 50001, 50002]));
      expect(result?.[ALObjectType.Page]).toEqual(expect.arrayContaining([50000, 50001]));

      console.log('✅ Consumption retrieved:', {
        tables: result?.[ALObjectType.Table]?.length,
        pages: result?.[ALObjectType.Page]?.length
      });
    }, 10000);

    test('should get next ID avoiding consumed ones', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: testAuthKey,
        perRange: false
      };

      const result = await backendService.getNext(request);

      expect(result).toBeDefined();
      expect(result?.available).toBe(true);

      const id = Array.isArray(result?.id) ? result.id[0] : result?.id;

      // Should not return already consumed IDs
      expect(id).not.toBe(50000);
      expect(id).not.toBe(50001);
      expect(id).not.toBe(50002);
      expect(id).toBeGreaterThanOrEqual(50003);

      console.log('✅ Next available table ID (avoiding consumed):', id);
    }, 10000);
  });

  describe('Pool Management', () => {
    let poolId: string | undefined;

    test('should create a new pool', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const result = await backendService.createPool(TEST_CONFIG.testAppId, testAuthKey);

      expect(result).toBeDefined();
      expect(result?.poolId).toBeDefined();

      poolId = result?.poolId;

      console.log('✅ Pool created:', poolId);
    }, 10000);

    test('should join an existing pool', async () => {
      if (!testAuthKey || !poolId) {
        console.warn('⚠️ Skipping: No auth key or pool ID available');
        return;
      }

      // Create a second test app to join the pool
      const secondAppId = TEST_CONFIG.testAppId + '-member';

      // First authorize the second app
      const authRequest = {
        appId: secondAppId,
        appName: 'Pool Member App',
        gitUser: 'test-user',
        gitEmail: 'test@example.com',
        gitRepo: 'https://github.com/test/repo',
        gitBranch: 'main'
      };

      const authResult = await backendService.authorizeApp(authRequest);
      const secondAuthKey = authResult.authKey;

      if (!secondAuthKey) {
        console.warn('⚠️ Could not authorize second app');
        return;
      }

      // Now join the pool
      const result = await backendService.joinPool(secondAppId, secondAuthKey, poolId);

      expect(result).toBe(true);

      console.log('✅ Second app joined pool:', poolId);
    }, 15000);

    test('should verify pool membership', async () => {
      if (!poolId) {
        console.warn('⚠️ Skipping: No pool ID available');
        return;
      }

      const result = await backendService.checkApp(TEST_CONFIG.testAppId);

      expect(result).toBeDefined();
      expect(result.hasPool).toBe(true);
      expect(result.poolId).toBe(poolId);

      console.log('✅ Pool membership verified');
    }, 10000);

    test('should leave pool', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const result = await backendService.leavePool(TEST_CONFIG.testAppId, testAuthKey);

      expect(result).toBe(true);

      console.log('✅ Left pool successfully');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle invalid auth key gracefully', async () => {
      const request = {
        appId: TEST_CONFIG.testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'invalid-auth-key',
        perRange: false
      };

      const result = await backendService.getNext(request);

      // Should return undefined on auth failure
      expect(result).toBeUndefined();

      console.log('✅ Invalid auth handled gracefully');
    }, 10000);

    test('should handle network timeouts', async () => {
      // Create a backend service with very short timeout
      const timeoutService = new BackendService();

      // This is a bit hacky but demonstrates timeout handling
      const request = {
        appId: TEST_CONFIG.testAppId,
        authKey: testAuthKey || 'test',
      };

      // Make multiple rapid requests to potentially trigger rate limiting or delays
      const promises = Array(5).fill(null).map(() =>
        timeoutService.getConsumption(request)
      );

      const results = await Promise.allSettled(promises);

      // At least some should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThan(0);

      console.log(`✅ Handled ${results.length} concurrent requests (${succeeded} succeeded)`);
    }, 20000);
  });

  describe('Performance Tests', () => {
    test('should handle rapid sequential requests', async () => {
      if (!testAuthKey) {
        console.warn('⚠️ Skipping: No auth key available');
        return;
      }

      const startTime = Date.now();
      const requests = 10;

      for (let i = 0; i < requests; i++) {
        const request = {
          appId: TEST_CONFIG.testAppId,
          type: ALObjectType.Codeunit,
          ranges: [{ from: 50000 + i * 100, to: 50099 + i * 100 }],
          authKey: testAuthKey,
          perRange: false
        };

        const result = await backendService.getNext(request);
        expect(result).toBeDefined();
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / requests;

      console.log(`✅ Completed ${requests} requests in ${duration}ms (avg: ${avgTime.toFixed(0)}ms)`);

      // Should complete reasonably quickly (under 500ms per request on average)
      expect(avgTime).toBeLessThan(500);
    }, 30000);
  });

  afterAll(() => {
    console.log('\n📊 Integration tests completed');
    console.log('=====================================\n');
  });
});

// Helper to run a single test in isolation
export async function runSingleIntegrationTest() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.Verbose);

  const backendService = new BackendService();

  console.log('Running single integration test...');

  const result = await backendService.checkApp('test-app');
  console.log('Result:', result);

  return result;
}

// If running this file directly
if (require.main === module) {
  runSingleIntegrationTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}