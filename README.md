# Creative Intelligence Studio

知识驱动的创意情报、创意决策与 AIGC 生产 Web App。

状态：2026-09-21 已实现首版 Next.js 前端交互预览；设计与真实业务验收仍待人工完成。团队仓库：[FlipBelt/creative-intelligence-studio](https://github.com/FlipBelt/creative-intelligence-studio)，公开可见。Sites 发布由 .openai/hosting.json 绑定，同一预览持续更新。

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

技术目标：Next.js / React / TypeScript、FastAPI、PostgreSQL、Redis + Celery、NAS。首版使用 Next.js 16.3.5、React 19.2.4、npm 锁文件；FastAPI 等后端尚未实现。

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
