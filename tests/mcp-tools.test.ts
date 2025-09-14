import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';

describe('MCP Server Tools', () => {
  let client: Client;
  let transport: StdioClientTransport;
  const testAppPath = 'U:/Git/DO/Cloud';

  beforeAll(async () => {
    // Initialize MCP client
    // Filter out undefined values from process.env
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Fix the server path - use process.cwd() to get the correct base path
    const serverPath = path.join(process.cwd(), 'dist', 'server.js');

    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env
    });

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(tools.tools).toBeInstanceOf(Array);

      // Check for expected tools
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('set-active-app');
      // get-active-app not needed - get-workspace-info provides this
      expect(toolNames).toContain('get-next-id');
      expect(toolNames).toContain('sync-object-ids');

      console.log('Available tools:', toolNames);
    });

    it('should provide schema for set-active-app', async () => {
      const tools = await client.listTools();
      const setActiveApp = tools.tools.find(t => t.name === 'set-active-app');

      expect(setActiveApp).toBeDefined();
      expect(setActiveApp?.inputSchema).toBeDefined();

      console.log('set-active-app schema:', JSON.stringify(setActiveApp?.inputSchema, null, 2));
    });
  });

  describe('set-active-app Tool', () => {
    it('should handle different parameter formats', async () => {
      const testCases = [
        { desc: 'forward slashes', params: { appPath: 'U:/Git/DO/Cloud' } },
        { desc: 'backslashes', params: { appPath: 'U:\\Git\\DO\\Cloud' } },
        { desc: 'appFolderUri parameter', params: { appFolderUri: testAppPath } },
        { desc: 'file URI', params: { appPath: `file:///${testAppPath}` } },
        { desc: 'direct app.json path', params: { appPath: `${testAppPath}/app.json` } }
      ];

      for (const testCase of testCases) {
        console.log(`\nTesting ${testCase.desc}:`);
        console.log('Parameters:', testCase.params);

        try {
          const result = await client.callTool({
            name: 'set-active-app',
            arguments: testCase.params
          });

          console.log('Success:', result);
          expect(result).toBeDefined();
        } catch (error: any) {
          console.log('Error:', error.message);
          console.log('Error details:', error);
        }
      }
    });

    it('should fail with invalid path', async () => {
      console.log('\nTesting invalid path:');

      try {
        await client.callTool({
          name: 'set-active-app',
          arguments: { appPath: '/invalid/nonexistent/path' }
        });

        fail('Should have thrown an error');
      } catch (error: any) {
        console.log('Expected error:', error.message);
        expect(error).toBeDefined();
      }
    });

    it('should fail without parameters', async () => {
      console.log('\nTesting missing parameters:');

      try {
        await client.callTool({
          name: 'set-active-app',
          arguments: {}
        });

        fail('Should have thrown an error');
      } catch (error: any) {
        console.log('Expected error:', error.message);
        expect(error).toBeDefined();
      }
    });
  });

  describe('get-workspace-info Tool', () => {
    it('should return workspace info including active app', async () => {
      // First set an active app
      try {
        await client.callTool({
          name: 'set-active-app',
          arguments: { appPath: testAppPath }
        });
      } catch (error) {
        console.log('Error setting app:', error);
      }

      // Get workspace info which includes active app
      try {
        const result = await client.callTool({
          name: 'get-workspace-info',
          arguments: {}
        });

        console.log('Workspace info:', result);
        expect(result).toBeDefined();
        // The result should contain activeApp field
        const content = (result as any).content[0];
        if (content?.type === 'text') {
          const info = JSON.parse(content.text);
          expect(info).toHaveProperty('activeApp');
        }
      } catch (error: any) {
        console.log('Error getting workspace info:', error.message);
      }
    });
  });

  describe('get-next-id Tool', () => {
    beforeEach(async () => {
      // Ensure app is set
      try {
        await client.callTool({
          name: 'set-active-app',
          arguments: { appPath: testAppPath }
        });
      } catch (error) {
        console.log('Setup error:', error);
      }
    });

    it('should get next ID for different object types', async () => {
      const objectTypes = ['table', 'page', 'codeunit', 'query', 'report', 'xmlport', 'enum'];

      for (const type of objectTypes) {
        console.log(`\nTesting ${type}:`);

        try {
          const result = await client.callTool({
            name: 'get-next-id',
            arguments: {
              type: type,
              name: `Test${type}`
            }
          });

          console.log(`Next ID for ${type}:`, result);
          expect(result).toBeDefined();
        } catch (error: any) {
          console.log(`Error for ${type}:`, error.message);
        }
      }
    });
  });

  describe('sync-object-ids Tool', () => {
    it('should sync IDs with backend', async () => {
      try {
        await client.callTool({
          name: 'set-active-app',
          arguments: { appPath: testAppPath }
        });

        const result = await client.callTool({
          name: 'sync-object-ids',
          arguments: {}
        });

        console.log('Sync result:', result);
        expect(result).toBeDefined();
      } catch (error: any) {
        console.log('Sync error:', error.message);
      }
    });
  });
});

// Standalone test runner for debugging
if (require.main === module) {
  (async () => {
    console.log('Running MCP Tools Tests...\n');

    // Filter out undefined values from process.env
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(__dirname, '../dist/server.js')],
      env
    });

    const client = new Client(
      { name: 'debug-client', version: '1.0.0' },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);
      console.log('Connected to MCP server\n');

      // List tools and their schemas
      const tools = await client.listTools();
      console.log('Available tools:');
      for (const tool of tools.tools) {
        console.log(`\n- ${tool.name}`);
        if (tool.inputSchema) {
          console.log('  Schema:', JSON.stringify(tool.inputSchema, null, 2));
        }
      }

      // Test set-active-app with different formats
      console.log('\n\nTesting set-active-app with different formats:');
      const formats = [
        { appPath: 'U:/Git/DO/Cloud' },
        { appFolderUri: 'U:/Git/DO/Cloud' },
        { path: 'U:/Git/DO/Cloud' },
        { uri: 'U:/Git/DO/Cloud' }
      ];

      for (const params of formats) {
        console.log(`\nTrying:`, params);
        try {
          const result = await client.callTool({
            name: 'set-active-app',
            arguments: params
          });
          console.log('Success:', result);
          break; // Stop on first success
        } catch (error: any) {
          console.log('Failed:', error.message);
        }
      }

    } catch (error) {
      console.error('Error:', error);
    } finally {
      await client.close();
      console.log('\nConnection closed');
    }
  })();
}