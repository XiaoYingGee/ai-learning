---
title: "高级 RAG 技术"
description: "掌握 Query Rewriting、HyDE、Re-ranking、Multi-hop Retrieval、GraphRAG 等进阶检索技术"
---

## 为什么需要高级 RAG

基础 RAG 的流程是「用户问题 → 向量检索 → LLM 生成」。但现实中这个流程有很多不足：

- 用户提问模糊或不完整
- 检索到的文档排序不够精准
- 单次检索无法回答需要综合多个文档的复杂问题

高级 RAG 技术就是在基础流程的各个环节做优化。

```
┌─────────────────────────────────────────────────────┐
│           高级 RAG 优化点                              │
│                                                     │
│  用户问题 ──→ [Query Rewriting / HyDE] ──→ 更好的查询 │
│                                                     │
│  检索结果 ──→ [Re-ranking] ──→ 更精准的排序           │
│                                                     │
│  单次检索 ──→ [Multi-hop] ──→ 多步推理检索            │
│                                                     │
│  非结构化 ──→ [GraphRAG] ──→ 知识图谱增强             │
└─────────────────────────────────────────────────────┘
```

## Query Rewriting（查询改写）

用户的问题往往不适合直接用来检索。Query Rewriting 让 LLM 先优化查询，再去检索。

```python
def rewrite_query(original_query: str) -> list[str]:
    """将用户问题改写为多个检索友好的查询"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": "将用户问题改写为 3 个不同角度的搜索查询，每行一个。"
        }, {
            "role": "user",
            "content": original_query,
        }],
    )
    return response.choices[0].message.content.strip().split("\n")

# 示例
# 原始："为什么我的 RAG 效果不好？"
# 改写：
# 1. "RAG 检索质量低的常见原因"
# 2. "提升 RAG 准确率的方法"
# 3. "RAG pipeline 调优最佳实践"
```

## HyDE（Hypothetical Document Embedding）

核心想法：用户的问题是「问句」，但数据库里存的是「陈述句」。两者语义空间不同，直接匹配效果差。

HyDE 的做法：先让 LLM 生成一个**假设性的回答文档**，用这个文档的向量去检索，效果往往更好。

```
┌────────────────────────────────────────────────┐
│  普通检索：                                      │
│  问题 "什么是 RAG？" ──embedding──→ 检索         │
│  （问句向量 vs 答案向量，语义空间不同）             │
│                                                │
│  HyDE：                                        │
│  问题 ──LLM 生成假设答案──→ "RAG 是一种将检索    │
│  与生成结合的技术..." ──embedding──→ 检索         │
│  （答案向量 vs 答案向量，语义空间一致）             │
└────────────────────────────────────────────────┘
```

```python
def hyde_retrieve(question: str, top_k: int = 5):
    # 1. 生成假设文档
    hypo_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": "请直接回答以下问题，写一段简洁的解释。"
        }, {
            "role": "user", "content": question,
        }],
    )
    hypo_doc = hypo_response.choices[0].message.content

    # 2. 用假设文档的向量去检索
    hypo_embedding = get_embedding(hypo_doc)
    results = vector_db.query(query_embeddings=[hypo_embedding], n_results=top_k)
    return results
```

## Re-ranking（重排序）

向量检索返回的 Top-K 结果排序不够精准。Re-ranker 用更精确（但更慢）的模型对结果重新排序。

```
┌──────────────────────────────────────────────┐
│          两阶段检索                             │
│                                              │
│  阶段1：向量检索（快但粗）                      │
│  从 100 万文档中找出 Top-20                    │
│           │                                  │
│           ▼                                  │
│  阶段2：Re-ranking（慢但精）                   │
│  对 Top-20 用 Cross-Encoder 精排              │
│  输出 Top-5                                  │
└──────────────────────────────────────────────┘
```

常用 Re-ranker：
- **Cohere Reranker** —— API 服务，效果好
- **bge-reranker** —— 开源，可本地部署
- **Cross-Encoder** —— 基于 sentence-transformers

```python
import cohere

co = cohere.Client("your-api-key")

results = co.rerank(
    model="rerank-v3.5",
    query="什么是 RAG？",
    documents=["RAG 是检索增强生成...", "CNN 是卷积神经网络...", "RAG 通过外部知识..."],
    top_n=2,
)

for r in results.results:
    print(f"Score: {r.relevance_score:.4f} | {r.document.text[:50]}")
```

## Multi-hop Retrieval（多步检索）

有些问题无法一次检索回答，需要多步推理：

```
问题："LangChain 的创始人之前在哪家公司工作？"

第1步检索 → "LangChain 由 Harrison Chase 创立"
第2步检索 → "Harrison Chase 之前在 Robust Intelligence 工作"
合并回答 → "Harrison Chase 之前在 Robust Intelligence 工作"
```

实现思路：让 LLM 判断检索结果是否足以回答问题，不够则生成后续查询继续检索。

## GraphRAG

微软提出的 GraphRAG 将文档中的实体和关系提取为**知识图谱**，然后在图上做检索。

```
┌─────────────────────────────────────────────┐
│  传统 RAG：                                  │
│  文档 → 分块 → 向量 → 语义检索               │
│  擅长：局部事实查询                           │
│                                             │
│  GraphRAG：                                  │
│  文档 → 提取实体关系 → 构建图 → 社区摘要      │
│                                             │
│     [张三]──works_at──→[公司A]               │
│       │                   │                 │
│    knows               located_in           │
│       │                   │                 │
│     [李四]             [北京]                │
│                                             │
│  擅长：全局总结、关系推理                      │
└─────────────────────────────────────────────┘
```

GraphRAG 特别适合需要「全局理解」的问题，如「这个数据集中的主要主题是什么？」

## 实际效果对比

| 技术 | 适用场景 | 提升幅度 | 复杂度 |
|------|---------|---------|--------|
| Query Rewriting | 用户问题模糊 | +10-20% | 低 |
| HyDE | 问答语义鸿沟大 | +5-15% | 低 |
| Re-ranking | 检索排序不准 | +15-25% | 中 |
| Multi-hop | 复杂推理问题 | 必需 | 高 |
| GraphRAG | 全局总结、关系推理 | 场景依赖 | 高 |

---

<details>
<summary><strong>自测题</strong></summary>

1. **HyDE 的核心思想是什么？为什么有效？**
   - 答：先用 LLM 生成假设答案，用答案的向量去检索。有效是因为答案和文档都是陈述句，语义空间一致，匹配更准。

2. **Re-ranking 为什么不直接用于全量检索？**
   - 答：Re-ranker（如 Cross-Encoder）计算复杂度是 O(n)，对每个候选文档都要与查询做交叉编码，速度太慢。所以先用向量检索粗筛，再用 Re-ranker 精排。

3. **GraphRAG 相比传统 RAG 的优势是什么？**
   - 答：传统 RAG 擅长局部事实检索，GraphRAG 通过知识图谱和社区摘要能回答需要全局理解的问题（如主题总结、关系推理）。

</details>

## 延伸阅读

- [GraphRAG 论文 (Microsoft)](https://arxiv.org/abs/2404.16130)
- [HyDE 论文](https://arxiv.org/abs/2212.10496)
- [Cohere Reranker 文档](https://docs.cohere.com/docs/reranking)
- [RAG 技术全景综述](https://arxiv.org/abs/2312.10997)
