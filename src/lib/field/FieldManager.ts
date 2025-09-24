import { Logger } from '../utils/Logger';
import { BackendService } from '../backend/BackendService';
import { ALObjectType } from '../types/ALObjectType';
import { ALRanges } from '../types/ALRange';

export interface FieldInfo {
  tableId: number;
  fieldId: number;
  fieldName?: string;
  dataType?: string;
}

export interface EnumValueInfo {
  enumId: number;
  valueId: number;
  valueName?: string;
}

export class FieldManager {
  private static instance: FieldManager;
  private logger: Logger;
  private backendService: BackendService;

  private constructor() {
    this.logger = Logger.getInstance();
    this.backendService = new BackendService();
  }

  static getInstance(): FieldManager {
    if (!this.instance) {
      this.instance = new FieldManager();
    }
    return this.instance;
  }

  /**
   * Get next available field ID for a table
   */
  async getNextFieldId(
    appId: string,
    authKey: string,
    tableId: number,
    isExtension: boolean = false
  ): Promise<number> {
    this.logger.verbose('Getting next field ID', { appId, tableId, isExtension });

    try {
      // Field IDs are handled as special object types
      const objectType = `table_${tableId}` as ALObjectType;

      // Determine ranges based on whether it's an extension
      const ranges = isExtension
        ? [{ from: 50000, to: 99999 }] // Extension field range
        : [{ from: 1, to: 49999 }];     // Base app field range

      const request = {
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false
      };

      const result = await this.backendService.getNext(request);

      if (result && result.available) {
        // Handle both single ID and array of IDs
        const fieldId = Array.isArray(result.id) ? result.id[0] : result.id;
        
        this.logger.info('Next field ID obtained', {
          tableId,
          fieldId,
          isExtension
        });
        return fieldId;
      }

      // No available ID in range
      this.logger.error('No available field ID', { tableId, isExtension });
      return 0;
    } catch (error) {
      this.logger.error('Failed to get next field ID', error);
      return 0;
    }
  }

  /**
   * Get next available enum value ID
   */
  async getNextEnumValueId(
    appId: string,
    authKey: string,
    enumId: number,
    isExtension: boolean = false
  ): Promise<number> {
    this.logger.verbose('Getting next enum value ID', { appId, enumId, isExtension });

    try {
      // Enum values are handled as special object types
      const objectType = `enum_${enumId}` as ALObjectType;

      // Determine ranges based on whether it's an extension
      const ranges = isExtension
        ? [{ from: 50000, to: 99999 }] // Extension value range
        : [{ from: 0, to: 49999 }];     // Base app value range

      const request = {
        appId,
        type: objectType,
        ranges,
        authKey,
        perRange: false
      };

      const result = await this.backendService.getNext(request);

      if (result && result.available) {
        // Handle both single ID and array of IDs
        const valueId = Array.isArray(result.id) ? result.id[0] : result.id;
        
        this.logger.info('Next enum value ID obtained', {
          enumId,
          valueId,
          isExtension
        });
        return valueId;
      }

      // No available ID in range
      this.logger.error('No available enum value ID', { enumId, isExtension });
      return -1;
    } catch (error) {
      this.logger.error('Failed to get next enum value ID', error);
      return -1;
    }
  }

