# CIS 实施待办

日期：2026-09-21。所属仓库：D:\creative-intelligence-studio。
用户已授权项目启动、规划文档提交、推送到团队仓并公开。以下实施路线不代表应用已完成，也不自动安排后台开发。
[x] 表示本次范围的交付与适用验证完成；普通软件不统一等待额外人员或专门全套真人 UAT。真实权限、数据准确性、恢复、素材许可和内容批准的具体要求保留，详见 [当前收口规则](acceptance.md)。

## 2026-10-29 当前规则与已完成范围同步

本节覆盖下方历史快照中统一等待人工视觉/业务 UAT 的门槛，历史测试和人工结论仍保留。代码/文档/方案任务不额外要求上线或配置真实凭据；承诺上线需发布证据与最小线上检查。体验和采用效果在实际工作中反馈，后续 Bug 独立跟进；未实现核心功能、真实接入及具体安全/数据缺口不能据此标完成。本次不新增部署、迁移、权限扩展、业务写入、付费或外部发布授权，明确暂停的工作仍暂停。

2026-10-29 已回读 Linear 的稳定 ID、Done 状态与既有证据，并核对 GitHub PR #4 仍开放、未合并。本次只同步下面两项确切范围，不把它们映射为旧全栈 P1/P2 全部完成，也未重跑历史应用测试或重新部署。

| 稳定 ID / Linear | 状态 | 已完成范围与证据 | 保留边界 |
|---|---|---|---|
| CIS-PIN-002 / [FBC-245](https://linear.app/j21nianyi/issue/FBC-245) | [x] 技术交付 | create/status/list/get/select/delete 版本化契约、不联网 stdio 合成 Mock；既有回执载明 17 项 Reference 用例与 Host/Dev Container CI 通过 | 在 [PR #4](https://github.com/FlipBelt/creative-intelligence-studio/pull/4) 交付，head `55ebd7d7f99f45bb1f51969ab8564c5e95ebb3ee` 未合并；真实 provider、素材许可、正式插件及真实 DAM 写入未交付 |
| CIS-WEB-008 / [FBC-268](https://linear.app/j21nianyi/issue/FBC-268) | [x] 已发布范围 | 精选素材首页、搜索/分类/收藏/来源、素材清单与手工 Markdown Agent 交接；Sites v6/source `da3b83d6575885b0699fadfe05aa20f7ea68d593`，既有回执载明 129 项检查、浏览器关键路径和线上回读通过 | owner-private 与 v5 回滚点保留，仅现有摄影参考和本地数据；PR #4 未合并，主线未包含该应用代码，不等于真实 provider、正式 DAM 或阿里云部署 |

历史最终 [PR CI 39749012594](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/39749012594) 对应 `55ebd7d7f99f45bb1f51969ab8564c5e95ebb3ee`；该提交与已部署应用 `da3b83d` 之间仅 README 与本 TODO 发布回执差异。更多来源、发布与检查证据见上述 Linear 正文；本次不重新关闭或重开任何其他 issue。

## 原始全栈路线

保留原稳定 ID 与未实现范围；该路线不自动成为轻量技术任务的通用前置。以下设计与阶段检查按当前规则执行，不再要求另找人员做全套体验 UAT。

| ID | 状态 | 依赖 | 交付与可观察条件 | 风险 |
|---|---|---|---|---|
| P0-DOC-001 | [x] | 无 | 本地Git初始化、原文保存、架构/设计/页面/验收文档齐全；原文hash一致、链接存在 | T0 |
| P0-DES-002 | [ ] | P0-DOC-001 | 核对本次采用的 DESIGN 与 UX、布局例外及相关状态；适用技术检查留证，视觉与使用体验在实际工作中反馈 | T0/T1 |
| P0-ARCH-003 | [ ] | P0-DOC-001 | 明确用户角色/身份、知识接口、NAS、首个供应商/预算与部署方式，记录决策 | T3设计 |
| P0-ENG-004 | [ ] | P0-DES-002 | 初始化Next.js/FastAPI工具链、锁版本、质量命令、基础组件；本地启动与目标检查通过 | T1 |
| P1-SEC-001 | [ ] | P0-ENG-004,P0-ARCH-003 | 项目授权与会话；跨项目API/资产/事件负向测试通过 | T3 |
| P1-KNOW-002 | [ ] | P1-SEC-001 | 只读绑定真实知识、版本快照、A/B/C/D/U；缺失/冲突/不可用路径测试 | T2 |
| P1-INTENT-003 | [ ] | P1-KNOW-002 | 需求草稿、解析建议、确认revision；冲突不丢输入 | T2 |
| P1-ASSET-004 | [ ] | P1-SEC-001 | NAS映射与上传元数据、手动参考集合；越权/穿越/写入失败测试 | T3 |
| P1-DIR-005 | [ ] | P1-INTENT-003,P1-ASSET-004 | 分析、方向比较、人工确认、不可变Instruction；上游修改失效测试 | T2 |
| P1-PROD-006 | [ ] | P1-DIR-005 | Direct图文、队列、outbox、幂等、任务事件；重复/超时/断流/部分失败验证 | T3 |
| P1-REVIEW-007 | [ ] | P1-PROD-006 | AI检查、人工审核、Final血缘；缺证据和未批准不能进入Final | T2 |
| P1-UAT-008 | [ ] | P1-REVIEW-007 | 对已实现 MVP 范围执行 acceptance.md 适用关键路径验证；相关真实权限、数据、恢复与内容批准留证，使用体验在实际工作中反馈 | T2/T3 |
| P2-DISC-001 | [ ] | P1-UAT-008 | pgvector、推荐解释、多样性、参考权重、Pattern与排序；评估集来源明确 | T2 |
| P3-ROUTE-001 | [ ] | P2-DISC-001 | LibTV/ComfyUI Adapter、能力探测、复杂图片路由；真实服务验证 | T3 |
| P4-VIDEO-001 | [ ] | P3-ROUTE-001 | 分阶段视频、镜头、声音与合成版本；局部重试不覆盖已审核资产 | T3 |

P0-DOC-001 验证：2026-09-21，PowerShell比较原文SHA-256、枚举Markdown相对链接目标；git status、git diff --check检查。实际结果见任务日志。
P0-ARCH-003的未知项不妨碍工程工具链准备，但阻塞真实鉴权与供应商接入。

## 历史回执：2026-10-22 FBC-267 合成试点输入包离线门禁

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

## 历史回执：2026-10-16 FBC-220 云端开发首批

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
