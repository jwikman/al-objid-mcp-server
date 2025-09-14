import { Logger, LogLevel } from '../../src/lib/utils/Logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = Logger.getInstance();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('log levels', () => {
    it('should log errors at Error level', () => {
      logger.setLogLevel(LogLevel.Error);

      logger.error('Test error', { details: 'error details' });
      logger.info('Test info');
      logger.verbose('Test verbose');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    });

    it('should log errors and info at Info level', () => {
      logger.setLogLevel(LogLevel.Info);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should log all messages at Verbose level', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should log all messages including debug at Debug level', () => {
      logger.setLogLevel(LogLevel.Debug);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');
      logger.debug('Test debug');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('data sanitization', () => {
    it('should redact sensitive keys', () => {
      logger.setLogLevel(LogLevel.Verbose);

      const sensitiveData = {
        authKey: 'secret-key',
        apiKey: 'api-secret',
        'X-Functions-Key': 'functions-secret',
        password: 'user-password',
        token: 'auth-token',
        normalField: 'visible-value',
      };

      logger.verbose('Test', sensitiveData);

      const logCall = consoleLogSpy.mock.calls[0];
      const loggedData = logCall[1];

      expect(loggedData.authKey).toBe('***REDACTED***');
      expect(loggedData.apiKey).toBe('***REDACTED***');
      expect(loggedData['X-Functions-Key']).toBe('***REDACTED***');
      expect(loggedData.password).toBe('***REDACTED***');
      expect(loggedData.token).toBe('***REDACTED***');
      expect(loggedData.normalField).toBe('visible-value');
    });

    it('should handle nested objects', () => {
      logger.setLogLevel(LogLevel.Verbose);

      const nestedData = {
        level1: {
          authKey: 'secret',
          level2: {
            apiKey: 'api-secret',
            normalField: 'visible',
          },
        },
      };

      logger.verbose('Test', nestedData);

      const logCall = consoleLogSpy.mock.calls[0];
      const loggedData = logCall[1];

      expect(loggedData.level1.authKey).toBe('***REDACTED***');
      expect(loggedData.level1.level2.apiKey).toBe('***REDACTED***');
      expect(loggedData.level1.level2.normalField).toBe('visible');
    });

    it('should handle arrays', () => {
      logger.setLogLevel(LogLevel.Verbose);

      const arrayData = [
        { authKey: 'secret1', value: 'visible1' },
        { authKey: 'secret2', value: 'visible2' },
      ];

      logger.verbose('Test', arrayData);

      const logCall = consoleLogSpy.mock.calls[0];
      const loggedData = logCall[1];

      expect(loggedData[0].authKey).toBe('***REDACTED***');
      expect(loggedData[0].value).toBe('visible1');
      expect(loggedData[1].authKey).toBe('***REDACTED***');
      expect(loggedData[1].value).toBe('visible2');
    });

    it('should handle errors', () => {
      logger.setLogLevel(LogLevel.Error);

      const error = new Error('Test error message');
      error.stack = 'Error stack trace';

      logger.error('An error occurred', error);

      const logCall = consoleErrorSpy.mock.calls[0];
      const loggedError = logCall[1];

      expect(loggedError.message).toBe('Test error message');
      expect(loggedError.stack).toBe('Error stack trace');
    });
  });

  describe('request/response logging', () => {
    it('should log requests', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.request('POST', 'https://api.example.com/test', {
        authKey: 'secret',
        data: 'value'
      });

      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[0]).toContain('[REQUEST]');
      expect(logCall[0]).toContain('POST');
      expect(logCall[0]).toContain('https://api.example.com/test');
      expect(logCall[1].authKey).toBe('***REDACTED***');
      expect(logCall[1].data).toBe('value');
    });

    it('should log responses', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.response(200, 'https://api.example.com/test', { result: 'success' });
      logger.response(404, 'https://api.example.com/notfound', { error: 'Not found' });

      const successCall = consoleLogSpy.mock.calls[0];
      expect(successCall[0]).toContain('[RESPONSE]');
      expect(successCall[0]).toContain('SUCCESS');
      expect(successCall[0]).toContain('200');

      const errorCall = consoleLogSpy.mock.calls[1];
      expect(errorCall[0]).toContain('[RESPONSE]');
      expect(errorCall[0]).toContain('FAILURE');
      expect(errorCall[0]).toContain('404');
    });
  });
});