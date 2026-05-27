---
title: "RAG 基础：检索增强生成"
description: "理解 RAG 的完整流程、Embedding 模型选择、检索方式对比，并动手实现一个最简 RAG"
---

:::tip[与其他章节的关联]
- RAG 的核心依赖 **Embedding** 技术，详见 [ch01 Embedding 与 Tokenization](/01-llm-fundamentals/02-tokenization-embedding/)
- RAG 可以作为 Agent 的工具使用，参见 [ch02 Agent 模式](/02-agent-patterns/01-what-is-agent/)
- 分块策略与向量数据库选型详见 [ch04-03](/04-rag/03-chunking-vectordb/)
:::

## RAG 定义与动机

RAG (Retrieval-Augmented Generation) 是将**信息检索**与**文本生成**结合的技术。

为什么不能只靠 LLM 的参数记忆？

1. **知识过时** —— LLM 的训练数据有截止日期，不知道最新信息
2. **知识缺失** —— 企业内部文档、私有数据不在训练集中
3. **幻觉问题** —— LLM 可能编造看起来合理但错误的答案
4. **引用溯源** —— 无法提供信息来源

RAG 的思路很直观：**先搜索，再回答**。就像学生考开卷考试——允许翻书查资料后再作答，准确率自然比闭卷高。

## RAG 完整流程

```mermaid
flowchart TD
    subgraph Offline["离线阶段（建立知识库）"]
        Doc["原始文档\nPDF/MD"] --> Chunk["分块\nChunking"] --> Emb1["Embedding\n生成向量"] --> VDB["向量数据库\n存储索引"]
    end
    subgraph Online["在线阶段（回答问题）"]
        Query["用户问题"] --> Emb2["Embedding\n生成向量"] --> Search["向量检索\n相似度搜索"] --> TopK["Top-K 文档片段"]
        TopK --> LLM["LLM 基于检索结果\n生成最终回答"]
    end
```

## Embedding 模型选择

Embedding 模型将文本转换为向量（一组数字），语义相似的文本在向量空间中距离更近。关于 Embedding 的原理，参见 [ch01 Embedding 基础](/01-llm-fundamentals/02-tokenization-embedding/)。

| 模型 | 维度 | 特点 | 价格 |
|------|------|------|------|
| OpenAI text-embedding-3-small | 1536 | 性价比高 | $0.02/1M tokens |
| OpenAI text-embedding-3-large | 3072 | 精度最高 | $0.13/1M tokens |
| Cohere embed-v3 | 1024 | 多语言优秀 | 免费额度 |
| BGE-M3 (开源) | 1024 | 免费、多语言 | 免费 |
| nomic-embed-text (开源) | 768 | 轻量、快速 | 免费 |

选择建议：
- **快速原型** → OpenAI text-embedding-3-small
- **多语言场景** → Cohere embed-v3 或 BGE-M3
- **数据敏感/成本敏感** → 本地部署开源模型

## 检索方式

```
┌────────────────────────────────────────────────────┐
│              三种检索方式对比                         │
│                                                    │
│  语义搜索 (Semantic Search)                         │
│  "如何提高睡眠质量" → 匹配 "改善失眠的方法"            │
│  ✅ 理解语义  ❌ 可能忽略关键词                       │
│                                                    │
│  关键词搜索 (BM25)                                  │
│  "Python 3.12 新特性" → 精确匹配包含这些词的文档      │
│  ✅ 精确匹配  ❌ 不懂同义词                          │

│                                                    │
│  混合搜索 (Hybrid)                                  │
│  同时用语义 + 关键词，加权合并结果                     │
│  ✅ 兼顾两者  ❌ 需要调权重                          │
└────────────────────────────────────────────────────┘
```

实际生产环境推荐使用 **Hybrid Search**，兼顾语义理解和精确匹配。

:::note[术语：BM25]
BM25（Best Matching 25）是经典的关键词检索算法，基于词频（TF）和逆文档频率（IDF）计算相关性得分。它不理解语义，但对精确关键词匹配非常有效。在 RAG 中常与向量检索组合使用（Hybrid Search）。
:::

