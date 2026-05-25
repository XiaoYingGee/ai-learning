---
title: "Function Calling：让 LLM 学会使用工具"
description: "理解 Function Calling / Tool Use 的原理、调用流程，以及 OpenAI 与 Claude 实现方式的异同"
---

## 什么是 Function Calling

想象一下：你问一个百科全书式的学者「今天北京天气怎么样？」，他知识渊博但**无法联网查天气**。Function Calling 就是给这位学者配了一部电话——他虽然不能亲自查天气，但可以**写一张纸条**告诉助手去查，助手查到后把结果念给他，他再组织语言回答你。

Function Calling（也叫 Tool Use）是 LLM 与外部世界交互的核心机制。LLM 本身只能生成文本，但通过 Function Calling，它可以：

- 查询实时数据（天气、股价、数据库）
- 执行操作（发邮件、创建日历事件）
- 调用计算工具（计算器、代码执行器）

## LLM 如何"调用"函数

关键认知：**LLM 并不真正执行函数**。它做的事情是生成一段结构化的 JSON，告诉调用方「我想调用某个函数，参数是这些」。实际的函数执行发生在你的应用代码中。

```
┌─────────────────────────────────────────────────────────┐
│                    完整调用流程                            │
│                                                         │
│  用户："北京今天多少度？"                                   │
│    │                                                    │
│    ▼                                                    │
│  ┌─────────┐   工具定义 + 用户消息                        │
│  │   LLM   │ ◄─────────────────────                     │
│  └────┬────┘                                            │
│       │ 生成 JSON：                                      │
│       │ {"name": "get_weather",                         │
│       │  "arguments": {"city": "北京"}}                  │
│       ▼                                                 │
│  ┌──────────────┐                                       │
│  │ 你的应用代码   │ ── 调用真正的天气 API                   │
│  └──────┬───────┘                                       │
│         │ 返回结果：{"temp": 28, "condition": "晴"}       │
│         ▼                                               │
│  ┌─────────┐                                            │
│  │   LLM   │ ── 组织自然语言回复                          │
│  └────┬────┘                                            │
│       │                                                 │
│       ▼                                                 │
│  "北京今天 28°C，晴天，适合出行！"                          │
└─────────────────────────────────────────────────────────┘
```

## OpenAI Function Calling vs Claude Tool Use

两者理念相同，但 API 设计有差异：

| 维度 | OpenAI Function Calling | Claude Tool Use |
|------|------------------------|-----------------|
| 工具定义位置 | `tools` 参数 | `tools` 参数 |
| Schema 格式 | JSON Schema | JSON Schema |
| 响应格式 | `tool_calls` 数组 | `tool_use` content block |
| 并行调用 | 支持（一次返回多个） | 支持 |
| 强制调用 | `tool_choice: "required"` | `tool_choice: {"type": "any"}` |
| 结果回传 | `role: "tool"` 消息 | `tool_result` content block |

核心区别在于消息结构：OpenAI 使用独立的 `tool` role 消息回传结果，Claude 将工具结果嵌套在 `user` 消息的 content block 中。

## 代码示例：一个简单的 Function Calling

以 OpenAI 格式为例，实现一个查询天气的 Function Calling：

```python
from openai import OpenAI

client = OpenAI()

# 1. 定义工具
tools = [
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
                        "description": "城市名称，如 '北京'、'上海'"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 2. 发送请求
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "北京今天天气怎么样？"}],
    tools=tools,
)

# 3. 检查是否有工具调用
message = response.choices[0].message
if message.tool_calls:
    tool_call = message.tool_calls[0]
    print(f"LLM 想调用: {tool_call.function.name}")
    print(f"参数: {tool_call.function.arguments}")

    # 4. 执行函数（这里用模拟数据）
    result = '{"temp": 28, "condition": "晴", "humidity": 45}'

    # 5. 将结果回传给 LLM
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "北京今天天气怎么样？"},
            message,  # 包含 tool_calls 的 assistant 消息
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            },
        ],
        tools=tools,
    )
    print(final_response.choices[0].message.content)
```

## 常见误区

1. **LLM 不执行代码** —— 它只是生成调用意图，执行在你的代码里
2. **Function Calling 不是 100% 可靠** —— LLM 可能选错工具或生成无效参数
3. **工具描述至关重要** —— 描述不清楚，LLM 就不知道何时该用这个工具

---

<details>
<summary><strong>自测题</strong></summary>

1. **Function Calling 中，LLM 实际做了什么？**
   - 答：生成结构化的 JSON（函数名 + 参数），而不是真正执行函数。

2. **OpenAI 和 Claude 在工具结果回传上有什么区别？**
   - 答：OpenAI 使用独立的 `role: "tool"` 消息，Claude 将 `tool_result` 嵌套在 `user` 消息的 content block 中。

3. **为什么说工具描述比工具名称更重要？**
   - 答：LLM 依赖描述来理解工具的用途和使用场景，描述不清会导致工具选择错误。

</details>

## 延伸阅读

- [OpenAI Function Calling 文档](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use 文档](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [Function Calling 最佳实践 (OpenAI Cookbook)](https://cookbook.openai.com/examples/how_to_call_functions_with_chat_models)
