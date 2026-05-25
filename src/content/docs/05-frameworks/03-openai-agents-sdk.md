---
title: "OpenAI Agents SDK"
description: "OpenAI Agents SDK 核心概念：Agent, Handoff, Guardrail, Tracing 与 Runner 执行模型"
---

## 概述

OpenAI Agents SDK（原 Swarm 的正式演进版）是 OpenAI 推出的轻量级多 Agent 编排框架。它的设计理念与 Claude Agent SDK 类似——**尽可能少的抽象，尽可能多的控制**。

SDK 围绕四个核心原语构建：**Agent、Handoff、Guardrail、Tracing**。

## 核心概念

### 1. Agent

Agent 是 SDK 的基本单元，本质上是一个配置了 instructions 和 tools 的 LLM 调用包装器。

```python
from agents import Agent, Runner, function_tool

@function_tool
def get_stock_price(symbol: str) -> str:
    """获取股票价格"""
    # 实际实现中调用股票 API
    return f"{symbol} 当前价格: $150.00"

stock_agent = Agent(
    name="股票助手",
    instructions="你是一个股票分析助手。用户问股票相关问题时，调用工具获取数据。",
    tools=[get_stock_price],
    model="gpt-4o",
)
```

### 2. Handoff（交接）

Handoff 允许 Agent 将控制权转移给另一个 Agent。与 Claude Agent SDK 的 Handoff 概念一致——当一个 Agent 发现当前任务超出自己的能力范围时，可以转交给更合适的 Agent。

```python
chinese_agent = Agent(
    name="中文客服",
    instructions="你负责用中文回答客户问题。",
    tools=[search_faq],
)

english_agent = Agent(
    name="English Support",
    instructions="You handle English customer inquiries.",
    tools=[search_faq],
)

triage_agent = Agent(
    name="路由 Agent",
    instructions="根据用户语言选择合适的客服 Agent。",
    handoffs=[chinese_agent, english_agent],
)
```

### 3. Guardrail（护栏）

Guardrail 是 SDK 内置的安全机制，分为**输入护栏**和**输出护栏**：

```python
from agents import Agent, InputGuardrail, GuardrailFunctionOutput

async def check_malicious_input(ctx, agent, input_text) -> GuardrailFunctionOutput:
    """检查用户输入是否包含恶意内容"""
    result = await Runner.run(
        malicious_detector_agent,
        input_text,
    )
    is_malicious = result.final_output.lower().startswith("yes")
    return GuardrailFunctionOutput(
        output_info={"reason": result.final_output},
        tripwire_triggered=is_malicious,  # True 时中断执行
    )

safe_agent = Agent(
    name="安全助手",
    instructions="正常回答用户问题。",
    input_guardrails=[
        InputGuardrail(guardrail_function=check_malicious_input),
    ],
)
```

当 `tripwire_triggered=True` 时，SDK 会抛出异常并中断 Agent 执行。

### 4. Tracing（追踪）

SDK 内置了完整的 Tracing 系统，自动记录每次 Agent 运行的完整轨迹：

- LLM 调用（输入/输出/Token 用量）
- 工具执行（参数/结果/耗时）
- Handoff 事件
- Guardrail 检查结果

Tracing 数据可以导出到 OpenAI Dashboard 或自定义后端进行分析。

## Runner 执行模型

Runner 是 SDK 的执行引擎，负责驱动 Agent Loop。它提供三种运行模式：

```python
from agents import Runner

# 模式 1: 同步运行（阻塞直到完成）
result = Runner.run_sync(stock_agent, "AAPL 今天股价多少？")
print(result.final_output)

# 模式 2: 异步运行
result = await Runner.run(stock_agent, "AAPL 今天股价多少？")
print(result.final_output)

# 模式 3: 流式运行（实时获取中间结果）
async for event in Runner.run_streamed(stock_agent, "AAPL 今天股价多少？"):
    if event.type == "agent_message":
        print(event.data)
```

Runner 的内部循环：

1. 调用当前 Agent 的 LLM
2. 如果 LLM 返回工具调用 → 执行工具 → 回到步骤 1
3. 如果 LLM 返回 Handoff → 切换到目标 Agent → 回到步骤 1
4. 如果 LLM 返回最终响应 → 结束循环

## 与其他框架的对比

| 特性 | OpenAI Agents SDK | Claude Agent SDK | LangChain |
|------|------------------|-----------------|-----------|
| 模型支持 | OpenAI 为主 | Claude 专属 | 多模型 |
| 抽象层级 | 低 | 低 | 高 |
| 内置 Guardrail | 有 | 无（需自行实现） | 无 |
| 内置 Tracing | 有 | 无 | 需 LangSmith |
| 多 Agent Handoff | 原生支持 | 原生支持 | 通过 LangGraph |

## 自测问题

<details>
<summary>1. Guardrail 的 tripwire_triggered 设为 True 时会发生什么？</summary>

SDK 会立即中断 Agent 的执行流程并抛出异常，阻止潜在的不安全操作继续执行。
</details>

<details>
<summary>2. Runner 的三种运行模式分别适用于什么场景？</summary>

`run_sync` 适合脚本和简单场景；`run` 适合异步 Web 服务；`run_streamed` 适合需要实时展示中间结果的聊天界面。
</details>

<details>
<summary>3. Agent 的 Handoff 和直接调用另一个 Agent 的工具有什么区别？</summary>

Handoff 是控制权的完全转移，目标 Agent 接管后续所有交互；而调用工具只是临时借用能力，控制权仍在当前 Agent。
</details>

## 延伸阅读

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/)
- [OpenAI Agents SDK GitHub](https://github.com/openai/openai-agents-python)
- [从 Swarm 到 Agents SDK 的演进](https://openai.com/index/new-tools-for-building-agents/)
