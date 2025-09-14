import { AppInfo, CheckAppResponse, GetNextResponse, AuthorizeAppResponse, SyncIdsResponse, ConsumptionResponse } from '../../src/lib/types/backend';
import { ALObjectType } from '../../src/lib/types/al';

export class MockResponseBuilder {
  static checkApp(managed: boolean): CheckAppResponse {
    return { managed };
  }

  static getNext(id: number, available: boolean = true): GetNextResponse {
    return {
      id,
      available,
      hasConsumption: false,
      updated: false
    };
  }

  static authorizeApp(key: string, successful: boolean = true): AuthorizeAppResponse {
    return {
      authKey: key,
      successful
    };
  }

  static syncIds(successful: boolean = true): SyncIdsResponse {
    return { successful };
  }

  static consumption(appId: string, objectType: ALObjectType, ids: number[]): ConsumptionResponse {
    return {
      appId,
      objectType,
      ids
    };
  }
}

export class TestDataBuilder {
  private static nextAppId = 1;
  private static nextAuthKey = 1000;

  static appId(): string {
    return `test-app-${Date.now()}-${this.nextAppId++}`;
  }

  static authKey(): string {
    return `auth-key-${this.nextAuthKey++}`;
  }

  static appInfo(): AppInfo {
    return {
      id: this.appId(),
      name: 'Test App',
      version: '1.0.0',
      publisher: 'Test Publisher'
    };
  }

  static ranges(): Array<{ from: number; to: number }> {
    return [
      { from: 50000, to: 50099 },
      { from: 60000, to: 60099 }
    ];
  }

  static consumption(type: ALObjectType, count: number = 5): number[] {
    const base = type === ALObjectType.table ? 50000 : 60000;
    return Array.from({ length: count }, (_, i) => base + i);
  }
}

export class MockHttpClient {
  private responses: Map<string, any> = new Map();
  private errors: Map<string, any> = new Map();
  private callHistory: Array<{ method: string; path: string; data?: any }> = [];

  setupResponse(path: string, response: any) {
    this.responses.set(path, response);
    return this;
  }

  setupError(path: string, error: any) {
    this.errors.set(path, error);
    return this;
  }

  async send(options: any): Promise<any> {
    const path = options.path;
    this.callHistory.push({
      method: options.method,
      path,
      data: options.data
    });

    if (this.errors.has(path)) {
      const error = this.errors.get(path);
      return {
        status: error.status || 500,
        error,
        value: undefined
      };
    }

    if (this.responses.has(path)) {
      return {
        status: 200,
        value: this.responses.get(path),
        error: undefined
      };
    }

    // Default 404 response
    return {
      status: 404,
      error: { message: 'Not found' },
      value: undefined
    };
  }

  getCallHistory() {
    return this.callHistory;
  }

  getCallCount(path: string): number {
    return this.callHistory.filter(call => call.path === path).length;
  }

  wasCalledWith(path: string, data?: any): boolean {
    return this.callHistory.some(call =>
      call.path === path &&
      (data === undefined || JSON.stringify(call.data) === JSON.stringify(data))
    );
  }

  reset() {
    this.responses.clear();
    this.errors.clear();
    this.callHistory = [];
  }
}

export const expectToBeSuccessResponse = (response: any) => {
  expect(response).toBeDefined();
  expect(response.error).toBeUndefined();
};

export const expectToBeErrorResponse = (response: any, expectedError?: string) => {
  expect(response).toBeDefined();
  if (expectedError) {
    expect(response.error).toBe(expectedError);
  } else {
    expect(response.error).toBeDefined();
  }
};