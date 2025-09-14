import { createHash } from 'crypto';

export class AppIdentifier {
  static generateHash(appId: string): string {
    return createHash('sha256').update(appId).digest('hex');
  }

  static validateAppId(appId: string): boolean {
    // GUID format validation
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(appId);
  }
}