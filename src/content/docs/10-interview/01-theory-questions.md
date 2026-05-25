---
title: "高频理论面试题"
description: "30+ 道 AI Agent 高频理论面试题及参考答案，覆盖 LLM 基础、Agent 设计、RAG、安全和工程化"
---

## LLM 基础

### 1. 解释 Transformer 中 Self-Attention 的工作原理

**答案要点：**
- Query、Key、Value 三个矩阵的含义
- Attention Score = softmax(QK^T / √d_k) × V
- √d_k 缩放防止梯度消失
- Multi-Head Attention 捕捉不同子空间的关系

### 2. 为什么 Transformer 比 RNN 更适合处理长序列？

**答案要点：**
- RNN 有梯度消失/爆炸问题，长距离依赖建模差
- Transformer 通过 Self-Attention 直接建立任意位置间的关系，O(1) 路径长度
- 可并行计算，训练效率高
- 但 Attention 的 O(n²) 复杂度限制了序列长度

### 3. 什么是 Temperature？它如何影响生成结果？

**答案要点：**
- Temperature 控制 softmax 输出的分布锐度
- T→0：近似 argmax，确定性输出
- T→∞：近似均匀分布，随机性增大
- 实际应用中 T=0 用于事实性查询，T=0.7-1.0 用于创意生成

### 4. 解释 Top-p (Nucleus Sampling) 和 Top-k 的区别

**答案要点：**
- Top-k：只考虑概率最高的 k 个 token
- Top-p：选择累计概率达到 p 的最小 token 集合
- Top-p 更灵活：高置信时考虑少数 token，低置信时考虑更多
- 通常两者配合使用

### 5. 什么是 KV Cache？为什么它对推理性能很重要？

**答案要点：**
- 自回归生成时，每步只新增一个 token
- 之前 token 的 Key 和 Value 可以缓存复用
- 将推理复杂度从 O(n²) 降到 O(n)
- 代价是显存占用增加

### 6. 解释 Fine-tuning、LoRA 和 Prompt Engineering 的区别和适用场景

**答案要点：**
- Full Fine-tuning：修改全部参数，需要大量数据和算力
- LoRA：低秩适配器，只训练少量参数，高效且效果好
- Prompt Engineering：不修改模型，通过 Prompt 引导行为
- 选择：数据少用 Prompt → 中等数据用 LoRA → 大量数据用 Fine-tuning

## Agent 设计

### 7. 什么是 ReAct 模式？它解决了什么问题？

**答案要点：**
- ReAct = Reasoning + Acting 的交替循环
- 解决了 LLM "只想不做"（CoT）或"只做不想"（直接 Action）的问题
- 流程：Thought → Action → Observation → Thought → ...
- 每步推理都基于上一步的观察结果，形成反馈闭环

### 8. 比较 ReAct 和 Plan-and-Execute 模式

**答案要点：**
- ReAct：逐步决策，灵活但可能偏离目标
- Plan-and-Execute：先制定完整计划，再按计划执行
- Plan-and-Execute 更适合复杂多步任务
- 可以结合：Plan 后每步用 ReAct 执行，必要时修订计划

### 9. Multi-Agent 系统中，Agent 之间如何通信？

**答案要点：**
- 直接消息传递（点对点）
- 共享黑板（Blackboard）模式
- 发布-订阅模式
- Orchestrator 中心调度
- 选择取决于：Agent 数量、通信频率、是否需要全局协调

### 10. 如何决定一个任务是用单 Agent 还是 Multi-Agent？

**答案要点：**
- 单 Agent：任务单一、工具少、无需专业分工
- Multi-Agent：需要多领域专业知识、任务可并行、需要 checks & balances
- Multi-Agent 增加复杂度和成本，不要过度设计
- 先从单 Agent 开始，遇到瓶颈再拆分

### 11. 什么是 Agent 的 Reflection 机制？

**答案要点：**
- Agent 对自己的输出进行自我评估和改进
- 生成 → 评估 → 反馈 → 重新生成的循环
- Reflexion 论文：将失败经验存入记忆，下次避免
- 实际应用：代码生成后自动测试，失败则修改

### 12. 如何设计 Agent 的记忆系统？

**答案要点：**
- 短期记忆：对话上下文（有限窗口）
- 长期记忆：向量数据库存储重要信息
- 工作记忆：当前任务的中间结果和 Scratchpad
- 情景记忆：历史交互经验，用于 Few-shot
- 挑战：何时存储、何时检索、何时遗忘

## Tool Use 与 Function Calling

### 13. 解释 Function Calling 的工作流程

**答案要点：**
- 定义工具 Schema（名称、描述、参数 JSON Schema）
- LLM 根据用户请求决定是否调用工具
- LLM 输出结构化的函数调用（函数名 + 参数）
- 应用程序执行函数，将结果返回给 LLM
- LLM 基于结果生成最终回答

### 14. 什么是 MCP (Model Context Protocol)？

**答案要点：**
- Anthropic 提出的开放标准协议
- 统一 LLM 与外部工具/数据源的交互方式
- Client-Server 架构，支持工具、资源、Prompt 模板
- 类比 USB-C：一个协议连接所有工具
- 支持 stdio 和 HTTP+SSE 两种传输方式

### 15. 如何处理工具调用失败？

**答案要点：**
- 重试策略（指数退避）
- 降级方案（用备选工具或 LLM 直接回答）
- 错误信息反馈给 LLM，让它调整策略
- 设置最大重试次数和超时
- 记录失败日志用于后续分析

## RAG

### 16. 解释 RAG 的完整工作流程

