---
title: "从零实现 ReAct Agent"
description: "不使用任何框架，用纯 Python 实现一个完整的 ReAct Agent"
---

## 什么是 ReAct

ReAct（Reasoning + Acting）是目前最主流的 Agent 模式。核心思想是让 LLM 交替进行**推理（Thought）** 和**行动（Action）**，直到得出最终答案。

本文将从零实现一个完整的 ReAct Agent，不依赖任何框架，帮你彻底理解 Agent 的内部工作原理。

:::tip[从理论到代码]
ReAct 的理论基础已在 [第二章 Agent 设计模式](/02-agent-patterns/02-react/) 中详细讲解。本章将把那里的"Thought → Action → Observation"循环变成可运行的 Python 代码——如果你对 ReAct 的推理范式还不熟悉，建议先回顾第二章。
:::

## 完整实现

### 第一步：定义工具

```python
import json
import httpx
from typing import Callable

# 工具注册表
TOOLS: dict[str, Callable] = {}

def tool(name: str, description: str, parameters: dict):
    """工具注册装饰器
    
    为什么用装饰器？——让工具定义和实现在同一处，
    避免"注册表"和"实现"两处维护导致不一致。
    """
    def decorator(func):
        # 将元信息附加到函数对象上，方便后续自动生成 Schema
        func.tool_name = name
        func.tool_description = description
        func.tool_parameters = parameters
        TOOLS[name] = func
        return func
    return decorator

@tool(
    name="calculator",
    description="计算数学表达式，例如 '2 + 3 * 4'",
    parameters={
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "数学表达式"}
        },
        "required": ["expression"],
    },
)
def calculator(expression: str) -> str:
    try:
        # 注意：生产环境不要用 eval，这里仅作演示
        result = eval(expression)
        return str(result)
    except Exception as e:
        return f"计算错误: {e}"

@tool(
    name="search",
    description="搜索互联网获取信息",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词"}
        },
        "required": ["query"],
    },
)
def search(query: str) -> str:
    # 模拟搜索结果，实际可替换为真实 API
    mock_results = {
        "北京天气": "北京今天晴，气温 22°C",
        "Python 创始人": "Python 由 Guido van Rossum 于 1991 年创建",
    }
    for key, value in mock_results.items():
        if key in query:
            return value
    return f"未找到关于 '{query}' 的结果"
```

### 第二步：构建 System Prompt

```python
def build_system_prompt() -> str:
    """动态生成包含工具描述的系统提示词"""
    tool_descriptions = []
    for name, func in TOOLS.items():
        tool_descriptions.append({
            "name": name,
            "description": func.tool_description,
            "parameters": func.tool_parameters,
        })

    return f"""你是一个智能助手，可以使用以下工具来帮助回答问题。

可用工具:
{json.dumps(tool_descriptions, ensure_ascii=False, indent=2)}

回复格式要求:
- 如果需要使用工具，返回 JSON: {{"tool": "工具名", "args": {{参数}}}}
- 如果已经有足够信息回答，直接返回最终答案文本（不要包含 JSON）

请一步一步思考，必要时使用工具获取信息。"""
```

### 第三步：实现 Agent 循环

这是核心部分——ReAct 的推理-行动循环。

