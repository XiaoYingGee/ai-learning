---
title: "Transformer 架构"
description: "理解 Transformer 的核心组件：Self-Attention、Multi-Head Attention、Position Encoding，以及它为何取代了 RNN/LSTM。"
---

## 为什么需要 Transformer？

在 Transformer 出现之前，处理序列数据（如文本）的主流模型是 RNN 和 LSTM。想象你在读一本书：

- **RNN** 就像一个只能逐字阅读、且记忆力很差的读者——读到第 100 页时，第 1 页的内容已经模糊了。
- **LSTM** 改进了记忆力，但仍然必须一个字一个字地读，无法跳读。
- **Transformer** 则像一个能同时看到整页内容的读者，可以自由地关联任意两个词之间的关系。

2017 年 Google 发表了论文 *"Attention Is All You Need"*，提出了 Transformer 架构，彻底改变了 NLP 领域。

## 整体架构：Encoder-Decoder

```
┌─────────────────────────────────────────────┐
│              Transformer 架构                │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │   Encoder    │    │     Decoder      │   │
│  │              │    │                  │   │
│  │ ┌──────────┐ │    │ ┌──────────────┐ │   │
│  │ │ Self-    │ │    │ │ Masked Self- │ │   │
│  │ │ Attention│ │    │ │ Attention    │ │   │
│  │ └────┬─────┘ │    │ └──────┬───────┘ │   │
│  │      ↓       │    │        ↓         │   │
│  │ ┌──────────┐ │    │ ┌──────────────┐ │   │
│  │ │ Feed-   │ │───→│ │ Cross-       │ │   │
│  │ │ Forward │ │    │ │ Attention    │ │   │
│  │ └──────────┘ │    │ └──────┬───────┘ │   │
│  │   × N 层     │    │        ↓         │   │
│  └──────────────┘    │ ┌──────────────┐ │   │
│                      │ │ Feed-Forward │ │   │
│                      │ └──────────────┘ │   │
│                      │   × N 层         │   │
│                      └──────────────────┘   │
└─────────────────────────────────────────────┘
```

- **Encoder**：将输入文本编码为连续的向量表示。BERT 只用了 Encoder。
- **Decoder**：根据 Encoder 的输出和已生成的内容，逐步生成输出。GPT 系列只用了 Decoder。
- 原始 Transformer（用于翻译）同时使用 Encoder 和 Decoder。

## Self-Attention 机制

Self-Attention 是 Transformer 的灵魂。核心思想：**对于序列中的每个词，计算它与其他所有词的相关性**。

### Q/K/V 矩阵

每个输入词的 Embedding 会被线性变换为三个向量：

- **Query (Q)**：「我在找什么？」
- **Key (K)**：「我能提供什么？」
- **Value (V)**：「我的实际内容是什么？」

类比：图书馆检索系统。你带着一个搜索词（Query），去匹配每本书的标签（Key），匹配度高的书把内容（Value）返回给你。

### 注意力得分计算

$$
\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$

```python
import numpy as np

def self_attention(Q, K, V):
    d_k = K.shape[-1]
    # 1. 计算注意力得分
    scores = Q @ K.T / np.sqrt(d_k)
    # 2. Softmax 归一化为概率分布
    weights = np.exp(scores) / np.exp(scores).sum(axis=-1, keepdims=True)
    # 3. 加权求和 Value
    output = weights @ V
    return output, weights
```

除以 $\sqrt{d_k}$ 是为了防止点积值过大导致 softmax 梯度消失。

## Multi-Head Attention

单个 Attention 只能捕捉一种关联模式。Multi-Head Attention 让模型同时关注不同类型的关系：

```
输入 ──→ [Head 1: 语法关系]  ──┐
     ──→ [Head 2: 语义关系]  ──┼──→ 拼接 ──→ 线性变换 ──→ 输出
     ──→ [Head 3: 指代关系]  ──┘
     ──→ [Head h: ...]       ──┘
```

每个 Head 独立学习不同的 Q/K/V 变换，最后拼接起来。这就像让多个专家各自分析同一段文本，然后综合意见。

## Position Encoding

Transformer 的 Attention 机制本身不包含位置信息——它不知道哪个词在前、哪个词在后。因此需要额外注入位置编码。

原始论文使用**正弦余弦函数**：

$$
\begin{aligned}
PE_{(pos, 2i)}   &= \sin\!\left(\frac{pos}{10000^{2i/d}}\right) \\
PE_{(pos, 2i+1)} &= \cos\!\left(\frac{pos}{10000^{2i/d}}\right)
\end{aligned}
$$

现代模型（如 LLaMA）则使用 **RoPE（旋转位置编码）**，支持更好的长度外推。

## 为什么 Transformer 替代了 RNN/LSTM

| 特性 | RNN/LSTM | Transformer |
|------|----------|------------|
| 并行计算 | 不支持（必须顺序处理） | 完全并行 |
| 长距离依赖 | 困难（梯度消失） | 轻松捕获 |
| 训练速度 | 慢 | 快（可利用 GPU 并行） |
| 可扩展性 | 差 | 优秀（Scaling Law） |

核心优势：**并行化** + **全局注意力** = 更快训练 + 更好效果。

## 面试考点

1. **为什么要除以 $\sqrt{d_k}$？** 防止点积数值过大，使 softmax 梯度更稳定。
2. **Multi-Head 的作用？** 让模型从不同子空间捕捉不同类型的依赖关系。
3. **Decoder 中的 Masked Attention 是什么？** 防止模型在生成时"偷看"未来的 token。
4. **Transformer 的计算复杂度？** Self-Attention 是 $O(n^2 d)$，$n$ 是序列长度。

<details>
<summary>自测题 1：Self-Attention 中 Q、K、V 分别代表什么？为什么需要三个不同的矩阵？</summary>

Q（Query）代表当前 token 的查询意图，K（Key）代表每个 token 的被匹配特征，V（Value）代表实际内容。使用三个不同矩阵可以让模型在不同的线性子空间中分别学习"匹配"和"输出"的表示，增强表达能力。如果 $Q=K=V$，模型的表达能力会大大受限。
</details>

<details>
<summary>自测题 2：Transformer 为什么能并行训练而 RNN 不能？</summary>

RNN 的隐藏状态 $h_t$ 依赖于 $h_{t-1}$，必须按时间步顺序计算。而 Transformer 的 Self-Attention 一次性计算所有位置之间的关系，不存在这种顺序依赖，因此可以完全并行。
</details>

<details>
<summary>自测题 3：如果去掉 Position Encoding，Transformer 会怎样？</summary>

Transformer 会变成一个词袋模型（Bag of Words），无法区分"猫追狗"和"狗追猫"的区别，因为 Attention 本身是排列不变的（permutation invariant）。
</details>

## 延伸阅读

- [Attention Is All You Need (原始论文)](https://arxiv.org/abs/1706.03762)
- [The Illustrated Transformer — Jay Alammar](https://jalammar.github.io/illustrated-transformer/)
- [3Blue1Brown: Attention in Transformers (视频)](https://www.youtube.com/watch?v=eMlx5fFNoYc)
