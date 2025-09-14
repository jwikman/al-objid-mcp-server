/**
 * Mock Backend Service for testing
 * Simulates the Azure Function backend API
 */

export interface MockBackendConfig {
  failAuth?: boolean;
  failNetwork?: boolean;
  latency?: number;
  authorizedApps?: string[];
}

export class MockBackendService {
  private config: MockBackendConfig;
  private callHistory: any[] = [];
  private consumedIds: Map<string, Set<number>> = new Map();

  constructor(config: MockBackendConfig = {}) {
    this.config = {
      failAuth: false,
      failNetwork: false,
      latency: 0,
      authorizedApps: [],
      ...config
    };
  }

  async simulateLatency() {
    if (this.config.latency) {
      await new Promise(resolve => setTimeout(resolve, this.config.latency));
    }
  }

  async checkAuthorization(appId: string): Promise<boolean> {
    this.callHistory.push({ method: 'checkAuthorization', appId });
    await this.simulateLatency();

    if (this.config.failNetwork) {
      throw new Error('Network error');
    }

    return this.config.authorizedApps?.includes(appId) || false;
  }

  async authorizeApp(appId: string, authKey: string): Promise<void> {
    this.callHistory.push({ method: 'authorizeApp', appId, authKey });
    await this.simulateLatency();

    if (this.config.failAuth) {
      throw new Error('Invalid authorization key');
    }

    if (authKey === 'valid-key-123') {
      this.config.authorizedApps?.push(appId);
    } else {
      throw new Error('Invalid authorization key');
    }
  }

  async getNextId(appId: string, objectType: string, ranges: any[]): Promise<number> {
    this.callHistory.push({ method: 'getNextId', appId, objectType, ranges });
    await this.simulateLatency();

    if (!this.config.authorizedApps?.includes(appId)) {
      throw new Error('App not authorized');
    }

    // Simple ID allocation logic
    const key = `${appId}-${objectType}`;
    const consumed = this.consumedIds.get(key) || new Set();

    for (const range of ranges) {
      for (let id = range.from; id <= range.to; id++) {
        if (!consumed.has(id)) {
          consumed.add(id);
          this.consumedIds.set(key, consumed);
          return id;
        }
      }
    }

    throw new Error('No available IDs in ranges');
  }

  async syncIds(appId: string, objects: any[]): Promise<void> {
    this.callHistory.push({ method: 'syncIds', appId, objects });
    await this.simulateLatency();

    if (this.config.failNetwork) {
      throw new Error('Network error');
    }

    if (!this.config.authorizedApps?.includes(appId)) {
      throw new Error('App not authorized');
    }

    // Store synced objects
    for (const obj of objects) {
      const key = `${appId}-${obj.type}`;
      const consumed = this.consumedIds.get(key) || new Set();
      consumed.add(obj.id);
      this.consumedIds.set(key, consumed);
    }
  }

  async checkCollision(appId: string, objectType: string, id: number): Promise<boolean> {
    this.callHistory.push({ method: 'checkCollision', appId, objectType, id });
    await this.simulateLatency();

    const key = `${appId}-${objectType}`;
    const consumed = this.consumedIds.get(key) || new Set();
    return consumed.has(id);
  }

  async getConsumptionReport(appId: string): Promise<any> {
    this.callHistory.push({ method: 'getConsumptionReport', appId });
    await this.simulateLatency();

    if (!this.config.authorizedApps?.includes(appId)) {
      throw new Error('App not authorized');
    }

    const report: any = {};
    for (const [key, ids] of this.consumedIds.entries()) {
      if (key.startsWith(appId)) {
        // Extract object type from key format: "appId-objectType"
        const objectType = key.substring(appId.length + 1); // +1 for the dash
        if (objectType) {
          report[objectType] = Array.from(ids).sort((a, b) => a - b);
        }
      }
    }

    return report;
  }

  // Test utilities
  getCallHistory() {
    return this.callHistory;
  }

  clearHistory() {
    this.callHistory = [];
  }

  setConfig(config: Partial<MockBackendConfig>) {
    this.config = { ...this.config, ...config };
  }

  reset() {
    this.callHistory = [];
    this.consumedIds.clear();
    this.config.authorizedApps = [];
  }
}