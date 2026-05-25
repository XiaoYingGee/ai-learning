---
title: "编码面试题集"
description: "AI Agent 编码面试常见题目、解题思路与参考代码"
---

## 题目 1：实现 ReAct 循环

### 题目描述

实现一个简单的 ReAct Agent，能够根据用户问题调用工具并生成最终答案。

### 解题思路

1. 定义工具接口和 Agent 循环结构
2. 每轮循环：调用 LLM → 解析输出（Thought/Action/Answer）→ 执行工具 → 将结果反馈
3. 设置最大迭代次数防止死循环

### 参考代码

```python
from openai import OpenAI

client = OpenAI()

# 工具定义
tools = {
    "search": lambda query: f"搜索结果: {query} 的相关信息...",
    "calculator": lambda expr: str(eval(expr)),
}

SYSTEM_PROMPT = """你是一个 ReAct Agent。每次回复使用以下格式之一：

Thought: 你的推理
Action: tool_name(参数)

或者当你有最终答案时：

Thought: 我已经有了答案
Answer: 最终答案
"""

def react_agent(question: str, max_steps: int = 5) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0,
        )

        output = response.choices[0].message.content
        messages.append({"role": "assistant", "content": output})

        # 检查是否有最终答案
        if "Answer:" in output:
            return output.split("Answer:")[-1].strip()

        # 解析 Action
        if "Action:" in output:
            action_line = [l for l in output.split("\n") if l.startswith("Action:")][0]
            action_str = action_line.split("Action:")[-1].strip()

            # 解析工具名和参数
            tool_name = action_str.split("(")[0].strip()
            tool_args = action_str.split("(")[1].rstrip(")").strip()

            # 执行工具
            if tool_name in tools:
                observation = tools[tool_name](tool_args)
            else:
                observation = f"错误: 未知工具 {tool_name}"

            messages.append({
                "role": "user",
                "content": f"Observation: {observation}"
            })

    return "达到最大步数，未能得出答案"

# 使用
result = react_agent("2024年诺贝尔物理学奖得主是谁？他们的主要贡献是什么？")
print(result)
```

---

## 题目 2：设计 Tool Schema 并实现 Function Calling

### 题目描述

为一个天气查询和日程管理场景定义 Tool Schema，并实现完整的 Function Calling 流程。

### 解题思路

1. 用 JSON Schema 定义工具的输入参数
2. 将工具定义传给 LLM
3. 解析 LLM 返回的 function call
4. 执行对应函数并将结果返回

### 参考代码

```python
import json
from openai import OpenAI

client = OpenAI()

# 工具 Schema 定义
tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如'北京'"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": "在日历中创建一个新事件",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "事件标题"},
                    "date": {"type": "string", "description": "日期，格式 YYYY-MM-DD"},
                    "time": {"type": "string", "description": "时间，格式 HH:MM"},
                    "duration_minutes": {"type": "integer", "description": "持续时间（分钟）"}
                },
                "required": ["title", "date", "time"]
            }
        }
    }
]

# 工具实现
def get_weather(city: str, unit: str = "celsius") -> dict:
    # 模拟天气 API
    return {"city": city, "temperature": 22, "unit": unit, "condition": "晴"}

def create_event(title: str, date: str, time: str, duration_minutes: int = 60) -> dict:
    return {"status": "created", "title": title, "date": date, "time": time}

tool_functions = {
    "get_weather": get_weather,
    "create_event": create_event,
}

def run_with_tools(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]

    # 第一次调用：LLM 决定是否使用工具
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tool_definitions,
    )

    msg = response.choices[0].message

    # 如果没有工具调用，直接返回
    if not msg.tool_calls:
        return msg.content

    # 处理工具调用
    messages.append(msg)

    for tool_call in msg.tool_calls:
        func_name = tool_call.function.name
        func_args = json.loads(tool_call.function.arguments)

        # 执行函数
        result = tool_functions[func_name](**func_args)

        # 将结果加入消息
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result, ensure_ascii=False)
        })

    # 第二次调用：LLM 基于工具结果生成回答
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )

    return final_response.choices[0].message.content
```

---

## 题目 3：实现 RAG 检索逻辑

### 题目描述

实现一个简单的 RAG 系统：文档分块、Embedding 存储、检索和生成答案。

### 解题思路

1. 文档预处理：加载 → 分块
2. 向量化：每个块生成 Embedding 并存储
3. 查询时检索最相关的块
4. 将检索结果与问题一起送入 LLM 生成答案

### 参考代码

