import { Logger, LogLevel } from '../../src/lib/utils/Logger';

describe('Logger', () => {
  let logger: Logger;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = Logger.getInstance();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation();
  });

  afterEach(() => {
    stderrSpy.mockRestore();
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

      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    it('should log errors and info at Info level', () => {
      logger.setLogLevel(LogLevel.Info);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');

      expect(stderrSpy).toHaveBeenCalledTimes(2); // error and info both go to stderr
    });

    it('should log all messages at Verbose level', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');

      expect(stderrSpy).toHaveBeenCalledTimes(3); // error, info, and verbose all go to stderr
    });

    it('should log all messages including debug at Debug level', () => {
      logger.setLogLevel(LogLevel.Debug);

      logger.error('Test error');
      logger.info('Test info');
      logger.verbose('Test verbose');
      logger.debug('Test debug');

      expect(stderrSpy).toHaveBeenCalledTimes(4); // error, info, verbose, and debug all go to stderr
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

      const logCall = stderrSpy.mock.calls[0];
      const logOutput = logCall[0].toString();

      // Extract JSON from log output (format: [VERBOSE] timestamp Test {json})
      const jsonMatch = logOutput.match(/\[VERBOSE\].*Test (.*)\n?$/);
      expect(jsonMatch).toBeTruthy();
      const loggedData = JSON.parse(jsonMatch![1]);

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

      const logCall = stderrSpy.mock.calls[0];
      const logOutput = logCall[0].toString();

      // Extract JSON from log output
      const jsonMatch = logOutput.match(/\[VERBOSE\].*Test (.*)\n?$/);
      expect(jsonMatch).toBeTruthy();
      const loggedData = JSON.parse(jsonMatch![1]);

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

      const logCall = stderrSpy.mock.calls[0];
      const logOutput = logCall[0].toString();

      // Extract JSON from log output
      const jsonMatch = logOutput.match(/\[VERBOSE\].*Test (.*)\n?$/);
      expect(jsonMatch).toBeTruthy();
      const loggedData = JSON.parse(jsonMatch![1]);

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

      const logCall = stderrSpy.mock.calls[0];
      const logOutput = logCall[0].toString();

      // Extract JSON from error log output
      const jsonMatch = logOutput.match(/\[ERROR\].*An error occurred (.*)\n?$/);
      expect(jsonMatch).toBeTruthy();
      const loggedData = JSON.parse(jsonMatch![1]);

      expect(loggedData.message).toBe('Test error message');
      expect(loggedData.stack).toBe('Error stack trace');
    });
  });

  describe('request/response logging', () => {
    it('should log requests', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.request('POST', 'https://api.example.com/test', {
        authKey: 'secret',
        data: 'value'
      });

      const logCall = stderrSpy.mock.calls[0];
      const logOutput = logCall[0].toString();

      expect(logOutput).toContain('[REQUEST]');
      expect(logOutput).toContain('POST');
      expect(logOutput).toContain('https://api.example.com/test');

      // Extract JSON from log output
      const jsonMatch = logOutput.match(/\[REQUEST\].*https:\/\/api\.example\.com\/test (.*)\n?$/);
      expect(jsonMatch).toBeTruthy();
      const loggedData = JSON.parse(jsonMatch![1]);

      expect(loggedData.authKey).toBe('***REDACTED***');
      expect(loggedData.data).toBe('value');
    });

    it('should log responses', () => {
      logger.setLogLevel(LogLevel.Verbose);

      logger.response(200, 'https://api.example.com/test', { result: 'success' });
      logger.response(404, 'https://api.example.com/notfound', { error: 'Not found' });

      const successCall = stderrSpy.mock.calls[0];
      const successOutput = successCall[0].toString();
      expect(successOutput).toContain('[RESPONSE]');
      expect(successOutput).toContain('SUCCESS');
      expect(successOutput).toContain('200');

      const errorCall = stderrSpy.mock.calls[1];
      const errorOutput = errorCall[0].toString();
      expect(errorOutput).toContain('[RESPONSE]');
      expect(errorOutput).toContain('FAILURE');
      expect(errorOutput).toContain('404');
    });
  });
});