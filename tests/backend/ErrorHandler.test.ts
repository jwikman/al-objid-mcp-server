import { ErrorHandler, BackendError, NetworkError, ValidationError } from '../../src/lib/backend/ErrorHandler';

describe('ErrorHandler', () => {
  describe('handle', () => {
    it('should throw BackendError for 400 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 400 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 400 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Bad request. Check your request parameters.');
        expect(error.statusCode).toBe(400);
      }
    });

    it('should throw BackendError for 401 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 401 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 401 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Unauthorized. Invalid API key. Please check your configuration.');
        expect(error.statusCode).toBe(401);
      }
    });

    it('should throw BackendError for 403 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 403 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 403 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Forbidden. App not authorized or insufficient permissions.');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw BackendError for 404 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 404 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 404 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Not found. The requested resource or endpoint does not exist.');
        expect(error.statusCode).toBe(404);
      }
    });

    it('should throw BackendError for 500 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 500 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 500 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Internal server error. The backend service encountered an error.');
        expect(error.statusCode).toBe(500);
      }
    });

    it('should throw BackendError for 429 status', () => {
      expect(() => {
        ErrorHandler.handle({ status: 429 });
      }).toThrow(BackendError);

      try {
        ErrorHandler.handle({ status: 429 });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BackendError);
        expect(error.message).toBe('Rate limit exceeded. Too many requests. Please try again later.');
        expect(error.statusCode).toBe(429);
      }
    });

    it('should throw NetworkError for ECONNREFUSED', () => {
      expect(() => {
        ErrorHandler.handle({ code: 'ECONNREFUSED' });
      }).toThrow(NetworkError);

      try {
        ErrorHandler.handle({ code: 'ECONNREFUSED' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe('Connection refused. Backend service may be down.');
        expect(error.code).toBe('ECONNREFUSED');
      }
    });

    it('should throw NetworkError for ECONNRESET', () => {
      expect(() => {
        ErrorHandler.handle({ code: 'ECONNRESET' });
      }).toThrow(NetworkError);

      try {
        ErrorHandler.handle({ code: 'ECONNRESET' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe('Connection reset by backend service.');
        expect(error.code).toBe('ECONNRESET');
      }
    });

    it('should throw NetworkError for ETIMEDOUT', () => {
      expect(() => {
        ErrorHandler.handle({ code: 'ETIMEDOUT' });
      }).toThrow(NetworkError);

      try {
        ErrorHandler.handle({ code: 'ETIMEDOUT' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe('Request timed out. The backend service is not responding.');
        expect(error.code).toBe('ETIMEDOUT');
      }
    });

    it('should throw NetworkError for ENOTFOUND', () => {
      expect(() => {
        ErrorHandler.handle({ code: 'ENOTFOUND' });
      }).toThrow(NetworkError);

      try {
        ErrorHandler.handle({ code: 'ENOTFOUND' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe('Backend service not found. Check your backend URL configuration.');
        expect(error.code).toBe('ENOTFOUND');
      }
    });

    it('should rethrow original error for unknown cases', () => {
      const originalError = new Error('Unknown error');
      expect(() => {
        ErrorHandler.handle(originalError);
      }).toThrow(originalError);
    });
  });

  describe('isRetryable', () => {
    it('should return true for 5xx status codes', () => {
      expect(ErrorHandler.isRetryable({ status: 500 })).toBe(true);
      expect(ErrorHandler.isRetryable({ status: 502 })).toBe(true);
      expect(ErrorHandler.isRetryable({ status: 503 })).toBe(true);
      expect(ErrorHandler.isRetryable({ status: 504 })).toBe(true);
    });

    it('should return true for 429 status code', () => {
      expect(ErrorHandler.isRetryable({ status: 429 })).toBe(true);
    });

    it('should return true for network error codes', () => {
      expect(ErrorHandler.isRetryable({ code: 'ECONNRESET' })).toBe(true);
      expect(ErrorHandler.isRetryable({ code: 'ECONNREFUSED' })).toBe(true);
      expect(ErrorHandler.isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
      expect(ErrorHandler.isRetryable({ code: 'ENOTFOUND' })).toBe(true);
    });

    it('should return true for status 0 (network error)', () => {
      expect(ErrorHandler.isRetryable({ status: 0 })).toBe(true);
    });

    it('should return false for 4xx status codes', () => {
      expect(ErrorHandler.isRetryable({ status: 400 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 401 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 403 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 404 })).toBe(false);
    });

    it('should return false for 3xx status codes', () => {
      expect(ErrorHandler.isRetryable({ status: 301 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 302 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 304 })).toBe(false);
    });

    it('should return false for 2xx status codes', () => {
      expect(ErrorHandler.isRetryable({ status: 200 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 201 })).toBe(false);
      expect(ErrorHandler.isRetryable({ status: 204 })).toBe(false);
    });

    it('should return false for unknown error codes', () => {
      expect(ErrorHandler.isRetryable({ code: 'UNKNOWN_ERROR' })).toBe(false);
      expect(ErrorHandler.isRetryable({ code: 'CUSTOM_ERROR' })).toBe(false);
    });

    it('should return false for errors without status or code', () => {
      expect(ErrorHandler.isRetryable({})).toBe(false);
      expect(ErrorHandler.isRetryable({ message: 'Some error' })).toBe(false);
    });
  });

  describe('Error classes', () => {
    describe('BackendError', () => {
      it('should create BackendError with status', () => {
        const error = new BackendError('Backend failed', 500);
        expect(error.message).toBe('Backend failed');
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe('BackendError');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('NetworkError', () => {
      it('should create NetworkError with code', () => {
        const error = new NetworkError('Connection failed', 'ECONNREFUSED');
        expect(error.message).toBe('Connection failed');
        expect(error.code).toBe('ECONNREFUSED');
        expect(error.name).toBe('NetworkError');
        expect(error).toBeInstanceOf(Error);
      });

      it('should create NetworkError without code', () => {
        const error = new NetworkError('Connection failed');
        expect(error.message).toBe('Connection failed');
        expect(error.code).toBeUndefined();
        expect(error.name).toBe('NetworkError');
      });
    });

    describe('ValidationError', () => {
      it('should create ValidationError', () => {
        const error = new ValidationError('Invalid input');
        expect(error.message).toBe('Invalid input');
        expect(error.name).toBe('ValidationError');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});