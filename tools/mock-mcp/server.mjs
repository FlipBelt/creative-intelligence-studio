import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTRACT_VERSION, TOOL_CONTRACTS } from '../../contracts/mock-mcp.mjs';
import { createMockService } from './service.mjs';

export function createMockMcpServer(options = {}) {
  const service = createMockService(options);
  const server = new McpServer({ name: 'cis-synthetic-mock', version: '0.1.0' }, {
    instructions: `CIS ${CONTRACT_VERSION}: synthetic fixtures only. No production knowledge, identity, uploads or approvals.`,
  });
  for (const [name, contract] of Object.entries(TOOL_CONTRACTS)) {
    server.registerTool(name, {
      description: contract.description, inputSchema: contract.input, outputSchema: contract.output,
      annotations: { readOnlyHint: contract.readOnly, destructiveHint: false, openWorldHint: false },
    }, (input) => service.invoke(name, input));
  }
  return server;
}
