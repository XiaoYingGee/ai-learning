---
title: "分块策略与向量数据库"
description: "掌握文档分块的各种策略、向量数据库选型，以及 Metadata 过滤技巧"
---

:::tip[与其他章节的关联]
- 分块大小需考虑模型的 Token 限制，参见 [ch01 Tokenization](/01-llm-fundamentals/02-tokenization-embedding/)
- 向量数据库是 [ch04-02 RAG 基础](/04-rag/02-rag-basics/) 中离线阶段的核心存储组件
- LangChain 内置了多种 Text Splitter，参见 [ch05-01 LangChain](/05-frameworks/01-langchain-langgraph/)
:::

## 文档分块策略

分块 (Chunking) 是 RAG 中至关重要的一步。分块太大，检索不精确；分块太小，丢失上下文。就像切面包——切太厚一片吃不完，切太薄又散架。

```
┌─────────────────────────────────────────────────┐
│              三种分块策略                          │
│                                                 │
│  1. 固定大小分块 (Fixed-size)                     │
│  ┌──────┐┌──────┐┌──────┐┌──────┐               │
│  │500字  ││500字  ││500字  ││500字  │              │
│  └──────┘└──────┘└──────┘└──────┘               │
│  简单但可能在句子中间截断                           │
│                                                 │
│  2. 语义分块 (Semantic)                           │
│  ┌────┐┌──────────┐┌───┐┌────────┐              │
│  │段落1││  段落2    ││ 3 ││ 段落4   │              │
│  └────┘└──────────┘└───┘└────────┘              │
│  按语义边界切分，长度不等                           │
│                                                 │
│  3. 递归分块 (Recursive)                          │
│  先按 \n\n 分 → 太长则按 \n 分 → 仍太长按句号分    │
│  ┌─────┐┌──────┐┌────┐┌───────┐                 │
│  │自然段││自然段  ││句子 ││自然段   │                │
│  └─────┘└──────┘└────┘└───────┘                 │
│  LangChain 默认策略，平衡性最好                    │
└─────────────────────────────────────────────────┘
```

### 代码示例：递归分块

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,        # 每块最大字符数
    chunk_overlap=50,      # 相邻块重叠字符数
    separators=["\n\n", "\n", "。", "，", " ", ""],  # 中文优化
)

text = """第一章 引言

人工智能正在改变世界。本书将介绍 AI Agent 的核心概念。

第二章 基础

Agent 是能够感知环境并采取行动的自主实体。"""

chunks = splitter.split_text(text)
for i, chunk in enumerate(chunks):
    print(f"Chunk {i}: {chunk[:50]}...")
```

## 分块大小与重叠的权衡

| 参数 | 小值 | 大值 |
|------|------|------|
| **chunk_size** | 检索精确，但缺乏上下文 | 上下文丰富，但检索噪音大 |
| **chunk_overlap** | 节省存储，但可能丢失边界信息 | 保留连贯性，但冗余增加 |

经验值：
- **chunk_size**: 300-1000 字符（中文建议 300-500）
- **chunk_overlap**: chunk_size 的 10-20%

## 向量数据库对比

```
┌──────────────────────────────────────────────────────────┐
│                   向量数据库选型地图                        │
│                                                          │
│           轻量/原型                生产级                   │
│              │                      │                    │
│         ┌────▼────┐           ┌─────▼─────┐              │
│         │ Chroma  │           │ Pinecone  │  全托管 SaaS  │
│         │ 本地嵌入 │           │  零运维    │              │
│         └─────────┘           └───────────┘              │
│         ┌─────────┐           ┌───────────┐              │
│         │ pgvector│           │  Milvus   │  大规模场景   │
│         │用现有 PG │           │ 十亿级向量 │              │
│         └─────────┘           └───────────┘              │
│                               ┌───────────┐              │
│                               │ Weaviate  │  多模态友好   │
│                               │ GraphQL   │              │
│                               └───────────┘              │
└──────────────────────────────────────────────────────────┘
```

详细对比：

| 数据库 | 部署方式 | 规模 | 特点 | 适用场景 |
|--------|---------|------|------|---------|
| **Chroma** | 嵌入式/本地 | 小 | 零配置，Python 原生 | 原型开发、个人项目 |
| **pgvector** | PostgreSQL 扩展 | 中 | 复用已有 PG 基础设施 | 已有 PG 的团队 |
| **Pinecone** | 全托管 SaaS | 大 | 零运维，自动扩缩 | 不想管基础设施 |
| **Milvus** | 自部署/云 | 超大 | 十亿级向量、GPU 加速 | 大规模企业应用 |
| **Weaviate** | 自部署/云 | 大 | GraphQL API、多模态 | 复杂查询需求 |

选型建议：
- **刚起步** → Chroma（5 分钟上手）
- **已有 PostgreSQL** → pgvector（无需新增组件）
- **生产环境、不想运维** → Pinecone
- **大规模、需要自控** → Milvus

## Metadata 过滤

仅靠向量相似度检索不够精准，Metadata 过滤可以大幅提升质量：

```python
# 存储时附加 metadata
vector_db.add(
    documents=["FastAPI 3.0 发布了新特性..."],
    embeddings=[embedding],
    metadatas=[{
        "source": "blog",
        "category": "python",
        "date": "2025-06-01",
        "author": "张三",
    }],
    ids=["doc_001"],
)

# 检索时使用 metadata 过滤
results = vector_db.query(
    query_embeddings=[query_embedding],
    n_results=5,
    where={
        "$and": [
            {"category": {"$eq": "python"}},
            {"date": {"$gte": "2025-01-01"}},
        ]
    },
)
```

Metadata 过滤的典型用途：
- **按时间** —— 只检索最近的文档
- **按来源** —— 只搜公司内部文档
- **按权限** —— 用户只能搜索有权限的内容
- **按类别** —— 技术文档 vs 法律文档分开搜索

---

## 常见陷阱

- **中文分块用英文分隔符**：默认的 `RecursiveCharacterTextSplitter` 分隔符优先列表针对英文设计（如 `\n\n`、`. `），中文应使用 `。`、`，` 等中文标点。
- **chunk_size 单位混淆**：`chunk_size` 是字符数而非 Token 数。中文 1 字符 ≈ 1-2 Token，英文 1 Token ≈ 4 字符。建议同时检查 Token 数是否超出 Embedding 模型限制。
- **忽略文档结构**：对 Markdown/HTML 文档不利用标题层级信息，导致一个 chunk 跨越多个不相关的章节。可用 `MarkdownHeaderTextSplitter` 按标题切分。

<div class="card-quiz">
  <details>
    <summary>自测题 1：递归分块为什么是最推荐的分块策略？</summary>
    <div class="answer">它按优先级依次尝试多种分隔符（段落→换行→句子），尽量在自然语义边界切分，兼顾了块大小的一致性和语义的完整性。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：chunk_overlap 的作用是什么？</summary>
    <div class="answer">让相邻块之间有重叠内容，避免重要信息恰好在切分边界被截断，保持上下文连贯性。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：什么场景下应该选 pgvector 而不是 Pinecone？</summary>
    <div class="answer">团队已有 PostgreSQL 基础设施、数据量中等、希望减少外部依赖、数据不能出境（合规要求）的场景。</div>
  </details>
</div>

## 延伸阅读

- [LangChain Text Splitters 文档](https://python.langchain.com/docs/how_to/#text-splitters)
- [Chroma 官方文档](https://docs.trychroma.com/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [分块策略深度对比 (Unstructured.io)](https://unstructured.io/blog/chunking-for-rag)
