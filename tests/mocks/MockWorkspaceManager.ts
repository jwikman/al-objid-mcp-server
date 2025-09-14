/**
 * Mock Workspace Manager for testing
 */

import * as path from 'path';

export interface MockApp {
  path: string;
  id: string;
  name: string;
  publisher: string;
  version: string;
  idRanges: Array<{ from: number; to: number }>;
  authorized?: boolean;
}

export class MockWorkspaceManager {
  private apps: Map<string, MockApp> = new Map();
  private activeApp: MockApp | null = null;
  private scanned: boolean = false;

  addApp(app: MockApp): void {
    // Normalize path for cross-platform compatibility
    const normalizedPath = path.normalize(app.path);
    this.apps.set(normalizedPath, { ...app, path: normalizedPath });
  }

  scanWorkspace(workspacePath: string): MockApp[] {
    this.scanned = true;
    // In real implementation, this would scan filesystem
    // For mock, we just return pre-configured apps
    return Array.from(this.apps.values()).filter(app =>
      app.path.startsWith(path.normalize(workspacePath))
    );
  }

  setActiveApp(appPath: string): void {
    if (!this.scanned) {
      throw new Error('Workspace not scanned. Run scan-workspace first.');
    }

    const normalizedPath = path.normalize(appPath);

    // Handle different path formats
    let app = this.apps.get(normalizedPath);

    if (!app) {
      // Try with app.json suffix
      app = this.apps.get(normalizedPath.replace(/[\\\/]app\.json$/, ''));
    }

    if (!app) {
      // Try without app.json suffix
      app = this.apps.get(path.join(normalizedPath, 'app.json').replace(/[\\\/]app\.json$/, ''));
    }

    if (!app) {
      // Search by partial match
      for (const [key, value] of this.apps.entries()) {
        if (key.includes(normalizedPath) || normalizedPath.includes(key)) {
          app = value;
          break;
        }
      }
    }

    if (!app) {
      throw new Error(`App not found in workspace: ${appPath}`);
    }

    this.activeApp = app;
  }

  getActiveApp(): MockApp | null {
    return this.activeApp;
  }

  getApp(appPath: string): MockApp | null {
    const normalizedPath = path.normalize(appPath);
    return this.apps.get(normalizedPath) || null;
  }

  getAllApps(): MockApp[] {
    return Array.from(this.apps.values());
  }

  isScanned(): boolean {
    return this.scanned;
  }

  reset(): void {
    this.apps.clear();
    this.activeApp = null;
    this.scanned = false;
  }

  getWorkspaceInfo(): any {
    return {
      scanned: this.scanned,
      appsCount: this.apps.size,
      apps: Array.from(this.apps.values()).map(app => ({
        path: app.path,
        name: app.name,
        id: app.id,
        isActive: app === this.activeApp
      })),
      activeApp: this.activeApp ? {
        name: this.activeApp.name,
        path: this.activeApp.path
      } : null
    };
  }
}