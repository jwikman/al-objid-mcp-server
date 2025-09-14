const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

async function testMcpResources() {
  console.log('=== MCP Resources Test ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'dist/server.js')]
  });

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('✓ Connected\n');

    // Test 1: List all resources
    console.log('=== Listing Resources ===');
    try {
      const resources = await client.listResources();
      console.log('Available resources:');

      if (resources && resources.resources) {
        for (const resource of resources.resources) {
          console.log(`\n📄 ${resource.name}`);
          console.log(`   URI: ${resource.uri}`);
          console.log(`   Description: ${resource.description}`);
          console.log(`   MIME Type: ${resource.mimeType}`);
        }
      } else {
        console.log('No resources found');
      }
    } catch (error) {
      console.log('✗ Failed to list resources:', error.message);
    }

    // Test 2: Read each resource
    console.log('\n\n=== Reading Resources ===');
    const resourceUris = [
      'mcp://workflows/workspace-setup',
      'mcp://workflows/quick-start',
      'mcp://workflows/tool-dependencies'
    ];

    for (const uri of resourceUris) {
      console.log(`\n→ Reading resource: ${uri}`);
      try {
        const result = await client.readResource({ uri });

        if (result && result.contents && result.contents[0]) {
          const content = result.contents[0];
          console.log('✓ Successfully read resource');
          console.log(`  MIME Type: ${content.mimeType}`);
          console.log(`  Content preview (first 200 chars):`);
          console.log(`  ${content.text.substring(0, 200)}...`);
        } else {
          console.log('✗ No content returned');
        }
      } catch (error) {
        console.log('✗ Failed to read resource:', error.message);
      }
    }

    // Test 3: Try reading non-existent resource
    console.log('\n\n=== Testing Error Handling ===');
    console.log('→ Reading non-existent resource: mcp://invalid/resource');
    try {
      await client.readResource({ uri: 'mcp://invalid/resource' });
      console.log('✗ Should have thrown an error!');
    } catch (error) {
      console.log('✓ Correctly threw error:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    console.log('\n\nClosing connection...');
    await client.close();
    console.log('✓ Connection closed');
  }
}

// Run the test
testMcpResources().catch(console.error);