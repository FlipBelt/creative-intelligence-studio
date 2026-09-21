# Creative Intelligence Studio 技术架构文档

**版本：V0.5**
**系统定位：知识驱动的创意情报、创意决策与 AIGC 生产一体化平台**
**部署形态：Web 应用 + 线上知识平台 + NAS + PostgreSQL + AI/API/本地推理混合架构**

---

# 1. 系统目标

Creative Intelligence Studio（CIS）用于完成：

**产品理解 → 案例发现 → 案例拆解 → 创意评优 → 参考组合 → 创意方向 → 方向筛选 → 图文视频生产 → AI/人工评审 → 资产沉淀**

核心业务对象：

```text
Knowledge
产品 / 品牌知识

Product
当前创作对象

Intent
用户创作意图

Reference
创意参考案例

Pattern
可迁移创意规律

Direction
最终创意方向

Production
生产任务

Generation
生成结果
```

系统核心不是 Prompt，而是：

> **Product × Intent × Reference × Direction**

---

# 2. 总体架构

```text
┌──────────────────────────────────────────┐
│               CIS Web                   │
│       Next.js / React / TypeScript       │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│                FastAPI                   │
│      API / Auth / Project / Asset        │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│                Core                     │
│                                          │
│ Product Context     Intent Understanding │
│ Reference Router    Creative Analysis    │
│ Pattern / DNA       Creative Transfer    │
│ Direction Decision Production Router     │
│ AI Critic          Feedback Intelligence │
└───────┬───────────────┬──────────────────┘
        │               │
        ▼               ▼
 PostgreSQL        Redis + Celery
        │               │
        │               ▼
        │            Workers
        │               │
        ▼               ▼
┌──────────────────────────────────────────┐
│               Adapter Layer              │
│                                          │
│ Knowledge / Crawler / Model / Embedding │
│ Direct Image / Video / LibTV / ComfyUI  │
│ Voice / Music / Storage                  │
└───────────────┬──────────────────────────┘
                │
       ┌────────┼──────────┐
       ▼        ▼          ▼
线上知识平台   AI API      NAS / GPU
```

架构原则：

> **Core 定义业务，Adapter 接入外部能力。**

禁止核心业务直接绑定 LibTV、ComfyUI、某个 LLM 或某个爬虫。

---

# 3. 产品知识架构

## 3.1 权威关系

```text
本地知识库 SSoT
      ↓ 发布
线上知识平台
      ↓ 只读
CIS Product Knowledge Gateway
```

本地知识库仍负责知识治理；线上知识平台作为 CIS 的**运行时产品理解底座**。

CIS 不再维护第二套产品知识。

---

## 3.2 Product Knowledge Gateway

统一接口：

```text
resolve_product()
get_product()
get_brand_context()
search_knowledge()
get_related_knowledge()
get_size_context()
get_knowledge_version()
```

支持通过：

```text
产品名称
SKU
产品 URL
产品图片
产品视频
NAS 素材
```

识别并绑定线上知识对象。

---

## 3.3 Product Context Compiler

知识平台可能包含大量内容，不能完整塞入每次模型调用。

因此由：

**Product Context Compiler**

按照当前任务动态编译：

```text
Product Facts
品牌上下文
核心卖点
关键结构
材料 / 技术
使用场景
产品限制
相关扩展知识
未知字段
知识来源
知识版本
```

例如 Campaign 重点读取：

```text
产品定位
卖点
用户
场景
结构
视觉识别
品牌约束
```

而技术文案则增加：

```text
材料
工艺
原理
测试
扩展知识
```

---

# 4. Product Context

产品理解最终不是单一 AI 推断，而由四部分组成：

```text
Product Intelligence Context
│
├── Knowledge Facts
│   线上知识事实
│
├── Visual State
│   当前图片 / 视频观察结果
│
├── Project Override
│   开发样 / 特殊色 / 当前项目修改
│
└── Creative Product Profile
    面向当前创意任务的产品画像
```

事实优先级：

```text
A 线上正式知识
B 项目明确输入
C 视觉观察
D AI 推断
U 未知
```

未知字段必须保持 UNKNOWN。

禁止 AI 将推断自动升级为产品事实。

---

# 5. 资产与 NAS

NAS 保存所有大体积媒体资产：

