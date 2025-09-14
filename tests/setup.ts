/**
 * Jest test setup file
 * Runs before each test suite
 */

// Suppress console output during tests unless explicitly needed
if (process.env.SHOW_TEST_LOGS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging test failures
    error: console.error
  };
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DEBUG_MODE = 'false';

// Increase timeout for slower CI environments
if (process.env.CI) {
  jest.setTimeout(30000);
}

// Global test utilities
(global as any).testUtils = {
  // Helper to create mock app.json
  createMockAppJson: (id: string, name: string, ranges: any[]) => ({
    id,
    name,
    publisher: "Test Publisher",
    version: "1.0.0.0",
    brief: "Test application",
    description: "Test application for unit tests",
    platform: "24.0.0.0",
    application: "24.0.0.0",
    idRanges: ranges,
    runtime: "13.0",
    target: "Cloud"
  }),

  // Helper to create ID range
  createRange: (from: number, to: number) => ({ from, to }),

  // Helper to wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Extend Jest matchers (optional)
expect.extend({
  toBeInRange(received: number, from: number, to: number) {
    const pass = received >= from && received <= to;
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be in range [${from}, ${to}]`
        : `expected ${received} to be in range [${from}, ${to}]`
    };
  }
});

// Clean up after tests
afterAll(() => {
  // Restore console
  if (process.env.SHOW_TEST_LOGS !== 'true') {
    (global as any).console = console;
  }
});