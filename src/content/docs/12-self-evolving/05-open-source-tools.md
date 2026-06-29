---
title: "开源项目与工具集"
description: "Agent 自评估与自进化领域的开源项目、工具、Awesome List 合集——按评估、优化、进化三层分类整理。"
lastUpdated: 2026-06-30
---

## Awesome Lists（入口导航）

先收藏这些，它们持续追踪领域最新进展：

| 仓库 | 维护方 | 说明 |
|------|--------|------|
| [Awesome-Self-Improving-Agents](https://github.com/TsinghuaC3I/Awesome-Self-Improving-Agents) | 清华 C3I | 自改进 Agent 综述配套，覆盖 harness/skills/memory/meta-evolution |
| [Awesome-Self-Evolving-Agents](https://github.com/XMUDeepLIT/Awesome-Self-Evolving-Agents) | 厦大 DeepLIT | 配套 Survey 论文，按 What/When/How/Where 分类 |
| [awesome-agent-evolution](https://github.com/EvoMap/awesome-agent-evolution) | EvoMap | Agent 进化、记忆系统、多智能体架构合集 |
| [Awesome-Self-Improving-Agents](https://github.com/FrontisAI/Awesome-Self-Improving-Agents) | FrontisAI | "Agents in the Era of Experience" 配套 |

---

## 评估层工具（方案 A 相关）

### 评估框架

| 项目 | Stars | 语言 | 核心能力 | 链接 |
|------|-------|------|---------|------|
| **Promptfoo** | 5k+ | TypeScript | Prompt/Agent 对比测试、红队扫描、CI 集成 | [GitHub](https://github.com/promptfoo/promptfoo) |
| **DeepEval** | 4k+ | Python | 14+ 内置指标、pytest 集成、Confident AI 平台 | [GitHub](https://github.com/confident-ai/deepeval) |
| **RAGAS** | 7k+ | Python | RAG 专项评估（faithfulness/relevance/context） | [GitHub](https://github.com/explodinggradients/ragas) |
| **AgentEval** | 新 | Python | Agent 专项评估框架 | [GitHub](https://github.com/agentkitai/agenteval) |
| **agent-eval-framework** | 新 | Python | 生产级 Agent 评估+持续改进 | [GitHub](https://github.com/goker/agent-eval-framework) |

### Observability（可观测性 + 评分）

| 项目 | 定位 | 自部署 | 核心能力 | 链接 |
|------|------|--------|---------|------|
| **Langfuse** | 开源 Observability | ✅ Docker | Trace、Scoring、Prompt 管理、数据集 | [GitHub](https://github.com/langfuse/langfuse) |
| **Arize Phoenix** | 开源 Observability | ✅ | Trace、LLM Eval、Embedding 分析 | [GitHub](https://github.com/Arize-ai/phoenix) |
| **OpenLIT** | OpenTelemetry for LLM | ✅ | 标准化 trace 采集、Grafana 集成 | [GitHub](https://github.com/openlit/openlit) |
| **Latitude** | Agent Observability | 部分 | 多 Agent trace、评估、prompt 版本 | [GitHub](https://github.com/latitude-dev/latitude) |

### Benchmark 数据集

| 项目 | 评估对象 | 说明 | 链接 |
|------|---------|------|------|
| **AgentBench** | Agent 综合能力 | 8 种环境（OS/DB/Web/Game...）| [GitHub](https://github.com/THUDM/AgentBench) |
| **SWE-bench** | 代码 Agent | 真实 GitHub issue 修复 | [GitHub](https://github.com/princeton-nlp/SWE-bench) |
| **GAIA** | 通用 Agent | 多步推理 + 工具使用 | [HuggingFace](https://huggingface.co/datasets/gaia-benchmark/GAIA) |
| **ToolBench** | 工具使用 | 16000+ 真实 API | [GitHub](https://github.com/OpenBMB/ToolBench) |
| **τ-bench** | 对话式 Agent | 模拟用户多轮交互 | [GitHub](https://github.com/sierra-research/tau-bench) |

---

## 优化层工具（方案 B 相关）

### Prompt 自动优化

| 项目 | 核心思想 | 适用场景 | 链接 |
|------|---------|---------|------|
| **DSPy** | 声明式 Prompt 编程 + 自动编译 | Pipeline 级优化，few-shot 自动选择 | [GitHub](https://github.com/stanfordnlp/dspy) |
| **TextGrad** | 文本梯度反向传播 | 单 prompt 深度优化 | [GitHub](https://github.com/zou-group/textgrad) |
| **OPRO** | LLM 搜索最优 prompt | 目标明确的 prompt 搜索 | [Paper](https://arxiv.org/abs/2309.03409) |
| **EvoPrompt** | 遗传算法 prompt 进化 | 大规模 prompt 变体搜索 | [Paper](https://arxiv.org/abs/2309.08532) |
| **PromptBreeder** | 自引用 prompt 进化 | Prompt + 变异策略协同进化 | [Paper](https://arxiv.org/abs/2309.16797) |

### 经验记忆与反思

| 项目 | 核心思想 | 链接 |
|------|---------|------|
| **Reflexion** | 语言强化学习，经验存文字记忆 | [GitHub](https://github.com/noahshinn/reflexion) |
| **LATS** | 树搜索 + 反思，探索多条推理路径 | [GitHub](https://github.com/laats/lats) |
| **Memento-II** | 有状态反思记忆 | [Paper](https://arxiv.org/abs/2512.22716) |
| **MARS** | 记忆增强 + 反思自改进 | [Paper](https://arxiv.org/pdf/2503.19271v1) |
| **MemoryBank** | 长期记忆管理与遗忘机制 | [GitHub](https://github.com/zhongwanjun/MemoryBank-SiliconFriend) |

### DSPy 生态

| 项目 | 说明 | 链接 |
|------|------|------|
| **DSPy 主仓库** | Stanford NLP 维护，核心框架 | [GitHub](https://github.com/stanfordnlp/dspy) |
| **dspy-0to1-guide** | 从零到一实战教程 | [GitHub](https://github.com/evalops/dspy-0to1-guide) |
| **dspy-agent-forge** | DSPy + Agent 结合示例 | [GitHub](https://github.com/allthingssecurity/dspy-agent-forge) |
| **AutoDSPy** | 用 RL 自动化 DSPy 模块设计 | [Paper (EMNLP 2025)](https://aclanthology.org/anthology-files/anthology-files/anthology-files/pdf/emnlp/2025.emnlp-industry.192.pdf) |

---

## 进化层框架（方案 C 相关）

### 自进化 Agent 框架

| 项目 | 出处 | 进化目标 | 成熟度 | 链接 |
|------|------|---------|--------|------|
| **EvoAgentX** | 开源社区 | 完整自进化生态系统 | 活跃开发中 | [GitHub](https://github.com/EvoAgentX/EvoAgentX) |
| **AgentEvolver** | 阿里 ModelScope | Agent 工作流自进化 | 论文配套 | [GitHub](https://github.com/modelscope/AgentEvolver) |
| **EvolveR** | ICML 2026 | 经验驱动全生命周期 | 论文配套 | [GitHub](https://github.com/KnowledgeXLab/EvolveR) |
| **EvoMaster** | 上海交大 | 科研级大规模进化 | 学术 | [GitHub](https://github.com/sjtu-sai-agents/EvoMaster) |
| **AHE** | arXiv 2604.25850 | Agent Harness 自进化 | 论文配套 | [GitHub](https://github.com/mqbazhaoyu/ahe) |

### 架构搜索与 Meta-Agent

| 项目 | 核心思想 | 链接 |
|------|---------|------|
| **ADAS** | 用代码搜索自动设计 Agent 系统 | [Paper (ICLR 2025)](https://arxiv.org/pdf/2408.08435v2) |
| **MetaAgent-X** | 端到端 RL 突破多智能体设计上限 | [Paper](https://arxiv.org/html/2605.14212) |
| **Meta-Agent (FSM)** | 基于有限状态机自动构建多 Agent 系统 | [Paper](https://arxiv.org/pdf/2507.22606) |
| **High-Order ADAS** | 高阶自动 Agent 系统设计 | [IEEE](https://ieeexplore.ieee.org/document/11158363) |

### 技能库与自动发现

| 项目 | 思路 | 链接 |
|------|------|------|
| **Voyager** | Minecraft Agent 自动发现技能 + 技能库 | [GitHub](https://github.com/MineDojo/Voyager) |
| **Claude Code Skills** | 文件系统承载的技能定义与自动触发 | [Docs](https://code.claude.com/docs/en/skills) |
| **code-voyager** | Voyager 思路用于代码 Agent | [GitHub](https://github.com/zenbase-ai/code-voyager) |
| **Anthropic Agent Skills** | SDK 级别的技能系统 | [Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) |

---

## 综合平台（商业/混合）

供参考架构设计思路，不一定需要直接使用：

| 平台 | 定位 | 开源程度 | 特点 |
|------|------|---------|------|
| [Braintrust](https://braintrust.dev) | Eval + 数据集 + 优化 | 部分开源 | 完整的 eval pipeline |
| [LangSmith](https://smith.langchain.com) | Trace + Eval + 标注 | 闭源 | LangChain 深度集成 |
| [HoneyHive](https://honeyhive.ai) | Eval + Observability | 闭源 | 企业级评估平台 |
| [AgentOps](https://agentops.ai) | Agent 可观测性 | 开源 SDK | 专注 Agent trace |
| [Weights & Biases Weave](https://wandb.ai/site/weave) | LLM 实验追踪 | 部分 | ML 实验管理背景 |

---

## 快速上手推荐

### 如果你只想今天就开始

```bash
# 1. 用 Promptfoo 跑你的第一个 eval
npx promptfoo@latest init
npx promptfoo@latest eval

# 2. 或用 DeepEval (Python)
pip install deepeval
deepeval test generate  # 自动生成测试用例
```

### 如果你有 1 周时间搭 MVP

1. **Langfuse** — 部署 trace 收集 (`docker compose up`)
2. **DeepEval** — 编写评估脚本
3. **DSPy** — 跑通一次 prompt 自动优化

### 如果你在做深度研究

1. 读完 [Awesome-Self-Improving-Agents (清华)](https://github.com/TsinghuaC3I/Awesome-Self-Improving-Agents) 的分类
2. 跑通 [EvoAgentX](https://github.com/EvoAgentX/EvoAgentX) 的 examples
3. 复现 [EvolveR](https://github.com/KnowledgeXLab/EvolveR) 的实验

---

## 持续更新

本文会持续收录新的开源项目。最后更新时间见页面顶部。

如果你发现了好的开源项目，欢迎通过 [GitHub Issue](https://github.com/XiaoYingGee/ai-learning/issues) 提交。