```python
from openai import OpenAI

client = OpenAI()

def run_react_agent(user_query: str, max_steps: int = 10) -> str:
    """
    运行 ReAct Agent

    Args:
        user_query: 用户问题
        max_steps: 最大推理步数（防止死循环）

    Returns:
        最终回答
    """
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": user_query},
    ]

    # 核心循环：每一轮 = 一次 LLM 推理 + 可能的一次工具调用
    # 当 LLM 返回纯文本（不含工具调用 JSON）时，循环结束
    for step in range(max_steps):
        print(f"\n--- 步骤 {step + 1} ---")

        # 调用 LLM
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0,
            )
        except Exception as e:
            print(f"LLM 调用失败: {e}")
            return f"抱歉，处理过程中出现错误: {e}"

        assistant_message = response.choices[0].message.content
        print(f"LLM 输出: {assistant_message}")

        # 尝试解析工具调用
        tool_call = try_parse_tool_call(assistant_message)

        if tool_call is None:
            # 没有工具调用，这是最终答案
            print(f"\n最终答案: {assistant_message}")
            return assistant_message

        # 执行工具
        tool_name = tool_call["tool"]
        tool_args = tool_call["args"]

        if tool_name not in TOOLS:
            error_msg = f"未知工具: {tool_name}"
            print(error_msg)
            messages.append({"role": "assistant", "content": assistant_message})
            messages.append({"role": "user", "content": f"错误: {error_msg}，请重试。"})
            continue

        print(f"调用工具: {tool_name}({tool_args})")
        try:
            result = TOOLS[tool_name](**tool_args)
        except Exception as e:
            result = f"工具执行错误: {e}"

        print(f"工具结果: {result}")

        # 关键：把工具结果以"用户消息"形式追加到历史中
        # 这样 LLM 下一轮就能看到 Observation，继续 ReAct 循环
        messages.append({"role": "assistant", "content": assistant_message})
        messages.append({"role": "user", "content": f"工具 {tool_name} 的执行结果: {result}\n\n请根据这个结果继续推理或给出最终答案。"})

    return "达到最大步数限制，无法完成任务。"


def try_parse_tool_call(text: str) -> dict | None:
    """尝试从 LLM 输出中解析工具调用 JSON"""
    try:
        # 尝试直接解析
        parsed = json.loads(text.strip())
        if "tool" in parsed and "args" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass

    # 尝试从文本中提取 JSON 块
    import re
    json_match = re.search(r'\{[^{}]*"tool"[^{}]*\}', text)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            if "tool" in parsed and "args" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

    return None
```

### 第四步：运行测试

```python
if __name__ == "__main__":
    # 测试 1：需要工具的问题
    answer = run_react_agent("北京今天天气怎么样？")

    # 测试 2：需要多步推理的问题
    answer = run_react_agent("计算 (15 + 27) * 3 等于多少？")

    # 测试 3：不需要工具的问题
    answer = run_react_agent("什么是机器学习？")
```

## 代码解析

整个 Agent 的核心逻辑只有一个 `while` 循环：

1. **发送消息给 LLM**：包含系统提示、用户问题和历史对话
2. **解析 LLM 输出**：判断是工具调用还是最终答案
3. **如果是工具调用**：执行工具，将结果加入对话历史，回到步骤 1
4. **如果是最终答案**：返回给用户
5. **安全阀**：`max_steps` 防止死循环

这就是所有 Agent 框架的核心——无论 LangChain、Claude SDK 还是 OpenAI SDK，底层都是这个循环。

## 自测问题

<div class="card-quiz">
  <details>
    <summary>自测题 1：为什么需要 max_steps 参数？</summary>
    <div class="answer">防止 Agent 陷入死循环。如果 LLM 持续返回工具调用而不给出最终答案，没有上限的话会无限循环下去，浪费 Token 和时间。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：如果工具执行抛出异常，当前实现如何处理？</summary>
    <div class="answer">通过 try/except 捕获异常，将错误信息作为工具结果返回给 LLM，让 LLM 决定如何应对（重试、换方法或向用户说明）。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：这个实现与使用模型原生 Tool Use API 有什么区别？</summary>
    <div class="answer">本实现通过 Prompt 让 LLM 返回 JSON 来模拟工具调用，需要自己解析 JSON；原生 Tool Use API 由模型提供结构化的工具调用输出，解析更可靠，不容易出现格式错误。</div>
  </details>
</div>

## 延伸阅读

- [ReAct 论文](https://arxiv.org/abs/2210.03629)
- [Building Effective Agents - Anthropic](https://www.anthropic.com/engineering/building-effective-agents)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
