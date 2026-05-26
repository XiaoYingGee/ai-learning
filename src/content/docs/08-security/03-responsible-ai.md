---
title: "负责任的 AI"
description: "Responsible Scaling Policy、AI 对齐基础、偏见公平性与透明度"
---

## Anthropic Responsible Scaling Policy

Anthropic 提出了 **Responsible Scaling Policy（RSP）**，这是一套系统性的 AI 安全框架，核心思想是：**随着模型能力的提升，安全措施也必须相应升级**。

RSP 定义了多个 **AI Safety Level（ASL）**：

| 级别 | 能力水平 | 安全要求 |
|------|---------|---------|
| **ASL-1** | 无显著风险 | 基本安全措施 |
| **ASL-2** | 当前大型模型 | 标准安全评测、使用策略 |
| **ASL-3** | 显著提升的危险能力 | 加强安全评测、部署限制、安全研究投入 |
| **ASL-4+** | 未来极强能力 | 极端安全措施，需全新安全范式 |

对 Agent 开发者的启示：
- 模型越强大，在你的应用中需要的 Guardrails 越多
- 定期评估你的 Agent 是否可能被滥用
- 关注上游模型的安全更新

## AI 对齐（Alignment）基础

AI 对齐指的是确保 AI 系统的行为**与人类意图和价值观一致**。这是 AI 安全的核心问题。

### 三个层面

**1. 指令对齐（Instruction Following）**

AI 能正确理解并执行人类给出的指令。这是最基础的对齐。

```
指令: "帮我写一封正式的辞职信"
对齐的输出: 一封语气得体、格式规范的辞职信
不对齐: 一封充满抱怨的吐槽邮件
```

**2. 意图对齐（Intent Alignment）**

AI 理解指令背后的**真正意图**，而不是字面意思。

```
指令: "让这段代码运行更快"
字面意思: 删掉所有错误处理代码（确实更快了）
真正意图: 在保持功能正确的前提下优化性能
```

**3. 价值对齐（Value Alignment）**

AI 的行为符合人类社会的基本价值观（公平、诚实、不伤害）。

这是最难的层面——不同文化、不同群体对"价值观"的定义不同。

### 对齐税（Alignment Tax）

对齐措施不是免费的——它们会降低模型的某些能力或增加延迟。好的对齐方案应该**最小化这个代价**。

## 偏见与公平性

LLM 从训练数据中学习，训练数据中的偏见会被模型放大：

**常见偏见类型：**
- **性别偏见**：将"护士"默认为女性，"工程师"默认为男性
- **种族偏见**：对不同种族的描述使用不同的情感倾向
- **文化偏见**：以西方视角为默认，忽视其他文化
- **确认偏见**：倾向于生成与问题暗示一致的回答

**缓解措施：**

```python
# 在 Agent 的系统提示中明确要求
system_prompt = """
公平性原则:
- 不要基于性别、种族、年龄等做出假设
- 涉及人群描述时使用中性语言
- 如果问题本身包含偏见性假设，指出并纠正
- 提供多元化的视角和建议
"""

# 评测阶段检查偏见
bias_test_cases = [
    {"query": "推荐一个适合的编程语言", "check": "不应假设用户性别"},
    {"query": "描述一个成功的企业家", "check": "不应默认为特定种族"},
]
```

## 透明度与可解释性

用户有权知道：
- 他们在和 AI 交互（而非真人）
- AI 的回答可能不准确
- AI 做出某个决策的原因

```python
class TransparentAgent:
    """透明的 Agent"""

    def respond(self, query: str) -> dict:
        # 获取 Agent 的推理过程
        reasoning_steps = self.think(query)
        final_answer = self.generate(query, reasoning_steps)

        return {
            "answer": final_answer,
            "confidence": self.estimate_confidence(final_answer),
            "sources": self.get_sources(),
            "disclaimer": "此回答由 AI 生成，可能存在不准确之处。",
            "reasoning": reasoning_steps,  # 可选：展示推理过程
        }

    def estimate_confidence(self, answer: str) -> str:
        """粗略估计回答的置信度"""
        if "不确定" in answer or "可能" in answer:
            return "low"
        if self.has_source_backing(answer):
            return "high"
        return "medium"
```

### 透明度清单

- [ ] 明确告知用户正在与 AI 交互
- [ ] 对不确定的回答标注置信度
- [ ] 提供信息来源的引用
- [ ] 记录并可追溯 Agent 的决策过程
- [ ] 用户可以要求人工服务

## 自测题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：Responsible Scaling Policy 的核心思想是什么？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">随着 AI 模型能力的提升，安全防护措施必须同步升级。能力越强的模型需要越严格的安全评测和部署控制。例如 ASL-2 级别（当前大模型）需要标准安全评测，而 ASL-3 级别（显著提升的危险能力）需要加强评测和部署限制。这是一个动态的安全框架，核心理念是"能力与安全措施必须共同演进"。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2："意图对齐"和"指令对齐"有什么区别？举一个例子。</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">指令对齐是按字面意思执行指令；意图对齐是理解指令背后的真正目的。例如用户说"帮我简化这段代码"，字面上可以删掉所有注释和错误处理（更简短了），但意图是在保持可读性和健壮性的前提下减少冗余代码。再如"让测试通过"——字面对齐可能删掉失败的测试用例，意图对齐则应修复代码使测试合理通过。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：为什么说 AI 的偏见问题很难彻底解决？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">因为偏见存在于训练数据中，而训练数据来源于人类社会——社会本身就存在各种偏见。完全消除训练数据中的偏见几乎不可能，只能通过多种缓解措施来减少偏见的影响。此外，"公平"本身就没有统一的定义——对一个群体公平的标准可能对另一个群体不公平（如统计平等 vs 机会均等），这使得偏见问题从根本上就是一个持续优化而非一次解决的过程。</div>
  </details>
</div>

## 延伸阅读

- [Anthropic Responsible Scaling Policy](https://www.anthropic.com/news/anthropics-responsible-scaling-policy)
- [AI Alignment 入门](https://alignmentforum.org/)
- [Fairness in Machine Learning](https://fairmlbook.org/)
