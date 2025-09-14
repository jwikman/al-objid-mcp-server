declare global {
  namespace jest {
    interface Matchers<R> {
      toBeSuccessResponse(): CustomMatcherResult;
      toBeErrorResponse(expectedStatus?: number): CustomMatcherResult;
      toHaveBeenCalledWithPath(expectedPath: string): CustomMatcherResult;
      toContainObjectIds(ids: number[]): CustomMatcherResult;
      toHaveRetried(times: number): CustomMatcherResult;
    }
  }
}

export const initializeCustomMatchers = () => {
  expect.extend({
    toBeSuccessResponse(response: any) {
      const pass = response && response.status >= 200 && response.status < 300 && !response.error;
      return {
        pass,
        message: () => pass
          ? `Expected response not to be successful, but got status ${response.status}`
          : `Expected successful response, but got status ${response?.status} with error: ${JSON.stringify(response?.error)}`
      };
    },

    toBeErrorResponse(response: any, expectedStatus?: number) {
      const hasError = response && (response.error || response.status >= 400);
      const statusMatches = expectedStatus === undefined || response?.status === expectedStatus;
      const pass = hasError && statusMatches;

      return {
        pass,
        message: () => pass
          ? `Expected response not to be an error, but got status ${response.status}`
          : `Expected error response${expectedStatus ? ` with status ${expectedStatus}` : ''}, but got status ${response?.status}`
      };
    },

    toHaveBeenCalledWithPath(mockClient: any, expectedPath: string) {
      const pass = mockClient.wasCalledWith && mockClient.wasCalledWith(expectedPath);
      return {
        pass,
        message: () => pass
          ? `Expected mock client not to be called with path ${expectedPath}`
          : `Expected mock client to be called with path ${expectedPath}`
      };
    },

    toContainObjectIds(response: any, ids: number[]) {
      const responseIds = response?.ids || [];
      const pass = ids.every(id => responseIds.includes(id));
      return {
        pass,
        message: () => pass
          ? `Expected response not to contain IDs ${ids}, but it did`
          : `Expected response to contain IDs ${ids}, but got ${responseIds}`
      };
    },

    toHaveRetried(mockFn: jest.Mock, times: number) {
      const actualCalls = mockFn.mock.calls.length - 1; // Subtract initial call
      const pass = actualCalls === times;
      return {
        pass,
        message: () => pass
          ? `Expected not to retry ${times} times, but it did`
          : `Expected to retry ${times} times, but retried ${actualCalls} times`
      };
    }
  });
};

export {};