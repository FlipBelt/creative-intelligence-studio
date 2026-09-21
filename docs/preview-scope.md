# 首版前端预览范围
日期：2026-09-21。用户明确授权完成前端并使用Sites部署首版预览。

## 工程决策
沿用既定Next.js/React/TypeScript；采用静态导出在Sites托管。FastAPI/PostgreSQL/Redis/NAS架构不变，本轮不实现或伪造这些服务。
项目页面使用可刷新hash路由，允许浏览器本地动态创建项目；与原拟定服务端path路由的差异限于首版静态预览。
数据只在当前浏览器保存，不提供团队同步或跨设备持久性。界面明确演示状态，不存真实产品数据、凭据或身份信息。
Sites新站保持默认私有访问；公开GitHub代码仓不自动扩大Sites受众。
原始产品事实保持UNKNOWN；演示项目输入为B级示例，摄影素材不作为产品照片。
模型未连接时不执行AI调用；可使用明确标注的本地模板体验生产到人工评审的交互，不能称作AI生成或NAS归档。

## 规划覆盖
项目创建/搜索/状态筛选，十个项目阶段，全局参考/资产/任务/设置。
前端核心操作：保存需求、选择参考、确认方向、查看创意板、创建本地文案演示、审核、导出Markdown。
未接入的知识搜索、图片/视频生成、上传NAS、身份和团队权限明确显示未配置。
人工设计验收继续开放；发布预览不是业务上线。

## 摄影参考与许可
三张照片仅作摄影参考及演示项目封面，不代表品牌合作、产品素材或商品性能证据。
- RUN 4 FFWPU：Trail Runner on Scenic Mountain Path，https://www.pexels.com/photo/trail-runner-on-scenic-mountain-path-35599353/
- Mathias Reding：Sunlight and Shadow on Building，https://www.pexels.com/photo/sunlight-and-shadow-on-building-12519360/
- Maria Varshavskaya：Texture of sand on beach in sunlight，https://www.pexels.com/photo/texture-of-sand-on-beach-in-sunlight-4931365/
许可：https://www.pexels.com/license/ ，2026-09-21核验来源页Free to use。页面保留摄影者与源链接；不提供图片图库再分发功能。
