#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';

import { BackendService } from './lib/backend/BackendService';
import { ConfigManager } from './lib/config/ConfigManager';
import { WorkspaceManager, WorkspaceApp } from './lib/workspace/WorkspaceManager';
import { CollisionDetector } from './lib/collision/CollisionDetector';
import { FieldManager } from './lib/field/FieldManager';
import { PollingService } from './lib/polling/PollingService';
import { AssignmentManager } from './lib/assignment/AssignmentManager';
import { ConfigPersistence } from './lib/config/ConfigPersistence';
import { AppIdentifier } from './lib/utils/AppIdentifier';
import { Logger, LogLevel } from './lib/utils/Logger';
import { ALObjectType } from './lib/types/ALObjectType';

// Define ToolCallResponse locally to match MCP SDK expectations
type ToolCallResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
};

import { getToolsForMode, isToolAvailable } from './tools/toolFilter';

class ALObjectIdServer {
  private server: Server;
  private backend: BackendService;
  private config: ConfigManager;
  private workspace: WorkspaceManager;
  private collision: CollisionDetector;
  private field: FieldManager;
  private polling: PollingService;
  private assignment: AssignmentManager;
  private persistence: ConfigPersistence;
  private logger: Logger;

  // Workflow documentation resources
  // Workflow documentation resources
  private resources = {
    'mcp://workflows/workspace-setup': {
      name: 'Workspace Setup Workflow',
      description: 'How to set up and activate an AL app in the workspace',
      mimeType: 'text/markdown',
      content: `# Workspace Setup Workflow

## Overview
Before you can use most AL Object ID Ninja tools, you need to set up your workspace properly. This involves scanning for AL apps and setting an active app.

## Required Steps

### 1. Scan the Workspace
First, scan your workspace to discover AL apps:

\`\`\`
Tool: scan-workspace
Parameters: {
  "workspacePath": "path/to/your/workspace"
}
\`\`\`

This will:
- Search for all AL apps (folders with app.json)
- Load app metadata (ID, name, version, ranges)
- Check authorization status
- Store apps in workspace memory

### 2. Set Active App
After scanning, set which app you want to work with:

\`\`\`
Tool: set-active-app
Parameters: {
  "appPath": "path/to/specific/app"
}
\`\`\`

**Important**: The appPath must match exactly what was returned from scan-workspace (including path separators).

### 3. Verify Setup
Check your workspace configuration:

\`\`\`
Tool: get-workspace-info
Parameters: {}
\`\`\`

## Common Issues

### "Failed to set active app"
- **Cause**: App not in workspace memory
- **Solution**: Run scan-workspace first
- **Note**: Path format must match exactly (Windows uses backslashes)

### "No AL app found"
- **Cause**: Using a tool without active app
- **Solution**: Set active app first

## Tools That Require Active App
- get-next-id
- sync-object-ids
- get-consumption-report
- check-collision
- assign-ids
- All field management tools
`
    },
    'mcp://workflows/quick-start': {
      name: 'Quick Start Guide',
      description: 'Getting started with AL Object ID Ninja MCP',
      mimeType: 'text/markdown',
      content: `# AL Object ID Ninja - Quick Start

## Initial Setup

1. **Scan your workspace**
   \`scan-workspace\` with your project root path

2. **Set active app**
   \`set-active-app\` with the app path

3. **Check authorization**
   \`check-authorization\` to verify app status

4. **Authorize if needed**
   \`authorize-app\` with auth key

## Common Workflows

### Get Next Object ID
\`\`\`
get-next-id
- objectType: "table" | "page" | "report" | etc.
- appPath: optional (uses active app)
- ranges: optional custom ranges
\`\`\`

### Check for Collisions
\`\`\`
check-collision
- objectType: type of object
- id: ID to check
- appPath: optional
\`\`\`

### Interactive Assignment
\`\`\`
assign-ids
- objectType: type of object
- count: number of IDs
- checkCollisions: true/false
- suggestAlternatives: true/false
\`\`\`

## Tips
- Always scan workspace first
- Path formats matter (Windows vs Unix)
- Most tools use active app if appPath not provided
- Use get-workspace-info to debug issues
`
    },
    'mcp://workflows/tool-dependencies': {
      name: 'Tool Dependencies',
      description: 'Which tools depend on others',
      mimeType: 'text/markdown', 
      content: `# Tool Dependencies

## Workspace Setup Dependencies

### Prerequisites: scan-workspace
The following tools require scan-workspace to be run first:
- **set-active-app**: Needs apps in workspace memory
- All tools that use appPath parameter (when not provided)

### Prerequisites: set-active-app OR appPath
These tools need either an active app or explicit appPath:
- get-next-id
- sync-object-ids
- check-authorization
- authorize-app
- get-consumption-report
- get-next-field-id
- get-next-enum-value-id
- check-collision
- assign-ids
- batch-assign
- reserve-range
- get-suggestions

### Prerequisites: Authorization
These tools require the app to be authorized:
- get-next-id
- sync-object-ids
- get-consumption-report
- get-next-field-id
- get-next-enum-value-id

## Standalone Tools
These work without prerequisites:
- get-workspace-info
- check-range-overlaps
- start-polling / stop-polling / get-polling-status
- save-preferences / get-preferences
- export-config / import-config
- get-statistics
- get-assignment-history

## Workflow Sequences

### Initial Setup
1. scan-workspace
2. set-active-app
3. check-authorization
4. authorize-app (if needed)

### ID Assignment Flow
1. Setup (above)
2. get-next-id OR assign-ids
3. sync-object-ids (to save to backend)

### Collision Detection Flow
1. Setup (workspace + active app)
2. check-collision OR check-range-overlaps
3. Use alternatives if collisions found
`
    }
  };
  constructor() {
    this.server = new Server({
      name: "al-objid-ninja-mcp",
      version: "0.3.0"
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.config = ConfigManager.getInstance();
    this.workspace = WorkspaceManager.getInstance();
    this.backend = new BackendService();  // BackendService doesn't use singleton pattern
    this.collision = CollisionDetector.getInstance();
    this.field = FieldManager.getInstance();
    this.polling = PollingService.getInstance();
    this.assignment = AssignmentManager.getInstance();
    this.persistence = ConfigPersistence.getInstance();
    this.logger = Logger.getInstance();

    // Log the server mode
    const mode = process.env.MCP_MODE?.toLowerCase();
    const actualMode = mode === 'lite' ? 'LITE' : 'FULL';
    this.logger.info(`AL Object ID Ninja MCP Server starting in ${actualMode} mode`);

    // Setup handlers
    this.setupHandlers();

    // Set up polling
    this.setupPolling();

    // Restore configuration
    this.restoreConfiguration();
  }

  private setupHandlers(): void {
    // Get tools based on mode
    const tools = getToolsForMode();
    
    // Set up the list tools handler
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({ tools })
    );

    // Tool call handler
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;

        // Check if tool is available in current mode
        if (!isToolAvailable(name)) {
          return {
            content: [
              {
                type: "text",
                text: `Tool '${name}' is not available in current mode`
              }
            ],
            isError: true
          };
        }

        try {
          switch (name) {
            // Core ID Management
            case "get-next-id":
              return await this.handleGetNextObjectId(args);
            case "reserve-id":
              return await this.handleReserveId(args);
            case "sync-object-ids":
              return await this.handleSyncObjectIds(args);

            // Authorization & Backend
            case "check-authorization":
              return await this.handleCheckAuthorization(args);
            case "authorize-app":
              return await this.handleAuthorizeApp(args);
            case "get-consumption-report":
              return await this.handleGetConsumptionReport(args);

            // Workspace Management
            case "scan-workspace":
              return await this.handleScanWorkspace(args);
            case "get-workspace-info":
              return await this.handleGetWorkspaceInfo(args);
            case "set-active-app":
              return await this.handleSetActiveApp(args);

            // Field Management
            case "get-next-field-id":
              return await this.handleGetNextFieldId(args);
            case "get-next-enum-value-id":
              return await this.handleGetNextEnumValueId(args);

            // Collision Detection
            case "check-collision":
              return await this.handleCheckCollision(args);
            case "check-range-overlaps":
              return await this.handleCheckRangeOverlaps(args);

            // Polling Management
            case "start-polling":
              return await this.handleStartPolling(args);
            case "stop-polling":
              return await this.handleStopPolling(args);
            case "get-polling-status":
              return await this.handleGetPollingStatus(args);

            // Interactive Assignment
            case "assign-ids":
              return await this.handleAssignIds(args);
            case "batch-assign":
              return await this.handleBatchAssign(args);
            case "reserve-range":
              return await this.handleReserveRange(args);
            case "get-suggestions":
              return await this.handleGetSuggestions(args);
            case "get-assignment-history":
              return await this.handleGetAssignmentHistory(args);

            // Configuration Management
            case "save-preferences":
              return await this.handleSavePreferences(args);
            case "get-preferences":
              return await this.handleGetPreferences(args);
            case "export-config":
              return await this.handleExportConfig(args);
            case "import-config":
              return await this.handleImportConfig(args);
            case "get-statistics":
              return await this.handleGetStatistics(args);

            default:
              return {
                content: [
                  {
                    type: "text",
                    text: `Unknown tool: ${name}`
                  }
                ]
              };
          }
        } catch (error) {
          this.logger.error(`Error handling tool ${name}`, error);
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ],
            isError: true
          };
        }
      }
    );

    // Handle list resources request
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Object.entries(this.resources).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));

      return { resources };
    });

    // Handle read resource request
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const resource = this.resources[request.params.uri as keyof typeof this.resources];

      if (!resource) {
        throw new Error(`Resource not found: ${request.params.uri}`);
      }

      return {
        contents: [{
          uri: request.params.uri,
          mimeType: resource.mimeType,
          text: resource.content
        }]
      };
    });
  }

  private setupPolling(): void {
    // Set up polling event listeners
    this.polling.on('update', (event) => {
      this.logger.info('Polling update received', event);
      // Could notify through MCP if there was a notification mechanism
    });
  }

  private restoreConfiguration(): void {
    try {
      // Restore polling configuration
      const pollingConfig = this.persistence.getPollingConfig();
      if (pollingConfig.enabled) {
        this.polling.start(pollingConfig);
      }

      // Restore preferences
      const preferences = this.persistence.getPreferences();
      if (preferences.logLevel) {
        this.logger.setLevel(preferences.logLevel as any);
      }

      this.logger.info('Configuration restored from persistence');
    } catch (error) {
      this.logger.error('Failed to restore configuration', error);
    }
  }

  // Helper method to get app from path
  private async getAppFromPath(appPath?: string): Promise<WorkspaceApp | null> {
    if (!appPath) {
      // Try to get active app
      const workspace = this.workspace.getCurrentWorkspace();
      if (workspace?.activeApp) {
        return workspace.activeApp;
      }
      return null;
    }

    // Try to find app by path
    let app = this.workspace.getAppByPath(appPath);
    
    if (!app) {
      // Try scanning if not found
      const workspace = await this.workspace.scanWorkspace(appPath);
      if (workspace.apps.length > 0) {
        app = workspace.apps[0];
      }
    }

    return app || null;
  }

  // Handler implementations

  private async handleGetNextObjectId(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Handle field/enum value requests
    if (args.parentObjectId) {
      if (args.objectType === 'field' || args.objectType === 'table') {
        // Get field ID
        const fieldId = await this.field.getNextFieldId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.isExtension || false
        );

        if (fieldId) {
          return {
            content: [{
              type: "text",
              text: `Next available field ID for table ${args.parentObjectId}: ${fieldId}\nUse 'reserve-id' to claim this ID.`
            }]
          };
        } else {
          return {
            content: [{ type: "text", text: `No available field IDs for table ${args.parentObjectId}` }],
            isError: true
          };
        }
      } else if (args.objectType === 'enum') {
        // Get enum value ID
        const enumValueId = await this.field.getNextEnumValueId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.isExtension || false
        );

        if (enumValueId) {
          return {
            content: [{
              type: "text",
              text: `Next available enum value for enum ${args.parentObjectId}: ${enumValueId}\nUse 'reserve-id' to claim this ID.`
            }]
          };
        } else {
          return {
            content: [{ type: "text", text: `No available enum values for enum ${args.parentObjectId}` }],
            isError: true
          };
        }
      }
    }

    // Standard object ID request (query only, no commit)
    const objectType = args.objectType as ALObjectType;
    const ranges = args.ranges || app.ranges || [{ from: 50000, to: 99999 }];

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);

    const request = {
      appId,
      type: objectType,
      ranges,
      authKey: app.authKey,
      perRange: false
    };

    // Query without committing (GET request)
    const result = await this.backend.getNext(request, false);

    if (result && result.available) {
      // Handle both single ID and array of IDs
      const id = Array.isArray(result.id) ? result.id[0] : result.id;

      // Check for collisions
      const collision = await this.collision.checkCollision(objectType, id, app);

      if (collision) {
        return {
          content: [{
            type: "text",
            text: `Next available ${objectType} ID: ${id}\n⚠️ Warning: Potential collision with ${collision.apps.map(a => a.appName).join(', ')}\nUse 'reserve-id' to claim this ID.`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `Next available ${objectType} ID: ${id}\nUse 'reserve-id' to claim this ID.`
        }]
      };
    }

    return {
      content: [{ type: "text", text: `No available IDs in the specified ranges` }],
      isError: true
    };
  }

  private async handleReserveId(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Handle field/enum value reservation
    if (args.parentObjectId) {
      if (args.objectType === 'field' || args.objectType === 'table') {
        // Reserve field ID
        const success = await this.field.reserveFieldId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.id,
          args.isExtension || false
        );

        if (success) {
          return {
            content: [{
              type: "text",
              text: `✓ Reserved field ID ${args.id} for table ${args.parentObjectId}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `✗ Failed to reserve field ID ${args.id} - may already be in use`
            }],
            isError: true
          };
        }
      } else if (args.objectType === 'enum') {
        // Reserve enum value
        const success = await this.field.reserveEnumValueId(
          app.appId,
          app.authKey,
          args.parentObjectId,
          args.id,
          args.isExtension || false
        );

        if (success) {
          return {
            content: [{
              type: "text",
              text: `✓ Reserved enum value ${args.id} for enum ${args.parentObjectId}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `✗ Failed to reserve enum value ${args.id} - may already be in use`
            }],
            isError: true
          };
        }
      }
    }

    // Standard object ID reservation
    const objectType = args.objectType as ALObjectType;
    const ranges = app.ranges || [{ from: 50000, to: 99999 }];
    const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);

    // Validate ID is within allowed ranges
    const inRange = ranges.some(r => args.id >= r.from && args.id <= r.to);
    if (!inRange) {
      return {
        content: [{
          type: "text",
          text: `✗ ID ${args.id} is outside allowed ranges`
        }],
        isError: true
      };
    }

    const request = {
      appId,
      type: objectType,
      ranges,
      authKey: app.authKey,
      perRange: false,
      require: args.id  // Specific ID to reserve
    };

    // Commit the reservation (POST request)
    const result = await this.backend.getNext(request, true);

    if (result && result.available) {
      const reservedId = Array.isArray(result.id) ? result.id[0] : result.id;

      if (reservedId === args.id) {
        // Successfully reserved the requested ID
        // Track the assignment
        await this.assignment.assignIds(app, {
          objectType,
          count: 1,
          description: `Reserved ${objectType} ID ${args.id}`
        });

        return {
          content: [{
            type: "text",
            text: `✓ Successfully reserved ${objectType} ID: ${args.id}`
          }]
        };
      } else {
        // Different ID was returned - original was taken
        return {
          content: [{
            type: "text",
            text: `✗ ID ${args.id} is already taken. Next available: ${reservedId}\nUse 'get-next-id' to find another available ID.`
          }],
          isError: true
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: `✗ Failed to reserve ${objectType} ID ${args.id}`
      }],
      isError: true
    };
  }

  private async handleCheckAuthorization(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (app.isAuthorized) {
      return {
        content: [{
          type: "text",
          text: `✅ App "${app.name}" is authorized`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `❌ App "${app.name}" is not authorized`
      }]
    };
  }

  private async handleAuthorizeApp(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);

    // For now, use simplified authorization (Phase 4 will add full git integration)
    const request = {
      appId,
      appName: app.name,
      gitUser: 'user',
      gitEmail: 'user@example.com',
      gitRepo: 'repo',
      gitBranch: 'main'
    };

    const result = await this.backend.authorizeApp(request);

    if (result) {
      // Update workspace manager
      this.workspace.updateAppAuthorization(app.path, args.authKey);
      
      // Save to persistence
      const workspace = this.workspace.getCurrentWorkspace();
      if (workspace) {
        this.persistence.saveWorkspace(
          workspace.rootPath,
          workspace.apps,
          workspace.activeApp?.appId
        );
      }

      return {
        content: [{
          type: "text",
          text: `✅ App "${app.name}" has been authorized successfully`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Authorization failed. Please check the auth key." }],
      isError: true
    };
  }

  private async handleSyncObjectIds(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    // Use pool ID if available (matches VSCode extension behavior)
    const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);
    
    // Support sync modes: merge (UPDATE/PATCH) or replace (REPLACE/POST)
    const merge = args.merge === true || args.mode === 'UPDATE' || args.mode === 'merge';
    
    const result = await this.backend.syncIds({
      appId,
      authKey: app.authKey,
      ids: args.ids,
      merge
    });

    if (result) {
      // Record in persistence
      for (const [objectType, ids] of Object.entries(args.ids)) {
        if (Array.isArray(ids)) {
          this.persistence.addAssignmentHistory(
            app.appId,
            objectType,
            ids,
            `${merge ? 'Merge' : 'Replace'} sync`
          );
        }
      }

      return {
        content: [{
          type: "text",
          text: `✅ Successfully synced object IDs for app "${app.name}" (${merge ? 'MERGE' : 'REPLACE'} mode)`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to sync object IDs" }],
      isError: true
    };
  }

  private async handleGetConsumptionReport(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found at the specified path" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized. Please authorize first." }],
        isError: true
      };
    }

    const objectTypes = args.objectTypes || [
      ALObjectType.Table,
      ALObjectType.Page,
      ALObjectType.Report,
      ALObjectType.Codeunit,
      ALObjectType.Query,
      ALObjectType.XmlPort,
      ALObjectType.Enum
    ];

    const report: Record<string, number[]> = {};

    // Get all consumption at once using pool ID if available (matches VSCode extension behavior)
    const appId = this.workspace.getPoolIdFromAppIdIfAvailable(app.appId);
    const request = {
      appId,
      authKey: app.authKey
    };
    const consumptionInfo = await this.backend.getConsumption(request);

    if (consumptionInfo) {
      for (const objectType of objectTypes) {
        const consumption = consumptionInfo[objectType as ALObjectType] || [];
        if (consumption.length > 0) {
          report[objectType] = consumption;
        }
      }
    }

    const summary = Object.entries(report)
      .map(([type, ids]) => `${type}: ${ids.length} IDs (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''})`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `📊 Consumption Report for "${app.name}":\n\n${summary || 'No consumed IDs found'}`
      }]
    };
  }

  private async handleScanWorkspace(args: any): Promise<ToolCallResponse> {
    const workspace = await this.workspace.scanWorkspace(args.workspacePath);

    // Save to persistence
    this.persistence.saveWorkspace(
      workspace.rootPath,
      workspace.apps,
      workspace.activeApp?.appId
    );

    const appList = workspace.apps
      .map(app => `- ${app.name} v${app.version} ${app.isAuthorized ? '✅' : '❌'}`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `Found ${workspace.apps.length} AL app(s):\n${appList}`
      }]
    };
  }

  private async handleGetWorkspaceInfo(args: any): Promise<ToolCallResponse> {
    const workspace = this.workspace.getCurrentWorkspace();
    
    if (!workspace) {
      return {
        content: [{ type: "text", text: "No workspace is currently active" }],
        isError: true
      };
    }

    const info = {
      rootPath: workspace.rootPath,
      appCount: workspace.apps.length,
      apps: workspace.apps.map(app => ({
        name: app.name,
        version: app.version,
        authorized: app.isAuthorized,
        path: app.path
      })),
      activeApp: workspace.activeApp?.name || 'None'
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(info, null, 2)
      }]
    };
  }

  private async handleSetActiveApp(args: any): Promise<ToolCallResponse> {
    const success = this.workspace.setActiveApp(args.appPath);

    if (success) {
      const workspace = this.workspace.getCurrentWorkspace();
      if (workspace) {
        // Save to persistence
        this.persistence.saveWorkspace(
          workspace.rootPath,
          workspace.apps,
          workspace.activeApp?.appId
        );

        return {
          content: [{
            type: "text",
            text: `✅ Active app set to: ${workspace.activeApp?.name}`
          }]
        };
      }
    }

    return {
      content: [{ type: "text", text: "Failed to set active app" }],
      isError: true
    };
  }

  private async handleGetNextFieldId(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized" }],
        isError: true
      };
    }

    const fieldId = await this.field.getNextFieldId(
      app.appId,
      app.authKey,
      args.tableId,
      args.isExtension || false
    );

    if (fieldId > 0) {
      return {
        content: [{
          type: "text",
          text: `Next available field ID for table ${args.tableId}: ${fieldId}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "No available field IDs" }],
      isError: true
    };
  }

  private async handleGetNextEnumValueId(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    if (!app.isAuthorized || !app.authKey) {
      return {
        content: [{ type: "text", text: "App is not authorized" }],
        isError: true
      };
    }

    const valueId = await this.field.getNextEnumValueId(
      app.appId,
      app.authKey,
      args.enumId,
      args.isExtension || false
    );

    if (valueId >= 0) {
      return {
        content: [{
          type: "text",
          text: `Next available enum value ID for enum ${args.enumId}: ${valueId}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "No available enum value IDs" }],
      isError: true
    };
  }

  private async handleCheckCollision(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const collision = await this.collision.checkCollision(
      args.objectType as ALObjectType,
      args.id,
      app
    );

    if (collision) {
      const conflictingApps = collision.apps
        .map(a => `- ${a.appName} (${a.appPath})`)
        .join('\n');

      return {
        content: [{
          type: "text",
          text: `⚠️ Collision detected!\n\n${collision.message}\n\nConflicting apps:\n${conflictingApps}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `✅ No collision detected for ${args.objectType} ID ${args.id}`
      }]
    };
  }

  private async handleCheckRangeOverlaps(args: any): Promise<ToolCallResponse> {
    const overlaps = await this.collision.checkRangeOverlaps();

    if (overlaps.length === 0) {
      return {
        content: [{
          type: "text",
          text: "✅ No range overlaps detected between apps"
        }]
      };
    }

    const overlapList = overlaps
      .map(o => `- ${o.message}`)
      .join('\n');

    return {
      content: [{
        type: "text",
        text: `⚠️ Range overlaps detected:\n\n${overlapList}`
      }]
    };
  }

  private async handleStartPolling(args: any): Promise<ToolCallResponse> {
    const config = {
      enabled: true,
      interval: args.interval || 30000,
      checkConsumption: args.features?.consumption !== false,
      checkCollisions: args.features?.collisions !== false,
      checkPools: args.features?.pools || false
    };

    this.polling.start(config);

    // Save to persistence
    this.persistence.savePollingConfig(config);

    return {
      content: [{
        type: "text",
        text: `✅ Polling started with interval: ${config.interval}ms`
      }]
    };
  }

  private async handleStopPolling(args: any): Promise<ToolCallResponse> {
    this.polling.stop();

    // Update persistence
    const config = this.persistence.getPollingConfig();
    config.enabled = false;
    this.persistence.savePollingConfig(config);

    return {
      content: [{
        type: "text",
        text: "✅ Polling stopped"
      }]
    };
  }

  private async handleGetPollingStatus(args: any): Promise<ToolCallResponse> {
    const status = this.polling.getStatus();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  // Phase 4: Interactive Assignment handlers

  private async handleAssignIds(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const result = await this.assignment.assignIds(app, {
      objectType: args.objectType as ALObjectType,
      count: args.count,
      ranges: args.ranges,
      description: args.description,
      checkCollisions: args.checkCollisions !== false,
      suggestAlternatives: args.suggestAlternatives !== false
    });

    if (result.success) {
      // Save to persistence
      this.persistence.addAssignmentHistory(
        app.appId,
        args.objectType,
        result.ids,
        args.description
      );

      let response = `✅ Assigned ${result.ids.length} ID(s): ${result.ids.join(', ')}`;
      
      if (result.collisions && result.collisions.length > 0) {
        response += `\n\n⚠️ Collisions detected:\n${result.collisions.map(c => 
          `- ID ${c.id} conflicts with ${c.conflictingApps.join(', ')}`
        ).join('\n')}`;
      }

      if (result.alternatives && result.alternatives.length > 0) {
        response += `\n\n💡 Alternative IDs: ${result.alternatives.join(', ')}`;
      }

      return { content: [{ type: "text", text: response }] };
    }

    return {
      content: [{ type: "text", text: result.message || "Failed to assign IDs" }],
      isError: true
    };
  }

  private async handleBatchAssign(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const results = await this.assignment.batchAssign(app, args.assignments);

    const summary = results.map(r => {
      const status = r.success ? '✅' : '❌';
      const ids = r.ids.length > 0 ? r.ids.join(', ') : 'None';
      return `${status} ${r.objectType}: ${ids}`;
    }).join('\n');

    return {
      content: [{
        type: "text",
        text: `Batch assignment results:\n\n${summary}`
      }]
    };
  }

  private async handleReserveRange(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const success = await this.assignment.reserveRange(
      app,
      args.objectType as ALObjectType,
      args.from,
      args.to,
      args.description
    );

    if (success) {
      const count = args.to - args.from + 1;
      return {
        content: [{
          type: "text",
          text: `✅ Reserved ${count} IDs (${args.from}-${args.to}) for ${args.objectType}`
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to reserve range" }],
      isError: true
    };
  }

  private async handleGetSuggestions(args: any): Promise<ToolCallResponse> {
    const app = await this.getAppFromPath(args.appPath);
    if (!app) {
      return {
        content: [{ type: "text", text: "No AL app found" }],
        isError: true
      };
    }

    const suggestions = await this.assignment.getSuggestions(
      app,
      args.objectType as ALObjectType,
      args.pattern
    );

    let response = `📊 ID Assignment Suggestions for ${args.objectType}:\n\n`;
    response += `Next available: ${suggestions.nextAvailable || 'None'}\n\n`;

    if (suggestions.suggestedRanges.length > 0) {
      response += `Suggested ranges:\n`;
      suggestions.suggestedRanges.forEach(r => {
        response += `- ${r.from}-${r.to} (${r.available} available)\n`;
      });
      response += '\n';
    }

    if (suggestions.patterns.length > 0) {
      response += `Patterns:\n`;
      suggestions.patterns.forEach(p => {
        response += `- ${p.pattern}: ${p.example}\n`;
      });
      response += '\n';
    }

    if (suggestions.recentlyUsed.length > 0) {
      response += `Recently used: ${suggestions.recentlyUsed.join(', ')}`;
    }

    return {
      content: [{ type: "text", text: response }]
    };
  }

  private async handleGetAssignmentHistory(args: any): Promise<ToolCallResponse> {
    const app = args.appPath ? await this.getAppFromPath(args.appPath) : undefined;

    // Get from both assignment manager and persistence
    const history = this.assignment.getHistory(app || undefined, args.objectType, args.limit);
    const persistedHistory = this.persistence.getAssignmentHistory(
      app?.appId,
      args.objectType,
      args.limit
    );

    // Combine and deduplicate
    const combined = [...history, ...persistedHistory.map(h => ({
      timestamp: h.timestamp,
      app: app || { appId: h.appId } as any,
      objectType: h.objectType as ALObjectType,
      ids: h.ids,
      description: h.description
    }))];

    // Sort by timestamp and limit
    const sorted = combined
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit || 50);

    if (sorted.length === 0) {
      return {
        content: [{ type: "text", text: "No assignment history found" }]
      };
    }

    const historyText = sorted.map(h => {
      const date = new Date(h.timestamp).toLocaleString();
      const ids = h.ids.slice(0, 5).join(', ') + (h.ids.length > 5 ? '...' : '');
      return `[${date}] ${h.objectType}: ${ids} ${h.description ? `(${h.description})` : ''}`;
    }).join('\n');

    return {
      content: [{
        type: "text",
        text: `📜 Assignment History:\n\n${historyText}`
      }]
    };
  }

  // Configuration Management handlers

  private async handleSavePreferences(args: any): Promise<ToolCallResponse> {
    this.persistence.savePreferences(args.preferences);

    // Apply preferences
    if (args.preferences.logLevel) {
      this.logger.setLevel(args.preferences.logLevel);
    }

    return {
      content: [{
        type: "text",
        text: "✅ Preferences saved successfully"
      }]
    };
  }

  private async handleGetPreferences(args: any): Promise<ToolCallResponse> {
    const preferences = this.persistence.getPreferences();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(preferences, null, 2)
      }]
    };
  }

  private async handleExportConfig(args: any): Promise<ToolCallResponse> {
    const config = this.persistence.exportConfig();

    return {
      content: [{
        type: "text",
        text: config
      }]
    };
  }

  private async handleImportConfig(args: any): Promise<ToolCallResponse> {
    const success = this.persistence.importConfig(args.config);

    if (success) {
      // Restore configuration
      this.restoreConfiguration();

      return {
        content: [{
          type: "text",
          text: "✅ Configuration imported successfully"
        }]
      };
    }

    return {
      content: [{ type: "text", text: "Failed to import configuration" }],
      isError: true
    };
  }

  private async handleGetStatistics(args: any): Promise<ToolCallResponse> {
    const stats = this.persistence.getStatistics();

    const workspace = this.workspace.getCurrentWorkspace();
    const assignmentStats = {
      pendingAssignments: this.assignment.getPendingAssignments().size,
      sessionHistory: this.assignment.getHistory().length
    };

    const combined = {
      ...stats,
      ...assignmentStats,
      currentWorkspace: workspace?.rootPath || 'None',
      activeApp: workspace?.activeApp?.name || 'None'
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(combined, null, 2)
      }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('AL Object ID Ninja MCP server running', {
      transport: 'stdio',
      pid: process.pid
    });

    // Ensure configuration is saved on exit
    process.on('SIGINT', () => {
      this.persistence.forceSave();
      process.exit(0);
    });
  }
}

// Start the server
const server = new ALObjectIdServer();
server.run().catch((error) => {
  // Use logger instead of console to avoid breaking stdio transport
  Logger.getInstance().error('Server error:', error);
  process.exit(1);
});