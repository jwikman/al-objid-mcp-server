import { Logger } from '../utils/Logger';
import { ALObjectType } from '../types/ALObjectType';
import { BackendService } from '../backend/BackendService';
import { WorkspaceManager, WorkspaceApp } from '../workspace/WorkspaceManager';

export interface CollisionInfo {
  objectType: ALObjectType;
  id: number;
  apps: Array<{
    appId: string;
    appName: string;
    appPath: string;
  }>;
  severity: 'warning' | 'error';
  message: string;
}

export interface ConsumptionCache {
  appId: string;
  objectType: ALObjectType;
  ids: number[];
  lastUpdated: number;
}

export class CollisionDetector {
  private static instance: CollisionDetector;
  private logger: Logger;
  private backendService: BackendService;
  private workspaceManager: WorkspaceManager;
  private consumptionCache: Map<string, ConsumptionCache> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.logger = Logger.getInstance();
    this.backendService = new BackendService();
    this.workspaceManager = WorkspaceManager.getInstance();
  }

  static getInstance(): CollisionDetector {
    if (!this.instance) {
      this.instance = new CollisionDetector();
    }
    return this.instance;
  }

  /**
   * Check if an object ID would cause a collision
   */
  async checkCollision(
    objectType: ALObjectType,
    id: number,
    currentApp: WorkspaceApp
  ): Promise<CollisionInfo | null> {
    this.logger.verbose('Checking for collisions', { objectType, id, app: currentApp.name });

    const workspace = this.workspaceManager.getCurrentWorkspace();
    if (!workspace) {
      return null;
    }

    const collidingApps: Array<{
      appId: string;
      appName: string;
      appPath: string;
    }> = [];

    // Check against other apps in the workspace
    for (const app of workspace.apps) {
      if (app.appId === currentApp.appId) {
        continue; // Skip current app
      }

      // Check if the ID is within the app's ranges
      if (this.isIdInRanges(id, app.ranges)) {
        // Get consumption from backend or cache
        const consumption = await this.getAppConsumption(app, objectType);

        if (consumption && consumption.includes(id)) {
          collidingApps.push({
            appId: app.appId,
            appName: app.name,
            appPath: app.path
          });
        }
      }
    }

    if (collidingApps.length > 0) {
      return {
        objectType,
        id,
        apps: collidingApps,
        severity: 'error',
        message: `Object ID ${id} is already used by ${collidingApps.length} other app(s)`
      };
    }

    return null;
  }

  /**
   * Check for potential range overlaps between apps
   */
  async checkRangeOverlaps(): Promise<CollisionInfo[]> {
    const workspace = this.workspaceManager.getCurrentWorkspace();
    if (!workspace) {
      return [];
    }

    const overlaps: CollisionInfo[] = [];
    const apps = workspace.apps;

    for (let i = 0; i < apps.length; i++) {
      for (let j = i + 1; j < apps.length; j++) {
        const app1 = apps[i];
        const app2 = apps[j];

        const overlapRanges = this.findOverlappingRanges(app1.ranges, app2.ranges);

        if (overlapRanges.length > 0) {
          for (const range of overlapRanges) {
            overlaps.push({
              objectType: ALObjectType.Table, // Generic, as ranges apply to all types
              id: range.from,
              apps: [
                {
                  appId: app1.appId,
                  appName: app1.name,
                  appPath: app1.path
                },
                {
                  appId: app2.appId,
                  appName: app2.name,
                  appPath: app2.path
                }
              ],
              severity: 'warning',
              message: `Range ${range.from}..${range.to} is shared between ${app1.name} and ${app2.name}`
            });
          }
        }
      }
    }

    return overlaps;
  }

  /**
   * Get consumed IDs for an app from cache or backend
   */
  private async getAppConsumption(
    app: WorkspaceApp,
    objectType: ALObjectType
  ): Promise<number[] | null> {
    if (!app.isAuthorized || !app.authKey) {
      return null;
    }

    const cacheKey = `${app.appId}-${objectType}`;
    const cached = this.consumptionCache.get(cacheKey);

    // Check if cache is still valid
    if (cached && Date.now() - cached.lastUpdated < this.cacheTimeout) {
      return cached.ids;
    }

    try {
      // Fetch from backend
      const request = {
        appId: app.appId,
        authKey: app.authKey
      };
      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        // Extract consumption for specific object type
        const consumption = consumptionInfo[objectType] || [];
        
        // Update cache
        this.consumptionCache.set(cacheKey, {
          appId: app.appId,
          objectType,
          ids: consumption,
          lastUpdated: Date.now()
        });

        return consumption;
      }
    } catch (error) {
      this.logger.error('Failed to get consumption', { app: app.name, error });
    }

    return null;
  }

  /**
   * Check if an ID is within the given ranges
   */
  private isIdInRanges(id: number, ranges?: Array<{ from: number; to: number }>): boolean {
    if (!ranges) {
      return false;
    }

    for (const range of ranges) {
      if (id >= range.from && id <= range.to) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find overlapping ranges between two sets of ranges
   */
  private findOverlappingRanges(
    ranges1?: Array<{ from: number; to: number }>,
    ranges2?: Array<{ from: number; to: number }>
  ): Array<{ from: number; to: number }> {
    if (!ranges1 || !ranges2) {
      return [];
    }

    const overlaps: Array<{ from: number; to: number }> = [];

    for (const r1 of ranges1) {
      for (const r2 of ranges2) {
        const overlapStart = Math.max(r1.from, r2.from);
        const overlapEnd = Math.min(r1.to, r2.to);

        if (overlapStart <= overlapEnd) {
          overlaps.push({
            from: overlapStart,
            to: overlapEnd
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Pre-fetch consumption for all authorized apps in workspace
   */
  async prefetchWorkspaceConsumption(): Promise<void> {
    const workspace = this.workspaceManager.getCurrentWorkspace();
    if (!workspace) {
      return;
    }

    const objectTypes = [
      ALObjectType.Table,
      ALObjectType.Page,
      ALObjectType.Report,
      ALObjectType.Codeunit,
      ALObjectType.Query,
      ALObjectType.XmlPort,
      ALObjectType.Enum
    ];

    for (const app of workspace.apps) {
      if (app.isAuthorized && app.authKey) {
        for (const objectType of objectTypes) {
          // This will cache the consumption
          await this.getAppConsumption(app, objectType);
        }
      }
    }

    this.logger.info('Pre-fetched consumption for workspace', {
      apps: workspace.apps.filter(a => a.isAuthorized).length
    });
  }

  /**
   * Clear consumption cache
   */
  clearCache(): void {
    this.consumptionCache.clear();
  }

  /**
   * Invalidate cache for a specific app
   */
  invalidateAppCache(appId: string): void {
    for (const key of this.consumptionCache.keys()) {
      if (key.startsWith(appId)) {
        this.consumptionCache.delete(key);
      }
    }
  }
}