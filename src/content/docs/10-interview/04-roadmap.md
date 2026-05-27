---
title: "学习路线图"
description: "6 周 AI Agent 面试冲刺计划，按时间线安排每周学习重点"
---

:::tip[与其他章节的关联]
- 每周的学习内容都对应本指南的具体章节，按路线图顺序即可系统覆盖所有面试考点
- 第 1 周 → [ch01 LLM 基础](/01-llm-fundamentals/01-transformer/)，第 2 周 → [ch02 设计模式](/02-agent-patterns/01-what-is-agent/) + [ch05 Tool Use](/03-tool-use/01-function-calling/) + [ch06 MCP](/03-tool-use/03-mcp/)
- 第 3-4 周 → [ch04 RAG](/04-rag/) + [ch03 记忆](/04-rag/01-memory-system/)，第 5 周 → [ch07 生产化](/07-production/) + [ch08 安全](/08-security/)
- 第 6 周 → [ch09 系统设计](/09-system-design/) + [ch10 面试](/10-interview/)
:::

## 总览

这份路线图按 **6 周** 设计，适合有一定编程基础、准备转型或面试 AI Agent 岗位的工程师。

```
第 1 周：LLM 基础
第 2 周：Agent 设计模式
第 3-4 周：技术栈与编码实战
第 5 周：生产化与安全
第 6 周：系统设计与面试冲刺
```

## 第 1 周：LLM 基础

### 学习目标
- 理解 Transformer 架构和 Self-Attention
- 掌握 Tokenization、Embedding 概念
- 了解推理优化（KV Cache、量化）
- 能解释 Temperature、Top-p 等参数

### 每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | Transformer 论文精读 + 架构图手画 | 3h |
| 2 | Self-Attention 数学推导 + 代码实现 | 3h |
| 3 | Tokenization（BPE、SentencePiece）| 2h |
| 4 | 推理优化：KV Cache、量化、Speculative Decoding | 3h |
| 5 | 生成参数（Temperature、Top-p）+ API 实践 | 2h |
| 6-7 | 复习 + 回答理论题 1-6 | 3h |

### 检验标准
- [ ] 能画出 Transformer 架构图并解释每个组件
- [ ] 能解释 Self-Attention 的计算过程
- [ ] 能说清 KV Cache 的原理和作用

:::note[术语：Speculative Decoding]
**Speculative Decoding（推测解码）** 是一种推理加速技术：用一个小模型快速生成多个候选 token，再用大模型一次性验证这些候选。如果小模型猜对了，就跳过大模型逐 token 生成的开销，在不损失质量的前提下显著加速推理。
:::

:::note[术语：Quantization（量化）]
**量化** 是将模型参数从高精度浮点数（如 FP16）压缩为低精度格式（如 INT8、INT4）的技术。量化可以大幅减少模型的显存占用和推理延迟，代价是微小的精度损失。常见方法包括 GPTQ、AWQ 和 GGUF。
:::

:::tip[第 1 周学习建议]
不要试图完全理解 Transformer 的每个数学细节——面试中更看重你能否清晰地解释直觉和工程意义。建议手画一次完整的架构图，并尝试用 PyTorch 实现一个简化版 Self-Attention，这比反复看论文更有效。
:::

## 第 2 周：Agent 设计模式

### 学习目标
- 掌握 ReAct、Plan-and-Execute、Reflection 模式
- 理解 Multi-Agent 架构
- 了解 Tool Use 和 Function Calling
- 熟悉 MCP 协议

### 每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | ReAct 论文 + 手写 ReAct 循环 | 3h |
| 2 | Plan-and-Execute + 状态机模式 | 3h |
| 3 | Reflection / Reflexion 机制 | 2h |
| 4 | Multi-Agent 架构模式 | 3h |
| 5 | Function Calling 实战 + Tool Schema 设计 | 3h |
| 6 | MCP 协议学习 | 2h |
| 7 | 复习 + 回答理论题 7-15 | 3h |

### 检验标准
- [ ] 能手写 ReAct Agent 代码
- [ ] 能比较各种 Agent 模式的优劣
- [ ] 能设计 Tool Schema

:::tip[第 2 周学习建议]
ReAct 是面试中出现频率最高的模式，务必能手写完整代码。建议用 OpenAI 或 Anthropic 的 API 实际跑一遍 ReAct 循环，体验 Thought-Action-Observation 的交互过程。对比不同模式时，重点理解"什么场景用什么模式"而不是死记区别。
:::

## 第 3-4 周：技术栈与编码实战

### 学习目标
- 掌握至少一个 Agent 框架的使用
- 实现完整的 RAG 系统
- 完成一个端到端的 Agent 项目

