# Creative Intelligence Studio

Agent 驱动的创意工具生态与素材中转试验；仓库同时保留既有创作工作台预览。

状态：2026-09-21 已实现首版 Next.js 前端交互预览；设计与真实业务验收仍待人工完成。团队仓库：[FlipBelt/creative-intelligence-studio](https://github.com/FlipBelt/creative-intelligence-studio)，公开可见。Sites 发布由 .openai/hosting.json 绑定，同一预览持续更新。

2026-10-16 当前路线见 [FBC-220](https://linear.app/j21nianyi/issue/FBC-220)：优先复用千问办公/兼容 Agent、产品知识、DAM 与专业设计工具。首批仅增加可重建开发环境、CI 和合成数据 Mock MCP；真实企业客户端、素材授权、业务审核及 DAM 登记仍待验证。既有预览保持，不在本批部署或更新 Sites。

## 云端开发首批

工具链固定为 Node.js **24.15.0**、npm **11.19.0**，使用根目录锁文件安装。可在支持 Dev Containers 的隔离环境打开仓库；本地使用相同版本也可执行：

```sh
npm ci --ignore-scripts
npm run check:cloud
```

`check:cloud` 包含工具链及预览保留检查、检查脚本测试、类型检查、既有预览测试、Mock MCP 双传输测试和静态构建。没有部署动作。Mock 只使用合成商品、素材及审核夹具，不代表已接通真实知识库、DAM 或千问。

冷启动、私有预览端口、权限边界和验收证据见 [云端开发说明](docs/cloud-development.md)。本批任务为 [FBC-230～234](https://linear.app/j21nianyi/issue/FBC-230)；真实客户端和权限/恢复分别由 [FBC-235](https://linear.app/j21nianyi/issue/FBC-235)、[FBC-236](https://linear.app/j21nianyi/issue/FBC-236) 跟踪。

## 独立输入门禁开发

2026-10-22：Penpot PR #12525 等待上游；[FBC-267 合成试点输入包离线门禁](tools/pilot-input/README.md)独立推进，校验固定版本、实际字节摘要和用途许可记录。执行 `npm run test:pilot-input`；新测试进入既有 `check:cloud`。只处理本地合成数据，不证明真实权限/版权/恢复或业务验收，不改变现有预览或生产。

## Reference 契约与主页交互（本地分支）

FBC-243优先推进官方数据源研究和[FBC-245合成Reference Mock](tools/mock-mcp/REFERENCE-MOCK.md)，使用 npm run test:reference / npm run mock:reference。未接入真实Pinterest/Apify或DAM。主页沿用现有结构补最近项目、续作与示例替换确认；获准5文件源码列入精确摘要审阅，Sites线上预览未更新。实际平台/素材许可和云资源仍见[FBC-244研究门禁](docs/research/fbc-244-pinterest-data-source-feasibility-2026-10-22.md)。

## 阅读顺序

1. [产品与实施架构](docs/architecture.md)
2. [全局设计规范](DESIGN.md)
3. [页面与交互契约](docs/ux-spec.md)
4. [实施待办](docs/TODO.md)
5. [验收清单](docs/acceptance.md)
6. [用户原始 V0.5 架构](docs/sources/architecture-v0.5.md)

## 首期闭环

面向用户的主路径：选择图片／文案／视频 → 描述需求 → 选择方向 → 查看与修改。产品资料、参考分析、创意板作为可选专业工具；生成与审核保留版本和来源约束。

目标用户同时包含非专业创作人员和专业图文视频生产人员；默认引导式创作，专业细节按需展开。身份提供方、NAS 和模型供应商接入尚待确定。

既有预览使用 Next.js 16.3.5、React 19.2.4 和 TypeScript。旧 FastAPI、PostgreSQL、Redis + Celery、NAS 全栈属于历史规划，未实现，不再自动作为轻量路线的前置。新路线由 FBC-6/7/8 实测及 FBC-9 ADR 决定。

OpenDesign 参考对象已由用户确认：[nexu-io/open-design](https://github.com/nexu-io/open-design)。设计参考：[FlipBelt 知识平台](https://github.com/J21NIANYI/flipbelt-kb-platform)。只提炼原则，本轮未复制第三方源码、品牌标志或模板。

## 首版前端

- 在仓库根执行：npm ci，然后 npm run dev。
- 本地入口：http://127.0.0.1:3100
- 类型检查：npm run typecheck；目标测试：npm test；静态构建：npm run build。
- 页面在 apps/web；静态导出在 out，构建产物不提交。
- 浏览器本地演示数据：不与团队同步、不代表正式产品知识。
- 首页以输入框和参考瀑布流为主，参考支持分类、搜索、收藏与带入创作；文案为本地模板，图片/视频/知识/NAS未接入。
- 作品库只收员工完成的图片：本地提交、四项质量评分、事实检查与精选筛选。技能支持文本上传、版本审核/退回/停用，已发布版本才可选择；不执行技能。
- 管理员角色切换只是明确标注的流程演示，真实身份、审批、共享存储与服务端权限尚未接入。
- 详细边界与摄影来源见 [预览范围](docs/preview-scope.md)。
首版预览：[打开 CIS 工作台](https://creative-intelligence-studio.sunwelljohn254892.chatgpt.site)（Sites默认私有访问）。


## 2026-10-22：本批审查、PR与发布授权

用户已明确授权审查FBC-245/268，无阻塞后提交、推送、创建PR、同步Linear并部署生产；本节覆盖前述本地阶段“尚不推送/部署”的历史范围。本批两项独立代码审查未发现可操作P1/P2。变更范围仍为合成Reference契约/stdio Mock与现有主页交互，不开启真实采集、付费调用、DAM写入或生成服务。

当前部署目标经Sites回读为既有绑定站点，保持owner-private访问范围；交付仅静态主页，Mock不作为线上服务运行。原Sites版本4/source714cf137保留为回滚点。本轮不请求合并GitHub PR；发布使用审查且CI通过的同一分支提交，GitHub主分支保护保持。

本批源码审查/本地实现为已完成项；PR/对应SHA远端CI/Sites保存版本及部署状态属于单独回执，以[Linear FBC-245](https://linear.app/j21nianyi/issue/FBC-245)和[FBC-268](https://linear.app/j21nianyi/issue/FBC-268)的本轮最新记录为准。自动验证/技术发布不替代人工视觉、业务或真实provider验收；FBC-244真实资源/资格/许可及246～248门禁继续开放。
