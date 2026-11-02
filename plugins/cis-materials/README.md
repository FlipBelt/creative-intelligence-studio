# CIS 素材只读插件

本地 Codex 插件，首批仅对已授权 FlipBelt 知识库的**图片引用与元数据**提供只读检索/读取/引用集。现有素材站保持不变。本插件不提供原图、下载票据、商用许可、第三方生成或资产写入。

## 工具

| 工具 | 用途 |
|---|---|
| search_materials | 按文字检索已发布知识页中的图片引用 |
| read_material | 按页面、素材ID与期望Release重新鉴权读取元数据 |
| list_collections | 搜索知识页图片引用集，明确非人工精选/非DAM集合 |
| get_collection | 读取某知识页固定Release的图片引用集 |

返回只保留允许字段；不输出签名URL、存储对象路径、正文或凭据。图片仅JPEG/PNG/WebP/GIF；过滤视频及SVG。每次业务请求重新调用知识源，旧授权、版本变化和来源失败均不回退为成功。图片hash、版权所有者及商用/改编/第三方处理许可未由知识源提供时保留unknown。

## 本地加载

运行环境为Node 24.15.0及本机Codex CLI；插件使用Node内置模块，不依赖缓存目录外的node_modules。源连接必须在Codex中已经连接且允许三项知识只读工具。本插件通过第一方App Server的原生MCP调用委托该连接，不读取或导出OAuth密钥，不调用模型。

在仓库根执行 `codex plugin list --marketplace cis-local --json --available` 可检查索引；安装及真实客户端/身份回执见本批验证报告。未取得实际成功回执前，不将清单可解析或stdio握手当作真实接通。

插件完整ID为 `cis-materials@cis-local`。本地索引位于 `.agents/plugins/marketplace.json`；它不是公开上架或企业工作区分发。当前聊天是否加载新工具与独立Codex进程的原生调用分开记录。

## 检查与退出

在仓库根执行 `npm run test:materials`。生产入口无fixture或anonymous成功模式；测试合成数据只在tests目录。结束stdio输入将关闭委托子进程。卸载或禁用插件不撤销既有知识库OAuth；授权撤销应在知识源本人入口操作。
