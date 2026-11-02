# FBC-16：知识库图片引用与Codex只读插件核验

日期：2026-10-22（Asia/Shanghai）。本轮按用户确认仅接已授权知识库的图片引用与元数据，不开放原图下载、商用或第三方生成。现有素材站不修改、不重新部署。

## 已有真实来源与权限

| 来源 | 当前证据 | 本批接入结论 |
|---|---|---|
| 正式知识库 | 已有员工委托的search/page/asset三工具，本轮真实只读成功；样本页26项image/webp和1项video/mp4 | 可接图片引用元数据。过滤视频/SVG，逐次调用服务端权限；系统可见性不等于内容使用许可 |
| AI资产中心 | get_capabilities返回尚未连接；已有审计将其识别为账号/AI成果治理台账 | 不发起授权、不把它当媒体DAM，不调用写入 |
| 企业NAS | 接口、ACL和素材归属尚无新证据 | 不访问、不接受NAS路径，不推断企业没有NAS |
| 素材站v6内置摄影参考/浏览器作品 | 独立预览来源，不能推导真实团队素材授权 | 本插件不读取浏览器localStorage，不把3摄影参考当正式知识库 |

正式知识入口由[知识库当前main指引](https://github.com/J21NIANYI/flipbelt-kb-platform/blob/e9b51e694584b2b194f8b53bea4233f9b847526d/docs/p0-uat-008-unified-mcp-guide.md#L3)确认是 `https://wiki.flipbeltchina.com/mcp`。该SHA是核验时源码，不把它与线上应用SHA混同。知识内容Release与应用版本分别记录。

现有资产信封有asset_id、display_name、mime_type、size_bytes、短链expires_in/url；没有媒体级hash/version/权利人/用途许可。知识页面的fileSha256是页面摘要，不能充作图片摘要。适配器可以接收短链字段用于丢弃，但不会跟随URL、下载或将其输出/持久化。

## 工具与边界

- search_materials：文字检索已发布知识页，输出其中允许MIME的图片引用。
- read_material：新读页面核对归属与期望Release，再调用知识素材元数据读取，并核对信封Release和MIME/大小。
- list_collections/get_collection：发现并读取知识页引用集，明确derived_from_released_page、human_curated=false、is_dam_collection=false。不是人工精选认证或正式DAM集合。
- 仅输出白名单字段，download_enabled=false；许可、权利和用途保留unknown。没有角色/租户/项目/URL/路径输入、写入/生成/删除工具，也不索取凭据。

本轮已取得实际Codex原生加载与业务调用回执，见下节；不将其扩大为人工业务采用或正式DAM/原图接通。

## 待验与限制

1. 真实跨角色/跨项目拒绝、员工停用及OAuth撤销需独立测试身份或本人操作，本轮不能由合成负测代替。
2. 来源不提供媒体级hash、不可变版本及用途许可；只可内部图片引用元数据，不放行原图、公开投放/改编或第三方模型处理。
3. 上游一般读取不接受expected_release，本插件的返回信封一致性检查不等于服务端原子固定快照。
4. 正式DAM精选、NAS和写入回流不在本轮；FBC-14/15/235/236不自动完成。
5. 本地开发、独立Codex客户端接通、当前聊天曝光与真人业务采用分别记录。插件本地安装不等于公开发布或企业分发。


## 本轮实现与验证回执

- 隔离分支 `codex/fbc16-readonly-plugin`，基于55ebd7d（PR4未合并）。代码/本地索引/文档保留在工作区，未提交推送或创建新PR；现有PR4和GitHub main未变。
- 插件 `cis-materials@cis-local` 0.1.1已安装且enabled=true，来自本仓本地市场，不是公开发布/企业分发。原生plugin/list与plugin/read识别本地索引、Skill和MCP配置；安装缓存与源码8/8文件SHA-256一致。
- 独立Codex CLI 0.150.1 App Server中，materials runtimeStatus=connected，四工具原生发现成功；ephemeral/read-only会话，没有模型turn和自动批准。委托source为已有 `flipbelt-kb` 员工OAuth连接，仅三项知识只读工具。
- 实际原生四流程：search_materials返回26图片，list_collections返回1个知识页引用集，get_collection返回26图片，read_material返回image/webp、227234字节元数据。均为当前Release `edit-d51febd2f0c3a032abda1d5a-v2`；没有下载文件。
- 实际失败：错误期望Release返回RELEASE_MISMATCH，非本页素材返回NOT_FOUND；返回字段检查无URL/source_path/sourcePath/objectKey/正文，download_enabled=false且rights=unknown。未知ID测试不等于另一员工/租户的真实越权测试。
- 初次0.1.0安装在native报os267，确认为当前兼容loader不替换PLUGIN_ROOT；改为插件根相对cwd与server.mjs参数，0.1.1原生加载成功。协议本身与SDK握手无故障，不读取或改写认证配置。
- 独立审查发现累计stdout预算会耗尽长会话，已改为未完成RPC批次预算；同一进程45次各512KiB、累计超过16MiB仍成功，单RPC喷流超预算仍拒绝。复核无剩余P1/P2。

验证分开记：修复前完整 `npm run check:cloud` 177项（19工程、30既有前端、25原Mock、38输入门禁、17Reference、48初版插件）、typecheck和静态构建通过；修复后 `npm run test:materials` 50/50通过（15 Adapter、4包装、15 Core、16协议），路径修正后包装4/4及安装后的真实原生调用通过。未重复未受影响的完整构建。最终预览守卫通过；Web、Sites绑定、导出脚本与原V0.5没有本轮差异，也未发布站点。

## 使用与回退

本机已安装的显示名为“CIS 素材只读”。可尝试：`用 CIS 素材只读检索袋鼠裤图片引用，并列出来源和知识页引用集。` 2026-10-22时本段对话尚未热加载新增四工具，独立原生客户端已验收；2026-10-29已确认当前对话四工具可见并实际完成检索、引用集和三项图片元数据读取。后续会话仅在实际缺失工具时再检查加载状态，不重复要求重启。

开发复现：在仓库根执行 `codex plugin marketplace add . --json`，再执行 `codex plugin add cis-materials@cis-local --json`。环境要求Node24.15.0与现有已授权的flipbelt-kb连接；不自动登录或读取密钥。

停用/回退可在Codex插件设置中禁用本插件，或执行 `codex plugin remove cis-materials@cis-local`；既有知识库授权和素材站不随之撤销/修改。当前接入依赖本机Codex原生App Server接口；CLI升级后须复测兼容性。

剩余范围为实际使用中需要的跨角色/员工停用/OAuth撤销和素材用途确认；2026-10-29的当前对话工具曝光与真实单账号元数据读取已完成。FBC-16保持In Progress按具体范围跟进，不追加通用全套人工UAT作为前置；知识图片元数据接通不因此宣称原图、版权、DAM或NAS完成。

参考：[OpenAI插件包装规范](https://developers.openai.com/plugins/build/plugins)、[Codex MCP配置与原生客户端](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。本机行为以同版本实测为准。
