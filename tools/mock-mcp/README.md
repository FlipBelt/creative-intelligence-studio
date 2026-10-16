# CIS Mock MCP（FBC-233 / FBC-220）

本目录是云端工程准备阶段的合成测试夹具。`contracts/mock-mcp.mjs` 是 CIS 本地拟定的 `mock-contract-v1`，不是知识平台、DAM、Penpot 或任何既有远端 API 的接口定义。现有前端预览不依赖本目录。

## 运行与验证

在仓库根目录安装锁定依赖后执行：

```powershell
npm ci --ignore-scripts
node --test tests/mock-mcp/*.test.mjs
```

stdio 入口（供 MCP 协议客户端启动；stdout 只输出协议消息）：

```powershell
node tools/mock-mcp/stdio.mjs
```

Streamable HTTP 入口是可启动、可关闭的函数。它固定绑定 `127.0.0.1`、随机端口，只接受该端口的 Host 与同源 Origin；每个实例供一个隔离 SDK 会话使用：

```javascript
import { startMockServer } from './tools/mock-mcp/http.mjs';
const server = await startMockServer();
// 将 server.url 交给 SDK StreamableHTTPClientTransport。
// 先关闭客户端，再释放实例；测试使用 try/finally 保证清理。
await server.close();
```

目标测试使用官方 `@modelcontextprotocol/sdk` 1.32.1 的 Client、stdio 与 Streamable HTTP transport，复用同一组 `initialize → tools/list → tools/call` 行为契约。它证明这两种协议传输可执行；未连接千问企业环境、Codex App 或其他真实客户端，不代表它们已经兼容。

stdio 子进程使用绝对 Node 路径、无 shell，覆盖 SDK 默认继承的环境，只保留 Windows 启动需要的 `SYSTEMROOT`。不继承云端或供应商环境变量，不读取用户配置或凭据目录。

## 合成工具和数据

| 工具 | 测试行为 |
|---|---|
| `mock_knowledge_read` | 固定 `mock_v1`，保留 A/B/C/D/U、来源 ID 和版本，U 保持 null |
| `mock_asset_search` | 合成素材元数据、虚拟 URI、允许用途和过期状态；不下载或读取文件 |
| `mock_wireframe_create` | 内存中的可编辑 JSON 节点、不可变输入摘要、来源等级和父资产血缘 |
| `mock_dam_register` | 显式审核票据校验、同键重放、冲突、可恢复的合成瞬时失败及 Mock 回执 |

所有实体 ID、版本和 URI 都有 `mock_` / `mock-` 标记；成功结果包含 `synthetic: true` 和契约版本。A 仅表示夹具中的“正式知识”类别，内容全部是合成数据，不能作为真实产品事实。JSON 节点可单独编辑文本与布局，未创建真实 Penpot 文件。

默认时钟固定为 `2026-10-16T00:00:00.000Z`。`mock_asset_current` 的许可到 10 月 17 日，仅允许 `internal_wireframe`；另一素材在夹具时钟下已过期。创建和登记都会检查许可，测试还用注入时钟覆盖创建后过期。

`mock_designer`、`mock_viewer`、`mock_outsider` 是启动时选择的租户/角色夹具，工具参数无法变更角色。stdio 可以使用 `--principal=mock_viewer`，HTTP 使用 `startMockServer({ principal: 'mock_viewer' })`。这只验证业务拒绝分支，不是生产身份认证或授权网关。

`fixtures.mjs` 中的 `mock_review_approved_v1` 是人工预先编写的**测试数据**，只匹配 `MOCK_INSTRUCTION` 的版本和摘要；没有创建或批准票据的工具。改动 brief 或 input_version 后旧票据失效。预设票据通过不代表发生真人审核。

DAM 登记只写当前进程 Map，返回 `mock-dam://...`，不上传、不登记真实资产。相同项目内，幂等键绑定完整命令摘要；同键同输入返回原回执，同键不同输入冲突。`failure_fixture: 'mock_transient_once'` 在登记前失败一次，使用同一命令重试得到 attempt 2 的单一回执。进程退出后数据清空，不具备持久化、跨实例幂等或灾难恢复能力。

## 契约与边界

输入、成功输出和领域错误均由 Zod 运行时校验；导出的 JSON Schema 从相同定义生成，测试用官方 SDK 的 AJV validator 实际执行校验。SDK 的工具成功输出携带 `structuredContent`；领域错误携带 `isError` 和经过校验的 JSON 文本，避免把错误当作成功业务对象解析。SDK 参数校验失败使用协议原生工具错误。

测试覆盖知识来源与未知值、素材范围和过期、跨租户与只读角色拒绝、URI/角色注入拒绝、编辑节点及血缘、未批准与旧审核拒绝、幂等重放/冲突、瞬时失败恢复、HTTP Host/Origin 边界。

本实现不访问公网、NAS、真实产品接口、真实 DAM、设计工具或付费生成服务。它没有生产鉴权、签名、凭据、持久化或远端备份。真实连接器契约、企业 App 兼容性、真人中文编辑和业务 UAT 仍需分别验证。
