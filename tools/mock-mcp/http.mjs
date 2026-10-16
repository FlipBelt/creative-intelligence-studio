import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMockMcpServer } from './server.mjs';

// One isolated SDK session per server. Bind address and port are intentionally not configurable.
export async function startMockServer(options = {}) {
  const server = createMockMcpServer(options);
  let transport;
  let origin;
  const http = createServer(async (request, response) => {
    if (!transport) { response.writeHead(503).end(); return; }
    if (request.url !== '/mcp') { response.writeHead(404).end(); return; }
    if (request.headers.host !== new URL(origin).host ||
      (request.headers.origin && request.headers.origin !== origin)) {
      response.writeHead(403).end('Mock loopback origin only');
      return;
    }
    try {
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) response.writeHead(500).end('Mock transport failure');
      else response.end();
    }
  });
  await new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${http.address().port}`;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID, enableJsonResponse: true, maxRequestBodySize: 16 * 1024,
  });
  try {
    await server.connect(transport);
  } catch (error) {
    await new Promise((resolve) => http.close(resolve));
    throw error;
  }
  return {
    url: new URL('/mcp', origin), address: http.address(),
    async close() {
      await server.close();
      const closed = new Promise((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
      http.closeAllConnections();
      await closed;
    },
  };
}
