import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMockMcpServer } from './server.mjs';

// The launch fixture is not supplied through tool arguments and is not real authentication.
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !/^--principal=mock_(designer|viewer|outsider)$/.test(args[0]))) {
  process.stderr.write('Usage: node tools/mock-mcp/stdio.mjs [--principal=mock_designer|mock_viewer|mock_outsider]\n');
  process.exitCode = 1;
} else {
  const principal = args[0]?.split('=')[1] ?? 'mock_designer';
  const server = createMockMcpServer({ principal });
  await server.connect(new StdioServerTransport());
  process.stdin.on('end', () => { void server.close(); });
}
