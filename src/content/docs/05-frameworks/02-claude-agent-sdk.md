---
title: "Claude Agent SDK"
description: "Anthropic Claude Agent SDK 核心概念、API 与 MCP 集成"
---

## 概述

Anthropic 的 Claude Agent SDK 是一个轻量级 Python 框架，用于构建基于 Claude 模型的 Agent 应用。它的设计哲学是**最小抽象，最大控制**——只提供 Agent 循环、工具调用和 Agent 间切换（handoff）三个核心原语，其余交给开发者自己实现。

SDK 的核心理念可以用一句话概括：**Agent = Model + Instructions + Tools**。

## 核心 API

### 1. Agent Loop（代理循环）

Agent Loop 是 SDK 的核心执行引擎。它实现了一个标准的 Agentic Loop：

1. 将用户消息发送给 Claude
2. Claude 返回文本响应或 Tool Use 请求
3. 如果是 Tool Use，SDK 自动执行工具并将结果返回给 Claude
4. 重复步骤 2-3，直到 Claude 返回最终文本响应

```python
import anthropic
from anthropic.types import ToolResult

client = anthropic.Anthropic()

# 定义工具
tools = [
    {
        "name": "get_weather",
        "description": "获取指定城市的天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称"}
            },
            "required": ["city"]
        }
    }
]

def run_agent(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            tools=tools,
            messages=messages,
        )

        # 检查是否有工具调用
        if response.stop_reason == "tool_use":
            tool_calls = [b for b in response.content if b.type == "tool_use"]
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []
            for tc in tool_calls:
                result = execute_tool(tc.name, tc.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc.id,
                    "content": result,
                })
            messages.append({"role": "user", "content": tool_results})
        else:
            # 最终响应
            return response.content[0].text
```

### 2. Tool Use（工具调用）

Claude 的 Tool Use 遵循 JSON Schema 定义。每个工具需要 `name`、`description` 和 `input_schema`。Claude 会根据工具描述自主决定是否调用以及传入什么参数。

关键设计原则：
- **描述要精确**：Claude 依赖描述来判断何时使用工具
- **参数校验**：通过 JSON Schema 的 `required` 和类型约束确保输入合法
- **错误处理**：工具执行失败时返回 `is_error: true`，让 Claude 决定如何应对

### 3. Handoffs（Agent 切换）

Handoff 允许一个 Agent 将对话控制权转移给另一个 Agent。这是实现多 Agent 系统的核心机制。

```python
# 定义专业 Agent
research_agent = Agent(
    name="researcher",
    instructions="你是一个研究助手，负责查找信息。",
    tools=[search_tool, browse_tool],
)

writing_agent = Agent(
    name="writer",
    instructions="你是一个写作助手，负责撰写内容。",
    tools=[write_tool],
)

# 主 Agent 可以将任务交给专业 Agent
orchestrator = Agent(
    name="orchestrator",
    instructions="根据用户需求，将任务分配给合适的专业 Agent。",
    handoffs=[research_agent, writing_agent],
)
```

## 与 MCP 的集成

Model Context Protocol (MCP) 是 Anthropic 推出的开放协议，用于标准化 LLM 与外部数据源和工具的连接方式。Claude Agent SDK 原生支持 MCP：

```python
from anthropic import Anthropic
from anthropic.mcp import MCPServerStdio

# 连接 MCP Server
server = MCPServerStdio(command="npx", args=["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])

# MCP 工具自动注册为 Agent 可用工具
agent = Agent(
    name="file_agent",
    instructions="你可以读写文件系统。",
    mcp_servers=[server],
)
```

MCP 的优势在于**工具定义与 Agent 解耦**——同一个 MCP Server 可以被任意 Agent 框架使用。

## 优缺点

| 优点 | 缺点 |
|------|------|
| 极简设计，学习成本低 | 仅支持 Claude 模型 |
| 原生 MCP 支持 | 生态不如 LangChain 丰富 |
| 代码透明，易于调试 | 需要自行实现记忆管理等高级功能 |
| Anthropic 官方维护 | 相对较新，社区资源有限 |

## 自测问题

<details>
<summary>1. Claude Agent SDK 的 Agent Loop 在什么条件下会终止循环？</summary>

当 Claude 的响应 `stop_reason` 不是 `tool_use` 时（即返回最终文本响应），循环终止。
</details>

<details>
<summary>2. Handoff 和普通的工具调用有什么区别？</summary>

工具调用执行完后控制权回到当前 Agent；Handoff 则是将整个对话控制权转移给另一个 Agent，由目标 Agent 继续处理后续交互。
</details>

<details>
<summary>3. MCP 解决了什么核心问题？</summary>

MCP 标准化了 LLM 与外部工具/数据源的连接协议，使得工具定义与具体 Agent 框架解耦，一个 MCP Server 可以被任意框架复用。
</details>

## 延伸阅读

- [Anthropic Agent SDK 文档](https://docs.anthropic.com/en/docs/agents-and-tools/agent-sdk)
- [Model Context Protocol 规范](https://modelcontextprotocol.io/)
- [Claude Tool Use 指南](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
