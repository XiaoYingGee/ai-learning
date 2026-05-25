---
title: "上下文窗口与 KV Cache"
description: "理解 LLM 的上下文窗口限制、KV Cache 加速原理、长文本处理策略，以及 Prompt Caching 机制。"
---

## 什么是上下文窗口？

上下文窗口（Context Window）是 LLM 一次能"看到"的最大 token 数量，包括输入和输出的总和。

类比：上下文窗口就像一张书桌的大小。桌子越大，你能同时摊开的资料越多，理解得越全面。但桌子总有边界——超出的资料就放不下了。

```
┌─────────── 上下文窗口（如 128K tokens）──────────────┐
│                                                      │
│  System Prompt  │  对话历史  │  当前输入  │  模型输出  │
│   (固定消耗)    │  (累积增长)│  (用户提问)│  (逐步生成)│
│                                                      │
└──────────────────────────────────────────────────────┘
       ← 所有部分的 token 总和不能超过窗口大小 →
```

## 主流模型上下文长度对比

| 模型 | 上下文窗口 | 等价约 |
|------|-----------|--------|
| GPT-4o | 128K tokens | ~300 页文档 |
| Claude Sonnet/Opus 4 | 200K tokens | ~500 页文档 |
| Gemini 1.5 Pro | 1M-2M tokens | ~数千页文档 |
| DeepSeek-V3 | 128K tokens | ~300 页文档 |
| Llama 3.1 405B | 128K tokens | ~300 页文档 |

更大的窗口不等于更好——模型在窗口中间区域的关注度往往低于开头和结尾（"Lost in the Middle" 问题）。

## KV Cache 原理与作用

### 问题：重复计算

在自回归生成中，每生成一个新 token，需要重新计算所有 token 的 Attention。如果序列长度为 n，每步的计算量是 O(n²)。

### 解决：缓存 K 和 V

已经生成的 token 的 Key 和 Value 不会改变，只需计算一次并缓存。

```
没有 KV Cache:
Step 1: 计算 [t1] 的 K,V
Step 2: 计算 [t1,t2] 的 K,V        ← t1 重复计算了！
Step 3: 计算 [t1,t2,t3] 的 K,V    ← t1,t2 重复计算了！

有 KV Cache:
Step 1: 计算 t1 的 K,V → 缓存 {K1,V1}
Step 2: 只计算 t2 的 K,V → 缓存 {K1,V1,K2,V2}
Step 3: 只计算 t3 的 K,V → 缓存 {K1,V1,K2,V2,K3,V3}
```

KV Cache 将每步计算从 O(n²) 降低到 O(n)，但代价是**显存消耗**。对于 128K 上下文的大模型，KV Cache 可能占用数十 GB 显存。

### KV Cache 的显存估算

```
KV Cache 大小 = 2 × 层数 × 头数 × 头维度 × 序列长度 × 精度字节数

例如 LLaMA 70B (80层, 64头, 128维, FP16):
= 2 × 80 × 64 × 128 × 序列长度 × 2 bytes
= 序列长度 × 2.6 MB

128K 序列 → ~330 GB KV Cache（单请求！）
```

这就是为什么长上下文模型需要 **GQA（Grouped Query Attention）** 或 **MQA（Multi-Query Attention）** 等压缩技术。

## 长文本处理策略

当内容超出上下文窗口时，有几种应对方法：

### 1. 摘要压缩

```
长文档 → LLM 生成摘要 → 用摘要替代原文放入上下文
优点: 简单直接
缺点: 可能丢失细节
```

### 2. 滑动窗口

```
文档: [段落1] [段落2] [段落3] [段落4] [段落5]

窗口1: [段落1] [段落2] [段落3] → 处理
窗口2: [段落2] [段落3] [段落4] → 处理（有重叠）
窗口3: [段落3] [段落4] [段落5] → 处理

最后合并各窗口的结果
```

### 3. RAG（检索增强生成）

```
全量文档 → 切片 → Embedding → 存入向量数据库
用户提问 → Embedding → 检索最相关的片段
只把相关片段放入上下文 → LLM 生成回答
```

RAG 是目前最实用的长文本方案，将在后续章节详细讲解。

## Prompt Caching 机制

Prompt Caching 是 API 层面的优化，可以大幅降低重复请求的成本和延迟。

### 工作原理

```
第 1 次请求:
[System Prompt (2000 tokens)] + [用户问题 A] → 全价计费

第 2 次请求:
[System Prompt (2000 tokens)] + [用户问题 B]
 ↑ 命中缓存，不重新计算      ↑ 只计算新增部分
 → 缓存 token 按折扣计费（Anthropic: 90% 折扣）
```

### 使用建议

- 将**不变的内容**（System Prompt、文档上下文、Few-shot 示例）放在消息开头
- 将**变化的内容**（用户问题）放在末尾
- 最小缓存长度：Anthropic 要求 ≥1024 tokens，OpenAI 自动缓存

```python
# Anthropic Prompt Caching 示例
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=[{
        "type": "text",
        "text": "你是一个代码审查专家...(很长的 system prompt)",
        "cache_control": {"type": "ephemeral"}  # 标记为可缓存
    }],
    messages=[{"role": "user", "content": "请审查这段代码..."}]
)
# 第二次调用相同 system prompt 时，会命中缓存
```

<details>
<summary>自测题 1：KV Cache 为什么能加速推理？它的代价是什么？</summary>

KV Cache 通过缓存已计算 token 的 Key 和 Value 矩阵，避免每次生成新 token 时重复计算所有历史 token 的 K/V。代价是显存消耗——缓存大小与序列长度、模型层数成正比，长上下文场景下可能需要数百 GB 显存。
</details>

<details>
<summary>自测题 2：RAG 相比直接加大上下文窗口有什么优势？</summary>

1) 成本低：只检索相关片段，不需要把所有内容放入上下文；2) 知识可更新：向量数据库可以随时添加新文档；3) 准确性：避免"Lost in the Middle"问题；4) 可扩展：可处理任意规模的知识库。
</details>

<details>
<summary>自测题 3：Prompt Caching 的最佳实践是什么？</summary>

将不变的长内容（System Prompt、参考文档、Few-shot 示例）放在消息序列的开头，变化的用户输入放在末尾。这样不变部分可以命中缓存，只对新增部分全价计算，可节省 90% 的成本和显著降低延迟。
</details>

## 延伸阅读

- [Lost in the Middle (论文)](https://arxiv.org/abs/2307.03172)
- [Anthropic Prompt Caching 文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [GQA: Training Generalized Multi-Query Transformer](https://arxiv.org/abs/2305.13245)