```python
import numpy as np
from openai import OpenAI

client = OpenAI()

class SimpleRAG:
    def __init__(self):
        self.chunks: list[str] = []
        self.embeddings: list[list[float]] = []

    def add_document(self, text: str, chunk_size: int = 500, overlap: int = 50):
        """将文档分块并建立索引"""
        # 简单的固定大小分块
        for i in range(0, len(text), chunk_size - overlap):
            chunk = text[i:i + chunk_size]
            if len(chunk.strip()) > 50:  # 过滤太短的块
                self.chunks.append(chunk)

        # 批量生成 Embedding
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=self.chunks
        )
        self.embeddings = [item.embedding for item in response.data]

    def retrieve(self, query: str, top_k: int = 3) -> list[str]:
        """检索最相关的文档块"""
        # 生成查询 Embedding
        query_emb = client.embeddings.create(
            model="text-embedding-3-small",
            input=[query]
        ).data[0].embedding

        # 计算余弦相似度
        scores = []
        for emb in self.embeddings:
            score = np.dot(query_emb, emb) / (
                np.linalg.norm(query_emb) * np.linalg.norm(emb)
            )
            scores.append(score)

        # 返回 Top-K
        top_indices = np.argsort(scores)[-top_k:][::-1]
        return [self.chunks[i] for i in top_indices]

    def query(self, question: str) -> str:
        """RAG 查询：检索 + 生成"""
        # 检索
        relevant_chunks = self.retrieve(question)
        context = "\n---\n".join(relevant_chunks)

        # 生成
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "基于以下参考资料回答问题。"
                        "如果资料中没有相关信息，如实说明。\n\n"
                        f"参考资料：\n{context}"
                    )
                },
                {"role": "user", "content": question}
            ],
            temperature=0,
        )

        return response.choices[0].message.content

# 使用
rag = SimpleRAG()
rag.add_document("你的文档内容...")
answer = rag.query("这个文档说了什么？")
```

---

## 题目 4：实现 Streaming 输出

### 题目描述

实现一个支持 streaming 的 Agent，逐步展示推理过程和工具调用结果。

### 参考代码

```python
from openai import OpenAI

client = OpenAI()

def stream_agent_response(question: str):
    """Streaming 输出 Agent 响应"""
    messages = [
        {"role": "system", "content": "你是一个有用的助手。"},
        {"role": "user", "content": question},
    ]

    stream = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        stream=True,
    )

    collected_content = ""
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            print(delta.content, end="", flush=True)
            collected_content += delta.content

    print()  # 换行
    return collected_content
```

---

## 题目 5：实现简单的 Agent 记忆系统

### 题目描述

实现一个支持短期记忆（对话上下文）和长期记忆（重要信息持久化）的 Agent。

### 参考代码

```python
from openai import OpenAI
import json

client = OpenAI()

class MemoryAgent:
    def __init__(self):
        self.short_term: list[dict] = []  # 对话历史
        self.long_term: list[dict] = []   # 持久化记忆
        self.max_short_term = 20          # 最大短期记忆条数

    def _should_memorize(self, message: str) -> bool:
        """判断是否需要存入长期记忆"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"判断以下信息是否值得长期记住（用户偏好、重要事实、关键决策）。"
                    f"只回答 yes 或 no。\n\n信息：{message}"
                )
            }],
            temperature=0,
        )
        return "yes" in response.choices[0].message.content.lower()

    def _get_relevant_memories(self, query: str) -> str:
        """检索相关的长期记忆"""
        if not self.long_term:
            return ""
        # 简化版：返回所有长期记忆
        memories = "\n".join([m["content"] for m in self.long_term])
        return f"\n长期记忆：\n{memories}"

    def chat(self, user_message: str) -> str:
        # 检查是否存入长期记忆
        if self._should_memorize(user_message):
            self.long_term.append({"content": user_message})

        # 构建消息
        memories = self._get_relevant_memories(user_message)
        system_msg = f"你是一个有记忆的助手。{memories}"

        messages = [{"role": "system", "content": system_msg}]
        messages.extend(self.short_term[-self.max_short_term:])
        messages.append({"role": "user", "content": user_message})

        # 调用 LLM
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
        )

        assistant_msg = response.choices[0].message.content

        # 更新短期记忆
        self.short_term.append({"role": "user", "content": user_message})
        self.short_term.append({"role": "assistant", "content": assistant_msg})

        return assistant_msg
```

## 面试编码技巧

1. **先写接口再写实现** — 先定义类和方法签名，和面试官确认方向
2. **处理边界情况** — 空输入、超时、工具失败
3. **解释设计决策** — 为什么用这种分块策略、为什么设这个阈值
4. **提到可优化点** — 时间不够写，但要口述你知道怎么优化
5. **代码可运行** — 面试中的代码不需要完美，但要能说清逻辑