```text
产品图
案例图
视频
关键帧
音频
字幕
Storyboard
生成图片
生成视频
最终资产
```

PostgreSQL 只保存：

```text
元数据
URI
关系
状态
分析结果
模型调用记录
版本
```

统一虚拟路径：

```text
storage://projects/xxx/...
```

不同机器自行映射：

```text
Windows → Z:\CIS\
Linux   → /mnt/nas/cis/
NAS     → /volume1/CIS/
```

避免数据库绑定具体 NAS 地址。

---

# 6. NAS 目录

```text
/CIS
├── projects/
│   └── {project_id}/
│       ├── source/
│       │   ├── product/
│       │   └── reference/
│       ├── derived/
│       │   ├── thumbnail/
│       │   ├── keyframe/
│       │   ├── transcript/
│       │   ├── audio/
│       │   └── proxy/
│       ├── creative/
│       │   ├── reference_set/
│       │   ├── direction/
│       │   ├── board/
│       │   └── storyboard/
│       ├── generation/
│       │   ├── image/
│       │   ├── video/
│       │   ├── voice/
│       │   └── music/
│       └── final/
├── library/
│   ├── references/
│   ├── patterns/
│   └── finals/
├── comfyui/
├── cache/
└── temp/
```

原始素材原则：

> **只追加，不覆盖。**

---

# 7. 创作意图解析

用户输入：

```text
产品
+
自然语言 Brief
+
上传素材
```

生成：

**Intent Profile**

结构包括：

```text
创作目标
输出类型
平台
用户
产品重点
视觉偏好
情绪
场景
人物
叙事
创新程度
禁止方向
生产限制
Reference Intent
```

Intent Profile 同时服务于：

```text
Reference Router
Creative Transfer
Direction Decision
Production Router
```

---

# 8. 案例采集与预处理

## 8.1 Crawler Adapter

```text
普通网页
YouTube
小红书
抖音
Instagram
本地上传
NAS
```

可分别接入 Crawl4AI、yt-dlp 或其他项目，但只作为 Adapter 实现。

---

## 8.2 图片预处理

```text
尺寸 / EXIF
OCR
主体
缩略图
视觉 Embedding
```

## 8.3 视频预处理

```text
FFmpeg
↓
元数据
音轨
ASR
字幕
Shot Detection
关键帧
代理视频
缩略图
```

再交给多模态模型进行分析。

---

# 9. 案例知识模型

每个 Reference 保存：

```text
基础属性
品牌 / 行业 / 品类 / 平台 / 年份

视觉属性
色彩 / 光线 / 构图 / 摄影 / 动态 / 材质

创意属性
Hook / Narrative / Product Expression

情绪属性
速度 / 力量 / 克制 / 松弛 / 未来等

生产属性
实拍 / CG / AIGC / 混合

质量属性
Creative Score
Performance Score
Transferability
Novelty

Embedding
文本 / 视觉 / Creative DNA
```

案例库因此不是文件库，而是：

> **可检索的创意知识库。**

---

# 10. Creative Reference Router

负责回答：

> **当前项目最值得参考什么？**

输入：

```text
Product Context
Intent Profile
Brand Context
Creative Pattern Library
Reference Library
```

候选召回：

```text
结构化筛选
+
关键词检索
+
pgvector 语义召回
+
视觉相似
```

排序考虑：

```text
产品相关度
意图相关度
Pattern 匹配
Creative Score
可迁移性
品牌适配
新颖度
多样性
重复惩罚
```

推荐不能只返回同品类最相似案例。

默认应包含：

```text
直接行业
相邻行业
跨行业启发
```

并提供推荐解释。

---

# 11. Reference Set

Creative Direction 可以由多个 Reference 共同支持。

例如：

```text
摄影       → Nike
产品表达   → SOAR
光线       → Porsche
色彩       → District Vision
动态       → Editorial
```

每个 Reference Intent 支持权重：

```text
强参考     1.0
弱参考     0.5
忽略       0
禁止迁移  -1
```

Reference Set 作为独立业务对象保存。

---

# 12. Creative Intelligence Engine

## 12.1 Creative Deconstruction

统一拆解：

```text
创意策略
Hook
Narrative
色彩
光线
构图
摄影
镜头
动态
人物
场景
材质
声音
文字
产品表达
```

视频进一步拆到 Shot Level。

---

## 12.2 Creative Evaluation

