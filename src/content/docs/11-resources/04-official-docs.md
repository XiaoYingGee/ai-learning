---
title: "官方文档"
description: "AI Agent 开发相关的官方文档和 SDK 参考"
---

## LLM 提供商

### Anthropic

**Claude API 文档：** https://docs.anthropic.com/

- Claude 模型系列（Opus、Sonnet、Haiku）的使用指南
- Messages API 详细说明
- Tool Use / Function Calling 文档
- Prompt Engineering 最佳实践
- Prompt Caching、Batch API 等高级功能

**MCP (Model Context Protocol)：** https://modelcontextprotocol.io/

- MCP 协议规范
- Client 和 Server SDK
- 工具、资源、Prompt 模板的定义方式
- 传输层（stdio、HTTP+SSE）

**推荐阅读顺序：** Messages API → Tool Use → Prompt Engineering Guide → MCP Specification

---

### OpenAI

**API 文档：** https://platform.openai.com/docs

- Chat Completions API
- Function Calling / Tool Use
- Structured Outputs（JSON Mode、JSON Schema）
- Assistants API
- Embeddings API
- Fine-tuning 指南

**Agents SDK：** https://github.com/openai/openai-agents-python

- OpenAI 官方 Agent 框架
- Agent 循环、Tool 集成、Handoff
- Guardrails 和 Tracing

**推荐阅读顺序：** Chat Completions → Function Calling → Structured Outputs → Agents SDK

---

### Google

**Gemini API：** https://ai.google.dev/docs

- Gemini 模型系列文档
- 多模态（文本、图片、视频、音频）处理
- Function Calling
- Context Caching

**Agent Development Kit (ADK)：** https://google.github.io/adk-docs/

- Google 的 Agent 开发框架
- Agent 定义、工具集成、多 Agent 协作

**A2A Protocol (Agent-to-Agent)：** https://github.com/google/A2A

- Google 提出的 Agent 间通信协议
- Agent Card、任务管理、消息交换
- 与 MCP 互补（MCP 管 Agent-Tool，A2A 管 Agent-Agent）

---

## Agent 框架

### LangChain / LangGraph

**LangChain 文档：** https://python.langchain.com/docs/

- 最流行的 LLM 应用框架
- Chain、Agent、Tool、Memory 抽象
- 丰富的集成（LLM、向量数据库、工具）

**LangGraph 文档：** https://langchain-ai.github.io/langgraph/

- 基于图的 Agent 工作流框架
- 状态管理和条件分支
- Multi-Agent 协作
- Human-in-the-loop

**LangSmith：** https://docs.smith.langchain.com/

- LLM 应用的可观测性平台
- Tracing、评估、数据集管理

**推荐阅读顺序：** LangChain 快速入门 → LangGraph 概念 → 构建 Agent → LangSmith 集成

---

### LlamaIndex

**文档：** https://docs.llamaindex.ai/

- 数据连接和索引框架
- RAG 管道构建
- Agentic RAG
- 多种数据源适配器

**核心概念：**
- Index（索引类型：向量、关键词、知识图谱）
- Query Engine（查询引擎）
- Agent（基于 LlamaIndex 的 Agent 构建）
- Evaluation（RAG 评估工具）

**推荐阅读顺序：** 快速入门 → RAG Pipeline → Agentic RAG → Evaluation

---

## 向量数据库

| 数据库 | 文档链接 |
|--------|---------|
| Pinecone | https://docs.pinecone.io/ |
| Weaviate | https://weaviate.io/developers/weaviate |
| Qdrant | https://qdrant.tech/documentation/ |
| Chroma | https://docs.trychroma.com/ |
| pgvector | https://github.com/pgvector/pgvector |
| Milvus | https://milvus.io/docs |

---

## 实用建议

### 文档阅读策略

1. **先看 Quickstart** — 5 分钟建立整体感知
2. **跑通示例代码** — 动手比看文档有效
3. **按需深入** — 遇到具体问题再查详细文档
4. **关注 Changelog** — 了解最新功能和 Breaking Changes

### 面试中如何展示文档知识

- 提到具体的 API 参数名和默认值
- 知道不同提供商的差异（如 Anthropic 的 Tool Use vs OpenAI 的 Function Calling）
- 了解各框架的优劣势和适用场景
