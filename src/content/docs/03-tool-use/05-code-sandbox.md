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

<div style="display:flex;gap:2rem;justify-content:center;margin:1.5rem 0;flex-wrap:wrap;">
  <div style="border:2px solid #ef4444;border-radius:12px;padding:1.2rem 1.5rem;min-width:200px;">
    <div style="font-weight:bold;color:#ef4444;margin-bottom:.5rem;">❌ 纯 LLM</div>
    <div style="font-size:.9rem;">"根据数据，大致呈上升趋势..."<br/>（瞎猜，无法验证）</div>
  </div>
  <div style="border:2px solid #22c55e;border-radius:12px;padding:1.2rem 1.5rem;min-width:200px;">
    <div style="font-weight:bold;color:#22c55e;margin-bottom:.5rem;">✅ LLM + Code Interpreter</div>
    <div style="font-size:.9rem;">→ 写 Python 读取 CSV<br/>→ 执行 pandas 分析<br/>→ 用 matplotlib 画图<br/>→ 基于实际结果回答</div>
  </div>
</div>

## 沙箱隔离的必要性

让 AI 执行代码听起来很酷，但也很危险。如果不做隔离：

- LLM 可能生成 `rm -rf /` 删除整个系统
- 恶意用户可能诱导 Agent 执行攻击代码
- 代码可能消耗无限资源（死循环、内存泄漏）

**沙箱 (Sandbox)** 就是一个受限的执行环境，像一个透明的「玻璃房间」—— 代码可以在里面运行，但无法影响外部系统。

:::note[术语：沙箱 (Sandbox)]
沙箱是一种安全机制，将程序的运行隔离在受限环境中，使其无法访问或修改外部系统资源。名称源自儿童在沙箱中玩耍——无论怎么折腾，影响范围都限定在沙箱内部。在 AI 代码执行场景中，沙箱防止 LLM 生成的代码对宿主系统造成破坏。
:::

<div style="border:2px solid #888;border-radius:12px;padding:1rem;margin:1.5rem 0;">
  <div style="font-weight:bold;margin-bottom:.5rem;">Host System</div>
  <div style="border:2px solid #f97316;border-radius:8px;padding:1rem;margin:.5rem;">
    <div class="question">Sandbox（沙箱）</div>
    <div style="border:1px dashed #666;border-radius:6px;padding:.8rem;">
      <div style="font-weight:bold;margin-bottom:.5rem;">代码在这里执行</div>
      <div style="font-size:.9rem;">
        ✅ 可以读写临时文件<br/>
        ✅ 可以使用 CPU/内存（限额）<br/>
        ❌ 不能访问宿主网络<br/>
        ❌ 不能读写宿主文件<br/>
        ❌ 不能安装系统级软件
      </div>
    </div>
  </div>
</div>

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

:::note[术语：gVisor]
gVisor 是 Google 开源的容器沙箱运行时。与 Docker 默认共享宿主内核不同，gVisor 实现了一个用户态的"虚拟内核"，拦截并重新实现系统调用，从而在容器和宿主内核之间增加了一层隔离。代价是有一定性能开销，但安全性远高于普通容器。
:::

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

### 安全深度：为什么"裸 Docker"不够安全

很多人认为把代码丢到 Docker 容器里就安全了，但实际上 Docker 的默认隔离是不够的：

- **共享内核** —— Docker 容器与宿主共享 Linux 内核，内核漏洞可能导致容器逃逸（container escape）
- **默认权限过大** —— 不加限制的容器可能挂载宿主目录、访问宿主网络
- **镜像供应链风险** —— 使用未审计的第三方镜像可能包含恶意代码

生产环境的安全加固措施：
- 使用 `--security-opt no-new-privileges` 防止权限提升
- 使用 `--read-only` 只读文件系统 + tmpfs 临时目录
- 使用 seccomp profile 限制系统调用
- 使用 gVisor 或 Kata Containers 实现内核级隔离
- 使用 `--network none` 彻底禁用网络（除非明确需要）

:::tip[与其他章节的关联]
代码沙箱是 AI 编程助手的核心基础设施。在 [第 6 章：Coding Agent](/06-coding/) 中，你将看到 Coding Agent 如何利用代码沙箱来编写、执行和验证代码，实现"写代码 → 运行 → 看结果 → 修复"的自动化循环。
:::

---

<div class="card-quiz">
  <details>
    <summary>自测题 1：为什么 LLM 需要代码执行能力，它自己不能计算吗？</summary>
    <div class="answer">
      LLM 通过 token 预测工作，不是精确计算引擎，复杂计算容易出错。代码执行提供了确定性的计算能力。类比：LLM 像一个文科学者，让它做精确数学不如给它一台计算器。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：沙箱需要限制哪些资源？为什么？</summary>
    <div class="answer">
      CPU 时间（防死循环）、内存（防泄漏）、网络（防攻击或数据外泄）、文件系统（防数据窃取）、执行时间（防无限运行）。每一项不限制都可能被恶意利用或因 LLM 生成的错误代码导致系统崩溃。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：E2B 和 Docker 自建沙箱各有什么优缺点？</summary>
    <div class="answer">
      E2B 开箱即用、无需管理基础设施、API 简洁，但依赖第三方服务（数据隐私和可用性风险）；Docker 自建灵活可控、可离线运行、无供应商锁定，但需要自己处理安全加固（seccomp、gVisor 等）和运维。
    </div>
  </details>
</div>

## 延伸阅读

- [E2B Code Interpreter SDK](https://e2b.dev/docs)
- [OpenAI Code Interpreter 文档](https://platform.openai.com/docs/assistants/tools/code-interpreter)
- [Docker 安全最佳实践](https://docs.docker.com/engine/security/)
- [gVisor 沙箱容器](https://gvisor.dev/)