分开保存：

### Performance Score

基于真实传播表现。

### Creative Intelligence Score

包括：

```text
Hook
Narrative
Visual Identity
Novelty
Product Clarity
Emotion
Execution
Transferability
```

禁止用传播表现替代创意质量。

---

## 12.3 Creative Pattern

从案例中提取：

> **可跨项目迁移的创意机制。**

例如：

```text
高速身体运动
+
稳定产品区域
→ 表达“控制 / 稳定”
```

Pattern 是 Reference 与 Direction 之间的重要知识层。

---

# 13. Creative Transfer 与 Direction

输入：

```text
Product Context
+
Intent Profile
+
Reference Set
+
Creative DNA
+
Brand Context
```

输出 3–5 个真正不同的：

**Creative Direction**

每个 Direction 包括：

```text
核心命题
产品表达
Creative Pattern
视觉策略
色彩 / 光线
摄影 / 构图
人物 / 场景
视频语言
Reference Set
品牌约束
产品约束
执行复杂度
风险
```

---

# 14. Direction Decision Support

系统不能只生成方案，还必须帮助筛选。

评分维度：

```text
Product Fit
Intent Fit
Brand Fit
Product Truth Alignment
Originality
Reference Fit
Feasibility
Production Complexity
Cost
Risk
Historical Similarity
```

用户可以按：

```text
综合推荐
最适合产品
最创新
最符合品牌
最容易执行
最低成本
最大胆
与历史差异最大
```

重新排序。

系统必须解释推荐理由，而不是只给总分。

---

# 15. Creative Instruction

用户确认 Direction 后，将其编译为平台内部统一生产协议：

```text
Creative Instruction
│
├── Product Context
├── Intent
├── Direction
├── Reference Set
├── Product Constraint
├── Brand Constraint
├── Output Type
└── Production Requirement
```

所有下游模型只消费 Creative Instruction，不直接消费杂乱原始数据。

---

# 16. Creative Production Router

负责决定：

> **这个任务应该怎么生产。**

不是简单按照图片 / 视频分类，而综合：

```text
复杂度
Reference 数量
多阶段需求
自主规划需求
产品还原要求
可重复性
成本
速度
质量
```

三种执行模式：

```text
Direct Model
LibTV
ComfyUI
```

---

# 17. Direct Model

适合：

```text
文案
简单图片
图片修改
单镜头视频
简单动画
明确的一次性任务
```

路径：

```text
Creative Instruction
↓
Prompt Compiler
↓
Model Gateway
↓
对应 API
```

优势：

```text
速度快
成本低
调用链短
易审计
```

---

# 18. LibTV

定位：

# 复杂视觉创作编排器

适合：

```text
多参考复杂图片
连续图片编辑
复杂 Campaign
Storyboard
关键帧
多镜头视频
TVC
产品影片
需要 Agent 自主规划的任务
```

职责边界：

```text
CIS
决定创意与产品事实

↓

LibTV
规划复杂生产过程
```

LibTV 不作为产品知识源，也不决定最终创意策略。

---

# 19. ComfyUI

定位：

# 确定性视觉工作流运行时

适合：

```text
固定模型
固定 Seed
ControlNet
Pose
Mask
Inpainting
LoRA
批量生成
高度可复现
产品精确控制
```

核心区别：

```text
LibTV
解决复杂创作问题

ComfyUI
执行确定生产流程
```

---

# 20. 视频工作室

复杂视频必须阶段化：

```text
Creative Direction
↓
视频结构
↓
脚本
↓
Storyboard
↓
关键帧
↓
Shot
↓
口播
↓
音乐
↓
音效
↓
字幕
↓
剪辑
↓
成片
```

Storyboard、关键帧、Shot、Voice、Music 均作为独立资产保存。

用户可以在关键阶段确认、修改或重生成。

---

# 21. Model Gateway 与 Model Router

## Model Gateway

统一封装：

```text
OpenAI
Gemini
Claude
Qwen
DeepSeek
Image Models
Video Models
Embedding Models
Local Models
```

Core 禁止直接调用具体 SDK。

---

## Model Router

负责具体模型选择。

与 Production Router 区分：

```text
Production Router
决定 Direct / LibTV / ComfyUI

Model Router
决定 Direct 内具体用哪个模型
```

模型运行记录：

