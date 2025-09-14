/**
 * Integration tests for complete MCP tool workflows
 * Testing real-world scenarios and tool interactions
 */

import { MockBackendService } from '../mocks/MockBackendService';
import { MockWorkspaceManager, MockApp } from '../mocks/MockWorkspaceManager';

describe('MCP Tool Integration Workflows', () => {
  let backend: MockBackendService;
  let workspace: MockWorkspaceManager;

  beforeEach(() => {
    backend = new MockBackendService();
    workspace = new MockWorkspaceManager();
  });

  afterEach(() => {
    backend.reset();
    workspace.reset();
  });

  describe('Scenario 1: New Developer Onboarding', () => {
    it('should complete full onboarding workflow', async () => {
      // Step 1: Developer clones repository with AL apps
      const apps: MockApp[] = [
        {
          path: '/workspace/MainApp',
          id: 'main-app-id',
          name: 'Main Application',
          publisher: 'Company',
          version: '1.0.0.0',
          idRanges: [{ from: 50000, to: 59999 }]
        },
        {
          path: '/workspace/TestApp',
          id: 'test-app-id',
          name: 'Test Application',
          publisher: 'Company',
          version: '1.0.0.0',
          idRanges: [{ from: 130000, to: 139999 }]
        }
      ];

      apps.forEach(app => workspace.addApp(app));

      // Step 2: Scan workspace
      const scannedApps = workspace.scanWorkspace('/workspace');
      expect(scannedApps).toHaveLength(2);
      expect(workspace.isScanned()).toBe(true);

      // Step 3: Set active app
      workspace.setActiveApp('/workspace/MainApp');
      const activeApp = workspace.getActiveApp();
      expect(activeApp?.name).toBe('Main Application');

      // Step 4: Check authorization
      let isAuthorized = await backend.checkAuthorization('main-app-id');
      expect(isAuthorized).toBe(false);

      // Step 5: Authorize app
      await backend.authorizeApp('main-app-id', 'valid-key-123');
      isAuthorized = await backend.checkAuthorization('main-app-id');
      expect(isAuthorized).toBe(true);

      // Step 6: Get first object ID
      const firstId = await backend.getNextId('main-app-id', 'table', activeApp!.idRanges);
      expect(firstId).toBe(50000);

      // Step 7: Sync to backend
      await backend.syncIds('main-app-id', [
        { type: 'table', id: firstId, name: 'MyFirstTable' }
      ]);

      // Verify complete setup
      const report = await backend.getConsumptionReport('main-app-id');
      expect(report.table).toContain(50000);
    });

    it('should handle onboarding errors gracefully', async () => {
      // Scenario: Developer tries to use tools without proper setup

      // Attempt 1: Set active app without scanning
      expect(() => {
        workspace.setActiveApp('/workspace/SomeApp');
      }).toThrow('Workspace not scanned');

      // Scan workspace first
      workspace.scanWorkspace('/workspace');

      // Attempt 2: Set non-existent app
      expect(() => {
        workspace.setActiveApp('/workspace/NonExistent');
      }).toThrow('App not found');

      // Add and scan app properly
      workspace.addApp({
        path: '/workspace/App',
        id: 'app-id',
        name: 'App',
        publisher: 'Company',
        version: '1.0.0.0',
        idRanges: [{ from: 50000, to: 50999 }]
      });
      workspace.scanWorkspace('/workspace');
      workspace.setActiveApp('/workspace/App');

      // Attempt 3: Get ID without authorization
      await expect(
        backend.getNextId('app-id', 'table', [{ from: 50000, to: 50999 }])
      ).rejects.toThrow('App not authorized');

      // Authorize properly
      await backend.authorizeApp('app-id', 'valid-key-123');

      // Now everything should work
      const id = await backend.getNextId('app-id', 'table', [{ from: 50000, to: 50999 }]);
      expect(id).toBe(50000);
    });
  });

  describe('Scenario 2: Collaborative Development', () => {
    it('should handle multiple developers working on same app', async () => {
      const app: MockApp = {
        path: '/shared/CollabApp',
        id: 'collab-app',
        name: 'Collaborative App',
        publisher: 'Team',
        version: '2.0.0.0',
        idRanges: [{ from: 50000, to: 50099 }]
      };

      // Developer 1 setup
      const dev1Backend = new MockBackendService({ authorizedApps: ['collab-app'] });
      const dev1Workspace = new MockWorkspaceManager();
      dev1Workspace.addApp(app);
      dev1Workspace.scanWorkspace('/shared');
      dev1Workspace.setActiveApp(app.path);

      // Developer 2 setup
      const dev2Backend = dev1Backend; // Share backend (simulates real backend)
      const dev2Workspace = new MockWorkspaceManager();
      dev2Workspace.addApp(app);
      dev2Workspace.scanWorkspace('/shared');
      dev2Workspace.setActiveApp(app.path);

      // Developer 1 gets IDs
      const dev1TableId = await dev1Backend.getNextId('collab-app', 'table', app.idRanges);
      const dev1PageId = await dev1Backend.getNextId('collab-app', 'page', app.idRanges);
      expect(dev1TableId).toBe(50000);
      expect(dev1PageId).toBe(50000);

      // Developer 1 syncs
      await dev1Backend.syncIds('collab-app', [
        { type: 'table', id: dev1TableId, name: 'Dev1Table' },
        { type: 'page', id: dev1PageId, name: 'Dev1Page' }
      ]);

      // Developer 2 gets IDs (should avoid conflicts)
      const dev2TableId = await dev2Backend.getNextId('collab-app', 'table', app.idRanges);
      const dev2CodeunitId = await dev2Backend.getNextId('collab-app', 'codeunit', app.idRanges);
      expect(dev2TableId).toBe(50001); // Next available
      expect(dev2CodeunitId).toBe(50000); // First for codeunit

      // Check for collisions
      const hasCollision = await dev2Backend.checkCollision('collab-app', 'table', 50000);
      expect(hasCollision).toBe(true);

      // Developer 2 syncs
      await dev2Backend.syncIds('collab-app', [
        { type: 'table', id: dev2TableId, name: 'Dev2Table' },
        { type: 'codeunit', id: dev2CodeunitId, name: 'Dev2Codeunit' }
      ]);

      // Verify final state
      const report = await dev2Backend.getConsumptionReport('collab-app');
      expect(report.table).toEqual([50000, 50001]);
      expect(report.page).toEqual([50000]);
      expect(report.codeunit).toEqual([50000]);
    });

    it('should handle conflict resolution', async () => {
      // Setup shared app
      backend.setConfig({ authorizedApps: ['shared-app'] });

      // Developer 1 reserves an ID
      await backend.syncIds('shared-app', [
        { type: 'table', id: 50100, name: 'ConflictTable' }
      ]);

      // Developer 2 tries to use same ID
      const hasConflict = await backend.checkCollision('shared-app', 'table', 50100);
      expect(hasConflict).toBe(true);

      // Developer 2 gets alternative
      const ranges = [{ from: 50000, to: 50999 }];
      let alternativeId = await backend.getNextId('shared-app', 'table', ranges);

      // Should get next available ID
      expect(alternativeId).toBe(50000);
    });
  });

  describe('Scenario 3: Large-Scale Migration', () => {
    it('should handle batch import of existing objects', async () => {
      // Scenario: Migrating legacy app with many existing objects

      const legacyApp: MockApp = {
        path: '/migration/LegacyApp',
        id: 'legacy-app',
        name: 'Legacy Application',
        publisher: 'OldCompany',
        version: '10.0.0.0',
        idRanges: [
          { from: 50000, to: 59999 },
          { from: 70000, to: 79999 }
        ]
      };

      workspace.addApp(legacyApp);
      workspace.scanWorkspace('/migration');
      workspace.setActiveApp(legacyApp.path);
      backend.setConfig({ authorizedApps: ['legacy-app'] });

      // Batch import existing objects
      const existingObjects = [
        // Tables
        ...Array(50).fill(null).map((_, i) => ({
          type: 'table',
          id: 50000 + i,
          name: `LegacyTable${i}`
        })),
        // Pages
        ...Array(30).fill(null).map((_, i) => ({
          type: 'page',
          id: 50100 + i,
          name: `LegacyPage${i}`
        })),
        // Codeunits
        ...Array(20).fill(null).map((_, i) => ({
          type: 'codeunit',
          id: 70000 + i,
          name: `LegacyCodeunit${i}`
        }))
      ];

      // Sync all at once
      await backend.syncIds('legacy-app', existingObjects);

      // Verify import
      const report = await backend.getConsumptionReport('legacy-app');
      expect(Object.keys(report)).toContain('table');
      expect(Object.keys(report)).toContain('page');
      expect(Object.keys(report)).toContain('codeunit');

      // Get next available IDs
      const nextTableId = await backend.getNextId('legacy-app', 'table', legacyApp.idRanges);
      expect(nextTableId).toBe(50050); // After 50 imported tables

      const nextPageId = await backend.getNextId('legacy-app', 'page', legacyApp.idRanges);
      expect(nextPageId).toBe(50000); // Pages start from beginning
    });

    it('should detect and resolve migration conflicts', async () => {
      // Two apps being merged
      const app1Ranges = [{ from: 50000, to: 54999 }];
      const app2Ranges = [{ from: 52000, to: 56999 }];

      // Check for overlaps
      const hasOverlap = checkRangeOverlap(app1Ranges, app2Ranges);
      expect(hasOverlap).toBe(true);

      // Find overlap region
      const overlapStart = Math.max(app1Ranges[0].from, app2Ranges[0].from);
      const overlapEnd = Math.min(app1Ranges[0].to, app2Ranges[0].to);
      expect(overlapStart).toBe(52000);
      expect(overlapEnd).toBe(54999);

      // Reserve non-overlapping ranges for migration
      const safeRanges = [
        { from: 50000, to: 51999 }, // App 1 safe zone
        { from: 55000, to: 56999 }, // App 2 safe zone
        { from: 60000, to: 69999 }  // New allocation
      ];

      // Verify no overlaps in safe ranges
      for (let i = 0; i < safeRanges.length - 1; i++) {
        for (let j = i + 1; j < safeRanges.length; j++) {
          const overlap = checkRangeOverlap([safeRanges[i]], [safeRanges[j]]);
          expect(overlap).toBe(false);
        }
      }
    });
  });

  describe('Scenario 4: Continuous Development Workflow', () => {
    it('should support iterative development cycle', async () => {
      // Setup
      const devApp: MockApp = {
        path: '/dev/MyApp',
        id: 'dev-app',
        name: 'Development App',
        publisher: 'DevTeam',
        version: '1.0.0.0',
        idRanges: [{ from: 50000, to: 50999 }]
      };

      workspace.addApp(devApp);
      workspace.scanWorkspace('/dev');
      workspace.setActiveApp(devApp.path);
      backend.setConfig({ authorizedApps: ['dev-app'] });

      // Day 1: Create initial objects
      const day1Ids = [];
      for (const type of ['table', 'page', 'codeunit']) {
        const id = await backend.getNextId('dev-app', type, devApp.idRanges);
        day1Ids.push({ type, id, name: `Day1_${type}` });
      }
      await backend.syncIds('dev-app', day1Ids);

      // Day 2: Add more objects
      const day2Ids = [];
      for (let i = 0; i < 3; i++) {
        const id = await backend.getNextId('dev-app', 'table', devApp.idRanges);
        day2Ids.push({ type: 'table', id, name: `Customer${i}` });
      }
      await backend.syncIds('dev-app', [...day1Ids, ...day2Ids]);

      // Day 3: Check consumption and plan
      const report = await backend.getConsumptionReport('dev-app');
      const totalConsumed = Object.values(report)
        .flat()
        .length;
      expect(totalConsumed).toBe(6);

      // Calculate remaining capacity
      const totalCapacity = devApp.idRanges.reduce(
        (sum, range) => sum + (range.to - range.from + 1),
        0
      );
      const remaining = totalCapacity - totalConsumed;
      expect(remaining).toBe(994);

      // Day 4: Collision detection for manual assignment
      const manualId = 50500;
      const hasCollision = await backend.checkCollision('dev-app', 'report', manualId);
      expect(hasCollision).toBe(false);

      // Safe to use manual ID
      await backend.syncIds('dev-app', [
        ...day1Ids,
        ...day2Ids,
        { type: 'report', id: manualId, name: 'SalesReport' }
      ]);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high-frequency ID requests', async () => {
      backend.setConfig({
        authorizedApps: ['perf-app'],
        latency: 1 // Minimal latency
      });

      const ranges = [{ from: 100000, to: 199999 }]; // Large range
      const startTime = Date.now();
      const ids: number[] = [];

      // Rapid-fire ID requests
      for (let i = 0; i < 100; i++) {
        const id = await backend.getNextId('perf-app', 'table', ranges);
        ids.push(id);
      }

      const duration = Date.now() - startTime;

      // Verify correctness
      expect(new Set(ids).size).toBe(100); // All unique
      expect(Math.min(...ids)).toBe(100000);
      expect(Math.max(...ids)).toBe(100099);

      // Performance check - adjust for test environment
      expect(duration).toBeLessThan(2000); // Under 2 seconds for 100 IDs in test env
    });

    it('should handle workspace with many apps', () => {
      // Create 100 apps
      for (let i = 0; i < 100; i++) {
        workspace.addApp({
          path: `/workspace/App${i}`,
          id: `app-${i}`,
          name: `Application ${i}`,
          publisher: 'MegaCorp',
          version: '1.0.0.0',
          idRanges: [{ from: 50000 + i * 1000, to: 50999 + i * 1000 }]
        });
      }

      const startTime = Date.now();
      const apps = workspace.scanWorkspace('/workspace');
      const scanDuration = Date.now() - startTime;

      expect(apps).toHaveLength(100);
      expect(scanDuration).toBeLessThan(100); // Should be very fast

      // Set active app performance
      const setStartTime = Date.now();
      workspace.setActiveApp('/workspace/App50');
      const setDuration = Date.now() - setStartTime;

      expect(workspace.getActiveApp()?.name).toBe('Application 50');
      expect(setDuration).toBeLessThan(10);
    });
  });
});

function checkRangeOverlap(
  ranges1: Array<{ from: number; to: number }>,
  ranges2: Array<{ from: number; to: number }>
): boolean {
  for (const r1 of ranges1) {
    for (const r2 of ranges2) {
      if (r1.from <= r2.to && r2.from <= r1.to) {
        return true;
      }
    }
  }
  return false;
}