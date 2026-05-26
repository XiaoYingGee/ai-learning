---
title: "多 Agent 系统实战"
description: "搭建 Orchestrator + Worker 模式的多 Agent 系统，含完整 Python 代码"
---

## 架构设计

本文实现一个 **Orchestrator + Worker** 模式的多 Agent 系统：

:::tip[理论回顾：Multi-Agent 设计模式]
Orchestrator-Worker、平行协作、辩论式等多 Agent 架构模式已在 [第二章 Multi-Agent 模式](/02-prompt/04-multi-agent/) 中系统介绍。本章选取最常用的 Orchestrator + Worker 模式，用完整 Python 代码演示从消息传递到任务编排的全过程。
:::

- **Orchestrator（编排器）**：接收用户请求，分解任务，分配给合适的 Worker，汇总结果
- **Worker（工作者）**：专注于特定领域的专业 Agent

我们将构建一个"内容创作团队"：一个编排器 + 三个专业 Worker（研究员、写手、审稿人）。

## 完整实现

### 基础设施：消息与 Agent 基类

```python
from dataclasses import dataclass, field
from typing import Any
from openai import OpenAI
import json

client = OpenAI()

@dataclass
class Message:
    """Agent 间传递的消息"""
    sender: str
    receiver: str
    content: str
    msg_type: str = "text"       # text | task | result
    metadata: dict = field(default_factory=dict)


class BaseAgent:
    """Agent 基类"""

    def __init__(self, name: str, system_prompt: str, model: str = "gpt-4o-mini"):
        self.name = name
        self.system_prompt = system_prompt
        self.model = model
        self.message_history: list[Message] = []

    def receive(self, message: Message):
        """接收消息"""
        self.message_history.append(message)

    def call_llm(self, user_content: str) -> str:
        """调用 LLM"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.7,
        )
        return response.choices[0].message.content

    def process(self) -> Message | None:
        """处理最新消息，返回回复。子类重写此方法。"""
        raise NotImplementedError
```

### Worker Agent 实现

```python
class ResearcherAgent(BaseAgent):
    """研究员 Agent：负责调研和收集信息"""

    def __init__(self):
        super().__init__(
            name="researcher",
            system_prompt=(
                "你是一位资深研究员。收到研究主题后，提供详细的要点、数据和见解。"
                "输出结构化的研究摘要，包含 3-5 个核心要点。"
            ),
        )

    def process(self) -> Message:
        last_msg = self.message_history[-1]
        result = self.call_llm(f"请研究以下主题：\n{last_msg.content}")
        return Message(
            sender=self.name,
            receiver=last_msg.sender,
            content=result,
            msg_type="result",
        )


class WriterAgent(BaseAgent):
    """写手 Agent：负责撰写内容"""

    def __init__(self):
        super().__init__(
            name="writer",
            system_prompt=(
                "你是一位专业写手。根据提供的研究材料撰写文章。"
                "文章要结构清晰、语言流畅、适合目标读者。"
            ),
        )

    def process(self) -> Message:
        last_msg = self.message_history[-1]
        result = self.call_llm(f"请根据以下材料撰写文章：\n{last_msg.content}")
        return Message(
            sender=self.name,
            receiver=last_msg.sender,
            content=result,
            msg_type="result",
        )


class ReviewerAgent(BaseAgent):
    """审稿人 Agent：负责审核和改进"""

    def __init__(self):
        super().__init__(
            name="reviewer",
            system_prompt=(
                "你是一位严格的审稿人。审核文章质量，指出问题并给出改进建议。"
                "评分（1-10），并列出具体修改意见。"
            ),
        )

    def process(self) -> Message:
        last_msg = self.message_history[-1]
        result = self.call_llm(f"请审核以下文章：\n{last_msg.content}")
        return Message(
            sender=self.name,
            receiver=last_msg.sender,
            content=result,
            msg_type="result",
        )
```

### Orchestrator 实现

