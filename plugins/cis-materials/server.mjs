import { createMaterialService } from './lib/material-service.mjs';
import { createCodexKbAdapter } from './lib/codex-kb-adapter.mjs';
import { serveMaterialMcp } from './lib/mcp-stdio.mjs';

// A delegated Codex process must never recursively launch this plugin.
if (process.env.CIS_MATERIALS_PROXY_CHILD === '1') {
  process.stderr.write('CIS materials is disabled inside its delegated source process.\n');
  process.exitCode = 1;
} else {
  const adapter = createCodexKbAdapter();
  const service = createMaterialService({ invoke: (name, input) => adapter.invoke(name, input) });
  await serveMaterialMcp({ service, onClose: () => adapter.close() });
}
