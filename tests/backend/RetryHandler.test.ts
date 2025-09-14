import { RetryHandler } from '../../src/lib/backend/RetryHandler';

describe('RetryHandler', () => {
  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue('success');

      const result = await handler.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const handler = new RetryHandler({
        maxRetries: 3,
        initialDelay: 10, // Short delay for tests
      });

      const operation = jest.fn()
        .mockRejectedValueOnce({ status: 500, message: 'First failure' })
        .mockRejectedValueOnce({ status: 500, message: 'Second failure' })
        .mockResolvedValueOnce('success');

      const result = await handler.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const handler = new RetryHandler({
        maxRetries: 2,
        initialDelay: 10,
      });

      const error = { status: 500, message: 'Persistent failure' };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(handler.execute(operation)).rejects.toEqual(error);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry when retryable returns false', async () => {
      const handler = new RetryHandler();
      const error = { status: 400, message: 'Non-retryable error' };
      const operation = jest.fn().mockRejectedValue(error);
      const retryable = jest.fn().mockReturnValue(false);

      await expect(handler.execute(operation, retryable)).rejects.toEqual(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(retryable).toHaveBeenCalledWith(error);
    });

    it('should handle network errors as retryable by default', async () => {
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelay: 10,
      });

      const networkError = { code: 'ECONNRESET', message: 'Connection reset' };
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors by default', async () => {
      const handler = new RetryHandler();
      const clientError = { status: 400, message: 'Bad request' };
      const operation = jest.fn().mockRejectedValue(clientError);

      await expect(handler.execute(operation)).rejects.toEqual(clientError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 Too Many Requests', async () => {
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelay: 10,
      });

      const rateLimitError = { status: 429, message: 'Rate limited' };
      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx server errors', async () => {
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelay: 10,
      });

      const serverError = { status: 503, message: 'Service unavailable' };
      const operation = jest.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce('success');

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use custom retryable function', async () => {
      const handler = new RetryHandler({
        maxRetries: 2,
        initialDelay: 10,
      });

      const customError = { type: 'CUSTOM', message: 'Custom error' };
      const operation = jest.fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValueOnce('success');

      // Custom retryable function that retries on CUSTOM type
      const retryable = (error: any) => error.type === 'CUSTOM';

      const result = await handler.execute(operation, retryable);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries even with retryable errors', async () => {
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelay: 10,
      });

      const error = { status: 500, message: 'Server error' };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(handler.execute(operation)).rejects.toEqual(error);
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});