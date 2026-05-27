---
title: "可靠性工程"
description: "Agent 死循环检测、重试策略、降级机制与幂等性设计"
---

## 为什么 Agent 可靠性很难

传统软件的执行路径是确定的；Agent 的执行路径由 LLM 决定，本质上是**不确定的**。这带来了一系列可靠性挑战：

- LLM 可能反复调用同一工具（死循环）
- API 调用可能因网络问题失败
- 模型服务可能过载或宕机
- 相同输入不保证相同输出

:::tip[相关章节：Tool Use 的错误处理]
工具调用失败是 Agent 不可靠的主要来源之一。[第三章 Tool Use](/03-tool-use/01-function-calling/) 中介绍了模型如何声明和调用工具——本章在此基础上补充生产环境的重试、降级和幂等策略。
:::

> **实战教训**：一个真实的案例——某团队上线 Agent 后发现，在网络抖动期间 Agent 会连续重试同一个"发送邮件"工具，导致同一封邮件被发送了 17 次。这就是为什么幂等性设计不是"锦上添花"，而是**上线前必做**。

## 死循环检测与终止

Agent 死循环是最常见的可靠性问题。检测策略：

```python
from collections import Counter

class LoopDetector:
    """Agent 死循环检测器"""

    def __init__(self, max_steps: int = 20, max_repeats: int = 3):
        self.max_steps = max_steps
        self.max_repeats = max_repeats
        self.step_count = 0
        self.action_history: list[str] = []

    def record(self, action: str) -> None:
        self.step_count += 1
        self.action_history.append(action)

    def is_looping(self) -> tuple[bool, str]:
        # 检查 1：总步数超限
        if self.step_count >= self.max_steps:
            return True, f"超过最大步数 {self.max_steps}"

        # 检查 2：最近 N 次操作完全相同
        if len(self.action_history) >= self.max_repeats:
            recent = self.action_history[-self.max_repeats:]
            if len(set(recent)) == 1:
                return True, f"连续 {self.max_repeats} 次执行相同操作: {recent[0]}"

        # 检查 3：检测周期性模式（如 A→B→A→B）
        if len(self.action_history) >= 6:
            for period in range(2, 4):
                tail = self.action_history[-period * 2:]
                first_half = tail[:period]
                second_half = tail[period:]
                if first_half == second_half:
                    return True, f"检测到周期模式: {first_half}"

        return False, ""
```

## 重试与指数退避

API 调用失败时，使用指数退避策略（Exponential Backoff）重试：

```python
import time
import random

async def retry_with_backoff(
    func,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    retryable_exceptions: tuple = (Exception,),
):
    """带指数退避的重试"""
    for attempt in range(max_retries + 1):
        try:
            return await func()
        except retryable_exceptions as e:
            if attempt == max_retries:
                raise
            delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
            print(f"重试 {attempt + 1}/{max_retries}，等待 {delay:.1f}s: {e}")
            await asyncio.sleep(delay)
```

关键点：加入**随机抖动（jitter）** 避免多个客户端同时重试导致"惊群效应"。

## 降级策略

当主模型不可用时，自动降级到备选方案：

```python
class ModelCascade:
    """模型级联降级"""

    def __init__(self):
        self.models = [
            {"name": "gpt-4o", "type": "premium"},
            {"name": "gpt-4o-mini", "type": "standard"},
            {"name": "rule_based", "type": "fallback"},
        ]

    async def generate(self, prompt: str) -> tuple[str, str]:
        for model in self.models:
            try:
                if model["type"] == "fallback":
                    return self._rule_based(prompt), model["name"]
                result = await self._call_llm(model["name"], prompt)
                return result, model["name"]
            except Exception as e:
                print(f"{model['name']} 失败: {e}，尝试下一个")
                continue
        raise RuntimeError("所有模型均不可用")

    def _rule_based(self, prompt: str) -> str:
        """最后的兜底：基于规则的回复"""
        return "抱歉，系统暂时繁忙，请稍后再试。"
```

降级链：**大模型 → 小模型 → 规则引擎**。确保任何情况下用户都能得到回复。

## Fallback 机制

除了模型降级，工具层也需要 Fallback：

```python
class ToolWithFallback:
    def __init__(self, primary, fallback, name: str):
        self.primary = primary
        self.fallback = fallback
        self.name = name

    async def execute(self, **kwargs):
        try:
            return await self.primary(**kwargs)
        except Exception as e:
            print(f"[{self.name}] 主工具失败: {e}，使用备用")
            return await self.fallback(**kwargs)
```

## 幂等性设计

Agent 可能因重试导致工具被多次调用。幂等性确保**多次执行与一次执行的效果相同**。

```python
import hashlib

class IdempotentExecutor:
    """幂等执行器"""

    def __init__(self):
        self._results_cache: dict[str, Any] = {}

    def _make_key(self, tool_name: str, args: dict) -> str:
        raw = f"{tool_name}:{json.dumps(args, sort_keys=True)}"
        return hashlib.sha256(raw.encode()).hexdigest()

    async def execute(self, tool_name: str, args: dict, handler) -> Any:
        key = self._make_key(tool_name, args)
        if key in self._results_cache:
            print(f"[幂等] 命中缓存: {tool_name}")
            return self._results_cache[key]
        result = await handler(**args)
        self._results_cache[key] = result
        return result
```

对于有副作用的操作（如发邮件、创建订单），使用 idempotency key 确保不会重复执行。

## 自测问题

<div class="card-quiz">
  <details>
    <summary>自测题 1：指数退避中的 jitter（随机抖动）解决什么问题？</summary>
    <div class="answer">避免惊群效应。如果多个客户端同时遇到错误并以相同的延迟重试，它们会在同一时刻再次涌入服务端。随机抖动让重试时间错开。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：为什么降级策略的最后一层是规则引擎而不是更小的模型？</summary>
    <div class="answer">规则引擎不依赖任何外部 API，是完全自主可控的。即使所有模型服务都宕机，规则引擎仍然可以提供基本的回复，确保系统不会完全无响应。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：哪些工具操作需要幂等性保护？哪些不需要？</summary>
    <div class="answer">有副作用的操作（写数据库、发邮件、转账）需要幂等性保护；只读操作（查询天气、搜索）不需要，因为多次执行不会造成额外影响。</div>
  </details>
</div>

## 延伸阅读

- [Building Reliable LLM Applications](https://www.anthropic.com/engineering/building-effective-agents)
- [AWS 指数退避最佳实践](https://docs.aws.amazon.com/general/latest/gr/api-retries.html)
- [幂等性设计模式](https://stripe.com/docs/api/idempotent_requests)
