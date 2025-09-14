# Integration Tests

This directory contains integration tests for the AL Object ID Ninja MCP server that make real HTTP calls to the live backend service.

## Running Tests

### Prerequisites

1. **Backend URL**: The tests use the Azure Function backend at `https://vjekocom-alext-weu.azurewebsites.net` by default.

2. **API Key**: For full test coverage, you need a valid API key. Without it, only basic connectivity tests will pass.

### Test Scripts

```bash
# Run Jest integration test suite
npm run test:integration

# Run standalone test with colored output
npm run test:live
```

### Environment Variables

Configure the backend connection using environment variables:

```bash
# Backend URL (optional, defaults to production)
export OBJID_BACKEND_URL=https://vjekocom-alext-weu.azurewebsites.net

# API Key (required for most tests)
export OBJID_API_KEY=your-api-key-here

# Run tests
npm run test:live
```

### Test Coverage

The integration tests cover:

1. **App Lifecycle**
   - Check if app exists (should not initially)
   - Authorize new app
   - Verify authorization status

2. **Object ID Management**
   - Get next available IDs for different object types
   - Sync consumed IDs
   - Retrieve consumption data
   - Verify consumed IDs are avoided

3. **Pool Management**
   - Create new pool
   - Join existing pool
   - Verify pool membership
   - Leave pool

4. **Error Handling**
   - Invalid auth key handling
   - Network timeout resilience
   - Concurrent request handling

5. **Performance Tests**
   - Rapid sequential requests
   - Response time verification

### Test Files

- `backend-live.test.ts` - Jest test suite with full assertions
- `../../test-backend-live.ts` - Standalone runner with colored console output

### Expected Results

Without API key:
- ✅ Connectivity tests pass
- ✅ Error handling tests pass
- ❌ Authorization tests fail (expected)
- ❌ ID management tests fail (expected)

With valid API key:
- ✅ All tests should pass
- Each test creates unique app IDs using timestamps to avoid conflicts

### Debugging

The tests use verbose logging by default. Check the console output for:
- Request/response details
- Error messages with stack traces
- Performance metrics

### Notes

- Tests create temporary apps with unique IDs (timestamp-based)
- No cleanup is performed - apps remain authorized on the backend
- Tests are safe to run multiple times without side effects
- Network connectivity is required for all tests