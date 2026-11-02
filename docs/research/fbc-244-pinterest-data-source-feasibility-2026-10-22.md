# FBC-244｜Pinterest 数据源可行性与最小接入建议

日期：2026-10-22。状态：官方资料研究阶段完成；实际平台资格、配额和阿里云资源尚未验证，FBC-244 保持 In Progress。此结论不依赖 Penpot PR #12525。

## 结论与本轮范围

优先完成 FBC-245 的本地合成 Reference 契约和失败测试。真实采集、图片缓存、第三方 AI 处理、DAM 入库和生产部署暂不执行。现有 Sites 预览保留，主页交互改动仅在隔离分支准备。

公开可见或可由 Actor 返回的图片，不自动获得保存、再分发或 AI 使用许可。ADR-PIN-001 中“临时缓存→人工精选→DAM”的原始方案保留为 Proposed；实际缓存/入库必须先通过平台政策、业务用途及素材权利门禁。

## 来源能力对比

| 候选 | 已核实的官方能力/规则 | 缺口与决定 |
|---|---|---|
| Pinterest v5 `GET /search/pins` | 搜索操作用户自己的 Pins；Business Access 条件与账号关系另受约束 | 不能作为全球公开关键词搜索接口 |
| Pinterest v5 `GET /search/partner/pins` | 关键词+国家/地区参数；属于受限 beta，非所有应用可用 | 未核验本项目资格，不承诺每查询100–200条；规范中“top 10”和 limit 1–50 的描述需真实资格获批后核对 |
| Apify 社区 Actor | 可以按 Actor 说明提交任务；计费模型及平台资源费随 Actor/方案而异 | 未运行、未付费、未验证输出/质量/权限，不以供应商广告作为结果证据 |
| 本地 Reference Mock | 固定合成输入、元数据、分页、选择、删除与错误夹具 | 本轮可独立完成；不代表任何真实 provider 已配置 |

接口依据固定为 [Pinterest OpenAPI v5.28.0](https://github.com/pinterest/api-description/blob/v5.28.0/v5/openapi.yaml)，不把固定规范误写成实时最新版本。Beta 资格以 [Pinterest restricted features](https://developers.pinterest.com/docs/key-concepts/using-beta-and-restricted-features/) 和实际应用回执为准；OAuth/scope 的存在不能代替资格或实际授权。[认证说明](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)

## 政策与权限门禁

[Pinterest Developer Guidelines](https://policy.pinterest.com/en/developer-guidelines) 对通过其 Materials/API 获取的信息保存、第三方共享、内容再利用和 AI/ML 用途设有限制；仅特定获准场景有例外。抓取/数据提取需明确许可，竞品研究/benchmark 亦有额外书面许可条件。不得将工具可调用、公开图片或“用于灵感”解释为所有下游用途已获准，也不把上述规则扩大为一切 AI 推理均被禁止。

真实接入前需逐项形成证据：

- 业务用途、API 应用资格、授权账号与最小 scope、端点及国家/地区范围。
- 平台对缓存期限/字段/图片字节、第三方处理、AI 用途、再分发、来源链接与删除的许可。
- 图片著作权、人物/品牌等所需权利、适用范围、有效期、撤销与责任人。
- 人工选择仅表示内容取舍；不代替版权许可、正式业务批准或 DAM 审核回执。
- 不使用用户 cookie、个人登录态、绕过反爬或 NAS 任意 URI 访问。

Apify 的服务条款不会替项目授予第三方网站/内容权利，需独立核验。[Apify Terms](https://docs.apify.com/legal/general-terms-and-conditions)

## 配额、费用与失败

Pinterest 公开文档列出 Trial 通用日限额1000、Standard 通用每用户/应用每秒100，同时还有端点类别限制。这是公开规则，不是本项目已获得的额度。实际应用、账号、端点及响应头/429证据尚未采集。[Rate limits](https://developers.pinterest.com/docs/reference/rate-limits/)

Apify Free 公开方案为0美元并含每月5美元用量额度，Starter 为每月19美元及相应用量额度。Actor 的按结果/事件/使用量收费、计算、代理、存储、传输及数据集操作可能另计，不能只用“每千条”推算总预算。价格需执行前重新核验。[Pricing](https://apify.com/pricing)、[Actor billing](https://docs.apify.com/actors/running/actors-in-store)

当前无账单、付费调用或真实配额验证。FBC-245 只模拟429、403、超时与单次预算熔断，模拟金额带 simulated 标识，不宣称实际费用为0或真实服务重试已成功。

## 阿里云资源与实施门禁

未访问阿里云账号或凭据；实际 region、CPU/内存、现存 API/Worker、数据库、OSS、网络、保留策略、预算和监控均未知。不能据设计文档认定资源存在或满足隔离部署。

| 门禁 | 最小证据 | 当前 |
|---|---|---|
| G0 用途/平台/素材许可 | 用途、端点资格、允许保存/AI/第三方处理范围及撤销责任 | 待实际证据 |
| G1 实际云资源 | 只读资源清单、区域/成本上限、网络/存储隔离、最小凭据与回滚 | 待验，阻止FBC-244关闭 |
| G2 实际 provider 样本 | 本人另行批准调用/预算，资格回执、失败和限额、固定输入输出 | FBC-246未开始 |
| G3 合成契约 | 权限/跨项目/分页/幂等/预算/URL/删除及SDK负向测试 | FBC-245本地实施 |
| G4 ReferenceSet/DAM | 授权范围、来源血缘、真实登记审核和撤销清理回执 | FBC-247未开始 |
| G5 试点放行 | 人工业务/视觉验收、费用/失败处理、明确Go | 未放行 |

顺序：先 G3 与本地 UI 交互；并行补 G0/G1 事实；获明确批准后做 G2 小样本，再考虑 G4、隔离环境演练和 G5。FBC-248 不是当前生产部署授权。
