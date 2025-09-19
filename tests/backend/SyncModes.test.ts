/**
 * Unit tests for BackendService sync modes functionality
 */

import { BackendService } from '../../src/lib/backend/BackendService';
import { HttpClient } from '../../src/lib/backend/HttpClient';

// Mock HttpClient
jest.mock('../../src/lib/backend/HttpClient');

describe('BackendService Sync Modes', () => {
  let backendService: BackendService;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    backendService = new BackendService();
    mockHttpClient = (backendService as any).httpClient as jest.Mocked<HttpClient>;

    // Mock the send method
    mockHttpClient.send = jest.fn();
  });

  describe('syncIds', () => {
    const mockConsumptionData = {
      table: [50001, 50002],
      page: [60001]
    };

    it('should use POST method for replace mode (merge: false)', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'success' });

      const request = {
        appId: 'test-app-id',
        authKey: 'test-auth-key',
        ids: mockConsumptionData,
        merge: false
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/syncIds'
        })
      );
    });

    it('should use PATCH method for merge mode (merge: true)', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'success' });

      const request = {
        appId: 'test-app-id',
        authKey: 'test-auth-key',
        ids: mockConsumptionData,
        merge: true
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: '/api/v2/syncIds'
        })
      );
    });

    it('should default to POST method when merge is undefined', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'success' });

      const request = {
        appId: 'test-app-id',
        authKey: 'test-auth-key',
        ids: mockConsumptionData
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
      expect(mockHttpClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v2/syncIds'
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockHttpClient.send.mockRejectedValue(new Error('Network error'));

      const request = {
        appId: 'test-app-id',
        authKey: 'test-auth-key',
        ids: mockConsumptionData,
        merge: true
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(false);
    });

    it('should return true for successful sync', async () => {
      mockHttpClient.send.mockResolvedValue({ status: 200, value: 'success' });

      const request = {
        appId: 'test-app-id',
        authKey: 'test-auth-key',
        ids: mockConsumptionData,
        merge: true
      };

      const result = await backendService.syncIds(request);

      expect(result).toBe(true);
    });
  });
});