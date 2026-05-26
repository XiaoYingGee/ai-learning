---
title: "成本控制"
description: "Token 计算监控、Prompt Caching、模型路由、批处理与成本预算"
---

## LLM 成本结构

LLM API 按 Token 收费：

:::tip[基础回顾：Token 与上下文窗口]
Token 的定义、计算方式和上下文窗口的概念已在 [第一章 LLM 基础](/01-fundamentals/01-token-context/) 中讲解。本章关注的是：当你理解了 Token 的计费逻辑后，如何在生产环境中系统性地控制成本。
:::

$$
\text{成本} = \text{输入 Token 数} \times \text{输入单价} + \text{输出 Token 数} \times \text{输出单价}
$$

Agent 场景下成本特别容易失控，因为：
- 每轮工具调用都需要一次 LLM 调用
- 对话历史越长，每次调用的输入 Token 越多
- 多 Agent 系统中成本成倍增长

## Token 计算与监控

```python
import tiktoken

class TokenTracker:
    """Token 用量追踪器"""

    def __init__(self, model: str = "gpt-4o"):
        self.encoder = tiktoken.encoding_for_model(model)
        self.total_input = 0
        self.total_output = 0
        self.call_count = 0
        # 价格（每百万 Token，美元）
        self.prices = {
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
        }
        self.model = model

    def record(self, input_tokens: int, output_tokens: int):
        self.total_input += input_tokens
        self.total_output += output_tokens
        self.call_count += 1

    @property
    def estimated_cost(self) -> float:
        prices = self.prices.get(self.model, {"input": 5.0, "output": 15.0})
        return (
            self.total_input * prices["input"] / 1_000_000
            + self.total_output * prices["output"] / 1_000_000
        )

    def report(self) -> str:
        return (
            f"调用次数: {self.call_count}\n"
            f"输入 Token: {self.total_input:,}\n"
            f"输出 Token: {self.total_output:,}\n"
            f"预估成本: ${self.estimated_cost:.4f}"
        )
```

## Prompt Caching

Prompt Caching 是降低成本最有效的手段之一。当多次请求共享相同的 Prompt 前缀时，缓存命中的部分不再重复计费。

**Anthropic Prompt Caching：**

```python
import anthropic

client = anthropic.Anthropic()

# 将系统提示标记为可缓存
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "你是一个专业的数据分析师...(很长的系统提示)...",
            "cache_control": {"type": "ephemeral"},  # 标记缓存
        }
    ],
    messages=[{"role": "user", "content": "分析这组数据"}],
)

# 查看缓存效果
print(f"缓存写入 Token: {response.usage.cache_creation_input_tokens}")
print(f"缓存命中 Token: {response.usage.cache_read_input_tokens}")
```

缓存命中时，输入价格降低 **90%**（Anthropic）。对于 Agent 场景，System Prompt 和工具定义在每轮对话中都是相同的，非常适合缓存。

**OpenAI 自动缓存：**

OpenAI 对超过 1024 Token 的相同 Prompt 前缀自动启用缓存，缓存命中价格降低 50%。无需手动标记。

## 模型路由

不是所有任务都需要最强大的模型。按任务复杂度路由到不同模型可以大幅降低成本。

```python
class ModelRouter:
    """按任务复杂度选择模型"""

    ROUTING_RULES = {
        "simple": "gpt-4o-mini",       # 简单问答、格式化
        "moderate": "gpt-4o",           # 一般推理、摘要
        "complex": "claude-sonnet-4-20250514",  # 复杂推理、代码生成
    }

    def classify_complexity(self, task: str) -> str:
        # 简单启发式规则
        if len(task) < 100 and "?" in task:
            return "simple"
        if any(kw in task for kw in ["分析", "推理", "代码", "设计"]):
            return "complex"
        return "moderate"

    def route(self, task: str) -> str:
        complexity = self.classify_complexity(task)
        model = self.ROUTING_RULES[complexity]
        print(f"任务复杂度: {complexity} → 模型: {model}")
        return model
```

生产环境中，可以用一个小模型（如 gpt-4o-mini）做路由分类，成本极低。

## 批处理 API

对于非实时任务，使用 Batch API 可以获得 **50%** 的成本折扣（OpenAI）。

```python
# 构造批量请求
import jsonl

requests = [
    {
        "custom_id": f"task-{i}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": f"总结文档 {i}"}],
        },
    }
    for i in range(1000)
]

# 提交批处理任务（24小时内完成）
batch = client.batches.create(
    input_file_id=uploaded_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
)
```

适用场景：批量文档处理、离线评测、数据标注。

## 成本预算与告警

```python
class BudgetGuard:
    """成本预算守卫"""

    def __init__(self, daily_budget: float = 10.0, alert_threshold: float = 0.8):
        self.daily_budget = daily_budget
        self.alert_threshold = alert_threshold
        self.tracker = TokenTracker()

    def check(self) -> bool:
        cost = self.tracker.estimated_cost
        if cost >= self.daily_budget:
            print(f"[预算] 已达上限 ${self.daily_budget}，停止调用")
            return False
        if cost >= self.daily_budget * self.alert_threshold:
            print(f"[告警] 已用 ${cost:.2f}/{self.daily_budget}，接近预算上限")
        return True
```

## 成本优化清单

| 策略 | 预期节省 | 实施难度 |
|------|---------|---------|
| Prompt Caching | 50-90% | 低 |
| 模型路由 | 30-60% | 中 |
| 批处理 API | 50% | 低 |
| 精简 Prompt | 10-30% | 低 |
| 对话历史压缩 | 20-40% | 中 |

## 自测问题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：为什么 Agent 场景的 LLM 成本特别容易失控？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">因为 Agent 的每轮工具调用都需要一次 LLM 调用，而且每次调用都要携带完整的对话历史（包括之前所有的工具调用和结果），导致输入 Token 数随循环次数线性增长。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：Prompt Caching 对 Agent 特别有效的原因是什么？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">Agent 的每轮 LLM 调用中，System Prompt 和工具定义是完全相同的，这部分通常很长且占输入 Token 的大头。缓存命中后这部分几乎免费。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：模型路由的分类器应该用什么级别的模型？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">应该用最便宜的模型（如 gpt-4o-mini），因为任务分类本身是一个简单任务。如果分类器的成本接近直接用大模型的成本，路由就失去了意义。</div>
  </details>
</div>

## 延伸阅读

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch)
- [LLM 成本优化实战](https://www.latent.space/p/ai-engineer-economics)
