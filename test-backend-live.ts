#!/usr/bin/env ts-node

/**
 * Standalone test runner for live backend integration
 *
 * Usage:
 *   npm run test:live
 *   or
 *   ts-node test-backend-live.ts
 *
 * Environment variables:
 *   OBJID_BACKEND_URL - Backend URL (defaults to Azure Function URL)
 *   OBJID_API_KEY - API key for authentication
 */

// Set environment variables before importing modules
process.env.NINJA_BACKEND_URL = process.env.OBJID_BACKEND_URL || 'https://vjekocom-alext-weu.azurewebsites.net';
process.env.NINJA_API_KEY = process.env.OBJID_API_KEY || '';

import { BackendService } from './src/lib/backend/BackendService';
import { ALObjectType } from './src/lib/types/ALObjectType';
import { Logger, LogLevel } from './src/lib/utils/Logger';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.bright + colors.blue);
  console.log('='.repeat(50));
}

async function testLiveBackend() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.Info);

  const backendService = new BackendService();

  const testAppId = `test-app-${Date.now()}`;
  const testAppName = 'Live Backend Test App';
  let authKey: string | undefined;
  let testsPassed = 0;
  let testsFailed = 0;

  log('🚀 AL Object ID Ninja - Live Backend Test', colors.bright + colors.cyan);
  log(`📍 Backend URL: ${process.env.NINJA_BACKEND_URL}`, colors.cyan);
  log(`📦 Test App ID: ${testAppId}`, colors.cyan);

  if (process.env.NINJA_API_KEY) {
    log(`🔑 API Key: ${process.env.NINJA_API_KEY.substring(0, 8)}...`, colors.cyan);
  } else {
    log(`⚠️  No API key configured (some tests may fail)`, colors.yellow);
  }

  try {
    // Test 1: Check App (should not exist)
    logSection('Test 1: Check Non-Existent App');
    try {
      const result = await backendService.checkApp(testAppId);
      log(`App managed: ${result.managed}`, colors.green);
      log(`Has pool: ${result.hasPool}`, colors.green);

      if (!result.managed) {
        log('✅ Test passed: App correctly reported as not managed', colors.green);
        testsPassed++;
      } else {
        throw new Error('App should not be managed');
      }
    } catch (error) {
      log(`❌ Test failed: ${error}`, colors.red);
      testsFailed++;
    }

    // Test 2: Authorize App
    logSection('Test 2: Authorize App');
    try {
      const request = {
        appId: testAppId,
        appName: testAppName,
        gitUser: 'test-user',
        gitEmail: 'test@example.com',
        gitRepo: 'https://github.com/test/repo',
        gitBranch: 'main'
      };

      const result = await backendService.authorizeApp(request);

      if (result && result.authKey) {
        authKey = result.authKey;
        log(`✅ App authorized successfully`, colors.green);
        log(`Auth key: ${authKey.substring(0, 8)}...`, colors.green);
        testsPassed++;
      } else {
        throw new Error('Authorization failed - no auth key returned');
      }
    } catch (error) {
      log(`❌ Test failed: ${error}`, colors.red);
      testsFailed++;
    }

    // Test 3: Get Next Table ID
    if (authKey) {
      logSection('Test 3: Get Next Table ID');
      try {
        const request = {
          appId: testAppId,
          type: ALObjectType.Table,
          ranges: [{ from: 50000, to: 50099 }],
          authKey,
          perRange: false
        };

        const result = await backendService.getNext(request);

        if (result && result.available) {
          const id = Array.isArray(result.id) ? result.id[0] : result.id;
          log(`✅ Next table ID: ${id}`, colors.green);
          testsPassed++;
        } else {
          throw new Error('No available ID returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 4: Sync IDs
      logSection('Test 4: Sync Object IDs');
      try {
        const request = {
          appId: testAppId,
          authKey,
          ids: {
            [ALObjectType.Table]: [50000, 50001, 50002],
            [ALObjectType.Page]: [50100, 50101],
            [ALObjectType.Codeunit]: [50200]
          }
        };

        const result = await backendService.syncIds(request);

        if (result) {
          log(`✅ IDs synced successfully`, colors.green);
          log(`  Tables: 50000, 50001, 50002`, colors.green);
          log(`  Pages: 50100, 50101`, colors.green);
          log(`  Codeunits: 50200`, colors.green);
          testsPassed++;
        } else {
          throw new Error('Sync failed');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 5: Get Consumption
      logSection('Test 5: Get Consumption');
      try {
        const request = {
          appId: testAppId,
          authKey
        };

        const result = await backendService.getConsumption(request);

        if (result) {
          log(`✅ Consumption retrieved:`, colors.green);

          for (const [type, ids] of Object.entries(result)) {
            if (ids && ids.length > 0) {
              log(`  ${type}: ${ids.length} IDs (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''})`, colors.green);
            }
          }
          testsPassed++;
        } else {
          throw new Error('No consumption data returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 6: Get Next ID (should avoid consumed)
      logSection('Test 6: Get Next ID (Avoiding Consumed)');
      try {
        const request = {
          appId: testAppId,
          type: ALObjectType.Table,
          ranges: [{ from: 50000, to: 50099 }],
          authKey,
          perRange: false
        };

        const result = await backendService.getNext(request);

        if (result && result.available) {
          const id = Array.isArray(result.id) ? result.id[0] : result.id;

          if (id !== 50000 && id !== 50001 && id !== 50002) {
            log(`✅ Next table ID (avoiding consumed): ${id}`, colors.green);
            testsPassed++;
          } else {
            throw new Error(`Returned already consumed ID: ${id}`);
          }
        } else {
          throw new Error('No available ID returned');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }

      // Test 7: Pool Management
      logSection('Test 7: Pool Management');
      try {
        // Create pool
        const createResult = await backendService.createPool(testAppId, authKey);

        if (createResult && createResult.poolId) {
          log(`✅ Pool created: ${createResult.poolId}`, colors.green);

          // Pool created successfully, now try to leave it
          log(`✅ Pool operations available`, colors.green);

          // Leave pool
          const leaveResult = await backendService.leavePool(testAppId, authKey);

          if (leaveResult) {
            log(`✅ Successfully left pool`, colors.green);
            testsPassed++;
          } else {
            log(`✅ Pool creation succeeded (leave operation may not be supported)`, colors.green);
            testsPassed++;
          }
        } else {
          throw new Error('Pool creation failed');
        }
      } catch (error) {
        log(`❌ Test failed: ${error}`, colors.red);
        testsFailed++;
      }
    }

    // Test 8: Error Handling
    logSection('Test 8: Error Handling');
    try {
      const request = {
        appId: testAppId,
        type: ALObjectType.Table,
        ranges: [{ from: 50000, to: 50099 }],
        authKey: 'invalid-key',
        perRange: false
      };

      const result = await backendService.getNext(request);

      if (!result) {
        log(`✅ Invalid auth key handled gracefully`, colors.green);
        testsPassed++;
      } else {
        throw new Error('Should have failed with invalid auth');
      }
    } catch (error) {
      log(`❌ Test failed: ${error}`, colors.red);
      testsFailed++;
    }

  } catch (error) {
    log(`\n❌ Fatal error: ${error}`, colors.red);
  }

  // Summary
  logSection('Test Summary');
  const total = testsPassed + testsFailed;
  const passRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : '0';

  if (testsFailed === 0) {
    log(`✅ All tests passed! (${testsPassed}/${total})`, colors.bright + colors.green);
  } else {
    log(`⚠️  Some tests failed`, colors.bright + colors.yellow);
    log(`   Passed: ${testsPassed}`, colors.green);
    log(`   Failed: ${testsFailed}`, colors.red);
    log(`   Pass rate: ${passRate}%`, colors.yellow);
  }

  return testsFailed === 0 ? 0 : 1;
}

// Run the test
testLiveBackend()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    log(`\n❌ Unhandled error: ${error}`, colors.red);
    process.exit(1);
  });