---
title: "核心论文"
description: "AI Agent 领域必读论文列表，附 arXiv 链接和一句话摘要"
---

## Transformer 基础

### Attention Is All You Need

**作者：** Vaswani et al. (Google, 2017)

**链接：** https://arxiv.org/abs/1706.03762

**一句话摘要：** 提出 Transformer 架构，用 Self-Attention 替代 RNN/CNN，成为现代 LLM 的基础。

**为什么重要：** 这是一切的起点。理解 Transformer 是理解 LLM 和 Agent 的前提。

---

## Agent 推理与规划

### ReAct: Synergizing Reasoning and Acting in Language Models

**作者：** Yao et al. (Princeton, 2023)

**链接：** https://arxiv.org/abs/2210.03629

**一句话摘要：** 将推理（Reasoning）和行动（Acting）交替进行，让 LLM 能够边想边做，通过观察结果调整策略。

**为什么重要：** ReAct 是最广泛使用的 Agent 模式，几乎所有 Agent 框架都实现了这个模式。面试必考。

---

### Reflexion: Language Agents with Verbal Reinforcement Learning

**作者：** Shinn et al. (Northeastern, 2023)

**链接：** https://arxiv.org/abs/2303.11366

**一句话摘要：** 让 Agent 通过语言化的自我反思来从失败中学习，无需更新模型权重就能改进行为。

**为什么重要：** 展示了 Agent 自我改进的可行方案，是理解 Reflection 模式的核心论文。

---

### Tree of Thoughts: Deliberate Problem Solving with Large Language Models

**作者：** Yao et al. (Princeton, 2023)

**链接：** https://arxiv.org/abs/2305.10601

**一句话摘要：** 将 LLM 的推理从线性链式思维扩展到树状搜索，允许探索多个推理路径并回溯。

**为什么重要：** 展示了结构化搜索如何增强 LLM 的规划能力，对复杂推理任务有显著提升。

---

## Tool Use

### Toolformer: Language Models Can Teach Themselves to Use Tools

**作者：** Schick et al. (Meta, 2023)

**链接：** https://arxiv.org/abs/2302.04761

**一句话摘要：** 训练 LLM 自主学会何时以及如何调用外部工具（计算器、搜索引擎等），无需人工标注。

**为什么重要：** 奠定了 LLM Tool Use 的理论基础，启发了后续 Function Calling 的设计。

---

### Gorilla: Large Language Model Connected with Massive APIs

**作者：** Patil et al. (UC Berkeley, 2023)

**链接：** https://arxiv.org/abs/2305.15334

**一句话摘要：** 训练 LLM 准确调用超过 1600 个 API，通过检索增强显著降低 API 调用的幻觉率。

**为什么重要：** 展示了 LLM 大规模 API 调用的可行性，对理解 Tool Use 的工程化落地有价值。

---

### HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face

**作者：** Shen et al. (Microsoft, Zhejiang University, 2023)

**链接：** https://arxiv.org/abs/2303.17580

**一句话摘要：** 用 LLM 作为控制器，协调 Hugging Face 上的多个专业 AI 模型来完成复杂任务。

**为什么重要：** Multi-Agent / 多模型协作的早期探索，展示了 LLM 作为 Orchestrator 的潜力。

---

## 优化与评估

### DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines

**作者：** Khattab et al. (Stanford, 2023)

**链接：** https://arxiv.org/abs/2310.03714

**一句话摘要：** 用声明式编程范式替代手写 Prompt，通过自动优化器编译出高质量的 LLM 调用管道。

**为什么重要：** 提出了 Prompt 工程的替代方案，展示了程序化优化 LLM 行为的新范式。面试中的加分项。

---

### RAGAS: Automated Evaluation of Retrieval Augmented Generation

**作者：** Es et al. (2023)

**链接：** https://arxiv.org/abs/2309.15217

**一句话摘要：** 提出 RAG 系统的自动化评估框架，包含 Faithfulness、Answer Relevancy、Context Precision 等指标。

**为什么重要：** RAG 评估是面试热门话题。RAGAS 提供了实用的评估方法论和工具。

---

## 安全与对齐

### Anthropic Responsible Scaling Policy (RSP)

**作者：** Anthropic (2023)

**链接：** https://www.anthropic.com/index/anthropics-responsible-scaling-policy

**一句话摘要：** Anthropic 提出的负责任 AI 扩展政策，定义了 AI 安全等级和对应的安全措施。

**为什么重要：** 理解 AI 安全的政策层面，面试 Anthropic 等公司时的加分知识。

---

## 阅读建议

### 优先级排序

```
必读（面试高频考点）：
├── Attention Is All You Need
├── ReAct
├── Toolformer
└── RAGAS

强烈推荐：
├── Reflexion
├── Tree of Thoughts
├── DSPy
└── Gorilla

有余力时：
├── HuggingGPT
└── Anthropic RSP
```

### 阅读方法

1. **先读 Abstract 和 Introduction** — 理解问题和贡献
2. **看 Figure 1-3** — 通常是方法概述图
3. **读 Method 章节** — 理解核心方法
4. **跳过数学推导** — 面试不会考细节公式
5. **重点看 Experiments** — 理解方法的优劣势