```text
模型
版本
Prompt Version
Token
成本
耗时
结果
质量评分
```

用于后期自动优化。

---

# 22. Knowledge Grounding

所有涉及：

```text
材料
结构
功能
性能
测试
产品数据
品牌事实
```

的生产内容必须经过：

**Knowledge Grounding Gate**

规则：

```text
有知识来源 → 可作为事实
项目明确输入 → 可限定当前项目使用
仅视觉观察 → 标明观察事实
AI 推断 → 不得直接作为事实
未知 → 保持未知
```

避免生成虚构卖点或错误产品信息。

---

# 23. AI Critic

AI Critic 同时评价：

```text
Visual Quality
Creative Alignment
Brand Fit
Originality
Technical Quality

Product Visual Accuracy
Product Fact Accuracy
Knowledge Grounding
Reference Intent Alignment
```

因此不仅检查：

> “好不好看”

还检查：

> “是不是我们的产品、表达得对不对。”

---

# 24. Human Review 与反馈

用户可以：

```text
通过
淘汰
收藏
评分
修改
局部重生成
备注
进入 Final
```

系统记录完整反馈链：

```text
Reference Recommended
↓
Reference Selected
↓
Direction Recommended
↓
Direction Selected
↓
Production Routing
↓
Generation
↓
AI Score
↓
Human Review
↓
Final Use
```

后期分别优化：

```text
Reference Router
Direction Decision
Production Router
Model Router
```

---

# 25. PostgreSQL 核心模型

建议保持领域化，而不是过度拆表。

核心表：

```text
projects

knowledge_bindings
knowledge_snapshots
product_contexts

products
product_visual_states
project_product_overrides

intent_profiles

assets
asset_relations

references
reference_intents
reference_features
reference_embeddings

reference_sets
reference_recommendations

analyses
evaluations
creative_patterns
creative_dna

creative_directions
direction_scores

creative_boards
creative_instructions

production_jobs
production_steps

prompts
generations
storyboards
shots

reviews

model_runs
engine_runs
jobs
```

---

# 26. 任务架构

MVP 使用：

```text
Redis + Celery
```

Queue：

```text
crawler
media
embedding
analysis
discovery
ranking
creative
direct_generation
libtv
comfyui
video
critic
```

统一状态：

```text
PENDING
QUEUED
RUNNING
WAITING_REVIEW
SUCCEEDED
FAILED
RETRYING
CANCELLED
```

暂不引入 Temporal，除非复杂视频与长期工作流规模证明 Celery 无法满足。

---

# 27. 推荐代码结构

```text
creative-intelligence-studio/
│
├── apps/
│   ├── web/
│   └── api/
│
├── core/
│   ├── knowledge/
│   ├── product/
│   ├── intent/
│   ├── reference/
│   ├── discovery/
│   ├── recommendation/
│   ├── analysis/
│   ├── pattern/
│   ├── creative_dna/
│   ├── direction/
│   ├── decision/
│   ├── instruction/
│   ├── production_router/
│   └── review/
│
├── adapters/
│   ├── knowledge/
│   ├── storage/
│   ├── crawler/
│   ├── embedding/
│   ├── llm/
│   ├── image/
│   ├── video/
│   ├── libtv/
│   ├── comfyui/
│   ├── voice/
│   └── music/
│
├── workers/
│
├── schemas/
├── prompts/
├── workflows/
├── migrations/
└── docker-compose.yml
```

依赖方向必须保持：

```text
Web
↓
API
↓
Core
↓
Interface
↓
Adapter
↓
第三方组件
```

不得反向依赖。

---

# 28. 部署拓扑

```text
                         局域网
                           │
        ┌──────────────────┼─────────────────┐
        ▼                  ▼                 ▼
    App Server            NAS             GPU PC
        │                  │                 │
 Next.js / FastAPI      Assets           ComfyUI
 PostgreSQL             Generation       Local Models
 Redis / Celery         Cache            Media Workers
        │
        ▼
线上知识平台
        │
        ▼
云端 AI / LibTV / 外部模型 API
```

系统可以逐步扩展 GPU Worker，而不改变核心架构。

---

# 29. Web 工作区

项目内建议采用：

