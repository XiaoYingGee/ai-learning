---
title: "RAG Pipeline 实战"
description: "完整 RAG Pipeline 实现：文档加载、分块、嵌入、向量存储、检索与生成"
---

## RAG 回顾

RAG（Retrieval-Augmented Generation）的核心流程：

:::tip[理论回顾：RAG 架构]
RAG 的原理、适用场景和检索策略已在 [第四章 RAG 基础](/04-rag/) 中系统讲解。本章将第四章的概念图变成完整可运行的代码——重点展示分块、嵌入、检索三步的工程实现细节。
:::

1. **文档加载**：读取原始文档
2. **分块（Chunking）**：将长文档切分为小段
3. **嵌入（Embedding）**：将文本转为向量
4. **存储**：将向量存入向量数据库
5. **检索（Retrieval）**：根据用户查询找到最相关的文档块
6. **生成（Generation）**：将检索结果作为上下文，让 LLM 生成回答

本文用 OpenAI Embedding + ChromaDB 实现一个完整可运行的 RAG Pipeline。

## 环境准备

```bash
pip install openai chromadb tiktoken
```

## 完整实现

### 第一步：文档加载与分块

```python
import tiktoken

def load_documents(file_paths: list[str]) -> list[dict]:
    """加载文本文件"""
    documents = []
    for path in file_paths:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        documents.append({"path": path, "content": content})
    return documents


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    source: str = "",
) -> list[dict]:
    """
    按 Token 数分块

    为什么按 Token 而不是字符分块？因为 LLM 的上下文窗口和
    Embedding 模型的输入限制都以 Token 计。按字符分块可能
    导致一个块的 Token 数超出模型限制。

    Args:
        text: 原始文本
        chunk_size: 每块最大 Token 数
        chunk_overlap: 相邻块的重叠 Token 数（防止语义被切断）
        source: 来源文件名
    """
    encoder = tiktoken.encoding_for_model("gpt-4o-mini")
    tokens = encoder.encode(text)

    chunks = []
    start = 0
    chunk_id = 0

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoder.decode(chunk_tokens)

        chunks.append({
            "id": f"{source}_chunk_{chunk_id}",
            "text": chunk_text,
            "source": source,
            "token_count": len(chunk_tokens),
        })

        start += chunk_size - chunk_overlap
        chunk_id += 1

    return chunks
```

### 第二步：嵌入与向量存储

```python
from openai import OpenAI
import chromadb

client = OpenAI()

def get_embeddings(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    """批量获取文本嵌入向量"""
    response = client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]


def build_vector_store(
    chunks: list[dict],
    collection_name: str = "rag_collection",
) -> chromadb.Collection:
    """构建向量存储"""
    chroma_client = chromadb.PersistentClient(path="./chroma_db")

    # 删除已存在的同名集合（如果有）
    try:
        chroma_client.delete_collection(collection_name)
    except Exception:
        pass

    collection = chroma_client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    # 批量处理（避免一次性发送过多数据）
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [c["text"] for c in batch]
        ids = [c["id"] for c in batch]
        metadatas = [{"source": c["source"]} for c in batch]

        embeddings = get_embeddings(texts)

        collection.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        print(f"已索引 {min(i + batch_size, len(chunks))}/{len(chunks)} 个文档块")

    return collection
```

### 第三步：检索与生成

```python
def retrieve(
    collection: chromadb.Collection,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """检索最相关的文档块"""
    query_embedding = get_embeddings([query])[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
    )

    retrieved = []
    for i in range(len(results["ids"][0])):
        retrieved.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "distance": results["distances"][0][i],
            "source": results["metadatas"][0][i]["source"],
        })

    return retrieved


def generate_answer(query: str, context_chunks: list[dict]) -> str:
    """基于检索结果生成回答"""
    context = "\n\n---\n\n".join([
        f"[来源: {c['source']}]\n{c['text']}"
        for c in context_chunks
    ])

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "你是一个知识助手。根据以下参考资料回答用户问题。\n"
                    "如果参考资料中没有相关信息，请如实说明。\n"
                    "回答时引用来源。"
                ),
            },
            {
                "role": "user",
                "content": f"参考资料:\n{context}\n\n问题: {query}",
            },
        ],
        temperature=0,
    )

    return response.choices[0].message.content
```

### 第四步：完整管线

```python
def rag_pipeline(file_paths: list[str], query: str) -> str:
    """完整 RAG 管线"""
    # 1. 加载文档
    print("1. 加载文档...")
    docs = load_documents(file_paths)

    # 2. 分块
    print("2. 文档分块...")
    all_chunks = []
    for doc in docs:
        chunks = chunk_text(doc["content"], source=doc["path"])
        all_chunks.extend(chunks)
    print(f"   共 {len(all_chunks)} 个块")

    # 3-4. 嵌入 + 存储
    print("3. 构建向量索引...")
    collection = build_vector_store(all_chunks)

    # 5. 检索
    print("4. 检索相关文档...")
    results = retrieve(collection, query)
    print(f"   找到 {len(results)} 个相关块")

    # 6. 生成
    print("5. 生成回答...")
    answer = generate_answer(query, results)

    return answer


if __name__ == "__main__":
    answer = rag_pipeline(
        file_paths=["./docs/guide.txt", "./docs/faq.txt"],
        query="如何配置系统？",
    )
    print(f"\n回答:\n{answer}")
```

## 关键设计决策

| 决策点 | 本文选择 | 替代方案 |
|--------|---------|---------|
| 分块策略 | 按 Token 数固定分块 | 按段落/语义分块 |
| Embedding 模型 | text-embedding-3-small | Cohere、BGE、Jina |
| 向量数据库 | ChromaDB（本地） | Pinecone、Weaviate、Qdrant |
| 相似度度量 | Cosine | L2、Inner Product |

## 自测问题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：chunk_overlap 的作用是什么？如果设为 0 会有什么问题？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">chunk_overlap 让相邻块有一部分重叠内容，确保跨块边界的信息不会丢失。设为 0 时，恰好在块边界处的完整语句会被切断，检索时可能找不到完整的相关信息。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：为什么要批量处理 Embedding 而不是逐条处理？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">API 调用有网络延迟开销。批量处理（一次发送 100 条）可以大幅减少 API 调用次数，降低延迟和成本。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：生成阶段的 System Prompt 中为什么强调"如果没有相关信息请如实说明"？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">防止 LLM 在参考资料中找不到答案时编造信息（幻觉）。明确指示 LLM 在信息不足时承认而不是臆测。</div>
  </details>
</div>

## 延伸阅读

- [ChromaDB 文档](https://docs.trychroma.com/)
- [OpenAI Embeddings 指南](https://platform.openai.com/docs/guides/embeddings)
- [分块策略详解](https://www.pinecone.io/learn/chunking-strategies/)
