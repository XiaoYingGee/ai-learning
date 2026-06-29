# AI Agent 学习指南 — CLAUDE.md

本文件用于指导 AI（如 Claude Code）对知识库进行迭代更新和维护。

## 项目概述

- **用途**：AI Agent 开发岗位面试学习 Wiki
- **技术栈**：Astro Starlight + TypeScript
- **部署**：Cloudflare Pages（GitHub push 自动构建）
- **语言**：中英双语（中文为默认语言）
- **仓库**：`XiaoYingGee/ai-learning`

## 目录结构

```
src/content/docs/
├── index.mdx                    # 首页（学习路线图）
├── 01-llm-fundamentals/         # 第一章：LLM 基础
├── 02-agent-patterns/           # 第二章：Agent 设计模式
├── 03-tool-use/                 # 第三章：工具使用与集成
├── 04-rag/                      # 第四章：记忆与知识（RAG）
├── 05-frameworks/               # 第五章：Agent 框架与 SDK
├── 06-coding/                   # 第六章：编码实战
├── 07-production/               # 第七章：生产化工程
├── 08-security/                 # 第八章：安全
├── 09-system-design/            # 第九章：系统设计题
├── 10-interview/                # 第十章：面试冲刺
├── 11-resources/                # 第十一章：推荐课程与资源
└── 12-self-evolving/            # 第十二章：Agent 自进化
```

## 文章格式规范

每篇文章使用以下 frontmatter：

```markdown
---
title: "文章标题"
description: "一句话描述"
lastUpdated: 2026-05-25
---
```

### 文章结构

1. **概念讲解** — 小白友好，用类比和日常例子解释
2. **原理图示** — ASCII 图或文字流程图
3. **代码示例** — Python 为主，可直接运行
4. **自测题** — 使用 `<details><summary>` 折叠答案
5. **延伸阅读** — 相关论文、文档、课程链接

### 自测题格式

```html
<details>
<summary>Q1: 问题内容？</summary>

答案内容...

</details>
```

## 双语规范

- **默认语言**：中文（文件直接放在章节目录下）
- **英文翻译**：暂不要求每篇都有英文版，优先保证中文内容质量
- 技术术语保留英文原文（如 ReAct、Transformer、Function Calling）
- 中文文件路径示例：`src/content/docs/01-llm-fundamentals/01-transformer.md`

## 时效性管理

### lastUpdated 字段

每篇文章 frontmatter 中的 `lastUpdated` 记录最后更新日期。

### 更新触发条件

以下情况需要更新对应文章：

1. **框架/SDK 发布重大版本**（如 LangChain v1.0、Claude Agent SDK 新版）
2. **新协议发布**（如 MCP 新版本、新的 Agent 协议）
3. **行业格局变化**（如新框架崛起、旧框架被废弃）
4. **面试趋势变化**（如新的高频考题出现）

### 高时效性章节（优先更新）

- `05-frameworks/` — Agent 框架变化极快
- `03-tool-use/03-mcp.md` — MCP 协议持续演进
- `03-tool-use/04-a2a.md` — A2A 协议较新
- `11-resources/` — 课程和资源链接可能失效

### 低时效性章节（较稳定）

- `01-llm-fundamentals/` — 基础理论变化慢
- `02-agent-patterns/` — 设计模式相对稳定
- `08-security/` — 安全原则较稳定

## AI 更新工作流

当用户要求更新知识库时，按以下步骤操作：

1. **检查时效性**：扫描所有文章的 `lastUpdated`，列出超过 3 个月未更新的文章
2. **搜索最新信息**：使用 WebSearch 搜索相关领域最新发展
3. **更新内容**：修改文章内容，更新 `lastUpdated` 日期
4. **更新侧边栏**：如有新增文章，更新 `astro.config.mjs` 中的 sidebar 配置
5. **构建验证**：运行 `npm run build` 确保无错误
6. **提交推送**：commit 并 push 到 GitHub，Cloudflare Pages 自动部署

## 构建与部署

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview
```

## 注意事项

- 不要删除现有文章，只做更新或新增
- 新增文章后必须在 `astro.config.mjs` 的 sidebar 中添加对应条目
- 代码示例确保可运行（至少语法正确）
- 保持文章间的交叉引用有效
