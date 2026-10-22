# CIS 实施待办

日期：2026-09-21。所属仓库：D:\creative-intelligence-studio。
用户已授权项目启动、规划文档提交、推送到团队仓并公开。以下实施路线不代表应用已完成，也不自动安排后台开发。
[x]表示交付与对应验证完成；人工验收另列，不以文档检查替代。

| ID | 状态 | 依赖 | 交付与可观察条件 | 风险 |
|---|---|---|---|---|
| P0-DOC-001 | [x] | 无 | 本地Git初始化、原文保存、架构/设计/页面/验收文档齐全；原文hash一致、链接存在 | T0 |
| P0-DES-002 | [ ] | P0-DOC-001 | 用户审阅DESIGN与UX，确认视觉原则、十阶段组织及布局例外 | 人工 |
| P0-ARCH-003 | [ ] | P0-DOC-001 | 明确用户角色/身份、知识接口、NAS、首个供应商/预算与部署方式，记录决策 | T3设计 |
| P0-ENG-004 | [ ] | P0-DES-002 | 初始化Next.js/FastAPI工具链、锁版本、质量命令、基础组件；本地启动与目标检查通过 | T1 |
| P1-SEC-001 | [ ] | P0-ENG-004,P0-ARCH-003 | 项目授权与会话；跨项目API/资产/事件负向测试通过 | T3 |
| P1-KNOW-002 | [ ] | P1-SEC-001 | 只读绑定真实知识、版本快照、A/B/C/D/U；缺失/冲突/不可用路径测试 | T2 |
| P1-INTENT-003 | [ ] | P1-KNOW-002 | 需求草稿、解析建议、确认revision；冲突不丢输入 | T2 |
| P1-ASSET-004 | [ ] | P1-SEC-001 | NAS映射与上传元数据、手动参考集合；越权/穿越/写入失败测试 | T3 |
| P1-DIR-005 | [ ] | P1-INTENT-003,P1-ASSET-004 | 分析、方向比较、人工确认、不可变Instruction；上游修改失效测试 | T2 |
| P1-PROD-006 | [ ] | P1-DIR-005 | Direct图文、队列、outbox、幂等、任务事件；重复/超时/断流/部分失败验证 | T3 |
| P1-REVIEW-007 | [ ] | P1-PROD-006 | AI检查、人工审核、Final血缘；缺证据和未批准不能进入Final | T2 |
| P1-UAT-008 | [ ] | P1-REVIEW-007 | 用户完成acceptance.md真实业务/视觉验收并明确结论 | 人工 |
| P2-DISC-001 | [ ] | P1-UAT-008 | pgvector、推荐解释、多样性、参考权重、Pattern与排序；评估集来源明确 | T2 |
| P3-ROUTE-001 | [ ] | P2-DISC-001 | LibTV/ComfyUI Adapter、能力探测、复杂图片路由；真实服务验证 | T3 |
| P4-VIDEO-001 | [ ] | P3-ROUTE-001 | 分阶段视频、镜头、声音与合成版本；局部重试不覆盖已审核资产 | T3 |

P0-DOC-001 验证：2026-09-21，PowerShell比较原文SHA-256、枚举Markdown相对链接目标；git status、git diff --check检查。实际结果见任务日志。
P0-ARCH-003的未知项不妨碍工程工具链准备，但阻塞真实鉴权与供应商接入。

## 2026-10-22 FBC-267：合成试点输入包离线门禁

