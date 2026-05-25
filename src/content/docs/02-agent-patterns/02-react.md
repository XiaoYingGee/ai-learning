---
title: "ReAct 模式"
description: "深入理解 ReAct（Reasoning + Acting）模式：核心思想、执行循环、代码实现与局限性分析。"
---

## ReAct 论文核心思想

ReAct 由 Yao et al. (2022) 提出，论文标题：*"ReAct: Synergizing Reasoning and Acting in Language Models"*。

核心洞见：**将推理（Reasoning）和行动（Acting）交织在一起，比单独做推理或单独做行动效果更好**。

```
只有推理 (CoT):
  思考 → 思考 → 思考 → 答案
  问题: 缺乏外部信息，容易产生幻觉

只有行动 (Action-only):
  行动 → 行动 → 行动 → 答案
  问题: 缺乏规划，盲目调用工具

ReAct (推理 + 行动):
  思考 → 行动 → 观察 → 思考 → 行动 → 观察 → 答案
  优势: 有计划地行动，有依据地推理
```

类比：ReAct 就像一个侦探破案的过程——先分析线索（思考），然后去现场调查（行动），根据发现调整推理方向（观察），再决定下一步调查什么。

## Reasoning + Acting 循环

ReAct 的核心是一个 **Thought → Action → Observation** 循环：

```
┌────────────────────────────────────────────────────┐
│                    ReAct 循环                       │
│                                                    │
│  ┌──────────┐     ┌──────────┐     ┌────────────┐ │
│  │ Thought  │────→│  Action  │────→│Observation │ │
│  │ (推理)   │     │ (行动)   │     │ (观察结果) │ │
│  └──────────┘     └──────────┘     └─────┬──────┘ │
│       ↑                                   │        │
│       └───────────────────────────────────┘        │
│                                                    │
│  重复直到:                                          │
│  - 获得最终答案                                     │
│  - 达到最大步数                                     │
│  - 模型判断任务完成                                  │
└────────────────────────────────────────────────────┘
```

### 每个阶段的作用

- **Thought**：模型用自然语言推理当前状态，决定下一步做什么。这个过程对外部不可见（内部独白）。
- **Action**：模型选择一个工具并调用它（如搜索、计算器、数据库查询）。
- **Observation**：工具返回的结果，作为新的输入供模型继续推理。

## ReAct 执行流程示例

```
用户问题: "比较 Tesla 和 BYD 2024 年的电动车销量"

Thought 1: 我需要分别查询 Tesla 和 BYD 的 2024 年销量数据。
           先查 Tesla。
Action 1:  search("Tesla 2024 annual EV sales")
Observation 1: Tesla 在 2024 年共交付约 178.9 万辆电动车。

Thought 2: 好的，Tesla 数据有了。现在查 BYD。
Action 2:  search("BYD 2024 annual EV sales")
Observation 2: BYD 2024 年新能源汽车销量约 427 万辆，
               其中纯电动约 176 万辆。

Thought 3: 现在我有了两组数据。需要注意 BYD 有纯电和
           混动之分。我可以做比较了。
Action 3:  finish(answer="Tesla 2024 年交付约 178.9 万辆
           纯电动车；BYD 纯电动约 176 万辆，但如果算上混动
           则总计约 427 万辆。纯电动领域两者接近，但 BYD
           在整体新能源市场大幅领先。")
```

## 代码实现

