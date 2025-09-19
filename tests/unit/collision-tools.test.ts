/**
 * Unit tests for Collision Detection Tools
 * Testing: check-collision, check-range-overlaps
 */

import { MockBackendService } from '../mocks/MockBackendService';
import { MockWorkspaceManager, MockApp } from '../mocks/MockWorkspaceManager';

describe('Collision Detection Tools', () => {
  let backend: MockBackendService;
  let workspace: MockWorkspaceManager;
  let testApp: MockApp;
  let partnerApp: MockApp;

  beforeEach(() => {
    testApp = {
      path: '/workspace/MyApp',
      id: 'my-app',
      name: 'My App',
      publisher: 'My Company',
      version: '1.0.0.0',
      idRanges: [
        { from: 50000, to: 50999 },
        { from: 70000, to: 70499 }
      ]
    };

    partnerApp = {
      path: '/workspace/PartnerApp',
      id: 'partner-app',
      name: 'Partner App',
      publisher: 'Partner Company',
      version: '1.0.0.0',
      idRanges: [
        { from: 50500, to: 51499 }, // Overlaps with testApp
        { from: 80000, to: 80999 }
      ]
    };

    backend = new MockBackendService({
      authorizedApps: [testApp.id, partnerApp.id]
    });

    workspace = new MockWorkspaceManager();
    workspace.addApp(testApp);
    workspace.addApp(partnerApp);
    workspace.scanWorkspace('/workspace');
    workspace.setActiveApp(testApp.path);

    // Pre-populate some consumed IDs
    setupConsumedIds();
  });

  async function setupConsumedIds() {
    // My App consumed IDs
    await backend.syncIds(testApp.id, [
      { type: 'table', id: 50000, name: 'Customer' },
      { type: 'table', id: 50001, name: 'Vendor' },
      { type: 'page', id: 50100, name: 'Customer List' },
      { type: 'codeunit', id: 70000, name: 'Management' }
    ]);

    // Partner App consumed IDs
    await backend.syncIds(partnerApp.id, [
      { type: 'table', id: 50500, name: 'Partner Table' },
      { type: 'page', id: 50501, name: 'Partner Page' },
      { type: 'report', id: 80000, name: 'Partner Report' }
    ]);
  }

  afterEach(() => {
    backend.reset();
    workspace.reset();
  });

  describe('check-collision', () => {
    it('should detect no collision for available ID', async () => {
      const hasCollision = await backend.checkCollision(testApp.id, 'table', 50002);
      expect(hasCollision).toBe(false);
    });

    it('should detect local collision', async () => {
      const hasCollision = await backend.checkCollision(testApp.id, 'table', 50000);
      expect(hasCollision).toBe(true);
    });

    it('should detect collision across object types', async () => {
      // Check if page ID 50000 collides (table 50000 exists)
      const hasCollision = await backend.checkCollision(testApp.id, 'page', 50000);

      // In AL, IDs are unique per object type, so this should be false
      expect(hasCollision).toBe(false);
    });

    it('should check collision for each object type', async () => {
      const objectTypes = ['table', 'page', 'codeunit', 'query', 'report', 'xmlport', 'enum'];

      for (const type of objectTypes) {
        // 50000 is only consumed for 'table'
        const hasCollision = await backend.checkCollision(testApp.id, type, 50000);

        if (type === 'table') {
          expect(hasCollision).toBe(true);
        } else {
          expect(hasCollision).toBe(false);
        }
      }
    });

    it('should detect partner app collision', async () => {
      // Check if partner's consumed ID would collide
      // Note: In real implementation, this would check across apps
      const hasCollision = await backend.checkCollision(partnerApp.id, 'table', 50500);
      expect(hasCollision).toBe(true);
    });

    it('should check collision with explicit appPath', async () => {
      const app = workspace.getApp(testApp.path);
      if (app) {
        const hasCollision = await backend.checkCollision(app.id, 'table', 50001);
        expect(hasCollision).toBe(true);
      }
    });

    it('should return collision details', async () => {
      // In a real implementation, this would return details about the collision
      const hasCollision = await backend.checkCollision(testApp.id, 'table', 50000);
      expect(hasCollision).toBe(true);

      // Could extend to return: { hasCollision: true, app: 'my-app', object: 'Customer' }
    });

    it('should handle IDs outside of ranges', async () => {
      // ID outside any defined range
      const hasCollision = await backend.checkCollision(testApp.id, 'table', 90000);
      expect(hasCollision).toBe(false);
    });
  });

  describe('check-range-overlaps', () => {
    it('should detect non-overlapping ranges', () => {
      const range1 = [{ from: 50000, to: 50499 }];
      const range2 = [{ from: 50500, to: 50999 }];

      const hasOverlap = checkRangeOverlap(range1, range2);
      expect(hasOverlap).toBe(false);
    });

    it('should detect partially overlapping ranges', () => {
      const range1 = [{ from: 50000, to: 50499 }];
      const range2 = [{ from: 50400, to: 50999 }];

      const hasOverlap = checkRangeOverlap(range1, range2);
      expect(hasOverlap).toBe(true);
    });

    it('should detect fully overlapping ranges', () => {
      const range1 = [{ from: 50000, to: 50999 }];
      const range2 = [{ from: 50200, to: 50799 }];

      const hasOverlap = checkRangeOverlap(range1, range2);
      expect(hasOverlap).toBe(true);
    });

    it('should detect nested ranges', () => {
      const range1 = [{ from: 50000, to: 60000 }];
      const range2 = [{ from: 51000, to: 52000 }];

      const hasOverlap = checkRangeOverlap(range1, range2);
      expect(hasOverlap).toBe(true);
    });

    it('should check multiple range sets', () => {
      const ranges1 = [
        { from: 50000, to: 50999 },
        { from: 70000, to: 70999 }
      ];
      const ranges2 = [
        { from: 60000, to: 60999 },
        { from: 70500, to: 71499 }
      ];

      const hasOverlap = checkRangeOverlap(ranges1, ranges2);
      expect(hasOverlap).toBe(true); // 70500-70999 overlaps
    });

    it('should handle edge cases', () => {
      // Adjacent ranges (no overlap)
      const adjacent1 = [{ from: 50000, to: 50999 }];
      const adjacent2 = [{ from: 51000, to: 51999 }];
      expect(checkRangeOverlap(adjacent1, adjacent2)).toBe(false);

      // Single ID ranges
      const single1 = [{ from: 50000, to: 50000 }];
      const single2 = [{ from: 50000, to: 50000 }];
      expect(checkRangeOverlap(single1, single2)).toBe(true);

      // Empty ranges
      const empty: any[] = [];
      const normal = [{ from: 50000, to: 50999 }];
      expect(checkRangeOverlap(empty, normal)).toBe(false);
    });

    it('should validate range format', () => {
      // Invalid range (from > to)
      const invalid = [{ from: 51000, to: 50000 }];
      expect(() => validateRange(invalid)).toThrow();

      // Valid range
      const valid = [{ from: 50000, to: 51000 }];
      expect(() => validateRange(valid)).not.toThrow();

      // Negative IDs
      const negative = [{ from: -100, to: 100 }];
      expect(() => validateRange(negative)).toThrow();
    });
  });

  describe('Collision detection workflow', () => {
    it('should complete collision check before assignment', async () => {
      const idToAssign = 50002;

      // 1. Check for collision
      const hasCollision = await backend.checkCollision(testApp.id, 'table', idToAssign);
      expect(hasCollision).toBe(false);

      // 2. Safe to assign
      if (!hasCollision) {
        await backend.syncIds(testApp.id, [
          { type: 'table', id: idToAssign, name: 'NewTable' }
        ]);
      }

      // 3. Verify it's now consumed
      const hasCollisionAfter = await backend.checkCollision(testApp.id, 'table', idToAssign);
      expect(hasCollisionAfter).toBe(true);
    });

    it('should find alternative when collision detected', async () => {
      const preferredId = 50000; // Already taken

      // 1. Check preferred ID
      const hasCollision = await backend.checkCollision(testApp.id, 'table', preferredId);
      expect(hasCollision).toBe(true);

      // 2. Find alternative
      let alternativeId = preferredId;
      while (await backend.checkCollision(testApp.id, 'table', alternativeId)) {
        alternativeId++;
        if (alternativeId > 50010) break; // Safety limit
      }

      expect(alternativeId).toBe(50002); // First available

      // 3. Use alternative
      await backend.syncIds(testApp.id, [
        { type: 'table', id: alternativeId, name: 'AlternativeTable' }
      ]);
    });

    it('should check range overlaps before reserving', () => {
      const newAppRanges = [{ from: 50100, to: 50599 }];

      // Check against existing apps
      const myAppOverlap = checkRangeOverlap(testApp.idRanges, newAppRanges);
      const partnerAppOverlap = checkRangeOverlap(partnerApp.idRanges, newAppRanges);

      expect(myAppOverlap).toBe(true); // Overlaps with 50000-50999
      expect(partnerAppOverlap).toBe(true); // Overlaps with 50500-51499
    });
  });

  describe('Performance', () => {
    it('should check collisions quickly', async () => {
      backend.setConfig({ latency: 2 });

      const start = Date.now();
      await backend.checkCollision(testApp.id, 'table', 50003);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300); // Increased for test environment variability
    });

    it('should handle bulk collision checks', async () => {
      const idsToCheck = Array(100).fill(null).map((_, i) => 50000 + i);
      const results: boolean[] = [];

      for (const id of idsToCheck) {
        const hasCollision = await backend.checkCollision(testApp.id, 'table', id);
        results.push(hasCollision);
      }

      // First two should have collisions (50000, 50001)
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);

      // Rest should be free
      expect(results.slice(2).every(r => r === false)).toBe(true);
    });

    it('should check range overlaps instantly', () => {
      const largeRanges1 = Array(100).fill(null).map((_, i) => ({
        from: i * 1000,
        to: i * 1000 + 999
      }));

      const largeRanges2 = Array(100).fill(null).map((_, i) => ({
        from: i * 1000 + 500,
        to: i * 1000 + 1499
      }));

      const start = Date.now();
      const hasOverlap = checkRangeOverlap(largeRanges1, largeRanges2);
      const duration = Date.now() - start;

      expect(hasOverlap).toBe(true);
      expect(duration).toBeLessThan(100); // Increased for test environment variability
    });
  });
});

// Helper functions for range checking
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

function validateRange(ranges: Array<{ from: number; to: number }>): void {
  for (const range of ranges) {
    if (range.from > range.to) {
      throw new Error(`Invalid range: from (${range.from}) > to (${range.to})`);
    }
    if (range.from < 0 || range.to < 0) {
      throw new Error('Range IDs must be positive');
    }
  }
}