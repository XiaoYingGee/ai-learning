---
title: "Prompt Engineering"
description: "掌握 LLM 提示工程核心技术：Zero-shot/Few-shot、Chain-of-Thought、ReAct Prompting、System Prompt 设计与 Prompt 版本管理。"
---

## 什么是 Prompt Engineering？

Prompt Engineering 是设计和优化输入提示以引导 LLM 产生期望输出的技术。类比：LLM 是一个能力极强但需要明确指令的实习生——你的指令（Prompt）越清晰具体，输出质量越高。

## Zero-shot 与 Few-shot Prompting

### Zero-shot：不给示例

```
请将以下文本分类为"正面"或"负面"：
"这家餐厅的服务态度非常好，菜品也很精致。"
```

模型直接根据预训练知识完成任务。

### Few-shot：给几个示例

```
请将文本分类为"正面"或"负面"。

示例1：
文本："食物很难吃，等了一个小时。"
分类：负面

示例2：
文本："环境优雅，价格合理。"
分类：正面

现在请分类：
文本："服务员态度冷淡，但菜品不错。"
分类：
```

Few-shot 通过示例"教"模型输出格式和判断标准，通常比 Zero-shot 更准确。

**关键技巧**：示例的质量和多样性比数量更重要。3-5 个高质量示例通常足够。

## Chain-of-Thought (CoT) 推理

CoT 让模型在给出最终答案前先展示推理过程，显著提升复杂推理任务的准确性。

```
# 不用 CoT
问：一个商店有 23 个苹果，卖出 5 个后又进了 12 个，现在有多少？
答：30 个。

# 使用 CoT
问：一个商店有 23 个苹果，卖出 5 个后又进了 12 个，现在有多少？
请一步步思考。
答：
1. 开始有 23 个苹果
2. 卖出 5 个：23 - 5 = 18 个
3. 又进了 12 个：18 + 12 = 30 个
所以现在有 30 个苹果。
```

触发 CoT 的常用短语：
- "Let's think step by step"
- "请一步步思考"
- "Show your reasoning"

### Zero-shot CoT vs Few-shot CoT

```
Zero-shot CoT: 只加一句 "请一步步思考"
Few-shot CoT:  提供包含推理过程的示例
```

Few-shot CoT 效果更好，但需要人工编写推理示例。

## Self-Consistency

Self-Consistency 是 CoT 的增强版：多次采样，取多数票。

```
问题 → CoT 路径 1 → 答案 A
     → CoT 路径 2 → 答案 A
     → CoT 路径 3 → 答案 B
     → CoT 路径 4 → 答案 A
     → CoT 路径 5 → 答案 A

多数票: A (4/5) ← 最终答案
```

```python
def self_consistency(prompt, model, n=5, temperature=0.7):
    answers = []
    for _ in range(n):
        response = model.generate(prompt, temperature=temperature)
        answer = extract_answer(response)
        answers.append(answer)
    # 返回出现次数最多的答案
    return max(set(answers), key=answers.count)
```

代价是 n 倍的 API 调用成本，适用于高价值决策场景。

## ReAct Prompting

ReAct（Reasoning + Acting）是连接 LLM 和外部工具的关键模式，也是 Agent 的核心范式（将在 Agent 章节详细讲解）。

```
问：2024 年奥运会在哪个城市举办？金牌数最多的国家是？

思考(Thought): 我需要查询 2024 年奥运会的信息。
行动(Action): search("2024 Olympics host city")
观察(Observation): 2024 年夏季奥运会在巴黎举办。

思考(Thought): 现在我需要查金牌榜。
行动(Action): search("2024 Olympics gold medal count by country")
观察(Observation): 美国以 40 枚金牌排名第一。

思考(Thought): 我现在有了所有需要的信息。
最终答案: 2024 年奥运会在巴黎举办，金牌数最多的国家是美国(40枚)。
```

ReAct 让 LLM 不仅能"想"，还能"做"——通过调用工具获取实时信息。

## System Prompt 设计最佳实践

System Prompt 定义了模型的角色、行为边界和输出规范。

```python
system_prompt = """
# 角色
你是一名资深 Python 后端工程师，专精 FastAPI 和 PostgreSQL。

# 能力边界
- 你只回答与 Python 后端开发相关的问题
- 你不提供前端、移动端或其他语言的建议

# 输出规范
- 代码示例使用 Python 3.12+ 语法
- 始终包含类型注解
- 必须包含错误处理
- 格式：先解释思路，再给代码，最后给注意事项

# 安全规则
- 不执行或建议任何删除数据库的操作
- SQL 查询必须使用参数化查询
"""
```

### 设计原则

```
好的 System Prompt 结构：

┌──────────────────────┐
│ 1. 角色定义           │  ← 你是谁？
├──────────────────────┤
│ 2. 能力与约束         │  ← 能做什么/不能做什么？
├──────────────────────┤
│ 3. 输出格式           │  ← 怎么回答？
├──────────────────────┤
│ 4. 示例 (可选)        │  ← Few-shot 示例
├──────────────────────┤
│ 5. 安全护栏           │  ← 红线规则
└──────────────────────┘
```

## Prompt 模板化与版本管理

在生产环境中，Prompt 应该像代码一样管理：

```python
# prompts/classification_v2.py
CLASSIFICATION_PROMPT = """
你是一个文本分类助手。

将用户输入分类为以下类别之一：{categories}

输入：{user_input}

请以 JSON 格式输出：{{"category": "类别名", "confidence": 0.0-1.0}}
"""

def classify(user_input: str, categories: list[str]) -> dict:
    prompt = CLASSIFICATION_PROMPT.format(
        categories=", ".join(categories),
        user_input=user_input,
    )
    return call_llm(prompt)
```

**版本管理建议**：
- 使用 Git 管理 Prompt 变更
- 每个 Prompt 版本对应 A/B 测试数据
- 用 LangSmith、Braintrust 等工具追踪 Prompt 效果
- 考虑使用 Prompt Management 平台（如 Anthropic Console）

<details>
<summary>自测题 1：Few-shot 示例的数量越多越好吗？</summary>

不是。过多示例会消耗上下文窗口，且可能引入偏见（模型过度拟合示例模式）。通常 3-5 个覆盖不同情况的高质量示例效果最佳。关键在于示例的多样性和代表性。
</details>

<details>
<summary>自测题 2：CoT 对所有任务都有效吗？</summary>

不是。CoT 主要对需要多步推理的复杂任务有效（数学、逻辑推理、代码理解）。对于简单的分类、翻译等任务，CoT 可能反而增加延迟而不提升质量。一般认为 CoT 对模型参数量 >100B 时效果最显著。
</details>

<details>
<summary>自测题 3：ReAct 和纯 CoT 的核心区别是什么？</summary>

CoT 只有内部推理（Reasoning），模型基于已有知识进行思考。ReAct 增加了外部行动（Acting），模型可以调用工具（搜索、计算器、API）获取实时信息，然后基于观察结果继续推理。这使得 LLM 能突破知识截止日期的限制。
</details>

## 延伸阅读

- [Chain-of-Thought Prompting (原始论文)](https://arxiv.org/abs/2201.11903)
- [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629)
- [Anthropic Prompt Engineering 指南](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering)
- [OpenAI Prompt Engineering 指南](https://platform.openai.com/docs/guides/prompt-engineering)