### 第 3 周每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | RAG 原理：分块、Embedding、检索 | 3h |
| 2 | 向量数据库实战（Chroma / Qdrant）| 3h |
| 3 | 高级 RAG：Hybrid Search、Reranking | 3h |
| 4 | RAG 评估（RAGAS 框架）| 2h |
| 5-7 | 实现完整 RAG 系统 | 6h |

### 第 4 周每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | LangChain / LangGraph 入门 | 3h |
| 2 | 框架对比实验 | 3h |
| 3-5 | 端到端项目：构建一个多工具 Agent | 8h |
| 6-7 | 代码整理 + 项目文档 + 回答编码题 | 4h |

### 检验标准
- [ ] 能独立实现 RAG 系统
- [ ] 有一个可展示的 Agent 项目
- [ ] 能解释框架选择的理由

:::tip[第 3-4 周学习建议]
这两周是编码实战的核心期，建议产出一个完整的可展示项目。推荐从 RAG 系统入手——它涵盖了 Embedding、向量检索、Prompt 构建等核心概念，且面试中经常被要求现场实现。项目不需要很大，但要能讲清楚每个设计决策的理由。
:::

## 第 5 周：生产化与安全

### 学习目标
- 理解 Agent 系统的可观测性
- 掌握成本控制和延迟优化
- 了解 Prompt Injection 防御
- 掌握 Guardrails 设计

### 每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | 可观测性：Tracing、Metrics、Logging | 3h |
| 2 | 成本优化：缓存、模型分级、Prompt 优化 | 2h |
| 3 | 延迟优化：Streaming、并行、预热 | 2h |
| 4 | Prompt Injection 攻防 | 3h |
| 5 | Guardrails 设计与实现 | 3h |
| 6-7 | 复习 + 回答理论题 21-31 | 3h |

### 检验标准
- [ ] 能设计 Agent 系统的监控方案
- [ ] 能列出至少 5 种 Prompt Injection 攻击方式
- [ ] 能设计 Guardrails 方案

:::tip[第 5 周学习建议]
安全和生产化是区分"会写 demo"和"能上生产"的关键。建议实际动手做一次 Red Teaming 练习——对你第 3-4 周构建的项目尝试 Prompt Injection 攻击，然后实现防御。这个经历本身就是很好的面试故事素材。
:::

## 第 6 周：系统设计与面试冲刺

### 学习目标
- 掌握 Agent 系统设计面试框架
- 练习经典系统设计题
- 完成行为面试准备
- 做模拟面试

### 每日计划

| 天 | 内容 | 时间 |
|----|------|------|
| 1 | 系统设计面试框架 | 2h |
| 2 | 设计题：数据分析 Agent | 3h |
| 3 | 设计题：智能客服系统 | 3h |
| 4 | 设计题：代码审查 Agent | 3h |
| 5 | 行为面试准备（STAR 故事）| 2h |
| 6 | 模拟面试（找朋友或 AI）| 3h |
| 7 | 查漏补缺 | 2h |

### 检验标准
- [ ] 能在 35 分钟内完成一道系统设计题
- [ ] 准备了 3-4 个 STAR 故事
- [ ] 完成至少 1 次模拟面试

:::tip[第 6 周学习建议]
系统设计的关键不是背答案，而是展示你的思考过程。建议用计时器模拟真实面试，练习在 35 分钟内完成需求澄清 -> 架构设计 -> 深入设计 -> 权衡讨论的完整流程。找朋友或用 AI 做模拟面试，录音后回听自己的表达是否清晰。
:::

## 推荐每日学习计划

对于在职准备面试的人，建议每天投入 2-3 小时：

```
工作日：
  早上 30 分钟：阅读理论（通勤时间可以）
  晚上 2 小时：编码实战 / 刷题

周末：
  上午 3 小时：深入学习新主题
  下午 2 小时：项目实战或系统设计练习
```

## 学习资源优先级

```
优先级 1（必须）：
  ├── 本学习指南的全部章节
  ├── 至少 1 个端到端项目
  └── 系统设计题练习

优先级 2（强烈推荐）：
  ├── ReAct、Reflexion、Toolformer 论文
  ├── 一门在线课程（Andrew Ng 系列）
  └── Anthropic / OpenAI 官方文档

优先级 3（有余力时）：
  ├── 大学课程（Berkeley / Stanford）
  ├── 更多论文
  └── 参与开源项目
```

## 面试前一天

- [ ] 回顾所有理论题答案要点
- [ ] 检查你的项目能否清晰讲述
- [ ] 准备好你要问面试官的问题
- [ ] 早点休息
