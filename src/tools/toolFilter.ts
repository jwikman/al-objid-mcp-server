import { ToolDefinition, TOOL_DEFINITIONS } from './toolDefinitions';
import { Logger } from '../lib/utils/Logger';

export type ServerMode = 'lite' | 'normal' | 'full';

const LITE_MODE_TOOLS = [
  'scan-workspace',     // Essential for discovering AL apps
  'set-active-app',     // Required to work with a specific app
  'get-next-id',        // Query available IDs (enhanced)
  'reserve-id'          // Reserve specific IDs (new)
];
const NORMAL_MODE_TOOLS = [
  // Core ID Management
  'get-next-id',           // Core functionality for getting next available ID
  'sync-object-ids',       // Sync consumed IDs with backend
  
  // Authorization & Backend
  'check-authorization',   // Check if app is authorized
  'authorize-app',         // Authorize app with backend
  'get-consumption-report', // Get consumption report
  
  // Workspace Management
  'scan-workspace',        // Discover AL apps in workspace
  'set-active-app',        // Set the active AL app
  
  // Field Management
  'get-next-field-id',     // Get next field ID for tables
  'get-next-enum-value-id', // Get next enum value ID
  
  // Collision Detection
  'check-collision',       // Check for ID collisions
  'check-range-overlaps',  // Check for range overlaps
  
  // Assignment
  'assign-ids',            // Interactive ID assignment
  'get-assignment-history', // View assignment history
  
  // Configuration
  'get-statistics'         // Get usage statistics
];

export function getServerMode(): ServerMode {
  const mode = process.env.MCP_MODE?.toLowerCase();
  if (mode === 'lite') return 'lite';
  if (mode === 'full') return 'full';
  return 'normal';  // Default to normal mode
}

export function getLiteTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter(tool => LITE_MODE_TOOLS.includes(tool.name));
}

export function getNormalTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter(tool => NORMAL_MODE_TOOLS.includes(tool.name));
}

export function getFullTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export function getToolsForMode(mode?: ServerMode): ToolDefinition[] {
  const actualMode = mode || getServerMode();
  const logger = Logger.getInstance();

  if (actualMode === 'lite') {
    logger.info(`Running in LITE mode - exposing ${LITE_MODE_TOOLS.length} essential tools`);
    return getLiteTools();
  } else if (actualMode === 'normal') {
    logger.info(`Running in NORMAL mode - exposing ${NORMAL_MODE_TOOLS.length} essential tools`);
    return getNormalTools();
  } else {
    logger.info(`Running in FULL mode - exposing all ${TOOL_DEFINITIONS.length} tools`);
    return getFullTools();
  }
}

export function isToolAvailable(toolName: string, mode?: ServerMode): boolean {
  const actualMode = mode || getServerMode();
  const availableTools = getToolsForMode(actualMode);
  return availableTools.some(tool => tool.name === toolName);
}