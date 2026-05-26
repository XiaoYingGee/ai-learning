---
title: "LangChain & LangGraph"
description: "LangChain 核心概念与 LangGraph 有向图编排模式详解"
---

:::tip[与其他章节的关联]
- LangChain 的 Chain 和 Agent 概念直接对应 [ch02 Agent 模式](/02-agent-basics/02-agent-patterns/) 中的 ReAct 等模式
- LangChain 的 Tool 抽象与 [ch03 工具调用](/03-tools-mcp/01-tool-calling/) 中的 Tool Use 机制一致
- LangChain 内置了完整的 RAG 支持，包括 [ch04 中介绍的分块、检索、Re-ranking](/04-rag/02-rag-basics/) 等能力
- LangGraph 的有向图模式可以实现 [ch04-05 Agentic RAG](/04-rag/05-agentic-rag/) 中的路由式和迭代式 RAG
:::

## LangChain 是什么

LangChain 是最早也最流行的 LLM 应用开发框架之一。它的核心理念是**将 LLM 调用与外部工具、数据源、记忆系统组合成可复用的"链"**。

### 四大核心概念

**1. Chain（链）**

Chain 是 LangChain 最基础的抽象——将多个步骤串联成一条处理管线。例如：用户输入 → Prompt 模板 → LLM 调用 → 输出解析。

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_template("用一句话解释什么是 {concept}")
llm = ChatOpenAI(model="gpt-4o-mini")
chain = prompt | llm | StrOutputParser()

result = chain.invoke({"concept": "Transformer"})
print(result)
```

LangChain 使用 `|` 运算符（LCEL 语法）将组件串联，非常直观。

:::note[术语：LCEL (LangChain Expression Language)]
LCEL 是 LangChain 的声明式组合语法，使用 Python 的 `|` 运算符将 Prompt、LLM、Parser 等组件串联成管线。它支持自动流式输出、异步执行和批处理，是 LangChain v0.2+ 推荐的组合方式，取代了早期的 `LLMChain` 等显式 Chain 类。
:::

**2. Agent（代理）**

Agent 让 LLM 根据用户请求自主决定使用哪些工具、以什么顺序调用。LangChain 内置了 ReAct、OpenAI Functions 等多种 Agent 类型。

**3. Tool（工具）**

Tool 是 Agent 可以调用的外部能力，比如搜索引擎、计算器、数据库查询等。每个 Tool 需要提供名称、描述和执行函数。

```python
from langchain_core.tools import tool

@tool
def search_weather(city: str) -> str:
    """查询指定城市的天气"""
    return f"{city}今天晴，气温 25°C"
```

**4. Memory（记忆）**

Memory 组件让对话具有上下文记忆能力。常见实现包括 `ConversationBufferMemory`（保存全部对话）和 `ConversationSummaryMemory`（保存摘要）。

## LangGraph 有向图模式

LangGraph 是 LangChain 团队推出的**图编排框架**，专门解决复杂 Agent 工作流的问题。与线性 Chain 不同，LangGraph 使用**有向图（Directed Graph）** 来编排 Agent 的执行流程。

### 三大核心概念

| 概念 | 说明 |
|------|------|
| **Node（节点）** | 图中的每个处理步骤，通常是一个函数 |
| **Edge（边）** | 连接节点的路径，决定执行顺序 |
| **State（状态）** | 在节点之间传递的共享数据对象 |

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    next_action: str

def think(state: AgentState) -> AgentState:
    # LLM 推理，决定下一步
    state["next_action"] = "use_tool"
    return state

def use_tool(state: AgentState) -> AgentState:
    # 执行工具调用
    state["messages"].append("工具执行结果：...")
    return state

def router(state: AgentState) -> str:
    return state["next_action"]

graph = StateGraph(AgentState)
graph.add_node("think", think)
graph.add_node("use_tool", use_tool)
graph.add_edge(START, "think")
graph.add_conditional_edges("think", router, {
    "use_tool": "use_tool",
    "finish": END,
})
graph.add_edge("use_tool", "think")

app = graph.compile()
```

LangGraph 的关键优势在于**条件分支**和**循环**——这正是 ReAct 等 Agent 模式所需要的。

## 适用场景与优缺点

**优点：**
- 生态最丰富，集成了数百种工具和数据源
- LCEL 语法简洁，快速原型开发
- LangGraph 支持复杂工作流（循环、分支、并行）
- 内置 LangSmith 观测平台

:::note[术语：LangSmith]
LangSmith 是 LangChain 团队推出的 LLM 应用可观测性平台，提供 Tracing（追踪每次 LLM 调用链路）、Evaluation（自动化评估）、Dataset 管理和 Prompt Playground 等功能。免费版支持有限调用量，生产环境需付费。
:::

**缺点：**
- 抽象层较厚，调试困难（"黑盒"问题）
- API 变动频繁，版本间不兼容
- 过度抽象可能导致性能开销
- 简单任务用 LangChain 反而增加复杂度

**适用场景：**
- 需要快速原型开发的项目
- 复杂多步骤 Agent 工作流
- 需要丰富第三方集成的场景

## 常见陷阱

- **过度抽象陷阱**：用 LangChain 包装一个简单的 API 调用，结果出错时需要翻阅框架源码才能定位问题。简单任务直接用模型 SDK。
- **版本不兼容**：LangChain API 变动频繁，`langchain` 与 `langchain-core`、`langchain-community` 的版本依赖关系复杂。建议锁定版本并关注 changelog。
- **隐式行为难调试**：LCEL 的 `|` 语法虽然简洁，但中间步骤的输入输出不直观。可用 `RunnablePassthrough` 或 LangSmith 来检查中间数据。

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：LangChain 的 Chain 和 LangGraph 的 Graph 有什么本质区别？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">Chain 是线性管线，数据从头到尾单向流动；Graph 是有向图，支持条件分支和循环，能表达更复杂的控制流。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：LangGraph 的 State 在整个图执行过程中扮演什么角色？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">State 是所有节点之间共享的数据载体。每个节点读取 State、执行操作、更新 State，然后传递给下一个节点。它相当于整个图的"全局上下文"。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：什么情况下不推荐使用 LangChain？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">当任务很简单（比如单次 LLM 调用）时，直接用 SDK 即可，LangChain 的抽象层反而增加了不必要的复杂度和调试难度。</div>
  </details>
</div>

## 延伸阅读

- [LangChain 官方文档](https://python.langchain.com/docs/)
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [LCEL 概念指南](https://python.langchain.com/docs/concepts/lcel/)
