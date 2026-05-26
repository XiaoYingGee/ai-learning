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

<div style="display:flex;flex-direction:column;gap:0;margin:1.5rem 0;max-width:400px;">
  <div style="background:#1e3a5f;color:#fff;padding:.8rem 1.2rem;border-radius:12px 12px 0 0;font-weight:bold;">1. 角色定义 <span style="font-weight:normal;opacity:.7;">← 你是谁？</span></div>
  <div style="background:#1a3350;color:#fff;padding:.8rem 1.2rem;border-top:1px solid #2a4a6f;">2. 能力与约束 <span style="opacity:.7;">← 能做什么/不能做什么？</span></div>
  <div style="background:#162b45;color:#fff;padding:.8rem 1.2rem;border-top:1px solid #2a4a6f;">3. 输出格式 <span style="opacity:.7;">← 怎么回答？</span></div>
  <div style="background:#12233a;color:#fff;padding:.8rem 1.2rem;border-top:1px solid #2a4a6f;">4. 示例（可选） <span style="opacity:.7;">← Few-shot 示例</span></div>
  <div style="background:#0e1b2f;color:#fff;padding:.8rem 1.2rem;border-radius:0 0 12px 12px;border-top:1px solid #2a4a6f;">5. 安全护栏 <span style="opacity:.7;">← 红线规则</span></div>
</div>

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

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：Few-shot 示例的数量越多越好吗？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      不是。过多示例会消耗宝贵的上下文窗口，且可能引入偏见——模型会过度拟合示例的表面模式（比如总是输出和示例相同的长度或格式），而忽略任务本身的要求。通常 3-5 个覆盖不同情况的高质量示例效果最佳。<br/><br/>
      关键在于示例的<strong>多样性和代表性</strong>，而非数量。比如做情感分类时，与其给 10 个正面示例，不如给 2 个正面 + 2 个负面 + 1 个边界情况（如"食物不错但服务很差"），这样模型能更好地理解判断标准。
    </div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：CoT 对所有任务都有效吗？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      不是。CoT 主要对需要<strong>多步推理</strong>的复杂任务有效，如数学题（需要列方程、分步计算）、逻辑推理（需要逐条分析条件）、代码理解（需要追踪变量状态）。对于简单的分类、翻译、信息提取等任务，CoT 可能反而增加延迟和 token 消耗而不提升质量。<br/><br/>
      此外，CoT 的效果与模型规模高度相关。研究表明，CoT 在参数量超过 100B 的模型上效果最显著（如 GPT-4、Claude），而小模型（如 7B）使用 CoT 时可能产生看似合理但实际错误的推理链，反而降低准确率。
    </div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：ReAct 和纯 CoT 的核心区别是什么？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">
      CoT 只有内部推理（Reasoning）——模型基于已有知识进行思考，就像闭卷考试。ReAct 增加了外部行动（Acting）——模型可以调用工具（搜索引擎、计算器、数据库 API）获取实时信息，然后基于观察结果继续推理，更像开卷考试。<br/><br/>
      举例：问"2024 年诺贝尔物理学奖得主是谁？"，纯 CoT 只能说"我的知识截止到 XX 年，无法回答"；ReAct 则会执行搜索操作获取最新信息，再给出准确答案。这种"想-做-看"的循环也是 AI Agent 的核心工作范式。
    </div>
  </details>
</div>

## 延伸阅读

- [Chain-of-Thought Prompting (原始论文)](https://arxiv.org/abs/2201.11903)
- [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629)
- [Anthropic Prompt Engineering 指南](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering)
- [OpenAI Prompt Engineering 指南](https://platform.openai.com/docs/guides/prompt-engineering)