  /**
   * Sync field IDs with backend
   */
  async syncFieldIds(
    appId: string,
    authKey: string,
    tableId: number,
    fieldIds: number[]
  ): Promise<boolean> {
    this.logger.verbose('Syncing field IDs', { appId, tableId, count: fieldIds.length });

    try {
      const objectType = `table_${tableId}` as ALObjectType;

      // Create consumption info for fields
      const consumptionInfo = {
        [objectType]: fieldIds
      };

      const result = await this.backendService.syncIds({
        appId,
        authKey,
        ids: consumptionInfo
      });

      if (result) {
        this.logger.info('Field IDs synced successfully', {
          tableId,
          count: fieldIds.length
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync field IDs', error);
      return false;
    }
  }

  /**
   * Sync enum value IDs with backend
   */
  async syncEnumValueIds(
    appId: string,
    authKey: string,
    enumId: number,
    valueIds: number[]
  ): Promise<boolean> {
    this.logger.verbose('Syncing enum value IDs', { appId, enumId, count: valueIds.length });

    try {
      const objectType = `enum_${enumId}` as ALObjectType;

      // Create consumption info for enum values
      const consumptionInfo = {
        [objectType]: valueIds
      };

      const result = await this.backendService.syncIds({
        appId,
        authKey,
        ids: consumptionInfo
      });

      if (result) {
        this.logger.info('Enum value IDs synced successfully', {
          enumId,
          count: valueIds.length
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync enum value IDs', error);
      return false;
    }
  }

  /**
   * Get consumed field IDs for a table
   */
  async getConsumedFieldIds(
    appId: string,
    authKey: string,
    tableId: number
  ): Promise<number[]> {
    this.logger.verbose('Getting consumed field IDs', { appId, tableId });

    try {
      const objectType = `table_${tableId}` as ALObjectType;
      const request = {
        appId,
        authKey
      };
      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        const consumption = consumptionInfo[objectType] || [];
        this.logger.info('Retrieved consumed field IDs', {
          tableId,
          count: consumption.length
        });
        return consumption;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get consumed field IDs', error);
      return [];
    }
  }

  /**
   * Get consumed enum value IDs
   */
  async getConsumedEnumValueIds(
    appId: string,
    authKey: string,
    enumId: number
  ): Promise<number[]> {
    this.logger.verbose('Getting consumed enum value IDs', { appId, enumId });

    try {
      const objectType = `enum_${enumId}` as ALObjectType;
      const request = {
        appId,
        authKey
      };
      const consumptionInfo = await this.backendService.getConsumption(request);

      if (consumptionInfo) {
        const consumption = consumptionInfo[objectType] || [];
        this.logger.info('Retrieved consumed enum value IDs', {
          enumId,
          count: consumption.length
        });
        return consumption;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get consumed enum value IDs', error);
      return [];
    }
  }

  /**
   * Check if a field ID is available
   */
  async isFieldIdAvailable(
    appId: string,
    authKey: string,
    tableId: number,
    fieldId: number
  ): Promise<boolean> {
    const consumed = await this.getConsumedFieldIds(appId, authKey, tableId);
    return !consumed.includes(fieldId);
  }

  /**
   * Check if an enum value ID is available
   */
  async isEnumValueIdAvailable(
    appId: string,
    authKey: string,
    enumId: number,
    valueId: number
  ): Promise<boolean> {
    const consumed = await this.getConsumedEnumValueIds(appId, authKey, enumId);
    return !consumed.includes(valueId);
  }

  /**
   * Reserve a specific field ID for a table
   */
  async reserveFieldId(
    appId: string,
    authKey: string,
    tableId: number,
    fieldId: number,
    isExtension: boolean = false
  ): Promise<boolean> {
    try {
      // Field IDs are handled as special object types
      const objectType = `table_${tableId}` as ALObjectType;

      const response = await this.backendService.getNext({
        appId,
        type: objectType,
        ranges: this.getFieldRanges(isExtension),
        authKey,
        perRange: false,
        require: fieldId
      }, true);  // Commit = true to reserve

      if (response && response.available) {
        const reservedId = Array.isArray(response.id) ? response.id[0] : response.id;
        return reservedId === fieldId;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to reserve field ID ${fieldId} for table ${tableId}`, error);
      return false;
    }
  }

  /**
   * Reserve a specific enum value ID for an enum
   */
  async reserveEnumValueId(
    appId: string,
    authKey: string,
    enumId: number,
    valueId: number,
    isExtension: boolean = false
  ): Promise<boolean> {
    try {
      // Enum value IDs are handled as special object types
      const objectType = `enum_${enumId}` as ALObjectType;

      const response = await this.backendService.getNext({
        appId,
        type: objectType,
        ranges: this.getEnumValueRanges(isExtension),
        authKey,
        perRange: false,
        require: valueId
      }, true);  // Commit = true to reserve

      if (response && response.available) {
        const reservedId = Array.isArray(response.id) ? response.id[0] : response.id;
        return reservedId === valueId;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to reserve enum value ${valueId} for enum ${enumId}`, error);
      return false;
    }
  }

  /**
   * Get field ranges based on extension status
   */
  private getFieldRanges(isExtension: boolean): ALRanges {
    if (isExtension) {
      return [{ from: 50000, to: 99999 }];
    }
    return [{ from: 1, to: 49999 }];
  }

  /**
   * Get enum value ranges based on extension status
   */
  private getEnumValueRanges(isExtension: boolean): ALRanges {
    if (isExtension) {
      return [{ from: 50000, to: 99999999 }];
    }
    return [{ from: 0, to: 49999 }];
  }

  /**
   * Suggest field ID range based on context
   */
  suggestFieldIdRange(isExtension: boolean, isSystemTable: boolean): { from: number; to: number } {
    if (isExtension) {
      // Extension fields always use 50000+ range
      return { from: 50000, to: 99999 };
    } else if (isSystemTable) {
      // System table fields use low range
      return { from: 1, to: 9999 };
    } else {
      // Custom table fields can use broader range
      return { from: 1, to: 49999 };
    }
  }

  /**
   * Suggest enum value ID range based on context
   */
  suggestEnumValueIdRange(isExtension: boolean): { from: number; to: number } {
    if (isExtension) {
      // Extension enum values use 50000+ range
      return { from: 50000, to: 99999 };
    } else {
      // Base enum values start from 0
      return { from: 0, to: 49999 };
    }
  }
}