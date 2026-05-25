---
title: "代码沙箱：安全的代码执行环境"
description: "理解 Agent 为什么需要代码执行能力、沙箱隔离的必要性，以及各种沙箱方案对比"
---

## 为什么 Agent 需要代码执行能力

LLM 擅长推理和语言理解，但有些任务它天生不擅长：

- **精确计算** —— 问 LLM「123456 × 789012 = ?」它经常算错
- **数据分析** —— 给一个 CSV 文件画统计图
- **代码验证** —— 写完代码后验证能不能跑通

Code Interpreter（代码解释器）让 Agent 能够**编写并执行代码**，用代码的确定性弥补 LLM 的不确定性。

```
┌────────────────────────────────────────┐
│       没有代码执行  vs  有代码执行        │
│                                        │
│  用户："分析这个 CSV 数据的趋势"          │
│                                        │
│  ❌ 纯 LLM：                           │
│  "根据数据，大致呈上升趋势..."（瞎猜）    │
│                                        │
│  ✅ LLM + Code Interpreter：           │
│  → 写 Python 代码读取 CSV              │
│  → 执行 pandas 分析                    │
│  → 用 matplotlib 画图                  │
│  → 基于实际结果回答                     │
└────────────────────────────────────────┘
```

## 沙箱隔离的必要性

让 AI 执行代码听起来很酷，但也很危险。如果不做隔离：

- LLM 可能生成 `rm -rf /` 删除整个系统
- 恶意用户可能诱导 Agent 执行攻击代码
- 代码可能消耗无限资源（死循环、内存泄漏）

**沙箱 (Sandbox)** 就是一个受限的执行环境，像一个透明的「玻璃房间」—— 代码可以在里面运行，但无法影响外部系统。

```
┌──────────────────────────────────────────┐
│              Host System                  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │          Sandbox (沙箱)             │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │     代码在这里执行              │  │
│  │  │     ✅ 可以读写临时文件         │  │
│  │  │     ✅ 可以使用 CPU/内存（限额） │  │
│  │  │     ❌ 不能访问宿主网络         │  │
│  │  │     ❌ 不能读写宿主文件         │  │
│  │  │     ❌ 不能安装系统级软件        │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

## Code Interpreter 模式

主流 LLM 平台都提供了内置的代码执行能力：

### OpenAI Code Interpreter

- 内置于 ChatGPT 和 Assistants API
- 支持 Python，预装常用数据分析库
- 可上传/下载文件
- 执行环境自动创建和销毁

### Claude Code Execution

- Anthropic 提供的 Analysis Tool
- 支持 Python 执行
- 通过 API 的 tool 机制调用

```python
# OpenAI Assistants API 使用 Code Interpreter 示例
from openai import OpenAI

client = OpenAI()

assistant = client.beta.assistants.create(
    name="Data Analyst",
    instructions="你是数据分析助手，用 Python 代码分析数据。",
    tools=[{"type": "code_interpreter"}],
    model="gpt-4o",
)

# 上传文件并让 Assistant 分析
thread = client.beta.threads.create()
message = client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="帮我分析这组数据的均值和标准差：[23, 45, 67, 89, 12, 34, 56]",
)
```

## 自建沙箱方案

当内置方案不够灵活时，可以自建沙箱：

| 方案 | 特点 | 适用场景 |
|------|------|---------|
| **Docker** | 容器隔离，自由定制环境 | 需要特定依赖的场景 |
| **E2B** | 云端沙箱 SDK，开箱即用 | 快速集成，不想管理基础设施 |
| **Modal** | Serverless 容器，按需启动 | 需要 GPU 或高性能计算 |
| **gVisor** | 内核级隔离，安全性最高 | 安全要求极高的生产环境 |

使用 E2B 的示例：

```python
from e2b_code_interpreter import Sandbox

# 创建沙箱实例
sandbox = Sandbox()

# 在沙箱中执行代码
execution = sandbox.run_code("""
import numpy as np
data = [23, 45, 67, 89, 12, 34, 56]
print(f"均值: {np.mean(data):.2f}")
print(f"标准差: {np.std(data):.2f}")
""")

print(execution.text)  # 获取输出
sandbox.close()
```

## 安全考量

构建代码沙箱时必须考虑的安全维度：

1. **资源限制** —— CPU 时间、内存上限、磁盘空间、进程数量
2. **网络隔离** —— 是否允许访问外网，如果允许要有白名单
3. **文件系统隔离** —— 只能访问临时目录，不能读宿主文件
4. **超时机制** —— 防止死循环，通常设 30-120 秒超时
5. **输出限制** —— 限制 stdout/stderr 大小，防止内存耗尽

---

<details>
<summary><strong>自测题</strong></summary>

1. **为什么 LLM 需要代码执行能力，它自己不能计算吗？**
   - 答：LLM 通过 token 预测工作，不是精确计算引擎，复杂计算容易出错。代码执行提供了确定性的计算能力。

2. **沙箱需要限制哪些资源？为什么？**
   - 答：CPU 时间（防死循环）、内存（防泄漏）、网络（防攻击）、文件系统（防数据窃取）、执行时间（防无限运行）。

3. **E2B 和 Docker 自建沙箱各有什么优缺点？**
   - 答：E2B 开箱即用、无需管理基础设施，但依赖第三方服务；Docker 自建灵活可控，但需要自己处理安全加固和运维。

</details>

## 延伸阅读

- [E2B Code Interpreter SDK](https://e2b.dev/docs)
- [OpenAI Code Interpreter 文档](https://platform.openai.com/docs/assistants/tools/code-interpreter)
- [Docker 安全最佳实践](https://docs.docker.com/engine/security/)
- [gVisor 沙箱容器](https://gvisor.dev/)
