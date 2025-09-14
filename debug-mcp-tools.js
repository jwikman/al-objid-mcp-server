const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

async function debugMcpTools() {
  console.log('=== MCP Tools Debugger ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'dist/server.js')]
  });

  const client = new Client(
    { name: 'debug-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('✓ Connected\n');

    // Step 1: List all tools and their schemas
    console.log('=== Available Tools ===');
    const tools = await client.listTools();

    for (const tool of tools.tools) {
      console.log(`\n📦 ${tool.name}`);
      console.log(`   ${tool.description || 'No description'}`);

      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log('   Parameters:');
        for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
          const required = tool.inputSchema.required?.includes(key) ? '(required)' : '(optional)';
          console.log(`     - ${key}: ${value.type} ${required}`);
          if (value.description) {
            console.log(`       ${value.description}`);
          }
        }
      }
    }

    // Step 2: First scan the workspace to discover apps
    console.log('\n\n=== Scanning Workspace for AL Apps ===');
    const workspacePath = 'U:/Git/DO';

    console.log(`→ Scanning workspace: ${workspacePath}`);
    try {
      const scanResult = await client.callTool({
        name: 'scan-workspace',
        arguments: { workspacePath }
      });
      console.log('✓ Workspace scanned successfully');
      console.log('  Response:', JSON.stringify(scanResult, null, 2));
    } catch (error) {
      console.log('✗ Failed to scan workspace:', error.message);
    }

    // Step 3: Now test set-active-app
    console.log('\n\n=== Testing set-active-app Tool ===');
    const setActiveAppTool = tools.tools.find(t => t.name === 'set-active-app');

    if (setActiveAppTool) {
      console.log('Tool schema:', JSON.stringify(setActiveAppTool.inputSchema, null, 2));

      // Use backslashes to match the scanned path format
      const testPath = 'U:\\Git\\DO\\Cloud';

      console.log(`\n→ Setting active app to: ${testPath}`);
      try {
        const result = await client.callTool({
          name: 'set-active-app',
          arguments: { appPath: testPath }
        });

        console.log('✓ SUCCESS!');
        console.log('  Response:', JSON.stringify(result, null, 2));

        // Test get-workspace-info to verify
        console.log('\n→ Getting workspace info to verify active app:');
        try {
          const infoResult = await client.callTool({
            name: 'get-workspace-info',
            arguments: {}
          });
          console.log('  Workspace info:', JSON.stringify(infoResult, null, 2));
        } catch (e) {
          console.log('  Error getting workspace info:', e.message);
        }

      } catch (error) {
        console.log('✗ Failed:', error.message);
        if (error.data) {
          console.log('  Error data:', JSON.stringify(error.data, null, 2));
        }
      }
    } else {
      console.log('❌ set-active-app tool not found!');
    }

    // Step 3: Test other tools after setting active app
    console.log('\n\n=== Testing Other Tools ===');

    // Try to get next ID
    console.log('\n→ Testing get-next-id:');
    try {
      const result = await client.callTool({
        name: 'get-next-id',
        arguments: {
          objectType: 'table'  // Fixed: use objectType instead of type
        }
      });
      console.log('✓ Success:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('✗ Failed:', error.message);
    }

    // Try to sync IDs
    console.log('\n→ Testing sync-object-ids:');
    try {
      const result = await client.callTool({
        name: 'sync-object-ids',
        arguments: {
          ids: {  // Fixed: add required ids parameter
            table: [50000, 50001],
            page: [50000]
          }
        }
      });
      console.log('✓ Success:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('✗ Failed:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    console.log('\n\nClosing connection...');
    await client.close();
    console.log('✓ Connection closed');
  }
}

// Run the debugger
debugMcpTools().catch(console.error);