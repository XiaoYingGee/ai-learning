---
title: "Tool Calling Dispatcher"
description: "设计一个完整的工具调用调度器：注册、校验、并行调用与超时处理"
---

## 为什么需要 Tool Dispatcher

当 Agent 拥有大量工具时，你需要一个**中心化的调度器**来管理工具的注册、参数校验、执行和错误处理。这就是 Tool Dispatcher 的作用。

本文实现一个生产级的 Tool Dispatcher，支持 JSON Schema 注册、参数校验、并行调用和超时处理。

:::tip[理论回顾：Function Calling]
Tool Dispatcher 是 [第三章 Function Calling](/03-tool-use/01-function-calling/) 的工程落地。第三章讲解了模型如何声明和调用工具的协议；本章把协议层之上的**注册、校验、超时、并行**等生产关切全部补齐。
:::

## 完整实现

### 工具注册与 Schema 管理

```python
import json
import asyncio
import time
from typing import Any, Callable, Awaitable
from dataclasses import dataclass, field
from jsonschema import validate, ValidationError

@dataclass
class ToolDefinition:
    """工具定义"""
    name: str
    description: str
    parameters: dict              # JSON Schema
    handler: Callable             # 同步或异步处理函数
    timeout: float = 30.0         # 超时时间（秒）
    is_async: bool = False        # 是否异步

    def to_schema(self) -> dict:
        """转换为 LLM 可用的 JSON Schema 格式"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class ToolDispatcher:
    """工具调用调度器"""

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: dict,
        timeout: float = 30.0,
    ):
        """装饰器：注册工具"""
        def decorator(func):
            is_async = asyncio.iscoroutinefunction(func)
            self._tools[name] = ToolDefinition(
                name=name,
                description=description,
                parameters=parameters,
                handler=func,
                timeout=timeout,
                is_async=is_async,
            )
            return func
        return decorator

    def list_schemas(self) -> list[dict]:
        """返回所有工具的 JSON Schema 列表"""
        return [tool.to_schema() for tool in self._tools.values()]

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)
```

### 参数校验

```python
    def validate_args(self, tool_name: str, args: dict) -> tuple[bool, str]:
        """
        校验工具参数是否符合 JSON Schema

        Returns:
            (is_valid, error_message)
        """
        tool = self._tools.get(tool_name)
        if tool is None:
            return False, f"未知工具: {tool_name}"

        try:
            validate(instance=args, schema=tool.parameters)
            return True, ""
        except ValidationError as e:
            return False, f"参数校验失败: {e.message}"
```

### 单工具执行（含超时处理）

```python
    async def execute(self, tool_name: str, args: dict) -> dict:
        """
        执行单个工具调用

        Returns:
            {"success": bool, "result": Any, "error": str, "duration_ms": int}
        """
        tool = self._tools.get(tool_name)
        if tool is None:
            return {"success": False, "result": None,
                    "error": f"未知工具: {tool_name}", "duration_ms": 0}

        # 参数校验
        is_valid, error = self.validate_args(tool_name, args)
        if not is_valid:
            return {"success": False, "result": None,
                    "error": error, "duration_ms": 0}

        start = time.monotonic()
        try:
            if tool.is_async:
                result = await asyncio.wait_for(
                    tool.handler(**args), timeout=tool.timeout
                )
            else:
                # 为什么同步函数要用 run_in_executor？
                # 因为同步函数会阻塞事件循环，导致同一批并行任务
                # 中的其他工具无法被调度。放到线程池后，事件循环
                # 可以在等待期间继续处理其他协程。
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: tool.handler(**args)),
                    timeout=tool.timeout,
                )
            duration = int((time.monotonic() - start) * 1000)
            return {"success": True, "result": result,
                    "error": "", "duration_ms": duration}

        except asyncio.TimeoutError:
            duration = int((time.monotonic() - start) * 1000)
            return {"success": False, "result": None,
                    "error": f"工具执行超时 ({tool.timeout}s)", "duration_ms": duration}
        except Exception as e:
            duration = int((time.monotonic() - start) * 1000)
            return {"success": False, "result": None,
                    "error": str(e), "duration_ms": duration}
```

### 并行调用

```python
    async def execute_parallel(
        self, calls: list[dict]
    ) -> list[dict]:
        """
        并行执行多个工具调用

        Args:
            calls: [{"tool": "name", "args": {...}}, ...]

        Returns:
            与 calls 顺序对应的结果列表
        """
        tasks = [
            self.execute(call["tool"], call["args"])
            for call in calls
        ]
        return await asyncio.gather(*tasks)
```

### 使用示例

```python
dispatcher = ToolDispatcher()

@dispatcher.register(
    name="get_weather",
    description="获取城市天气",
    parameters={
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "城市名"},
        },
        "required": ["city"],
    },
    timeout=10.0,
)
def get_weather(city: str) -> str:
    return f"{city}: 晴天，25°C"

@dispatcher.register(
    name="translate",
    description="翻译文本",
    parameters={
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "target_lang": {"type": "string"},
        },
        "required": ["text", "target_lang"],
    },
)
async def translate(text: str, target_lang: str) -> str:
    await asyncio.sleep(0.1)  # 模拟 API 调用
    return f"[{target_lang}] {text}"

# 并行调用
async def main():
    results = await dispatcher.execute_parallel([
        {"tool": "get_weather", "args": {"city": "北京"}},
        {"tool": "translate", "args": {"text": "Hello", "target_lang": "zh"}},
    ])
    for r in results:
        print(r)

asyncio.run(main())
```

## 设计要点总结

| 特性 | 实现方式 |
|------|---------|
| **注册** | 装饰器 + JSON Schema |
| **校验** | jsonschema 库自动校验 |
| **超时** | asyncio.wait_for |
| **并行** | asyncio.gather |
| **同步兼容** | run_in_executor 包装 |
| **错误隔离** | 每个工具独立 try/except |

## 自测问题

<div class="card-quiz">
  <details>
    <summary>自测题 1：为什么同步工具需要用 run_in_executor 包装？</summary>
    <div class="answer">因为同步函数会阻塞事件循环（event loop），导致其他并行任务无法执行。run_in_executor 把同步函数放到线程池中运行，不会阻塞事件循环。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：JSON Schema 参数校验发生在什么阶段？</summary>
    <div class="answer">在工具实际执行之前。先校验参数格式是否合法，通过后才调用 handler 函数。这样可以避免将非法参数传入工具造成不可预期的错误。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：如果并行执行 3 个工具，其中 1 个超时了，另外 2 个会受影响吗？</summary>
    <div class="answer">不会。asyncio.gather 中每个任务是独立的，一个超时不影响其他任务的正常完成。每个任务有自己独立的错误处理。</div>
  </details>
</div>

## 延伸阅读

- [JSON Schema 规范](https://json-schema.org/)
- [Python asyncio 文档](https://docs.python.org/3/library/asyncio.html)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
