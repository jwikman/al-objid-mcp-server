import { getToolsForMode, isToolAvailable, getLiteTools, getNormalTools, getFullTools } from '../../src/tools/toolFilter';
import { TOOL_DEFINITIONS } from '../../src/tools/toolDefinitions';

describe('Tool Filter Modes', () => {
  describe('Lite Mode', () => {
    it('should return exactly 3 tools in lite mode', () => {
      const tools = getToolsForMode('lite');
      expect(tools).toHaveLength(3);
    });

    it('should include only essential tools in lite mode', () => {
      const tools = getLiteTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toEqual([
        'get-next-id',
        'scan-workspace',
        'set-active-app'
      ]);
    });

    it('should correctly identify available tools in lite mode', () => {
      expect(isToolAvailable('scan-workspace', 'lite')).toBe(true);
      expect(isToolAvailable('set-active-app', 'lite')).toBe(true);
      expect(isToolAvailable('get-next-id', 'lite')).toBe(true);

      // These should not be available in lite mode
      expect(isToolAvailable('sync-object-ids', 'lite')).toBe(false);
      expect(isToolAvailable('check-authorization', 'lite')).toBe(false);
      expect(isToolAvailable('start-polling', 'lite')).toBe(false);
    });
  });

  describe('Normal Mode', () => {
    it('should return exactly 14 tools in normal mode', () => {
      const tools = getToolsForMode('normal');
      expect(tools).toHaveLength(14);
    });

    it('should include essential tools in normal mode', () => {
      const tools = getNormalTools();
      const toolNames = tools.map(t => t.name);

      const expectedTools = [
        // Core ID Management
        'get-next-id',
        'sync-object-ids',
        // Authorization & Backend
        'check-authorization',
        'authorize-app',
        'get-consumption-report',
        // Workspace Management
        'scan-workspace',
        'set-active-app',
        // Field Management
        'get-next-field-id',
        'get-next-enum-value-id',
        // Collision Detection
        'check-collision',
        'check-range-overlaps',
        // Assignment
        'assign-ids',
        'get-assignment-history',
        // Configuration
        'get-statistics'
      ];

      expect(toolNames).toEqual(expect.arrayContaining(expectedTools));
      expect(toolNames).toHaveLength(expectedTools.length);
    });

    it('should correctly identify available tools in normal mode', () => {
      // Core tools should be available
      expect(isToolAvailable('get-next-id', 'normal')).toBe(true);
      expect(isToolAvailable('sync-object-ids', 'normal')).toBe(true);

      // Auth tools should be available
      expect(isToolAvailable('check-authorization', 'normal')).toBe(true);
      expect(isToolAvailable('authorize-app', 'normal')).toBe(true);
      expect(isToolAvailable('get-consumption-report', 'normal')).toBe(true);

      // Workspace tools should be available
      expect(isToolAvailable('scan-workspace', 'normal')).toBe(true);
      expect(isToolAvailable('set-active-app', 'normal')).toBe(true);

      // Field tools should be available
      expect(isToolAvailable('get-next-field-id', 'normal')).toBe(true);
      expect(isToolAvailable('get-next-enum-value-id', 'normal')).toBe(true);

      // Collision tools should be available
      expect(isToolAvailable('check-collision', 'normal')).toBe(true);
      expect(isToolAvailable('check-range-overlaps', 'normal')).toBe(true);

      // Essential assignment tools should be available
      expect(isToolAvailable('assign-ids', 'normal')).toBe(true);
      expect(isToolAvailable('get-assignment-history', 'normal')).toBe(true);

      // Statistics should be available
      expect(isToolAvailable('get-statistics', 'normal')).toBe(true);

      // Excluded tools should NOT be available
      expect(isToolAvailable('get-workspace-info', 'normal')).toBe(false);
      expect(isToolAvailable('start-polling', 'normal')).toBe(false);
      expect(isToolAvailable('stop-polling', 'normal')).toBe(false);
      expect(isToolAvailable('get-polling-status', 'normal')).toBe(false);
      expect(isToolAvailable('batch-assign', 'normal')).toBe(false);
      expect(isToolAvailable('reserve-range', 'normal')).toBe(false);
      expect(isToolAvailable('get-suggestions', 'normal')).toBe(false);
      expect(isToolAvailable('save-preferences', 'normal')).toBe(false);
      expect(isToolAvailable('get-preferences', 'normal')).toBe(false);
      expect(isToolAvailable('export-config', 'normal')).toBe(false);
      expect(isToolAvailable('import-config', 'normal')).toBe(false);
    });
  });

  describe('Full Mode', () => {
    it('should return all tools in full mode', () => {
      const tools = getToolsForMode('full');
      expect(tools).toHaveLength(TOOL_DEFINITIONS.length);
    });

    it('should include all defined tools in full mode', () => {
      const tools = getFullTools();
      expect(tools).toEqual(TOOL_DEFINITIONS);
    });

    it('should correctly identify all tools as available in full mode', () => {
      // Test a sample of all categories
      const allToolNames = [
        // Core
        'get-next-id',
        'sync-object-ids',
        // Auth
        'check-authorization',
        'authorize-app',
        'get-consumption-report',
        // Workspace
        'scan-workspace',
        'set-active-app',
        'get-workspace-info',
        // Fields
        'get-next-field-id',
        'get-next-enum-value-id',
        // Collision
        'check-collision',
        'check-range-overlaps',
        // Polling
        'start-polling',
        'stop-polling',
        'get-polling-status',
        // Assignment
        'assign-ids',
        'batch-assign',
        'reserve-range',
        'get-suggestions',
        'get-assignment-history',
        // Config
        'save-preferences',
        'get-preferences',
        'export-config',
        'import-config',
        'get-statistics'
      ];

      for (const toolName of allToolNames) {
        expect(isToolAvailable(toolName, 'full')).toBe(true);
      }
    });
  });

  describe('Mode Comparison', () => {
    it('should have lite as subset of normal', () => {
      const liteTools = getLiteTools().map(t => t.name);
      const normalTools = getNormalTools().map(t => t.name);

      for (const liteTool of liteTools) {
        expect(normalTools).toContain(liteTool);
      }
    });

    it('should have normal as subset of full', () => {
      const normalTools = getNormalTools().map(t => t.name);
      const fullTools = getFullTools().map(t => t.name);

      for (const normalTool of normalTools) {
        expect(fullTools).toContain(normalTool);
      }
    });

    it('should have different tool counts for each mode', () => {
      const liteModeCount = getToolsForMode('lite').length;
      const normalModeCount = getToolsForMode('normal').length;
      const fullModeCount = getToolsForMode('full').length;

      expect(liteModeCount).toBeLessThan(normalModeCount);
      expect(normalModeCount).toBeLessThan(fullModeCount);
      expect(liteModeCount).toBe(3);
      expect(normalModeCount).toBe(14);
      expect(fullModeCount).toBe(25);
    });
  });

  describe('Environment Variable Mode Selection', () => {
    const originalEnv = process.env.MCP_MODE;

    afterEach(() => {
      // Restore original environment variable
      if (originalEnv !== undefined) {
        process.env.MCP_MODE = originalEnv;
      } else {
        delete process.env.MCP_MODE;
      }
    });

    it('should use environment variable when no mode specified', () => {
      process.env.MCP_MODE = 'lite';
      const tools = getToolsForMode();
      expect(tools).toHaveLength(3);
    });

    it('should override environment variable when mode specified', () => {
      process.env.MCP_MODE = 'lite';
      const tools = getToolsForMode('full');
      expect(tools).toHaveLength(25);
    });

    it('should default to normal mode when no environment variable set', () => {
      delete process.env.MCP_MODE;
      const tools = getToolsForMode();
      expect(tools).toHaveLength(14);
    });

    it('should use full mode when explicitly set', () => {
      process.env.MCP_MODE = 'full';
      const tools = getToolsForMode();
      expect(tools).toHaveLength(25);
    });
  });
});