```python
import json
from dataclasses import dataclass

@dataclass
class Tool:
    name: str
    description: str
    function: callable

def react_agent(
    query: str,
    tools: list[Tool],
    llm,
    max_steps: int = 10,
) -> str:
    """一个简单的 ReAct Agent 实现"""

    # 构建工具描述
    tool_descriptions = "\n".join(
        f"- {t.name}: {t.description}" for t in tools
    )
    tool_map = {t.name: t.function for t in tools}

    system_prompt = f"""你是一个 ReAct Agent。面对用户问题，你需要交替进行思考和行动。

可用工具:
{tool_descriptions}

请严格按以下格式输出（每次只输出一轮）:
Thought: <你的推理过程>
Action: <工具名称>
Action Input: <工具参数，JSON 格式>

当你有足够信息回答时:
Thought: <最终推理>
Final Answer: <最终答案>
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query},
    ]

    for step in range(max_steps):
        response = llm.chat(messages)
        messages.append({"role": "assistant", "content": response})

        # 检查是否有最终答案
        if "Final Answer:" in response:
            return response.split("Final Answer:")[-1].strip()

        # 解析 Action
        if "Action:" in response and "Action Input:" in response:
            action = response.split("Action:")[-1].split("\n")[0].strip()
            action_input = response.split("Action Input:")[-1].strip()

            # 执行工具
            if action in tool_map:
                try:
                    args = json.loads(action_input)
                    observation = tool_map[action](**args)
                except Exception as e:
                    observation = f"错误: {e}"
            else:
                observation = f"未知工具: {action}"

            # 将观察结果加入消息
            messages.append({
                "role": "user",
                "content": f"Observation: {observation}",
            })

    return "达到最大步数，未能完成任务。"


# 使用示例
def search(query: str) -> str:
    """模拟搜索工具"""
    # 实际中调用搜索 API
    return f"搜索 '{query}' 的结果: ..."

def calculator(expression: str) -> str:
    """计算数学表达式"""
    return str(eval(expression))

tools = [
    Tool("search", "搜索互联网信息", search),
    Tool("calculator", "计算数学表达式", calculator),
]

# result = react_agent("...", tools, llm)
```

## ReAct 的局限性

### 1. 推理链过长时效果下降

当任务需要 10+ 步推理时，模型可能"迷失方向"或陷入循环。

```
Step 1-3: 推理清晰
Step 4-6: 开始重复之前的思考
Step 7+:  可能偏离主题或循环
```

### 2. 错误累积

每一步的错误会传递到后续步骤。一个工具调用失败或返回错误信息，可能导致整个推理链崩溃。

### 3. 缺乏回溯机制

标准 ReAct 是线性的——一旦走错路，无法回退到之前的状态重新尝试。这催生了 Reflection 和 Planning 模式（后续章节）。

### 4. 依赖 Prompt 格式

模型必须严格遵循 Thought/Action/Observation 格式。格式错误会导致解析失败。现代框架（如 LangChain、Claude Tool Use）通过结构化工具调用部分解决了这个问题。

### 改进方向

| 局限 | 改进方案 | 详见章节 |
|------|---------|---------|
| 无回溯 | Reflection 模式 | 第 2 章第 3 节 |
| 无全局规划 | Planning 模式 | 第 2 章第 4 节 |
| 单点故障 | Multi-Agent | 第 2 章第 5 节 |

<details>
<summary>自测题 1：ReAct 相比纯 CoT 的核心优势是什么？</summary>

ReAct 引入了 Action 阶段，使模型能调用外部工具获取实时信息，而非仅依赖训练数据进行推理。这解决了 CoT 容易产生幻觉的问题——模型可以通过搜索、计算等工具验证自己的推理。
</details>

<details>
<summary>自测题 2：ReAct 循环中 Thought 阶段的作用是什么？能否跳过？</summary>

Thought 阶段让模型在行动前先进行推理和规划，决定下一步应该做什么、为什么要做。如果跳过 Thought 直接行动（Action-only），模型会缺乏规划能力，可能盲目调用工具或遗漏重要步骤。论文实验表明，去掉 Thought 会显著降低效果。
</details>

<details>
<summary>自测题 3：现代 Agent 框架如何改进了原始 ReAct 的格式依赖问题？</summary>

现代框架使用结构化的工具调用协议（如 OpenAI Function Calling、Claude Tool Use），模型直接输出 JSON 格式的工具调用请求，而非在自然语言中嵌入特定格式。这消除了格式解析错误，使工具调用更可靠。
</details>

## 延伸阅读

- [ReAct: Synergizing Reasoning and Acting in Language Models (原始论文)](https://arxiv.org/abs/2210.03629)
- [LangChain ReAct Agent 实现](https://python.langchain.com/docs/how_to/agent_executor/)
- [Anthropic Tool Use 文档](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
