import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { REFERENCE_CONTRACT_VERSION, REFERENCE_TOOL_CONTRACTS } from '../../contracts/reference-collection.mjs';
import { createReferenceMockService } from './reference-service.mjs';

export function createReferenceMockMcpServer(options = {}) {
  const service = createReferenceMockService(options);
  const server = new McpServer({ name: 'cis-synthetic-reference-mock', version: '0.1.0' }, {
    instructions: `CIS ${REFERENCE_CONTRACT_VERSION}: synchronous synthetic fixtures only. Real provider absent; eligibility unknown; real data persistence not authorized. No network, paid calls, DAM writes or real human approval.`,
  });
  for (const [name, contract] of Object.entries(REFERENCE_TOOL_CONTRACTS)) {
    server.registerTool(name, {
      description: contract.description, inputSchema: contract.input, outputSchema: contract.output,
      annotations: { readOnlyHint: contract.readOnly, destructiveHint: contract.destructive ?? false,
        openWorldHint: false },
    }, (input) => service.invoke(name, input));
  }
  return server;
}
