---
title: "Tool Schema 设计：让 LLM 精准选择工具"
description: "掌握 JSON Schema 定义工具的方法，以及工具命名、描述、参数设计的最佳实践"
---

## JSON Schema 定义工具

:::note[术语：JSON Schema]
JSON Schema 是一种用于描述 JSON 数据结构的标准规范。它定义了数据的类型、必需字段、可选字段、取值范围等约束。在 Function Calling 中，JSON Schema 用来告诉 LLM 每个工具接受什么参数、参数的类型和格式。详见 [json-schema.org](https://json-schema.org/)。
:::

工具定义就像给 LLM 一本「工具说明书」。说明书写得好不好，直接决定 LLM 能不能在正确的时机选择正确的工具。

一个标准的工具定义包含三要素：

```
┌─────────────────────────────────┐
│         Tool Definition         │
├─────────────────────────────────┤
│  name: "search_products"        │  ← 工具名称
│  description: "在商品数据库中    │  ← 工具描述（最关键）
│    搜索商品，支持按名称、分类、  │
│    价格范围过滤"                 │
│  parameters:                    │  ← 参数 Schema
│    ├─ query (string, required)  │
│    ├─ category (enum, optional) │
│    └─ max_price (number, opt.)  │
└─────────────────────────────────┘
```

```python
tool_schema = {
    "name": "search_products",
    "description": "在商品数据库中搜索商品。当用户想查找、浏览或比较商品时使用此工具。",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词，如 '无线耳机'、'机械键盘'"
            },
            "category": {
                "type": "string",
                "enum": ["electronics", "clothing", "books", "home"],
                "description": "商品分类，不确定时不传此参数"
            },
            "max_price": {
                "type": "number",
                "description": "最高价格（元），用于筛选预算范围内的商品"
            }
        },
        "required": ["query"]
    }
}
```

## 参数描述的重要性

LLM 选择工具的准确性 **70% 取决于描述质量**。看两个对比：

```
❌ 差的描述
name: "query"
description: "查询参数"

✅ 好的描述
name: "query"  
description: "搜索关键词，支持商品名称、品牌、型号。
例如：'Sony WH-1000XM5'、'机械键盘 红轴'"
```

描述撰写原则：

1. **说清楚做什么** —— 不是「查询」，而是「在商品数据库中按关键词搜索」
2. **说清楚何时用** —— 「当用户想查找商品时使用」
3. **给出示例值** —— 帮助 LLM 理解参数格式
4. **说明边界情况** —— 「不确定分类时不传此参数」

## 工具数量多时的路由策略

当工具超过 10-20 个，LLM 选择准确率会下降。常用策略：

```
┌────────────────────────────────────────────┐
│           工具路由策略                       │
├────────────────────────────────────────────┤
│                                            │
│  策略 1：分层路由                            │
│  ┌─────────┐                               │
│  │  Router  │ ─→ 先选分类 ─→ 再选具体工具    │
│  └─────────┘                               │
│  "用户管理" → [create_user, delete_user]    │
│  "订单管理" → [create_order, query_order]   │
│                                            │
│  策略 2：动态加载                            │
│  根据对话上下文只加载相关工具                  │
│  聊天关于订单 → 只加载订单相关工具             │
│                                            │
│  策略 3：工具描述中嵌入关键词                  │
│  让 LLM 通过关键词匹配快速定位                │
│                                            │
└────────────────────────────────────────────┘
```

实际工程中推荐 **策略 1 + 策略 2 混合**：先用一个轻量级 LLM 调用做路由分类，再把对应类别的工具传给主 LLM。

## 并行工具调用

现代 LLM 支持一次返回多个工具调用，适用于互不依赖的操作：

```python
# 用户："帮我查北京和上海的天气"
# LLM 一次性返回两个 tool_calls：
# tool_calls[0]: get_weather(city="北京")
# tool_calls[1]: get_weather(city="上海")

# 你可以并行执行，然后一起回传结果
import asyncio

async def handle_parallel_calls(tool_calls):
    tasks = []
    for call in tool_calls:
        args = json.loads(call.function.arguments)
        tasks.append(get_weather_async(args["city"]))
    
    results = await asyncio.gather(*tasks)
    
    # 构建回传消息
    tool_messages = []
    for call, result in zip(tool_calls, results):
        tool_messages.append({
            "role": "tool",
            "tool_call_id": call.id,
            "content": json.dumps(result),
        })
    return tool_messages
```

## 最佳实践清单

| 维度 | 建议 |
|------|------|
| **命名** | 使用 `动词_名词` 格式：`search_products`、`create_user` |
| **描述** | 包含：做什么 + 何时用 + 示例 |
| **参数** | 必需参数尽量少，用 `enum` 约束有限选项 |
| **数量** | 单次调用建议 ≤ 20 个工具，超过则分层路由 |
| **错误处理** | 工具返回结果应包含 `success/error` 状态 |
| **幂等性** | 写操作的工具要考虑重复调用的安全性 |

:::note[术语：幂等性 (Idempotent)]
幂等性是指同一操作执行多次与执行一次的效果完全相同。例如"设置用户名为 Alice"是幂等的（执行 10 次结果不变），而"给账户余额加 100 元"不是幂等的（执行 10 次会加 1000 元）。在工具设计中，写操作应尽量设计为幂等的，因为 LLM 可能因超时或重试而重复调用同一工具。
:::

---

<div class="card-quiz">
  <details>
    <summary>自测题 1：为什么工具的 description 比 name 更重要？</summary>
    <div class="answer">
      LLM 主要依赖 description 来理解工具的用途、适用场景和使用时机，name 只是标识符。一个叫 <code>do_stuff</code> 但描述清晰的工具，比一个叫 <code>search_products</code> 但描述模糊的工具更容易被正确调用。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：当系统有 50 个工具时，应该怎么处理？</summary>
    <div class="answer">
      使用分层路由（先用轻量级 LLM 把工具分类，再把相关类别的工具传给主 LLM）或动态加载（根据对话上下文只加载相关工具）。比如用户在聊订单，就只加载订单相关的 5 个工具，而不是全部 50 个。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：并行工具调用的前提条件是什么？</summary>
    <div class="answer">
      多个工具调用之间没有依赖关系，即后一个调用不需要前一个的结果。例如"查北京和上海天气"可以并行，但"先查用户 ID，再用 ID 查订单"必须串行。
    </div>
  </details>
</div>

## 延伸阅读

- [OpenAI 工具使用最佳实践](https://platform.openai.com/docs/guides/function-calling/best-practices)
- [JSON Schema 规范](https://json-schema.org/learn/getting-started-step-by-step)
- [Anthropic Tool Use 设计指南](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/best-practices)
