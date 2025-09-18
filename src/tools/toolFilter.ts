import { ToolDefinition, TOOL_DEFINITIONS } from './toolDefinitions';
import { Logger } from '../lib/utils/Logger';

export type ServerMode = 'lite' | 'full';

const LITE_MODE_TOOLS = [
  'scan-workspace',     // Essential for discovering AL apps
  'set-active-app',     // Required to work with a specific app
  'get-next-id'         // Core functionality
];

export function getServerMode(): ServerMode {
  const mode = process.env.MCP_MODE?.toLowerCase();
  return mode === 'lite' ? 'lite' : 'full';
}

export function getLiteTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter(tool => LITE_MODE_TOOLS.includes(tool.name));
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