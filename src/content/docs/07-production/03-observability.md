---
title: "可观测性"
description: "Agent Tracing、日志结构化、关键指标与可观测性方案"
---

## 为什么 Agent 需要可观测性

传统应用的调试可以依赖断点和日志；Agent 的行为由 LLM 驱动，具有**不确定性**——相同输入可能产生不同的执行路径。这使得问题排查极其困难。

### 为什么 LLM 应用的可观测性比传统应用更难

传统 Web 服务的请求-响应链路是确定性的：同一个 API 调用走相同的代码路径，产生可预测的日志。LLM 应用则完全不同：

1. **执行路径不确定**：同一个用户问题，Agent 可能走 3 步完成，也可能走 8 步——你无法提前定义"正常路径"来设告警。
2. **中间状态是自然语言**：传统应用的中间状态是结构化数据（数据库行、JSON），可以精确比较；Agent 的中间状态是 LLM 生成的自然语言文本，需要语义级别的分析。
3. **延迟分布极宽**：传统 API 的 P99 延迟通常是 P50 的 2-5 倍；Agent 的 P99 可能是 P50 的 20 倍以上（因为工具调用次数不同），使传统的延迟告警阈值几乎无效。
4. **错误不一定是异常**：传统应用的错误通常伴随 HTTP 500 或异常堆栈；Agent 可能"成功"返回了一个完全错误的答案，没有任何异常被抛出。

这意味着你不能简单地把传统 APM（Application Performance Monitoring）工具套用到 LLM 应用上——需要专门的 Tracing 和评测体系。

可观测性（Observability）让你能回答：
- Agent 做了哪些决策？为什么？
- 每一步花了多长时间、消耗了多少 Token？
- 哪个工具调用失败了？失败原因是什么？
- 整体成功率和延迟趋势如何？

## Tracing：追踪 Agent 执行轨迹

Tracing 记录 Agent 每次运行的完整执行轨迹，是可观测性的核心。

### 主流 Tracing 工具

:::note[术语：Langfuse]
Langfuse 是一个开源的 LLM 可观测性平台，提供 Tracing、Prompt 管理和评测功能。支持自托管，常作为 LangSmith 的开源替代方案。
:::

:::note[术语：OpenTelemetry]
OpenTelemetry（简称 OTel）是 CNCF 托管的开源可观测性标准，定义了 Traces、Metrics、Logs 的统一采集协议。它不是 LLM 专用工具，但可以通过扩展支持 LLM Tracing。
:::

| 工具 | 特点 | 定价 |
|------|------|------|
| **LangSmith** | LangChain 官方，集成最好 | 付费（有免费额度） |
| **Langfuse** | 开源，可自托管 | 开源免费 / 云版付费 |
| **Braintrust** | 评测 + Tracing 一体 | 付费 |
| **OpenTelemetry** | 通用标准，灵活但需配置 | 开源 |

### 自定义 Tracing 实现

```python
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Span:
    """追踪单元"""
    span_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    start_time: float = 0
    end_time: float = 0
    attributes: dict = field(default_factory=dict)
    children: list["Span"] = field(default_factory=list)

    @property
    def duration_ms(self) -> int:
        return int((self.end_time - self.start_time) * 1000)


class AgentTracer:
    """Agent 追踪器"""

    def __init__(self, trace_id: str | None = None):
        self.trace_id = trace_id or str(uuid.uuid4())[:12]
        self.root_span: Span | None = None
        self._span_stack: list[Span] = []

    def start_span(self, name: str, **attributes) -> Span:
        span = Span(name=name, start_time=time.time(), attributes=attributes)
        if self._span_stack:
            self._span_stack[-1].children.append(span)
        else:
            self.root_span = span
        self._span_stack.append(span)
        return span

    def end_span(self, **attributes):
        span = self._span_stack.pop()
        span.end_time = time.time()
        span.attributes.update(attributes)

    def print_trace(self, span: Span | None = None, indent: int = 0):
        span = span or self.root_span
        if not span:
            return
        prefix = "  " * indent
        print(f"{prefix}[{span.name}] {span.duration_ms}ms {span.attributes}")
        for child in span.children:
            self.print_trace(child, indent + 1)

# 使用示例
tracer = AgentTracer()

tracer.start_span("agent_run", user_query="天气查询")
tracer.start_span("llm_call", model="gpt-4o-mini")
tracer.end_span(input_tokens=150, output_tokens=30)
tracer.start_span("tool_call", tool="get_weather")
tracer.end_span(result="晴天 25°C")
tracer.start_span("llm_call", model="gpt-4o-mini")
tracer.end_span(input_tokens=200, output_tokens=50)
tracer.end_span(status="success")

tracer.print_trace()
# 输出:
# [agent_run] 1250ms {'user_query': '天气查询', 'status': 'success'}
#   [llm_call] 800ms {'model': 'gpt-4o-mini', 'input_tokens': 150, ...}
#   [tool_call] 200ms {'tool': 'get_weather', 'result': '晴天 25°C'}
#   [llm_call] 250ms {'model': 'gpt-4o-mini', 'input_tokens': 200, ...}
```

