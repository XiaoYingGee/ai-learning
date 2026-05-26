---
title: "Google ADK"
description: "Google Agent Development Kit 概述、Gemini 集成与 A2A 协议支持"
---

:::tip[与其他章节的关联]
- ADK 的 Agent 定义模式与 [ch02 Agent 模式](/02-agent-basics/02-agent-patterns/) 中的概念一致
- Vertex AI Search 工具实现了 [ch04 RAG](/04-rag/02-rag-basics/) 的检索增强生成
- A2A 协议与 [ch03 MCP](/03-tools-mcp/02-mcp-protocol/) 互补：MCP 标准化 Agent-工具连接，A2A 标准化 Agent-Agent 连接
:::

## 概述

Google Agent Development Kit（ADK）是 Google 推出的 Agent 开发框架，深度集成了 Gemini 模型和 Vertex AI 平台。ADK 的核心特色是**原生支持 A2A（Agent-to-Agent）协议**，使得不同框架构建的 Agent 可以互相通信。

ADK 的定位是为企业级 AI Agent 应用提供从开发到部署的完整工具链。

## 核心架构

ADK 采用分层架构设计：

| 层级 | 说明 |
|------|------|
| **Agent 层** | 定义 Agent 的行为、工具和编排逻辑 |
| **Model 层** | 对接 Gemini、Vertex AI 等模型 |
| **Tool 层** | 内置工具 + 自定义工具 + MCP 工具 |
| **Runtime 层** | 执行引擎，支持本地和云端运行 |

### 基本用法

```python
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# 定义 Agent
agent = Agent(
    name="travel_agent",
    model="gemini-2.0-flash",
    instruction="你是一个旅行规划助手。根据用户的需求推荐旅行目的地和行程。",
    tools=[search_destinations, book_hotel],
)

# 创建 Session 管理
session_service = InMemorySessionService()
session = session_service.create_session(
    app_name="travel_app",
    user_id="user_123",
)

# 运行 Agent
runner = Runner(agent=agent, session_service=session_service)
response = runner.run(
    session_id=session.id,
    user_message="我想去日本玩5天，预算1万元",
)
print(response.text)
```

## 与 Gemini、Vertex AI 的集成

ADK 与 Google 生态系统深度整合：

**Gemini 模型集成：**
- 直接使用 `gemini-2.0-flash`、`gemini-2.5-pro` 等模型
- 原生支持 Gemini 的多模态能力（图片、视频、音频）
- 利用 Gemini 的超长上下文窗口（100万+ Token）

**Vertex AI 平台集成：**

:::note[术语：Vertex AI]
Vertex AI 是 Google Cloud 的统一 AI/ML 平台，提供模型训练、部署、监控和 Agent 托管等全生命周期服务。它是 GCP 生态中运行 AI 应用的核心入口，类似于 AWS 的 SageMaker + Bedrock 的组合。
:::
- 一键部署到 Vertex AI Agent Engine
- 内置 Vertex AI Search 用于 RAG
- 与 BigQuery、Cloud Storage 等 GCP 服务无缝连接

```python
from google.adk.agents import Agent
from google.adk.tools import VertexAISearchTool

# 使用 Vertex AI Search 作为 RAG 工具
search_tool = VertexAISearchTool(
    data_store_id="projects/my-project/locations/global/dataStores/my-store",
)

rag_agent = Agent(
    name="knowledge_agent",
    model="gemini-2.5-pro",
    instruction="基于知识库回答用户问题。如果知识库中没有相关信息，请如实告知。",
    tools=[search_tool],
)
```

## A2A 协议原生支持

A2A（Agent-to-Agent）协议是 Google 提出的开放标准，定义了**不同 Agent 之间的通信规范**。

核心概念：
- **Agent Card**：描述 Agent 能力的元数据（类似 API 的 OpenAPI 规范）
- **Task**：Agent 之间传递的工作单元
- **Message**：Task 中的通信内容
- **Artifact**：Task 产生的输出物

```python
from google.adk.agents import Agent
from google.adk.a2a import A2AServer

# 将 Agent 暴露为 A2A 服务
agent = Agent(
    name="translator",
    model="gemini-2.0-flash",
    instruction="你是一个翻译 Agent，将任何文本翻译成目标语言。",
)

# 启动 A2A Server
server = A2AServer(agent=agent, port=8080)
server.start()

# 其他 Agent 可以通过 A2A 协议调用该翻译服务
# 无论对方使用什么框架（LangChain、CrewAI 等）
```

A2A 的意义在于打破框架壁垒：用 LangChain 构建的 Agent 可以通过 A2A 协议调用用 ADK 构建的 Agent，反之亦然。

## 优缺点

**优点：**
- 与 GCP 生态深度集成，企业级场景开箱即用
- A2A 协议支持跨框架 Agent 互操作
- 多模态能力强（Gemini 原生支持）
- Session 管理和状态持久化内置

**缺点：**
- 深度绑定 Google 生态，使用其他模型时体验下降
- 社区相对较新，教程和示例较少
- A2A 协议尚未被广泛采用

## 常见陷阱

- **GCP 绑定过深**：过度依赖 Vertex AI Search、BigQuery 等 GCP 服务会导致迁移困难。业务逻辑应与云服务解耦。
- **A2A 协议不成熟**：A2A 尚处于早期阶段，跨框架互操作的实际案例有限。用于 PoC 可以，生产环境需评估稳定性。
- **模型切换成本**：虽然 ADK 技术上支持非 Gemini 模型，但多模态能力、长上下文等特性与 Gemini 深度耦合，换模型后体验会下降。

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：A2A 协议的 Agent Card 类似于 Web 开发中的什么概念？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">类似于 OpenAPI 规范（Swagger），它描述了 Agent 的能力、接受的输入和产生的输出，让其他 Agent 能够自动发现和调用它。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：ADK 的 Session 管理解决了什么问题？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">Session 管理维护了用户与 Agent 之间的对话状态，使得 Agent 能够记住上下文信息，支持多轮对话。InMemorySessionService 用于开发，生产环境可替换为持久化存储。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：与 MCP 相比，A2A 协议的侧重点有什么不同？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">MCP 侧重于 Agent 与工具/数据源之间的连接标准化；A2A 侧重于 Agent 与 Agent 之间的通信标准化。两者互补而非竞争。</div>
  </details>
</div>

## 延伸阅读

- [Google ADK 官方文档](https://google.github.io/adk-docs/)
- [A2A 协议规范](https://github.com/google/A2A)
- [Vertex AI Agent Engine](https://cloud.google.com/vertex-ai/docs/agents)
