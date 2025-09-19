/**
 * Unit tests for Object ID Management Tools
 * Testing: get-next-id, sync-ids, get-consumption-report
 */

import { MockBackendService } from '../mocks/MockBackendService';
import { MockWorkspaceManager, MockApp } from '../mocks/MockWorkspaceManager';

describe('Object ID Management Tools', () => {
  let backend: MockBackendService;
  let workspace: MockWorkspaceManager;
  let testApp: MockApp;

  beforeEach(() => {
    testApp = {
      path: '/test/workspace/IDApp',
      id: 'id-app',
      name: 'ID Test App',
      publisher: 'Test',
      version: '1.0.0.0',
      idRanges: [
        { from: 50000, to: 50099 },
        { from: 70000, to: 70049 }
      ],
      authorized: true
    };

    backend = new MockBackendService({
      authorizedApps: [testApp.id]
    });

    workspace = new MockWorkspaceManager();
    workspace.addApp(testApp);
    workspace.scanWorkspace('/test/workspace');
    workspace.setActiveApp(testApp.path);
  });

  afterEach(() => {
    backend.reset();
    workspace.reset();
  });

  describe('get-next-id', () => {
    it('should get next ID for table object', async () => {
      const nextId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);

      expect(nextId).toBe(50000);
    });

    it('should get next ID for different object types', async () => {
      const objectTypes = ['table', 'page', 'codeunit', 'query', 'report', 'xmlport', 'enum'];

      for (const type of objectTypes) {
        backend.reset();
        backend.setConfig({ authorizedApps: [testApp.id] });

        const nextId = await backend.getNextId(testApp.id, type, testApp.idRanges);
        expect(nextId).toBeGreaterThanOrEqual(50000);
        expect(nextId).toBeLessThanOrEqual(70049);
      }
    });

    it('should respect app.json ranges', async () => {
      const ids: number[] = [];

      // Get 10 IDs
      for (let i = 0; i < 10; i++) {
        const id = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
        ids.push(id);
      }

      // All should be unique
      expect(new Set(ids).size).toBe(10);

      // All should be within ranges
      ids.forEach(id => {
        const inRange = testApp.idRanges.some(r => id >= r.from && id <= r.to);
        expect(inRange).toBe(true);
      });
    });

    it('should get next ID with custom ranges', async () => {
      const customRanges = [{ from: 80000, to: 80010 }];
      const nextId = await backend.getNextId(testApp.id, 'page', customRanges);

      expect(nextId).toBeGreaterThanOrEqual(80000);
      expect(nextId).toBeLessThanOrEqual(80010);
    });

    it('should fail for unauthorized app', async () => {
      backend.setConfig({ authorizedApps: [] });

      await expect(
        backend.getNextId(testApp.id, 'table', testApp.idRanges)
      ).rejects.toThrow('App not authorized');
    });

    it('should fail with exhausted ranges', async () => {
      const tinyRange = [{ from: 90000, to: 90002 }]; // Only 3 IDs

      // Consume all IDs
      await backend.getNextId(testApp.id, 'enum', tinyRange);
      await backend.getNextId(testApp.id, 'enum', tinyRange);
      await backend.getNextId(testApp.id, 'enum', tinyRange);

      // Next should fail
      await expect(
        backend.getNextId(testApp.id, 'enum', tinyRange)
      ).rejects.toThrow('No available IDs');
    });

    it('should handle concurrent get-next-id calls', async () => {
      const promises = Array(5).fill(null).map(() =>
        backend.getNextId(testApp.id, 'table', testApp.idRanges)
      );

      const ids = await Promise.all(promises);

      // All IDs should be unique
      expect(new Set(ids).size).toBe(5);

      // All should be in valid range
      ids.forEach(id => {
        expect(id).toBeGreaterThanOrEqual(50000);
        expect(id).toBeLessThanOrEqual(70049);
      });
    });

    it('should track different object types separately', async () => {
      const tableId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      const pageId = await backend.getNextId(testApp.id, 'page', testApp.idRanges);
      const codeunitId = await backend.getNextId(testApp.id, 'codeunit', testApp.idRanges);

      // First ID for each type should be the same (50000)
      expect(tableId).toBe(50000);
      expect(pageId).toBe(50000);
      expect(codeunitId).toBe(50000);

      // Second ID for table should be 50001
      const tableId2 = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(tableId2).toBe(50001);
    });
  });

  describe('sync-ids', () => {
    it('should sync with no changes', async () => {
      await backend.syncIds(testApp.id, []);

      const history = backend.getCallHistory();
      expect(history).toContainEqual(
        expect.objectContaining({
          method: 'syncIds',
          appId: testApp.id,
          objects: []
        })
      );
    });

    it('should sync new IDs assigned', async () => {
      const objects = [
        { type: 'table', id: 50000, name: 'Customer Extension' },
        { type: 'page', id: 50001, name: 'Customer List Extension' },
        { type: 'codeunit', id: 50002, name: 'Customer Management' }
      ];

      await backend.syncIds(testApp.id, objects);

      // Verify IDs are now consumed
      const nextTableId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(nextTableId).toBe(50001); // 50000 is taken

      const nextPageId = await backend.getNextId(testApp.id, 'page', testApp.idRanges);
      expect(nextPageId).toBe(50000); // 50001 is taken by table, not page
    });

    it('should sync with deleted objects', async () => {
      // First sync some objects
      const initialObjects = [
        { type: 'table', id: 50000, name: 'Table1' },
        { type: 'table', id: 50001, name: 'Table2' },
        { type: 'table', id: 50002, name: 'Table3' }
      ];
      await backend.syncIds(testApp.id, initialObjects);

      // Sync again with one deleted (only 50000 and 50002)
      const updatedObjects = [
        { type: 'table', id: 50000, name: 'Table1' },
        { type: 'table', id: 50002, name: 'Table3' }
      ];
      await backend.syncIds(testApp.id, updatedObjects);

      // Note: In real implementation, 50001 might become available again
      // For this mock, it remains consumed
      const nextId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(nextId).toBe(50003);
    });

    it('should fail sync for unauthorized app', async () => {
      backend.setConfig({ authorizedApps: [] });

      await expect(
        backend.syncIds(testApp.id, [{ type: 'table', id: 50000, name: 'Test' }])
      ).rejects.toThrow('App not authorized');
    });

    it('should handle backend failures with retry', async () => {
      // First call fails
      backend.setConfig({ failNetwork: true });
      await expect(
        backend.syncIds(testApp.id, [])
      ).rejects.toThrow('Network error');

      // Reset and retry
      backend.setConfig({ failNetwork: false });
      await backend.syncIds(testApp.id, []);

      const history = backend.getCallHistory();
      const syncCalls = history.filter(h => h.method === 'syncIds');
      expect(syncCalls).toHaveLength(2);
    });

    it('should batch sync large number of objects', async () => {
      const objects = Array(100).fill(null).map((_, i) => ({
        type: 'table',
        id: 50000 + i,
        name: `Table${i}`
      }));

      await backend.syncIds(testApp.id, objects);

      // Verify all are consumed
      const nextId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(nextId).toBe(70000); // Jumped to second range
    });
  });

  describe('get-consumption-report', () => {
    beforeEach(async () => {
      // Pre-consume some IDs
      await backend.getNextId(testApp.id, 'table', testApp.idRanges); // 50000
      await backend.getNextId(testApp.id, 'table', testApp.idRanges); // 50001
      await backend.getNextId(testApp.id, 'page', testApp.idRanges);  // 50000
      await backend.getNextId(testApp.id, 'codeunit', testApp.idRanges); // 50000
    });

    it('should get report for app with consumption', async () => {
      const report = await backend.getConsumptionReport(testApp.id);

      expect(report).toMatchObject({
        table: [50000, 50001],
        page: [50000],
        codeunit: [50000]
      });
    });

    it('should get report for app with no consumption', async () => {
      backend.reset();
      backend.setConfig({ authorizedApps: [testApp.id] });

      const report = await backend.getConsumptionReport(testApp.id);
      expect(report).toEqual({});
    });

    it('should calculate consumption statistics', async () => {
      const report = await backend.getConsumptionReport(testApp.id);

      // Count total consumed
      const totalConsumed = Object.values(report)
        .flat()
        .length;

      expect(totalConsumed).toBe(4);
    });

    it('should fail for unauthorized app', async () => {
      backend.setConfig({ authorizedApps: [] });

      await expect(
        backend.getConsumptionReport(testApp.id)
      ).rejects.toThrow('App not authorized');
    });

    it('should report per object type', async () => {
      // Consume more IDs
      for (let i = 0; i < 10; i++) {
        await backend.getNextId(testApp.id, 'report', testApp.idRanges);
      }

      const report = await backend.getConsumptionReport(testApp.id);

      expect(report.report).toBeDefined();
      expect(report.report).toHaveLength(10);
      expect(report.report[0]).toBe(50000);
      expect(report.report[9]).toBe(50009);
    });
  });

  describe('ID assignment workflow', () => {
    it('should complete full ID assignment flow', async () => {
      // 1. Get next ID
      const tableId = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      expect(tableId).toBe(50000);

      // 2. Get more IDs
      const pageId = await backend.getNextId(testApp.id, 'page', testApp.idRanges);
      const codeunitId = await backend.getNextId(testApp.id, 'codeunit', testApp.idRanges);

      // 3. Sync to backend
      await backend.syncIds(testApp.id, [
        { type: 'table', id: tableId, name: 'MyTable' },
        { type: 'page', id: pageId, name: 'MyPage' },
        { type: 'codeunit', id: codeunitId, name: 'MyCodeunit' }
      ]);

      // 4. Get consumption report
      const report = await backend.getConsumptionReport(testApp.id);

      expect(report).toMatchObject({
        table: [50000],
        page: [50000],
        codeunit: [50000]
      });
    });

    it('should handle ID conflicts during assignment', async () => {
      // Pre-consume an ID
      await backend.syncIds(testApp.id, [
        { type: 'table', id: 50005, name: 'ExistingTable' }
      ]);

      // Get IDs that will skip the consumed one
      const ids: number[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await backend.getNextId(testApp.id, 'table', testApp.idRanges);
        ids.push(id);
      }

      // 50005 should be skipped
      expect(ids).not.toContain(50005);
      expect(ids).toContain(50004);
      expect(ids).toContain(50006);
    });
  });

  describe('Performance', () => {
    it('should get next ID quickly', async () => {
      backend.setConfig({ latency: 5 });

      const start = Date.now();
      await backend.getNextId(testApp.id, 'table', testApp.idRanges);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300); // Increased for test environment variability
    });

    it('should handle 1000 sequential ID assignments', async () => {
      const largeRange = [{ from: 100000, to: 110000 }];
      const ids: number[] = [];

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        const id = await backend.getNextId(testApp.id, 'table', largeRange);
        ids.push(id);
      }
      const duration = Date.now() - start;

      // All should be unique
      expect(new Set(ids).size).toBe(1000);

      // Should complete reasonably fast
      expect(duration).toBeLessThan(5000);
    });
  });
});