# Phase 4 TypeScript Errors to Fix

## API Changes Needed:

1. **BackendService.getNext()** - Now takes a GetNextRequest object, not individual parameters
2. **BackendService.getConsumption()** - Now takes a GetConsumptionRequest object, returns ConsumptionInfo (object with arrays)
3. **Logger** - Missing `warn()` and `setLevel()` methods
4. **ToolCallResponse** - Not exported from MCP SDK types

## Fixes Required:

1. Update all calls to `getNext()` to use request object
2. Update all calls to `getConsumption()` to use request object and handle ConsumptionInfo type
3. Add missing Logger methods
4. Define ToolCallResponse locally or use correct import
5. Fix NodeJS Timer type issues