## 代码示例：一个最简 RAG

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

# ========== 离线阶段：构建知识库 ==========

documents = [
    "Python 3.12 引入了类型参数语法（PEP 695），简化了泛型定义。",
    "FastAPI 是一个高性能的 Python Web 框架，基于 Starlette 和 Pydantic。",
    "Docker Compose 可以用 YAML 文件定义多容器应用的服务。",
    "RAG 通过检索外部知识来增强大语言模型的生成能力。",
]

def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding

# 为所有文档生成向量
doc_embeddings = [get_embedding(doc) for doc in documents]

# ========== 在线阶段：检索 + 生成 ==========

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def retrieve(query: str, top_k: int = 2) -> list[str]:
    """检索最相关的文档"""
    query_emb = get_embedding(query)
    similarities = [cosine_similarity(query_emb, doc_emb) for doc_emb in doc_embeddings]
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    return [documents[i] for i in top_indices]

def rag_answer(question: str) -> str:
    """RAG 回答流程"""
    # 1. 检索
    relevant_docs = retrieve(question)
    context = "\n".join(relevant_docs)

    # 2. 生成
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"根据以下参考资料回答问题。如果资料中没有相关信息，请说明。\n\n参考资料：\n{context}"},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content

# 使用
answer = rag_answer("什么是 RAG？")
print(answer)
```

---

## 给初次构建 RAG 的实用建议

1. **先跑通最小闭环**：用上面的代码示例 + 10 篇文档跑通全流程，再逐步扩展。不要一开始就追求完美的分块策略或高级检索。
2. **评估先于优化**：在做任何优化之前，先准备 20-50 个测试问题和标准答案。没有评估数据，你无法判断优化是否有效。
3. **检查检索质量**：90% 的 RAG 问题出在检索环节，而非生成环节。优先打印并检查检索到的文档片段是否相关。
4. **Embedding 模型与分块大小要匹配**：大多数 Embedding 模型对超过 512 Token 的输入效果下降，确保分块不要太长。
5. **System Prompt 要明确**：告诉 LLM「如果参考资料中没有相关信息，请说明你不知道」，避免模型在没有证据时编造答案。

## 常见陷阱

- **忽略 Metadata**：只做向量检索不做过滤，导致检索到过时或不相关类别的文档。参见 [ch04-03 Metadata 过滤](/04-rag/03-chunking-vectordb/)。
- **Embedding 模型混用**：建库时用模型 A，查询时用模型 B，向量空间不一致导致检索失败。
- **分块太小丢上下文**：每块只有一两句话，LLM 拿到后无法理解完整语境。建议至少 300 字符。
- **不处理特殊格式**：PDF 表格、代码块、图片说明等结构化内容直接当纯文本切分，损失大量信息。

<div class="card-quiz">
  <details>
    <summary>自测题 1：RAG 解决了 LLM 的哪些核心问题？</summary>
    <div class="answer">知识过时、知识缺失、幻觉问题、缺乏引用溯源。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：语义搜索和关键词搜索各自的优劣是什么？</summary>
    <div class="answer">语义搜索理解同义词和语义但可能忽略关键词精确匹配；关键词搜索精确但不理解语义。混合搜索兼顾两者。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：RAG 的离线阶段和在线阶段分别做什么？</summary>
    <div class="answer">离线阶段将文档分块、生成 Embedding、存入向量数据库；在线阶段将用户问题生成 Embedding、检索相似文档、将文档作为上下文让 LLM 生成回答。</div>
  </details>
</div>

## 延伸阅读

- [RAG 论文 (Lewis et al., 2020)](https://arxiv.org/abs/2005.11401)
- [LangChain RAG 教程](https://python.langchain.com/docs/tutorials/rag/)
- [OpenAI Embedding 文档](https://platform.openai.com/docs/guides/embeddings)
