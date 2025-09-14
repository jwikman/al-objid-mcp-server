import { HttpClient } from '../../src/lib/backend/HttpClient';
import * as https from 'https';
import { EventEmitter } from 'events';

jest.mock('https');

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    httpClient = new HttpClient();
    mockRequest = new EventEmitter();
    mockRequest.end = jest.fn();
    mockRequest.write = jest.fn();
    mockRequest.setHeader = jest.fn();
    mockRequest.destroy = jest.fn();

    mockResponse = new EventEmitter();
    mockResponse.statusCode = 200;
    mockResponse.headers = { 'content-type': 'application/json' };

    (https.request as jest.Mock).mockImplementation((options, callback) => {
      // Call the callback with response on next tick
      if (callback) {
        process.nextTick(() => callback(mockResponse));
      }
      return mockRequest;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should successfully send a GET request', async () => {
      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'GET',
      });

      // Simulate response on next tick
      process.nextTick(() => {
        mockResponse.emit('data', JSON.stringify({ success: true }));
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe(200);
      expect(result.value).toEqual({ success: true });
      expect(result.error).toBeUndefined();
    });

    it('should successfully send a POST request with data', async () => {
      const requestData = { key: 'value' };
      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'POST',
        data: requestData,
      });

      // Simulate response on next tick
      process.nextTick(() => {
        mockResponse.emit('data', JSON.stringify({ received: true }));
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(mockRequest.write).toHaveBeenCalledWith(JSON.stringify(requestData));
      expect(result.status).toBe(200);
      expect(result.value).toEqual({ received: true });
    });

    it('should handle network errors', async () => {
      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'GET',
      });

      // Simulate network error on next tick
      process.nextTick(() => {
        const error = new Error('ECONNREFUSED');
        (error as any).code = 'ECONNREFUSED';
        mockRequest.emit('error', error);
      });

      const result = await promise;

      expect(result.status).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('ECONNREFUSED');
    });

    it('should handle timeout', async () => {
      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'GET',
        timeout: 1000,
      });

      // Simulate timeout on next tick
      process.nextTick(() => {
        mockRequest.emit('timeout');
      });

      const result = await promise;

      expect(mockRequest.destroy).toHaveBeenCalled();
      expect(result.status).toBe(0);
      expect(result.error.message).toBe('Request timeout');
    });

    it('should handle invalid JSON response', async () => {
      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'GET',
      });

      // Simulate response with invalid JSON on next tick
      process.nextTick(() => {
        mockResponse.emit('data', 'Invalid JSON');
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe(200);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Invalid JSON response');
      expect(result.error.body).toBe('Invalid JSON');
    });

    it('should handle empty response', async () => {
      mockResponse.statusCode = 204;

      const promise = httpClient.send({
        hostname: 'api.example.com',
        path: '/test',
        method: 'GET',
      });

      // Simulate empty response on next tick
      process.nextTick(() => {
        mockResponse.emit('data', '');
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe(204);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });
});