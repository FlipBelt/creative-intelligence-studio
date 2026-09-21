# 产品与实施架构 V0.1

## 1. 权威与范围

用户 V0.5 是业务输入原文，见 sources/architecture-v0.5.md。本文件是实施解释与提案；未建立真实接口、身份、部署或生产能力。
目标：内部团队以真实产品知识形成可解释方向，再执行图文生产并留下可追溯资产。目标角色暂按策划、制作、审核、系统管理员；最终成员与权限待定。
MVP 对齐 V0.5 第33节；未来范围完整规划但不提前建设全部表与队列。

## 2. OpenDesign 的借鉴边界

参考 https://github.com/nexu-io/open-design ，2026-09-21 查看 README；用户确认参考对象，未固定源码 revision，未复制实现。
采用其需求澄清、方向确认、产物预览、批评迭代的闭环，以及工作区中上下文与产物相邻呈现、设计规范文件化的思路。
CIS 增加产品事实、结构化方向、知识血缘与人工评审。Web 用户不需要安装本地 CLI。
不继承桌面本地文件信任模型；模型、CLI 或媒体执行必须发生于受控 Worker。若未来引入 HTML 产物，使用隔离来源和 sandbox 预览，不授予应用会话或 NAS 访问。
OpenDesign 不替代业务 Core，也不是知识源；UI/UX Studio 是设计协作工具，不自动成为运行时依赖。

## 3. 模块与依赖

- apps/web：Next.js / React / TypeScript；页面、交互和API客户端。
- apps/api：FastAPI；认证入口、项目权限、业务命令与查询、事件读取、装配。
- core：knowledge/product/intent/reference/analysis/pattern/direction/decision/instruction/production_router/review；纯业务与 ports。
- adapters：knowledge/storage/crawler/embedding/llm/image/video/libtv/comfyui/voice/music；实现 Core ports。
- workers：Celery 任务入口、装配和步骤执行；不得重复定义业务规则。
- schemas：版本化 API/事件契约；prompts/workflows：受版本控制的生产配置；migrations：数据库演进。

上述为规划目录，不以空目录代表功能完成。运行调用 API→Core→注入的接口实现；代码依赖是 Adapter→Core ports，Core 不依赖 Adapter，修正原文链式图可能带来的误读。
PostgreSQL 是状态与血缘真源；Redis 是队列/临时协调。NAS 保存媒体，API 授权后访问，不把物理挂载地址给浏览器。

## 4. 首期领域契约（设计草案）

| 对象 | 关键记录与约束 |
|---|---|
| Project | id、标题、成员关系、revision、时间；所有子对象都带project_id |
| KnowledgeBinding/Snapshot | 外部知识ID、来源、版本、读取时间、摘要hash；不可回写为知识主库 |
| ProductContext | 字段值+证据级别+来源+范围；UNKNOWN保留，项目override不修改正式事实 |
| IntentProfile | brief、目标、输出、受众、约束、未知项、用户确认revision |
| Reference/ReferenceSet | 资产来源、使用限制、选择维度、权重；MVP先支持手动集合，智能推荐P2 |
| Analysis/Direction | 输入revision、解释、证据、候选差异、风险、人工选择 |
| CreativeInstruction | 固定产品/需求/参考/方向版本、约束、输出规格、schema版本与hash |
| ProductionJob/Step | 幂等键、输入hash、状态、attempt、provider_job_id、错误分类、真实成本 |
| Asset/Generation | storage URI、hash、类型、父资产、任务、状态；原始文件只追加 |
| Review | 对应产物revision、AI建议、人工结果、理由与操作者；Final需人工通过 |

事实 A正式知识/B项目输入/C视觉观察/D推断/U未知。优先级不能简单覆盖冲突：正式数据与项目样品冲突时并列说明作用范围；不能把B写回A。
材料、功能、性能等事实主张需逐条关联证据；缺证据阻断该主张进入最终文案，允许删去主张后再评审。
方向或产品输入变更使旧Instruction标记过期，重新确认生成新版本；旧产物保持原血缘。

## 5. API 与任务可靠性（待实现契约）

