import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createReferenceMockMcpServer } from './reference-server.mjs';

// Only pre-authored launch identities; never take roles, tenants or credentials from tool input/environment.
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !/^--principal=mock_(designer|colleague|viewer|outsider|anonymous)$/.test(args[0]))) {
  process.stderr.write('MOCK_INVALID_LAUNCH_FIXTURE\n');
  process.exitCode = 1;
} else {
  const principal = args[0]?.split('=')[1] ?? 'mock_designer';
  const server = createReferenceMockMcpServer({ principal });
  await server.connect(new StdioServerTransport());
  process.stdin.on('end', () => { void server.close(); });
}
