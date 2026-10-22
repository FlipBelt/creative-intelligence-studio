# CIS 云端开发首批

日期：2026-10-16。父事项：[FBC-220](https://linear.app/j21nianyi/issue/FBC-220)。本批只交付开发环境、CI 和 Mock 技术验证，保留已有预览。真实企业接通、业务 UAT 与生产放行各自记录。

## 2026-10-22 当前开发状态（覆盖下方首批历史快照）

只读回读确认：PR #2 已于 2026-10-16 合并，main 为 `5ed3e6e16e9fa391ec0f5d375ac637cdb090d467`。主分支保护已启用，要求 Host checks / Dev container checks、strict 和 enforce_admins，禁止 force push / deletion。以下“PR待审/保护未启用”是首批交付时的历史记录。

本轮不再重复等待 Penpot：#12525 子项标为等待上游，独立实施 [FBC-267](https://linear.app/j21nianyi/issue/FBC-267) 合成输入包离线门禁。说明见 [输入包门禁](../tools/pilot-input/README.md)；新测试接入既有 `check:cloud`，本轮实际本地验证结果在 TODO 单独记录，不冒称新提交的 GitHub CI 已运行。实际权限、许可、备份恢复、真实客户端/DAM 回执及人工验收仍须逐项完成。

## 范围与输入

- 固定基线为 `714cf137f136f9a8b951b38a0a2a846d01b377aa`。原工作区的未提交审计、实验和附件保持；本批从干净主线在独立工作树实施，不批量将旧材料加入公开仓。
- 运行时为 Node.js `24.15.0`、npm `11.19.0`，根 `package-lock.json` 是依赖安装来源。新增 MCP SDK/Zod 只用于开发和协议测试；保留原预览依赖版本。
- 只使用本仓合成数据，不需要 `.env`、个人目录、SSH、NAS、真实业务数据或供应商密钥。不要将这些内容挂载或复制到云端环境。
- 不安装或执行创作 Skills，不调用付费模型，不上传真实素材，不部署或改动现有 Sites。

## 干净冷启动

在支持 Dev Containers 的编辑器或隔离 Codespaces 中检出本批分支，使用仓库 `.devcontainer` 配置。首次创建安装固定 npm 并执行 `npm ci --ignore-scripts`。之后运行：

```sh
node --version
npm --version
npm run check:cloud
```

本地无需容器时先安装相同精确工具链，再执行：

```sh
npm ci --ignore-scripts
npm run check:cloud
```

工具链不一致时检查会明确失败；不要用 `--force` 绕过。`npm ci` 不改锁文件，`--ignore-scripts` 禁止安装生命周期脚本；后续显式测试和构建是本批审阅的命令。

查看既有预览时手动运行：

```sh
npm run dev
```

预览端口为 `3100`。Codespaces 的 Ports 面板须保持 **Private**，不要公开共享；配置不会自动启动或公开端口。UI 中的身份切换、作品审核和 Skill 审批仍为浏览器演示。换设备不会自动同步浏览器数据。

## CI 与权限

`.github/workflows/ci.yml` 在 PR、主线/本批开发分支推送或手动触发时验证。普通 Linux job 执行根 `check:cloud`；容器 job 使用固定版本 Dev Containers CLI 实际构建、启动本仓容器并在容器内执行相同检查。

工作流只授予 `contents: read`，checkout 不保留 Git 写凭据；Actions 使用固定提交 SHA。没有生产 environment、生产 secret、部署、SSH、真实 DB、对象存储写入或 `pull_request_target`。测试日志不输出合成票据以外的凭据，也不上传整个工作区。

`check:preview` 以本批基线检查 `apps/web`、原预览启动/导出脚本、原始 V0.5 和 Sites 绑定不变。它仅是本次改造的保护门禁；未来经过授权修改预览时，需要审阅并显式更新保护范围，不将预览永久冻结。

CI 成功不代表分支保护已经启用；GitHub 保护规则和人工审批配置须单独核验。容器在 CI 中成功运行也不代表用户已亲自在 Codespaces 完成体验验收。

## Mock 契约

Mock 使用 `mock_*` 工具，输入输出契约在 `contracts/`，实现和合成夹具在 `tools/mock-mcp/`，目标测试在 `tests/mock-mcp/`。这些是 CIS 新拟定的本地测试契约，**不是现有知识库或 DAM 的正式 API**。

stdio 与 Streamable HTTP 均通过官方 SDK Client 进行真实 `initialize`、`tools/list`、`tools/call`。两种传输测试不等于两款企业产品的兼容性测试，更不等于千问账号授权成功。HTTP 仅绑定 loopback 和临时端口；子进程不继承生产凭据。

测试包含合成知识/素材→原生线框结构→显式人工审核夹具→Mock 登记；以及权限拒绝、授权过期、版本变更失效、幂等冲突和可恢复失败。人工审核夹具不是模型批准，也不是实际用户批准。Mock 不访问第三方服务，临时内存登记不会写入 DAM。

单独执行：

```sh
npm run test:mock
```

详见 [Mock 运行说明](../tools/mock-mcp/README.md)。SDK 选择固定的 `@modelcontextprotocol/sdk@1.32.1` v1 维护线，避免把本批 Mock 与业务运行时绑定；官方 v2 已使用独立包，后续真实接入应另做版本兼容评审。[官方 SDK 版本说明](https://github.com/modelcontextprotocol/typescript-sdk#readme)

## 失败恢复与回退

- 安装失败：保留锁文件，检查工具链和 registry 网络，在干净环境重新执行 `npm ci --ignore-scripts`；不从个人电脑复制 `node_modules`。
- 检查失败：按失败步骤运行单个命令定位，不跳过权限/过期/幂等断言。
- 容器构建失败：保留日志；普通 Linux job 成功不能代替容器验证。
- 本批未改变预览源码、存储格式或生产配置；停止临时环境即可退出试验。PR 不自动合并，生产无本批回退动作。
- Mock 内存状态的重新初始化不等于业务数据备份恢复。独立加密备份及隔离恢复仍由 FBC-236 跟踪。

## 任务与证据分工

| 事项 | 交付范围 | 完成证据 |
|---|---|---|
| [FBC-230](https://linear.app/j21nianyi/issue/FBC-230) | 范围、依赖、预览保留 | Linear 回读及本仓文档 |
| [FBC-231](https://linear.app/j21nianyi/issue/FBC-231) | 精确运行时与 Dev Container | 云端实际冷启动日志 |
| [FBC-232](https://linear.app/j21nianyi/issue/FBC-232) | 最小权限 CI 与保护检查 | 最终 SHA 的成功 CI |
| [FBC-233](https://linear.app/j21nianyi/issue/FBC-233) | Mock 契约与双传输 | 目标测试、负向测试 |
| [FBC-234](https://linear.app/j21nianyi/issue/FBC-234) | 干净云端验证与 Draft PR | PR、SHA、CI、独立回读 |
| [FBC-235](https://linear.app/j21nianyi/issue/FBC-235) | 真实客户端与 DAM 回执 | 后续真实调用、设计师 UAT、登记 ID |
| [FBC-236](https://linear.app/j21nianyi/issue/FBC-236) | 实际权限、公开边界与恢复 | 后续真实隔离验证 |

本仓 `docs/TODO.md` 继续保留开发待办真源。Linear 同步执行状态、优先级、依赖和证据：交付/验收定义经仓库 PR 更新后回写 Linear，状态和回执经 Linear 回读后更新本仓记录；冲突明确记录待协调，不自动覆盖或依赖两个自由编辑副本。

FBC-6/7/8 实测与本批工程准备可并行；FBC-9 仍决定真实 P1 主入口和降级方案。首轮真实闭环若用人工确认导入 DAM，必须取得真实版本、审核和登记回执；自动回流继续在 FBC-16/17 后置。

本批技术验证已完成：实现 SHA `8d406d0c1e2ac7f98cdf58932729094794afa8b4` 的 [CI 38848097680](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/38848097680) 在 Linux 宿主与实际 Dev Container 内均通过 `check:cloud`。容器 job 实际执行了构建、启动、postCreate 锁文件安装和容器内检查；每条路径11项工程检查、15项旧预览测试、25项Mock测试、typecheck和静态构建全部通过。本机Windows也完成相同检查。本次文档回写提交的最终CI见 [Draft PR #2](https://github.com/FlipBelt/creative-intelligence-studio/pull/2) 和Linear回执。

PR待审未合并，主分支和线上预览保持。实际GitHub分支保护仍未启用；用户亲自操作Codespaces、真实千问/客户端、Penpot与DAM接通、业务UAT、公开Git历史审查和独立恢复不在本批通过范围。
