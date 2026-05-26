---
title: "上下文窗口与 KV Cache"
description: "理解 LLM 的上下文窗口限制、KV Cache 加速原理、长文本处理策略，以及 Prompt Caching 机制。"
---

## 什么是上下文窗口？

上下文窗口（Context Window）是 LLM 一次能"看到"的最大 token 数量，包括输入和输出的总和。

类比：上下文窗口就像一张书桌的大小。桌子越大，你能同时摊开的资料越多，理解得越全面。但桌子总有边界——超出的资料就放不下了。

<div style="border:2px solid #60a5fa;border-radius:12px;padding:1rem;margin:1.5rem 0;">
  <div style="text-align:center;font-weight:bold;color:#60a5fa;margin-bottom:.8rem;">上下文窗口（如 128K tokens）</div>
  <div style="display:flex;gap:0;text-align:center;font-size:.85rem;">
    <div style="flex:2;background:#1e3a5f;color:#fff;padding:.6rem;border-radius:8px 0 0 8px;">System Prompt<br/><span style="opacity:.7;">（固定消耗）</span></div>
    <div style="flex:3;background:#2a4a6f;color:#fff;padding:.6rem;">对话历史<br/><span style="opacity:.7;">（累积增长）</span></div>
    <div style="flex:2;background:#365880;color:#fff;padding:.6rem;">当前输入<br/><span style="opacity:.7;">（用户提问）</span></div>
    <div style="flex:2;background:#426690;color:#fff;padding:.6rem;border-radius:0 8px 8px 0;">模型输出<br/><span style="opacity:.7;">（逐步生成）</span></div>
  </div>
  <div style="text-align:center;font-size:.8rem;color:#888;margin-top:.5rem;">← 所有部分的 token 总和不能超过窗口大小 →</div>
</div>

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

在自回归生成中，每生成一个新 token，需要重新计算所有 token 的 Attention。如果序列长度为 $n$，每步的计算量是 $O(n^2)$。

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

KV Cache 将每步计算从 $O(n^2)$ 降低到 $O(n)$，但代价是**显存消耗**。对于 128K 上下文的大模型，KV Cache 可能占用数十 GB 显存。

### KV Cache 的显存估算

:::note[术语：FP16]
FP16（16-bit Floating Point，半精度浮点数）每个数字占 2 字节。相比 FP32（4 字节），FP16 节省一半显存且计算更快，是目前 LLM 推理的主流精度。更激进的还有 INT8（1 字节）和 INT4 量化。
:::

$$
\text{KV Cache 大小} = 2 \times \text{层数} \times \text{头数} \times \text{头维度} \times \text{序列长度} \times \text{精度字节数}
$$

例如 LLaMA 70B（80 层，64 头，128 维，FP16）：

$$
= 2 \times 80 \times 64 \times 128 \times \text{序列长度} \times 2\;\text{bytes} = \text{序列长度} \times 2.6\;\text{MB}
$$

128K 序列 → ~330 GB KV Cache（单请求！）

这就是为什么长上下文模型需要 **GQA（Grouped Query Attention）** 或 **MQA（Multi-Query Attention）** 等压缩技术。

:::note[术语：GQA 与 MQA]
标准 Attention 中每个注意力头都有独立的 K 和 V，显存消耗巨大。MQA（Multi-Query Attention）让所有头共享同一组 K/V；GQA（Grouped Query Attention）则让若干头为一组共享 K/V，在速度和质量之间取得平衡。LLaMA 2/3 使用 GQA。
:::

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

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：KV Cache 为什么能加速推理？它的代价是什么？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      在自回归生成中，每生成一个新 token 都需要与所有历史 token 做 Attention 计算。KV Cache 将已计算的 Key 和 Value 矩阵缓存在显存中，新 token 只需计算自己的 K/V 并追加到缓存，避免了对所有历史 token 的重复计算，将每步复杂度从 $O(n^2)$ 降到 $O(n)$。<br/><br/>
      代价是显存消耗：以 LLaMA 70B 为例，128K 序列的 KV Cache 需要约 330GB 显存（单个请求）。这也是为什么需要 GQA/MQA 等技术来压缩 KV Cache 的大小，以及为什么长上下文推理通常需要多张 GPU。
    </div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：RAG 相比直接加大上下文窗口有什么优势？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      RAG 有四个核心优势：1) <strong>成本低</strong>：只检索最相关的几个片段放入上下文，而非把全部文档塞进去，大幅减少 token 消耗；2) <strong>知识可更新</strong>：向量数据库可以随时增删文档，无需重新训练模型；3) <strong>准确性</strong>：避免"Lost in the Middle"问题——研究表明模型对上下文中间部分的关注度显著低于首尾；4) <strong>可扩展</strong>：理论上可处理任意规模的知识库。<br/><br/>
      打个比方：加大上下文窗口就像把整个图书馆的书都搬到桌子上；RAG 则是先在图书馆检索目录，只把需要的几本拿过来翻阅，更高效也更精准。
    </div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：Prompt Caching 的最佳实践是什么？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      核心原则是<strong>把不变的长内容放在消息序列的开头，变化的用户输入放在末尾</strong>。这样不变的部分（System Prompt、参考文档、Few-shot 示例）在多次请求间可以命中缓存，只对新增的用户输入全价计算。Anthropic 的 Prompt Caching 可节省 90% 的费用并显著降低首 token 延迟。<br/><br/>
      需要注意：缓存有最小长度要求（Anthropic 要求至少 1024 tokens），且缓存前缀必须完全一致——哪怕改了一个字符，缓存就会失效。因此应避免在 System Prompt 中嵌入时间戳等动态内容。
    </div>
  </details>
</div>

## 延伸阅读

- [Lost in the Middle (论文)](https://arxiv.org/abs/2307.03172)
- [Anthropic Prompt Caching 文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [GQA: Training Generalized Multi-Query Transformer](https://arxiv.org/abs/2305.13245)
