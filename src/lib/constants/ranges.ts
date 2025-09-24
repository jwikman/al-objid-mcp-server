import { ALRanges } from '../types/ALRange';

/**
 * Default ID ranges for AL development
 */

/**
 * Default range for extensions (50000-99999)
 * This is the standard range for customer extensions in Business Central
 */
export const DEFAULT_EXTENSION_RANGES: ALRanges = [{ from: 50000, to: 99999 }];

/**
 * Default range for base objects (1-49999)
 * This range is typically used for base application objects
 */
export const DEFAULT_BASE_OBJECT_RANGES: ALRanges = [{ from: 1, to: 49999 }];

/**
 * Default range for base enum values (0-49999)
 * Enum values typically start from 0 in the base application
 */
export const DEFAULT_BASE_ENUM_VALUE_RANGES: ALRanges = [{ from: 0, to: 49999 }];

/**
 * Get the appropriate default range based on context
 */
export function getDefaultRanges(isExtension = false, isEnumValue = false): ALRanges {
  if (isExtension) {
    return DEFAULT_EXTENSION_RANGES;
  } else if (isEnumValue) {
    return DEFAULT_BASE_ENUM_VALUE_RANGES;
  } else {
    return DEFAULT_BASE_OBJECT_RANGES;
  }
}