拟使用 /api/v1 的项目、需求、参考、方向、生产、审核、资产资源；真实路由在OpenAPI任务中定义并生成客户端，本文件不宣称接口已存在。
知识网关能力名称来自 V0.5，是 CIS 内部端口；必须核验真实知识平台协议后实现，禁止按这些名字假设远端存在同名API。
写操作做服务端项目授权与revision校验；冲突返回可恢复的冲突信息，禁止静默覆盖。生成提交幂等；命令写库与入队采用事务outbox或等效补偿。
Redis/Celery按至少一次交付设计。步骤以业务幂等键去重；外部供应商超时先查任务状态，不能盲目重复收费。
状态：PENDING→QUEUED→RUNNING→SUCCEEDED；RUNNING可进入WAITING_REVIEW、RETRYING或FAILED；审核后继续QUEUED；可重试失败创建有记录的新attempt。
取消是请求动作，取消请求字段独立于状态；确认执行停止才CANCELLED。完成与取消竞争由服务端原子裁决。明确重试上限、退避、租约和超时分类后实施。
通过带递增事件ID的SSE或轮询投影进度；断流重连读取数据库快照，不依赖进程内历史。进度未知只展示阶段。
SUCCEEDED仅表示任务完成，AI评审、人类通过、Final分别记录；生产与审核状态不能合并。

## 6. 安全与存储边界

身份提供方待决，MVP也必须有服务端项目授权。暂拟成员可编辑、审核人可批准、管理员配置；是否允许自审待人工确认，不先硬编码。
鉴权覆盖API、SSE、缩略图和下载。网络输入URL阻断内网/本机/重定向绕过；文件校验类型、大小，媒体处理放入资源受限Worker。
storage://projects/{project_id}/... 由Storage Adapter映射；拒绝路径穿越、跨项目URI及任意挂载路径。
NAS写入临时文件、校验hash、完成发布后登记可用资产；失败有清理/重试记录，不登记半文件为Final。生成资产不可覆盖来源。
知识快照受相同项目权限与保留策略约束；只用于溯源，不建立可编辑的第二套知识库。
供应商密钥仅服务端环境变量/密钥管理；日志脱敏，真实业务审计与产品分析遥测分开。不默认增加遥测。
上线前定义备份恢复目标并进行PostgreSQL+NAS一致性恢复验证；数值尚未确定，不编造SLA。

## 7. 实施阶段与待决项

P0：规范、权限/接入决策、工程骨架与基础组件。
P1：真实知识绑定→需求→手动参考→分析→方向确认→Direct图文→审核→NAS。
P2：pgvector、智能召回、参考权重、Pattern和解释性排序。
P3：LibTV/ComfyUI、生产路由、复杂图片。
P4：视频脚本、分镜、关键帧、镜头、声音、合成与逐阶段审核。
P1即有简单ReferenceSet和CreativeInstruction以固定输入；P2扩展集合推荐，解决原文首期手动参考与二期ReferenceSet的交界。
接入前必须明确：身份与成员权限、线上知识协议/可用字段、NAS访问方式、首个文案/图片供应商及预算、部署位置。它们不阻塞本轮文档，但阻塞相应真实集成。

### 简易预览交互补充（2026-09-21）
用户批准面向非专业人员简化主路径。浏览器演示Project增加向后兼容的可选simple布尔字段；simple项目确认需求后可在无产品绑定、无参考时选择预设方向。该规则仅作用于前端预览，不构成真实生产中对事实来源、授权或供应商输入验证的豁免。所有旧记录继续可读，修改保留旧资产版本。

### 参考、作品与技能边界（2026-09-21）
已对照用户指定钉钉《AIGC创意智能自动化平台》的策略→生产→测图→归因回流，前端区分Reference、员工完成的图片Work、项目过程Asset、版本化Skill。创意质量与真实投放表现分开，评分绑定作品版本；技能审批绑定具体内容版本。
本次只实施浏览器本地状态模型与预览界面；未建立真实员工身份、团队API、NAS上传、投放回流、技能执行和后端授权。后续服务端必须使用身份提供方角色，审批状态与内容摘要绑定，执行入口再次检查已发布/未停用，不能信任前端演示角色。管理员审核也不自动授予供应商/工具权限。原产品知识SSoT与未知事实约束保留。