- [x] [FBC-267](https://linear.app/j21nianyi/issue/FBC-267)：严格契约、只读CLI、合成样例及目标测试已交付；新检查进入既有check:cloud。
- [x] 本地目标38/38、Mock25/25、工程门禁11/11及样例/预览保护检查通过；提交分支的完整验证与远端CI另行记录。
- 输入仅限synthetic分类；固定知识Release/版本、文件SHA/size、用途/处理方许可记录与确认摘要。修改输入使旧确认失效；拒绝路径越界、链接、UNC/设备/URL入口、超限、过期/撤销及缺证。
- FBC-236继续In Progress，真实ACL/许可真实性、真人确认、媒体解码、备份恢复和业务UAT仍待验。门禁通过不关闭236/235或真实MVP。
- [Penpot PR #12525](https://github.com/penpot/penpot/pull/12525) 仅SDK整文件导出与恢复子项等待上游，无新反馈时停止重复轮询，不阻塞独立开发。
- 原预览、Sites绑定及生产配置保持；暂不部署生产。旧P1/P2路线与人工验收记录保留。

使用方式与边界见[输入门禁说明](../tools/pilot-input/README.md)。

## 首版前端预览（用户于2026-09-21明确授权实施并部署Sites）
P0-WEB-005 [x]（2026-09-21前端与Sites首版预览交付完成）：依赖P0-DOC-001；独立前端预览任务，按既定设计实现十阶段工作台、浏览器本地演示流程和Sites部署。风险T2（本地状态/多页面）；自动验证包括typecheck、目标状态测试、静态构建、核心交互。
用户本轮实施指令允许按现有规范制作预览；不将P0-DES-002人工验收标为通过。此任务不依赖真实后端接入，P0-ARCH-003及P1集成任务继续未完成。
P0-WEB-005验证：npm run typecheck通过，npm test 7/7通过，npm run build通过。浏览器本地示例验证新建→产品→需求→参考→方向→文案演示→评审→Final；360/768/1440首页无水平溢出；WebMCP只读工具正常/异常输入均检查。自动化评审动作仅针对临时演示项目，不能作为真实业务UAT。
Sites预览：https://creative-intelligence-studio.sunwelljohn254892.chatgpt.site 。owner-private部署成功；P0-DES-002与真实业务UAT仍待人工确认。

P0-WEB-006 [x]（2026-09-21）：按用户批准的界面建议，统一侧边栏；图片／文案／视频首屏入口；场景引导、简易需求、三步创作；专业工具与历史版本折叠。保留旧项目，未知事实不补造。T2：npm test 9/9、typecheck与正式构建通过；浏览器验证一句需求建立项目、方向确认、文案生成演示/修改另存/审核、图片计划与视频未接入提示、360px首页与结果页无横向溢出、移动导航开关。用户业务及视觉验收仍待完成。发布证据记于全局任务日志。

P0-WEB-007 [x]（2026-09-21）：用户批准输入框核心首页、参考瀑布流、导航排序、员工图片作品与技能审核前端。实现本地图片提交/评分/精选，技能待审/发布/退回/停用/版本替换；所有状态明确本地演示。T2本地状态测试15项通过、typecheck通过；真实鉴权与审批执行属于尚未实现的T3接入项。浏览器验证参考回填草稿、直接创作、技能上传审批后可选、作品上传/事实检查/评分筛选；发布证据见任务日志。

## 2026-10-16：FBC-220 云端开发首批

本批已获用户实施授权：先拆分并同步 Linear，完成隔离开发环境、CI 和 Mock 测试，保留既有预览，暂不部署生产。旧全栈待办不自动推进或批量改记完成。FBC-5 静态审计 Done、FBC-7 本机 Penpot 技术 PoC 部分通过；FBC-6/8/9 的企业兼容、接口审计和人工 ADR 继续开放。

| 事项 | 状态 | 依赖/范围 | 可观察交付 |
|---|---|---|---|
| [FBC-230](https://linear.app/j21nianyi/issue/FBC-230) | [x] 技术交付 | 本批范围与证据 | Linear 子任务/关联回读、预览保护、文档分工 |
| [FBC-231](https://linear.app/j21nianyi/issue/FBC-231) | [x] 技术交付 | FBC-230 | 固定工具链、容器真实冷启动和目标检查 |
| [FBC-232](https://linear.app/j21nianyi/issue/FBC-232) | [x] 技术交付 | FBC-231 | 最小权限 CI、预览基线门禁、对应 SHA 成功日志 |
| [FBC-233](https://linear.app/j21nianyi/issue/FBC-233) | [x] 技术交付 | FBC-231 | 合成 Mock/契约、stdio+HTTP、权限/过期/版本/幂等/重试测试 |
| [FBC-234](https://linear.app/j21nianyi/issue/FBC-234) | [x] 技术交付 | FBC-231/232/233 | 干净云端验证、Draft PR、SHA/CI 和独立回读 |
| [FBC-235](https://linear.app/j21nianyi/issue/FBC-235) | [ ] 后续真实验收 | FBC-6/7/8/9/10/11、234/236 | 真实客户端、原生编辑/人工审核、DAM 登记回执 |
| [FBC-236](https://linear.app/j21nianyi/issue/FBC-236) | [ ] 后续验证 | FBC-8/9 | 实际素材权限、公开资料边界、独立加密恢复 |

实现与复现说明见 [云端开发说明](cloud-development.md)。代码和自动验证不替代真人 Codespaces 体验、千问企业兼容、设计师 UAT 或生产审批。真实 P1 首轮增加人工确认导入 DAM 的回执验收，自动回流留 FBC-16/17。

本仓 TODO 继续为开发待办真源；Linear 同步执行状态/优先级/依赖。验收定义先由仓库 PR 更新再回写 Linear；状态和回执从 Linear 回读后更新本仓。冲突显式记录待协调，不静默覆盖。首批完成与剩余边界以最终 PR/CI 回执补记。

首批技术回执：实现提交 `8d406d0c1e2ac7f98cdf58932729094794afa8b4` 已在 [Draft PR #2](https://github.com/FlipBelt/creative-intelligence-studio/pull/2) 交付；[云端 CI 38848097680](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/38848097680) 的 Linux 宿主与实际 Dev Container 构建/启动/容器内检查均成功。每条执行路径均为工程11、旧预览15、Mock25共51项，typecheck和静态构建通过。本次文档回写的最终提交/CI在PR和Linear持续关联，不将同一测试在不同环境执行累加成更多独立用例。PR待审未合并；主分支仍为714cf137，实际保护规则未启用。真人云端体验、FBC-6/7/8/9、FBC-235/236和生产放行继续开放。


## 2026-10-22 FBC-243 与现有主页交互（本地分支）

- [x] [FBC-244](https://linear.app/j21nianyi/issue/FBC-244) 官方数据源研究子阶段：[报告](research/fbc-244-pinterest-data-source-feasibility-2026-10-22.md)。用户Pins与受限beta检索区别、保存/AI/第三方许可、配额及费用均单列；实际应用资格/阿里云资源未知，244继续In Progress。
- [x] [FBC-245](https://linear.app/j21nianyi/issue/FBC-245) 本地合成契约实现与验证：六工具、严格版本/启动身份、owner/project隔离、游标/幂等/预算/失败/URL/删除及SDK stdio，目标17/17通过；[PR4](https://github.com/FlipBelt/creative-intelligence-studio/pull/4)已提交/推送，Linear In Review待合并。
- [x] [FBC-268 / P0-WEB-008](https://linear.app/j21nianyi/issue/FBC-268) 本地主页交互：最近项目、统一续作、示例替换确认与焦点；导航目标7/7及浏览器smoke通过，360/768/1440px无溢出。Linear In Review，人工视觉/业务UAT未验。
- [ ] 真实provider/平台与素材许可、实际云资源、真实ReferenceSet/DAM及人工Go：FBC-246/247/248保持后续门禁，未运行Actor/付费调用/部署。
- 保留原Sites线上预览和所有旧工作区改动。获准变化的5个Web源码在scripts/preview-review.json列精确摘要（统一LF）；其他Web文件/媒体、Sites绑定、导出脚本和原V0.5继续保护。后续源码变更需重新审阅摘要，不自动放行。

- [x] 本地npm run check:cloud：19工程+22前端+25既有Mock+38输入门禁+17Reference=121项，typecheck/静态构建通过；独立复核无P1/P2。
- [x] FBC-245/268已审查、提交推送并交付[PR4](https://github.com/FlipBelt/creative-intelligence-studio/pull/4)。应用提交b018782的[push CI39739763264](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/39739763264)与[PR CI39739848630](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/39739848630)均success；Host/Dev Container各121项、typecheck/build通过。
- [x] FBC-267已随[PR3](https://github.com/FlipBelt/creative-intelligence-studio/pull/3)合并至main ca8bc97；[main CI39733146440](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/39733146440)双job成功，Linear267 Done、236/220仍In Progress。前述首批Draft/保护未启用是历史快照。


## 2026-10-22：本批审查、PR与发布授权

用户已明确授权审查FBC-245/268，无阻塞后提交、推送、创建PR、同步Linear并部署生产；本节覆盖前述本地阶段“尚不推送/部署”的历史范围。本批两项独立代码审查未发现可操作P1/P2。变更范围仍为合成Reference契约/stdio Mock与现有主页交互，不开启真实采集、付费调用、DAM写入或生成服务。

当前部署目标经Sites回读为既有绑定站点，保持owner-private访问范围；交付仅静态主页，Mock不作为线上服务运行。原Sites版本4/source714cf137保留为回滚点。本轮不请求合并GitHub PR；发布使用审查且CI通过的同一分支提交，GitHub主分支保护保持。

本批源码审查/本地实现为已完成项；PR/对应SHA远端CI/Sites保存版本及部署状态属于单独回执，以[Linear FBC-245](https://linear.app/j21nianyi/issue/FBC-245)和[FBC-268](https://linear.app/j21nianyi/issue/FBC-268)的本轮最新记录为准。自动验证/技术发布不替代人工视觉、业务或真实provider验收；FBC-244真实资源/资格/许可及246～248门禁继续开放。

## 2026-10-22：生产技术发布回执

- [x] 应用提交b018782a129740c8e3382b99c3b6893821ed98e5已发布为Sites v5，部署succeeded；[正式CIS地址](https://creative-intelligence-studio.nianyi21j.chatgpt.site)。同一project与owner-private访问策略回读不变，旧v4保留为回滚点。主页面200、8个页面引用JS/CSS均200且摘要逐文件匹配本地构建。
- [x] FBC-245/268及父243/220已同步PR、CI、版本/部署回执，完整描述规范化回读4/4匹配；245/268仍In Review，PR开放未合并，GitHub main未变。
- 本次发布仅静态主页；Reference Mock仍为合成工程工具。真实provider/许可/资源/恢复和人工UAT继续开放。后续仅文档收口提交不改变已发布应用代码；各提交与对应CI在PR查看。


## 2026-10-22 用户反馈后的主页定位纠偏

v5技术发布已完成，但用户指出默认主页仍为旧创作输入框，未落实“精选素材站＋Agent插件”规划。技术发布不视为该定位已获人工验收。

- [x] FBC-268：默认首页改为素材发现；清单/Agent交接成为主要流程，旧工作台后置且数据/深链兼容。
- [x] 交接辅助函数8项含负向测试；浏览器验证搜索/收藏/来源/加入、复制成功/失败手工回退/空态、旧草稿刷新与参考回跳、跳过导航，以及360/768/1440px无横向溢出。check:cloud共129项（19工程/30前端/25Mock/38输入门禁/17Reference）、typecheck与静态构建通过；独立复核无P1/P2。复制失败仅在本地临时注入，刷新已恢复。8个Web文件列精确摘要，保护其他源码、媒体、Sites绑定和导出脚本。
- [x] 纠偏提交da3b83d已在现有PR4交付；PR CI39747766188/push CI39747758147均success，Host及真实Dev Container各129项与typecheck/build通过。同一owner-private Sites v6已succeeded/source精确匹配，用户现有预览页刷新后确认精选素材标题1个、创作输入框0个；访问策略不变，v5保留回滚点。PR4未合并，人工视觉/业务UAT仍待验收。
- [ ] 正式Agent插件及受控素材MCP：复用FBC-16/相关任务，需真实来源、最小只读身份/项目权限、许可/撤销与客户端验收；当前FBC-245合成测试不等于插件交付。
