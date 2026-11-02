# CIS 素材插件、项目 Skill 与收口文档源码交付（2026-11-02）

## 范围与授权

用户本轮明确授权“提交推送并部署”。沿用已有项目与素材站受众；本轮覆盖前一阶段不提交/部署的限制，不扩大素材使用权、账号权限、生成或业务写入。

源码范围：`plugins/cis-materials`、对应50项测试、本地插件目录、两个项目 Skill、包脚本与README/架构/TODO/验收/研究报告。私有候选 Brief、引用索引及线框交接均在公开仓库外。原 D 盘工作区及其他任务改动不操作。

Web、Sites 绑定、导出脚本及原始 V0.5 相对 `55ebd7d` 无差异；静态站点继续是现有素材站。插件运行在本机 Codex 内，网页部署不把它变成访客可调用的线上网关。原图下载、商业/第三方处理、正式 DAM 登记与实际新设计不在本批。

## 审查与本地验证

- 独立插件审查未发现可操作问题或阻断P1/P2；额外全合成smoke的撤销后拒绝、Release变化、非页面成员和未知下载工具四条件均通过，未调用真实源。
- 独立范围复核未发现凭据、签名URL或私有候选正文进入Git路径。历史工具加载状态已日期化，不误称真实设计或DAM完成。
- `npm run check:cloud` 通过：19工程、30前端、25原Mock、38输入门禁、17Reference及50素材插件，共179项，typecheck与静态构建通过。
- 既有项目Skill格式校验、Codex0.150.1原生发现与关键样例见[10月29日收口报告](cis-minimum-loop-closeout-2026-10-29.md)；本批未修改两个Skill正文。
- 保留上游非原子Release边界；图片引用可读不代表用途许可或跨角色/撤销已通过。

## 发布回执

本段仅记录已发生的结果。代码推送、对应SHA的远端CI、站点源码同步和站点部署分别验证；未取得平台成功回执不将本地构建写成线上更新。

源码提交 `79ea86e341eb951067559f74d552e4e201a28db9` 已推送至 `codex/fbc16-readonly-plugin`，远端分支SHA独立读回一致。[PR #6](https://github.com/FlipBelt/creative-intelligence-studio/pull/6)叠加在仍开放的PR #4源码分支；不将PR #4当已合并，本轮不请求合并。

[CI 41370053588](https://github.com/FlipBelt/creative-intelligence-studio/actions/runs/41370053588)对应上述完整SHA，结论success；Host checks（job125038389294）及真实Dev Container checks（job125038389655）和全部步骤均success。容器日志实际读到19/30/25/38/17/50各套件0fail及构建成功；Host状态/步骤成功已回读，日志下载遇TLS超时，不冒称两份原始日志均读取。

本机官方package-site helper生成静态归档，42文件：41个静态文件与本地out逐字节一致，另1个hosting manifest仅将static.directory规范化为dist；保留原project_id。SHA256为 `3619a5bdcdf688b10a3efbdd2c2ca3d1950440dbfe6551a2e2fc6518bbfb3c0f`。没有源码、凭据、私有候选或node_modules。初次额外检查按out而非helper规范化的dist寻找入口失败，修正检查映射后全部字节/manifest通过，未改包。

发布通道阻塞：

- Sites `get_site` 与插件发现接口均返回“tool is not available to the model”。
- 受支持的Codex0.150.1 AppServer目录包含Sites/Linear工具，但同一session约9–52秒均runtimeStatus=starting；目录存在不代表已连接。实际 `sites.get_site` 调用失败于“timed out awaiting tools/list after 30s”，没有调用部署或读取凭据。
- 根据[官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)进行一次只影响诊断进程的startup_timeout_sec=60尝试；内建codex_apps无法单独以该表覆盖，返回invalid transport，进程退出。没有改持久配置、权限或审批，没有继续无变化重试。

未得到新站点版本/部署或本轮Linear写后回读回执，因此两项保持未完成。已有源码、归档、PR与CI可复用；原素材站保留。部署及同步授权仍有效，恢复受支持连接后继续，无需重复请求授权。