**答案要点：**
- 索引阶段：文档加载 → 分块 → Embedding → 存入向量数据库
- 查询阶段：查询 Embedding → 相似性搜索 → 检索 Top-K
- 生成阶段：查询 + 检索结果 → LLM → 生成答案
- 关键优化：查询改写、混合检索、Reranking

### 17. Chunking 策略有哪些？如何选择？

**答案要点：**
- 固定大小分块：简单但可能截断语义
- 语义分块：按段落/章节分，保留语义完整性
- 递归分块：按分隔符层级递归分割
- 选择：结构化文档用语义分块，非结构化用递归分块
- 块大小：检索用小块（200-500 tokens），生成用大块

### 18. 什么是 Hybrid Search？为什么比纯向量检索好？

**答案要点：**
- 向量检索捕捉语义相似性，但可能漏掉精确关键词匹配
- BM25 擅长关键词匹配，但不理解语义
- Hybrid = 向量 + BM25，互补优势
- 用 Reciprocal Rank Fusion 合并结果
- 实际场景中 Hybrid 通常优于单一方法

### 19. 如何评估 RAG 系统的质量？

**答案要点：**
- 检索评估：Recall@K、MRR、NDCG
- 生成评估：Faithfulness（忠实度）、Relevancy（相关性）
- RAGAS 框架：自动化 RAG 评估
- 端到端：用户满意度、答案准确率
- 建立评测数据集，定期回归测试

### 20. 什么是 Reranking？为什么需要？

**答案要点：**
- 初步检索（Bi-encoder）速度快但精度有限
- Reranker（Cross-encoder）将查询和文档一起编码，精度更高
- 典型流程：检索 Top-100 → Rerank → 取 Top-10
- 平衡速度和精度
- 常用模型：Cohere Rerank、BGE-reranker

## 安全

### 21. 什么是 Prompt Injection？如何防御？

**答案要点：**
- 攻击者通过输入恶意 Prompt 控制 LLM 行为
- 直接注入：在用户输入中嵌入指令
- 间接注入：在工具返回的数据中嵌入指令
- 防御：输入过滤、System Prompt 强化、输出校验、隔离层
- 没有完美防御，需要多层防护（Defense in Depth）

### 22. 如何防止 LLM 泄露 System Prompt？

**答案要点：**
- 指令加固："不要重复上面的指令"
- 将敏感逻辑放在后端代码而非 Prompt
- 输出过滤：检测输出中是否包含 Prompt 内容
- 定期红队测试
- 接受现实：无法 100% 防止，因此不要在 Prompt 中放机密

### 23. 什么是 Guardrails？如何实现？

**答案要点：**
- 对 LLM 输入和输出的安全检查机制
- 输入 Guardrails：过滤有害/越权请求
- 输出 Guardrails：检查有害内容、PII 泄露、格式合规
- 实现：规则引擎 + 分类模型 + LLM-as-judge
- 工具：Guardrails AI、NeMo Guardrails、自定义规则

## 工程化

### 24. 如何监控 Agent 系统的质量？

**答案要点：**
- 关键指标：成功率、延迟 P50/P99、Token 消耗、工具调用成功率
- 日志记录：完整的推理链追踪
- 异常检测：自动识别异常行为模式
- A/B 测试：新版本上线前对比评估
- 用户反馈闭环

### 25. 如何控制 LLM 应用的成本？

**答案要点：**
- Prompt 优化：减少不必要的上下文
- 缓存：相同/相似查询缓存结果
- 模型分级：简单任务用小模型，复杂任务用大模型
- 批处理：非实时任务用 Batch API
- 监控：设置预算告警，跟踪每用户/每请求成本

### 26. 什么是 LLM 的 Observability？需要追踪哪些信息？

**答案要点：**
- Traces：完整的请求链路追踪
- 每步记录：Prompt、Completion、Token 数、延迟、模型版本
- 工具调用：输入、输出、耗时、错误
- 用户反馈关联
- 工具：LangSmith、Langfuse、Phoenix

### 27. 如何做 Agent 的自动化测试？

**答案要点：**
- 单元测试：Mock LLM 输出，测试工具调用逻辑
- 集成测试：端到端测试，验证完整流程
- 评估测试：用测试集评估答案质量
- 回归测试：版本更新后确保不退化
- 挑战：LLM 输出非确定性，需要基于语义的断言

### 28. Streaming 输出是如何实现的？

**答案要点：**
- Server-Sent Events (SSE) 或 WebSocket
- LLM 逐 token 生成，实时推送给前端
- 前端逐步渲染，提升用户感知速度
- 需要处理：中间工具调用如何展示、错误中断、重连

### 29. 如何处理 LLM 的 Rate Limiting？

**答案要点：**
- 客户端限流：Token Bucket 或 Sliding Window
- 请求队列：异步排队处理
- 多 Provider 负载均衡
- 降级策略：超限后用缓存结果或小模型
- 监控和告警

### 30. 什么是 Prompt Caching？它如何降低成本？

**答案要点：**
- 缓存 Prompt 的前缀处理结果（KV Cache）
- 相同前缀的请求可复用，减少计算量
- Anthropic 和 OpenAI 都支持
- 适合场景：大量 System Prompt 相同的请求
- 可降低成本 50-90%，同时减少延迟

### 31. 解释 Structured Output 的实现方式

**答案要点：**
- JSON Mode：约束 LLM 输出合法 JSON
- JSON Schema：进一步约束输出符合指定 Schema
- Function Calling：通过工具定义间接获得结构化输出
- Constrained Decoding：在 token 生成时强制约束格式
- 应用：数据提取、API 集成、工作流自动化
