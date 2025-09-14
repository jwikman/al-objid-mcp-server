/**
 * Unit tests for Workspace Management Tools
 * Testing: scan-workspace, set-active-app, get-workspace-info, get-active-app
 */

import { MockWorkspaceManager, MockApp } from '../mocks/MockWorkspaceManager';
import * as path from 'path';

describe('Workspace Management Tools', () => {
  let workspaceManager: MockWorkspaceManager;

  beforeEach(() => {
    workspaceManager = new MockWorkspaceManager();
  });

  afterEach(() => {
    workspaceManager.reset();
  });

  describe('scan-workspace', () => {
    it('should scan empty workspace successfully', () => {
      const apps = workspaceManager.scanWorkspace('/test/workspace');

      expect(apps).toEqual([]);
      expect(workspaceManager.isScanned()).toBe(true);
    });

    it('should scan workspace with single AL app', () => {
      const testApp: MockApp = {
        path: '/test/workspace/App1',
        id: 'app1-id',
        name: 'Test App 1',
        publisher: 'Test Publisher',
        version: '1.0.0.0',
        idRanges: [{ from: 50000, to: 50099 }]
      };

      workspaceManager.addApp(testApp);
      const apps = workspaceManager.scanWorkspace('/test/workspace');

      expect(apps).toHaveLength(1);
      expect(apps[0]).toMatchObject({
        name: 'Test App 1',
        id: 'app1-id'
      });
    });

    it('should scan workspace with multiple AL apps', () => {
      const apps: MockApp[] = [
        {
          path: '/test/workspace/App1',
          id: 'app1-id',
          name: 'App 1',
          publisher: 'Publisher',
          version: '1.0.0.0',
          idRanges: [{ from: 50000, to: 50099 }]
        },
        {
          path: '/test/workspace/App2',
          id: 'app2-id',
          name: 'App 2',
          publisher: 'Publisher',
          version: '1.0.0.0',
          idRanges: [{ from: 50100, to: 50199 }]
        },
        {
          path: '/test/workspace/Nested/App3',
          id: 'app3-id',
          name: 'App 3',
          publisher: 'Publisher',
          version: '1.0.0.0',
          idRanges: [{ from: 50200, to: 50299 }]
        }
      ];

      apps.forEach(app => workspaceManager.addApp(app));
      const scannedApps = workspaceManager.scanWorkspace('/test/workspace');

      expect(scannedApps).toHaveLength(3);
      expect(scannedApps.map(a => a.name)).toEqual(['App 1', 'App 2', 'App 3']);
    });

    it('should handle nested AL apps', () => {
      const apps: MockApp[] = [
        {
          path: '/test/workspace/Parent',
          id: 'parent-id',
          name: 'Parent App',
          publisher: 'Publisher',
          version: '1.0.0.0',
          idRanges: [{ from: 60000, to: 60099 }]
        },
        {
          path: '/test/workspace/Parent/Child',
          id: 'child-id',
          name: 'Child App',
          publisher: 'Publisher',
          version: '1.0.0.0',
          idRanges: [{ from: 60100, to: 60199 }]
        }
      ];

      apps.forEach(app => workspaceManager.addApp(app));
      const scannedApps = workspaceManager.scanWorkspace('/test/workspace');

      expect(scannedApps).toHaveLength(2);
      expect(scannedApps.find(a => a.name === 'Parent App')).toBeDefined();
      expect(scannedApps.find(a => a.name === 'Child App')).toBeDefined();
    });

    it('should extract app metadata correctly', () => {
      const testApp: MockApp = {
        path: '/test/workspace/DetailedApp',
        id: 'f4b69b55-c90d-4937-8f53-2742898fa948',
        name: 'Detailed Test App',
        publisher: 'Continia Software',
        version: '26.3.0.0',
        idRanges: [
          { from: 6175271, to: 6175499 },
          { from: 50000, to: 50099 }
        ]
      };

      workspaceManager.addApp(testApp);
      const apps = workspaceManager.scanWorkspace('/test/workspace');

      expect(apps[0]).toMatchObject({
        id: 'f4b69b55-c90d-4937-8f53-2742898fa948',
        name: 'Detailed Test App',
        publisher: 'Continia Software',
        version: '26.3.0.0',
        idRanges: expect.arrayContaining([
          { from: 6175271, to: 6175499 },
          { from: 50000, to: 50099 }
        ])
      });
    });
  });

  describe('set-active-app', () => {
    const testApp: MockApp = {
      path: '/test/workspace/ActiveApp',
      id: 'active-app-id',
      name: 'Active Test App',
      publisher: 'Test',
      version: '1.0.0.0',
      idRanges: [{ from: 70000, to: 70099 }]
    };

    beforeEach(() => {
      workspaceManager.addApp(testApp);
    });

    it('should set active app after successful scan', () => {
      workspaceManager.scanWorkspace('/test/workspace');
      workspaceManager.setActiveApp('/test/workspace/ActiveApp');

      const activeApp = workspaceManager.getActiveApp();
      expect(activeApp).toBeDefined();
      expect(activeApp?.name).toBe('Active Test App');
    });

    it('should fail to set active app without prior scan', () => {
      expect(() => {
        workspaceManager.setActiveApp('/test/workspace/ActiveApp');
      }).toThrow('Workspace not scanned');
    });

    it('should fail with non-existent app path', () => {
      workspaceManager.scanWorkspace('/test/workspace');

      expect(() => {
        workspaceManager.setActiveApp('/test/workspace/NonExistent');
      }).toThrow('App not found');
    });

    it('should handle different path formats', () => {
      workspaceManager.scanWorkspace('/test/workspace');

      // Forward slashes
      workspaceManager.setActiveApp('/test/workspace/ActiveApp');
      expect(workspaceManager.getActiveApp()?.name).toBe('Active Test App');

      // Backslashes (Windows)
      workspaceManager.reset();
      workspaceManager.addApp({
        ...testApp,
        path: 'C:\\test\\workspace\\ActiveApp'
      });
      workspaceManager.scanWorkspace('C:\\test\\workspace');
      workspaceManager.setActiveApp('C:\\test\\workspace\\ActiveApp');
      expect(workspaceManager.getActiveApp()?.name).toBe('Active Test App');
    });

    it('should persist active app across calls', () => {
      workspaceManager.scanWorkspace('/test/workspace');
      workspaceManager.setActiveApp('/test/workspace/ActiveApp');

      // Simulate multiple calls
      const app1 = workspaceManager.getActiveApp();
      const app2 = workspaceManager.getActiveApp();

      expect(app1).toBe(app2);
      expect(app1?.name).toBe('Active Test App');
    });

    it('should switch between multiple active apps', () => {
      const app2: MockApp = {
        path: '/test/workspace/SecondApp',
        id: 'second-app-id',
        name: 'Second App',
        publisher: 'Test',
        version: '1.0.0.0',
        idRanges: [{ from: 80000, to: 80099 }]
      };

      workspaceManager.addApp(app2);
      workspaceManager.scanWorkspace('/test/workspace');

      // Set first app
      workspaceManager.setActiveApp('/test/workspace/ActiveApp');
      expect(workspaceManager.getActiveApp()?.name).toBe('Active Test App');

      // Switch to second app
      workspaceManager.setActiveApp('/test/workspace/SecondApp');
      expect(workspaceManager.getActiveApp()?.name).toBe('Second App');
    });
  });

  describe('get-workspace-info', () => {
    it('should return info with no workspace scanned', () => {
      const info = workspaceManager.getWorkspaceInfo();

      expect(info).toMatchObject({
        scanned: false,
        appsCount: 0,
        apps: [],
        activeApp: null
      });
    });

    it('should return info after scan but no active app', () => {
      const apps: MockApp[] = [
        {
          path: '/test/workspace/App1',
          id: 'app1',
          name: 'App 1',
          publisher: 'Test',
          version: '1.0.0.0',
          idRanges: [{ from: 90000, to: 90099 }]
        },
        {
          path: '/test/workspace/App2',
          id: 'app2',
          name: 'App 2',
          publisher: 'Test',
          version: '1.0.0.0',
          idRanges: [{ from: 90100, to: 90199 }]
        }
      ];

      apps.forEach(app => workspaceManager.addApp(app));
      workspaceManager.scanWorkspace('/test/workspace');

      const info = workspaceManager.getWorkspaceInfo();

      expect(info).toMatchObject({
        scanned: true,
        appsCount: 2,
        activeApp: null
      });
      expect(info.apps).toHaveLength(2);
      expect(info.apps.every((a: any) => !a.isActive)).toBe(true);
    });

    it('should return info with active app set', () => {
      const testApp: MockApp = {
        path: '/test/workspace/ActiveApp',
        id: 'active-id',
        name: 'Active App',
        publisher: 'Test',
        version: '1.0.0.0',
        idRanges: [{ from: 95000, to: 95099 }]
      };

      workspaceManager.addApp(testApp);
      workspaceManager.scanWorkspace('/test/workspace');
      workspaceManager.setActiveApp('/test/workspace/ActiveApp');

      const info = workspaceManager.getWorkspaceInfo();

      expect(info).toMatchObject({
        scanned: true,
        appsCount: 1,
        activeApp: {
          name: 'Active App',
          path: expect.stringContaining('ActiveApp')
        }
      });
      expect(info.apps[0].isActive).toBe(true);
    });

    it('should return complete workspace structure', () => {
      const apps: MockApp[] = [
        {
          path: '/workspace/App1',
          id: 'id1',
          name: 'App 1',
          publisher: 'Pub',
          version: '1.0',
          idRanges: [{ from: 100000, to: 100099 }]
        },
        {
          path: '/workspace/App2',
          id: 'id2',
          name: 'App 2',
          publisher: 'Pub',
          version: '2.0',
          idRanges: [{ from: 100100, to: 100199 }]
        },
        {
          path: '/workspace/Nested/App3',
          id: 'id3',
          name: 'App 3',
          publisher: 'Pub',
          version: '3.0',
          idRanges: [{ from: 100200, to: 100299 }]
        }
      ];

      apps.forEach(app => workspaceManager.addApp(app));
      workspaceManager.scanWorkspace('/workspace');
      workspaceManager.setActiveApp('/workspace/App2');

      const info = workspaceManager.getWorkspaceInfo();

      expect(info.appsCount).toBe(3);
      expect(info.apps).toHaveLength(3);
      expect(info.apps.find((a: any) => a.name === 'App 2').isActive).toBe(true);
      expect(info.activeApp.name).toBe('App 2');
    });
  });

  describe('get-active-app', () => {
    it('should return active app when set', () => {
      const app: MockApp = {
        path: '/test/GetActiveApp',
        id: 'get-active-id',
        name: 'Get Active App',
        publisher: 'Test',
        version: '1.0.0.0',
        idRanges: [{ from: 110000, to: 110099 }]
      };

      workspaceManager.addApp(app);
      workspaceManager.scanWorkspace('/test');
      workspaceManager.setActiveApp('/test/GetActiveApp');

      const activeApp = workspaceManager.getActiveApp();

      expect(activeApp).toBeDefined();
      expect(activeApp).toMatchObject({
        name: 'Get Active App',
        id: 'get-active-id'
      });
    });

    it('should return null when no active app', () => {
      workspaceManager.scanWorkspace('/test');
      const activeApp = workspaceManager.getActiveApp();
      expect(activeApp).toBeNull();
    });
  });
});