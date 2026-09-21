# Creative Intelligence Studio

知识驱动的创意情报、创意决策与 AIGC 生产 Web App。

状态：2026-09-21 完成项目启动与设计规划草案。尚无可运行应用；规范待人工评审。团队仓库：[FlipBelt/creative-intelligence-studio](https://github.com/FlipBelt/creative-intelligence-studio)，公开可见。应用尚未部署。

## 阅读顺序

1. [产品与实施架构](docs/architecture.md)
2. [全局设计规范](DESIGN.md)
3. [页面与交互契约](docs/ux-spec.md)
4. [实施待办](docs/TODO.md)
5. [验收清单](docs/acceptance.md)
6. [用户原始 V0.5 架构](docs/sources/architecture-v0.5.md)

## 首期闭环

创建项目 → 绑定产品及知识版本 → 确认需求 → 手动选择参考 → 分析 → 比较并确认方向 → 文案或图片生产 → AI 辅助检查与人工评审 → 保存最终资产。

目标用户暂按内部创意策划、设计制作与审核人员规划；角色是否合并、身份提供方、NAS 和模型供应商接入尚待确定。

技术目标：Next.js / React / TypeScript、FastAPI、PostgreSQL、Redis + Celery、NAS。具体版本、包管理器与启动命令在工程阶段核验并锁定，本轮不提供尚不存在的运行命令。

OpenDesign 参考对象已由用户确认：[nexu-io/open-design](https://github.com/nexu-io/open-design)。设计参考：[FlipBelt 知识平台](https://github.com/J21NIANYI/flipbelt-kb-platform)。只提炼原则，本轮未复制第三方源码、品牌标志或模板。