```text
01 产品
   产品绑定 / Product Context

02 创意需求
   Intent Profile

03 参考发现
   Filter / Search / AI Recommendation

04 Reference Set

05 创意分析
   Pattern / Creative DNA

06 Creative Direction
   Compare / Ranking / Selection

07 Creative Board

08 Production
   文案 / 图片 / 视频

09 Review

10 Final Assets
```

普通用户无需接触：

```text
模型名称
Embedding
pgvector
Worker
LibTV
ComfyUI 节点
```

这些均放入高级设置。

---

# 30. 技术组件基线

| 层级                | 技术/组件                        | 主要职责                     |
| ----------------- | ---------------------------- | ------------------------ |
| Web               | Next.js / React / TypeScript | 用户工作台                    |
| API               | FastAPI                      | 业务接口                     |
| Database          | PostgreSQL                   | 状态、关系、分析结果               |
| Semantic Search   | pgvector                     | Reference / Pattern 语义检索 |
| Queue             | Redis + Celery               | 异步任务                     |
| Storage           | NAS                          | 媒体资产                     |
| Media             | FFmpeg                       | 视频预处理与合成基础能力             |
| Knowledge         | 线上知识平台                       | 产品/品牌知识运行时底座             |
| LLM/VLM           | Model Gateway                | 理解、分析、文案、Judge           |
| Retrieval         | Reference Router             | 创意案例发现与推荐                |
| Complex Creation  | LibTV                        | 复杂图片与复杂视频编排              |
| Workflow          | ComfyUI                      | 精密、确定性视觉生产               |
| Direct Generation | Image / Video APIs           | 简单生成任务                   |
| Review            | AI Critic + Human Review     | 质量和事实审核                  |

---

# 31. 系统核心数据流

```text
线上知识平台
        │
        ▼
Product Context
        │
        +
用户素材 / Brief
        │
        ▼
Intent
        │
        ▼
Reference Router
        │
        ▼
Reference Set
        │
        ▼
Analysis → Pattern → Creative DNA
        │
        ▼
Creative Direction
        │
        ▼
Direction Decision
        │
        ▼
Creative Instruction
        │
        ▼
Production Router
        │
   ┌────┼───────────┐
   ▼    ▼           ▼
Direct LibTV     ComfyUI
   │    │           │
   └────┼───────────┘
        ▼
Generation
        │
        ▼
AI Critic
        │
        ▼
Human Review
        │
        ▼
NAS / Final
```

---

# 32. 架构边界

CIS 必须长期坚持：

**知识平台负责“什么是真的”。**

**Reference Intelligence 负责“什么值得学习”。**

**Creative Intelligence 负责“为什么有效”。**

**Direction Decision 负责“最值得往哪里做”。**

**Production Router 负责“应该怎么生产”。**

**LibTV 负责“复杂创作如何编排”。**

**ComfyUI 负责“确定性视觉工作流如何执行”。**

**模型负责具体推理与生成。**

**NAS 负责资产。**

**PostgreSQL 负责关系、状态和数据血缘。**

**AI Critic + 人负责最终质量判断。**

---

# 33. 实施原则

首期优先打通：

```text
线上产品知识
→ 产品绑定
→ Intent
→ Reference 手动/筛选
→ Creative Analysis
→ Direction
→ Direct 文案/图片生成
→ Review
→ NAS
```

第二阶段加入：

```text
pgvector
Reference Router
AI Recommendation
Reference Set
Creative Pattern
Direction Ranking
```

第三阶段加入：

```text
LibTV
ComfyUI
Creative Production Router
复杂图片
```

第四阶段完成：

```text
Video Studio
Storyboard
关键帧
Shot
声音
复杂视频
```

原则：

> **架构预留能力，但实现按真实使用价值逐步增加，不为了“完整”提前制造系统复杂度。**

---

# 34. 最终技术定位

Creative Intelligence Studio 最终由四类基础设施共同组成：

```text
Knowledge Infrastructure
知识基础设施

Creative Intelligence Infrastructure
创意智能基础设施

Production Infrastructure
AIGC 生产基础设施

Asset & Feedback Infrastructure
资产与反馈基础设施
```

其完整能力链是：

> **知道产品是什么 → 找到值得学习的案例 → 理解案例为什么有效 → 形成适合产品的创意方向 → 选择正确生产方式 → 完成图文视频 → 校验产品与创意准确性 → 将最终经验重新沉淀为可复用数据。**

这构成 CIS 的完整技术架构。