```python
class OrchestratorAgent(BaseAgent):
    """编排器：分解任务、分配工作、汇总结果"""

    def __init__(self, workers: dict[str, BaseAgent]):
        super().__init__(
            name="orchestrator",
            system_prompt=(
                "你是一个任务编排器。分析用户需求，协调团队完成工作。"
                "你的团队包括：researcher（研究员）、writer（写手）、reviewer（审稿人）。"
            ),
        )
        self.workers = workers

    def dispatch(self, worker_name: str, task_content: str) -> str:
        """向 Worker 分发任务并获取结果
        
        设计要点：Orchestrator 是唯一与 Worker 交互的角色，
        Worker 之间互不感知——这保证了流程清晰且易于调试。
        """
        worker = self.workers[worker_name]
        task_msg = Message(
            sender=self.name,
            receiver=worker_name,
            content=task_content,
            msg_type="task",
        )
        worker.receive(task_msg)
        result_msg = worker.process()
        print(f"\n[{worker_name}] 完成任务")
        return result_msg.content

    def run(self, user_request: str) -> str:
        """执行完整的多 Agent 工作流"""
        print(f"[orchestrator] 收到用户请求: {user_request}")

        # 阶段 1：研究
        print("\n=== 阶段 1: 研究 ===")
        research = self.dispatch("researcher", user_request)

        # 阶段 2：写作（基于研究结果）
        print("\n=== 阶段 2: 写作 ===")
        writing_prompt = (
            f"用户需求: {user_request}\n\n"
            f"研究材料:\n{research}\n\n"
            f"请基于以上材料撰写文章。"
        )
        article = self.dispatch("writer", writing_prompt)

        # 阶段 3：审核
        print("\n=== 阶段 3: 审核 ===")
        review = self.dispatch("reviewer", article)

        # 阶段 4：汇总
        print("\n=== 阶段 4: 汇总 ===")
        summary = self.call_llm(
            f"以下是团队协作的成果，请整理最终输出：\n\n"
            f"文章:\n{article}\n\n"
            f"审核意见:\n{review}\n\n"
            f"请根据审核意见修改文章，输出最终版本。"
        )

        return summary
```

### 运行

```python
def main():
    # 创建 Worker
    workers = {
        "researcher": ResearcherAgent(),
        "writer": WriterAgent(),
        "reviewer": ReviewerAgent(),
    }

    # 创建 Orchestrator
    orchestrator = OrchestratorAgent(workers)

    # 执行
    result = orchestrator.run("写一篇关于 AI Agent 发展趋势的短文，面向技术管理者")
    print(f"\n{'='*50}")
    print(f"最终输出:\n{result}")

if __name__ == "__main__":
    main()
```

## 架构要点

| 设计点 | 说明 |
|--------|------|
| **消息传递** | 通过 Message 对象规范化 Agent 间通信 |
| **单向依赖** | Worker 不知道其他 Worker 的存在，只与 Orchestrator 交互 |
| **顺序编排** | 研究 → 写作 → 审核，每步依赖上一步的输出 |
| **可扩展性** | 新增 Worker 只需继承 BaseAgent，注册到 Orchestrator |

如果需要并行执行 Worker（比如同时让多个研究员调研不同方向），可以用 `asyncio.gather` 改造 `dispatch` 方法。

## 自测问题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：为什么 Worker 之间不直接通信，而是都通过 Orchestrator？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">这是 Orchestrator 模式的核心设计——中心化控制。好处是：流程清晰、易于调试、容易添加全局策略（如超时、重试）。缺点是 Orchestrator 成为单点瓶颈。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：如果审核不通过，如何实现"打回重写"的循环？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">在 Orchestrator 的 run 方法中，解析审核结果的评分。如果评分低于阈值，将审核意见发回给 Writer，让其修改后再次提交审核。设置最大循环次数防止死循环。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：这个系统的 Token 消耗主要在哪些环节？如何优化？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">每个 Agent 调用 LLM 都消耗 Token，尤其是传递完整研究材料和文章时。优化方法：摘要压缩（研究结果先摘要再传给 Writer）、使用更小的模型做审核、缓存重复查询。</div>
  </details>
</div>

## 延伸阅读

- [Multi-Agent Systems 设计模式](https://www.anthropic.com/engineering/building-effective-agents)
- [AutoGen 多 Agent 对话](https://microsoft.github.io/autogen/)
- [CrewAI 团队协作](https://docs.crewai.com/)
