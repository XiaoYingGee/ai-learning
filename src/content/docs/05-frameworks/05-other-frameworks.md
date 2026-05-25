---
title: "其他 Agent 框架"
description: "CrewAI、AutoGen、Semantic Kernel、Strands Agents 等框架概览"
---

## CrewAI：角色扮演多 Agent

CrewAI 的核心理念是**让多个 Agent 像一个团队一样协作**。每个 Agent 扮演特定角色（Role），拥有明确的目标（Goal）和背景故事（Backstory）。

```python
from crewai import Agent, Task, Crew

# 定义角色
researcher = Agent(
    role="市场研究员",
    goal="收集和分析市场数据",
    backstory="你是一位资深市场研究员，擅长发现行业趋势。",
    tools=[search_tool, web_scraper],
)

writer = Agent(
    role="报告撰写人",
    goal="将研究数据整理成专业报告",
    backstory="你是一位经验丰富的商业写作专家。",
)

# 定义任务
research_task = Task(
    description="研究 2025 年 AI Agent 市场的发展趋势",
    agent=researcher,
    expected_output="结构化的市场研究数据",
)

writing_task = Task(
    description="基于研究数据撰写市场分析报告",
    agent=writer,
    expected_output="一份完整的市场分析报告",
    context=[research_task],  # 依赖研究任务的输出
)

# 组建团队执行
crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])
result = crew.kickoff()
```

**特点：** 上手简单、直觉化的角色定义、自动任务委派。适合快速构建多 Agent 原型。

## AutoGen / AG2：多 Agent 对话

AutoGen 是微软研究院推出的多 Agent 对话框架（社区分支更名为 AG2）。它的核心模式是**Agent 之间通过对话来协作**。

```python
from autogen import AssistantAgent, UserProxyAgent

# AI 助手
assistant = AssistantAgent(
    name="coding_assistant",
    llm_config={"model": "gpt-4o"},
    system_message="你是一个 Python 编程专家。",
)

# 用户代理（可自动执行代码）
user_proxy = UserProxyAgent(
    name="user",
    human_input_mode="NEVER",
    code_execution_config={"work_dir": "output"},
)

# 启动对话
user_proxy.initiate_chat(
    assistant,
    message="用 Python 画一个正弦波的图表",
)
```

**特点：** 支持 Agent 自动执行代码、群聊模式（GroupChat）多 Agent 讨论、灵活的对话终止条件。适合需要代码执行和复杂讨论的场景。

## Semantic Kernel：微软企业级

Semantic Kernel 是微软面向企业的 AI 编排框架，同时支持 C#、Python 和 Java。设计理念是将传统软件工程与 AI 能力无缝融合。

```python
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion

kernel = sk.Kernel()

# 添加 AI 服务
kernel.add_service(AzureChatCompletion(
    deployment_name="gpt-4o",
    endpoint="https://your-resource.openai.azure.com/",
))

# 定义 Plugin（类似工具集合）
class EmailPlugin:
    @sk.kernel_function(description="发送邮件")
    def send_email(self, to: str, subject: str, body: str) -> str:
        return f"邮件已发送至 {to}"

kernel.add_plugin(EmailPlugin(), "email")
```

**特点：** 深度集成 Azure 生态、企业级安全合规、多语言支持、Plugin 架构。适合微软技术栈的企业项目。

## Strands Agents：AWS 出品

Strands Agents 是 AWS 推出的开源 Agent 框架，设计理念是**model-driven**——让模型来驱动 Agent 的行为，而不是框架预设的流程。

```python
from strands import Agent
from strands.tools import tool

@tool
def query_database(sql: str) -> str:
    """执行 SQL 查询"""
    # 实际实现中连接数据库
    return "查询结果: ..."

agent = Agent(
    system_prompt="你是一个数据分析助手。",
    tools=[query_database],
)

response = agent("帮我查询上个月的销售数据")
print(response)
```

**特点：** 极简 API（20 行代码构建 Agent）、内置 25+ AWS 服务工具、支持 MCP、与 Amazon Bedrock 深度集成。

## 各框架一句话总结

| 框架 | 一句话总结 |
|------|-----------|
| **LangChain/LangGraph** | 生态最全的通用 Agent 框架，适合快速原型 |
| **Claude Agent SDK** | Anthropic 官方极简框架，适合 Claude 深度用户 |
| **OpenAI Agents SDK** | OpenAI 官方轻量框架，内置 Guardrail 和 Tracing |
| **Google ADK** | GCP 深度集成 + A2A 协议，适合 Google 生态用户 |
| **CrewAI** | 角色扮演多 Agent，上手最快 |
| **AutoGen/AG2** | 对话式多 Agent + 自动代码执行 |
| **Semantic Kernel** | 微软企业级，多语言支持 |
| **Strands Agents** | AWS 极简框架，model-driven 理念 |

## 自测问题

<details>
<summary>1. CrewAI 和 AutoGen 在多 Agent 协作方式上有什么本质区别？</summary>

CrewAI 基于任务委派——每个 Agent 有明确的角色和任务，按依赖关系顺序执行。AutoGen 基于对话——Agent 之间通过对话交换信息，更灵活但也更难控制。
</details>

<details>
<summary>2. 如果你的公司重度使用 Azure，应该优先考虑哪个框架？</summary>

Semantic Kernel，因为它与 Azure 生态深度集成、支持 C#/Java/Python 多语言、符合企业安全合规要求。
</details>

<details>
<summary>3. Strands Agents 的 "model-driven" 理念是什么意思？</summary>

指让 LLM 自主决定执行流程和工具使用，框架不预设固定的执行路径。这与 LangGraph 等需要预先定义图结构的框架形成对比。
</details>

## 延伸阅读

- [CrewAI 文档](https://docs.crewai.com/)
- [AutoGen 文档](https://microsoft.github.io/autogen/)
- [Semantic Kernel 文档](https://learn.microsoft.com/semantic-kernel/)
- [Strands Agents GitHub](https://github.com/strands-agents/sdk-python)
