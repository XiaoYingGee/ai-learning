---
title: "Tokenization 与 Embedding"
description: "理解文本如何变成模型可处理的数字：Token 化方法（BPE、WordPiece）、Embedding 向量空间，以及它们对 RAG 和 Agent 的重要性。"
---

## 文本到数字：为什么需要 Tokenization？

大语言模型不认识文字，只能处理数字。Tokenization 就是把文本拆分成小单元（Token），再映射为数字 ID 的过程。

```
"我喜欢机器学习" → ["我", "喜欢", "机器", "学习"] → [8821, 35946, 9554, 15206]
```

## Token 化方法

### BPE（Byte Pair Encoding）

GPT 系列使用的方法。核心思想：从单个字符开始，反复合并出现频率最高的相邻字符对。

```
训练过程示意：
初始词表:  [a, b, c, d, ...]
第 1 轮:   合并 (t, h) → th      （因为 "th" 出现最频繁）
第 2 轮:   合并 (th, e) → the     （"the" 出现最频繁）
第 3 轮:   合并 (i, n) → in
...重复直到词表达到目标大小
```

BPE 的优势：能处理任何语言，罕见词自动拆分为子词，不会出现 OOV（Out of Vocabulary）。

### WordPiece

BERT 使用的方法，与 BPE 类似，但合并依据是最大化语言模型的似然度，而非频率。

### SentencePiece

Google 开发的独立分词工具，将整个句子视为原始输入（包括空格），不依赖预分词。支持 BPE 和 Unigram 两种算法。LLaMA 等模型使用此方法。

## Tokenizer 工作流程

```mermaid
flowchart LR
    A["原始文本\n'Hello world'"] --> B["Tokenizer\n['Hello', ' world']"]
    B --> C["Token IDs\n[9906, 1917]"]
    C --> D["Embedding 层\n高维向量"]
```

```python
# 使用 tiktoken（OpenAI 的 tokenizer）
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4")
tokens = enc.encode("Hello, 大语言模型!")
print(tokens)       # [9906, 11, 220, 28947, 99454, 39013, 0]
print(len(tokens))  # 7 个 token

# 解码回文本
text = enc.decode(tokens)
print(text)  # "Hello, 大语言模型!"
```

### Token 计数的重要性

Token 数量直接影响：
- **成本**：API 按 token 计费
- **速度**：token 越多，推理越慢
- **上下文窗口**：输入 + 输出的 token 总和不能超过模型的上下文窗口

经验法则：1 个英文单词 ≈ 1-1.5 个 token；1 个中文字 ≈ 1.5-2 个 token。

## Embedding：从 ID 到语义空间

Token ID 只是一个编号，没有语义信息。Embedding 层将每个 ID 映射为一个高维向量（如 768 维或 4096 维），使得语义相近的词在向量空间中距离更近。

```
向量空间示意（降维到 2D 展示）：

      ↑
  猫  ●              ● 汽车
      ● 狗        ● 卡车
                ● 火车
  鸟  ●
      ──────────────────→
   （动物区域）    （交通工具区域）
```

### 语义相似性计算

```python
import numpy as np

def cosine_similarity(a, b):
    """余弦相似度：衡量两个向量的方向是否一致"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 示例（真实向量维度远高于此）
vec_cat = np.array([0.9, 0.1, 0.8])
vec_dog = np.array([0.85, 0.15, 0.75])
vec_car = np.array([0.1, 0.9, 0.2])

print(cosine_similarity(vec_cat, vec_dog))  # ≈ 0.99（猫和狗很相似）
print(cosine_similarity(vec_cat, vec_car))  # ≈ 0.45（猫和车差异大）
```

## 为什么 Embedding 对 Agent 很重要

Embedding 是 **RAG（检索增强生成）** 的基石：

```mermaid
flowchart TD
    Q["用户问题: '如何部署 Kubernetes？'"] --> Emb["Embedding 模型将问题转为向量"]
    Emb --> Search["在向量数据库中检索最相似的文档"]
    Search --> Docs["找到相关文档作为上下文"]
    Docs --> LLM["LLM 基于检索到的内容生成回答"]
```

Agent 利用 Embedding 实现：
1. **知识检索**：从海量文档中快速找到相关信息
2. **记忆管理**：将历史对话编码存储，按语义检索
3. **工具选择**：将工具描述编码，根据任务语义匹配最合适的工具

常用 Embedding 模型：OpenAI `text-embedding-3-small`、`BAAI/bge-m3`、`Cohere embed-v3`。

<details>
<summary>自测题 1：为什么 BPE 不会遇到 OOV 问题？</summary>

BPE 的最小粒度是单个字节（或字符）。即使遇到从未见过的词，也可以把它拆分为更小的已知子词或字符来表示。最极端的情况是把每个字符当作一个 token。
</details>

<details>
<summary>自测题 2：为什么中文比英文消耗更多 token？</summary>

大多数 LLM 的 tokenizer 以英文语料为主训练，英文常见词被合并为单个 token。而中文字符在训练语料中出现频率相对较低，往往需要多个 token 来表示一个汉字（尤其是 UTF-8 编码下一个汉字占 3 个字节）。
</details>

<details>
<summary>自测题 3：Embedding 向量的维度越高越好吗？</summary>

不一定。更高维度可以表达更丰富的语义信息，但也带来更大的存储和计算开销。实际中需要在表达能力和效率之间权衡。OpenAI 的 text-embedding-3 系列支持通过 `dimensions` 参数动态调整维度。
</details>

## 延伸阅读

- [Byte Pair Encoding — Hugging Face NLP Course](https://huggingface.co/learn/nlp-course/chapter6/5)
- [OpenAI Tokenizer 可视化工具](https://platform.openai.com/tokenizer)
- [Massive Text Embedding Benchmark (MTEB)](https://huggingface.co/spaces/mteb/leaderboard)