## 日志结构化

Agent 日志应该是**结构化的 JSON**，而不是自由文本，这样才能方便查询和分析。

```python
import json
import logging
from datetime import datetime

class StructuredLogger:
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.logger = logging.getLogger(agent_name)

    def log(self, event: str, **data):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent": self.agent_name,
            "event": event,
            **data,
        }
        self.logger.info(json.dumps(entry, ensure_ascii=False))

# 使用
log = StructuredLogger("weather_agent")
log.log("tool_call", tool="get_weather", args={"city": "北京"}, duration_ms=150)
log.log("llm_response", model="gpt-4o", tokens={"input": 200, "output": 50})
```

## 关键指标

生产环境中应该监控以下指标：

| 指标 | 说明 | 告警阈值（参考） |
|------|------|----------------|
| **端到端延迟** | 用户发问到收到最终回答 | P95 > 30s |

:::note[术语：P50/P99（百分位延迟）]
P50 表示 50% 的请求在该延迟内完成（即中位数），P95/P99 分别表示 95%/99% 的请求在该延迟内完成。P99 比 P50 更能反映"最差体验"。例如 P50=2s、P99=15s 意味着大多数用户等 2 秒，但 1% 的用户要等 15 秒。
:::
| **每次对话 Token 用量** | 输入 + 输出 Token 总数 | > 10,000 |
| **工具调用成功率** | 成功/总次数 | < 95% |
| **Agent 循环次数** | 每次对话的 LLM 调用次数 | > 10 |
| **最终成功率** | Agent 最终返回有效答案的比例 | < 90% |
| **成本/对话** | 每次对话的美元成本 | > $0.10 |

## 搭建方案

推荐的**最小可行方案**：

1. **Tracing**：Langfuse（开源，可自托管）
2. **日志**：结构化 JSON → 写入文件或 ELK
3. **指标**：Prometheus + Grafana
4. **告警**：基于指标的阈值告警

如果团队已经在用 LangChain，LangSmith 是最简单的选择（一行代码接入）。

## 自测问题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：为什么传统的日志方式不足以调试 Agent？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">Agent 的执行路径是动态的、不确定的。传统日志记录线性的事件序列，无法体现 Agent 决策的分支、循环和嵌套关系。Tracing 的树状结构能完整表达这些关系。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：结构化日志相比自由文本日志有什么优势？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">结构化日志（JSON）可以被程序自动解析、过滤和聚合。比如你可以轻松查询"所有 tool_call 事件中 duration_ms > 1000 的记录"，自由文本日志做不到。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：为什么需要监控"Agent 循环次数"这个指标？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">循环次数反映了 Agent 的效率。如果一个简单问题需要 10+ 次 LLM 调用才能回答，说明 Prompt 设计有问题或 Agent 陷入了低效的推理模式，需要优化。</div>
  </details>
</div>

## 延伸阅读

- [Langfuse 文档](https://langfuse.com/docs)
- [LangSmith 文档](https://docs.smith.langchain.com/)
- [OpenTelemetry 概述](https://opentelemetry.io/docs/)
