import { BackendService, GetNextRequest, GetConsumptionRequest } from '../backend/BackendService';
import { ALObjectType } from '../types/ALObjectType';
import { NextObjectIdInfo } from '../types/NextObjectIdInfo';

/**
 * Adapter class to provide compatibility between old and new API signatures
 */
export class BackendAdapter {
  private backend: BackendService;

  constructor() {
    this.backend = new BackendService();
  }

  /**
   * Get next available ID with simplified signature
   */
  async getNextSimple(
    appId: string,
    objectType: ALObjectType,
    ranges: Array<{ from: number; to: number }>,
    authKey?: string
  ): Promise<{ id: number; available: boolean } | undefined> {
    if (!authKey) {
      return undefined;
    }

    const request: GetNextRequest = {
      appId,
      type: objectType,
      ranges,
      authKey,
      perRange: false
    };

    const result = await this.backend.getNext(request);

    if (!result) {
      return undefined;
    }

    // Handle both single ID and array of IDs
    const id = Array.isArray(result.id) ? result.id[0] : result.id;

    return {
      id,
      available: result.available
    };
  }

  /**
   * Get consumption for a specific object type
   */
  async getConsumptionSimple(
    appId: string,
    authKey: string,
    objectType: ALObjectType
  ): Promise<number[] | undefined> {
    const request: GetConsumptionRequest = {
      appId,
      authKey
    };

    const result = await this.backend.getConsumption(request);

    if (!result) {
      return undefined;
    }

    // ConsumptionInfo is an object with objectType keys
    return result[objectType] || [];
  }

  /**
   * Get the underlying backend service for direct access
   */
  getBackendService(): BackendService {
    return this.backend;
  }

  /**
   * Helper to extract single ID from NextObjectIdInfo
   */
  static extractSingleId(info: NextObjectIdInfo): number {
    return Array.isArray(info.id) ? info.id[0] : info.id;
  }

  /**
   * Helper to ensure ID is always a number
   */
  static ensureNumberId(id: number | number[]): number {
    return Array.isArray(id) ? id[0] : id;
  }
}