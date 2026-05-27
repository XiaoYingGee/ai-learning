---
title: "评测体系"
description: "Eval-Driven Development、评测维度、自动化评测与 Human-in-the-loop"
---

## Eval-Driven Development

传统软件开发有 TDD（Test-Driven Development）；Agent 开发需要 **EDD（Eval-Driven Development）**。

核心理念：**在写 Prompt 之前先写评测，用评测指标驱动迭代**。

:::tip[相关章节：RAG 评测指标]
如果你的 Agent 包含 RAG 管线，[第四章 RAG 评测](/07-production/04-evaluation/) 中介绍的 Faithfulness、Answer Relevance、Context Precision 等指标可以直接用在本章的评测框架中，作为 RAG 维度的评分标准。
:::

```
定义评测集 → 写初始 Prompt → 运行评测 → 分析结果 → 优化 Prompt → 重复
```

为什么传统单元测试不够？因为 LLM 的输出是非确定性的——相同输入可能产生不同但都正确的输出，简单的字符串匹配无法判断对错。

## 评测维度

| 维度 | 说明 | 评测方法 |
|------|------|---------|
| **准确性** | 答案是否事实正确 | LLM-as-Judge / 人工标注 |
| **相关性** | 答案是否切题 | 语义相似度 / LLM 评分 |
| **完整性** | 是否覆盖了所有要点 | Checklist 检查 |
| **安全性** | 是否包含有害内容 | 分类器 / 关键词过滤 |
| **格式合规** | 输出格式是否正确 | 正则匹配 / Schema 校验 |
| **延迟** | 响应时间 | 计时 |
| **成本** | Token 消耗 | Token 计数 |

## 自动化评测 Pipeline

```python
from dataclasses import dataclass
from openai import OpenAI

client = OpenAI()

@dataclass
class EvalCase:
    """评测用例"""
    query: str
    expected_answer: str | None = None  # 参考答案（可选）
    criteria: list[str] = None          # 评判标准

@dataclass
class EvalResult:
    """评测结果"""
    case: EvalCase
    actual_output: str
    scores: dict[str, float]  # 各维度评分
    feedback: str

def llm_as_judge(
    query: str,
    actual_output: str,
    expected_answer: str | None = None,
    criteria: list[str] | None = None,
) -> dict:
    """用 LLM 作为评委打分"""
    criteria_text = "\n".join(criteria) if criteria else "准确性、相关性、完整性"

    judge_prompt = f"""你是一个严格的 AI 输出质量评委。

用户问题: {query}
AI 回答: {actual_output}
{"参考答案: " + expected_answer if expected_answer else ""}

评判标准:
{criteria_text}

请对每个标准打分（1-10），并给出简短反馈。
以 JSON 格式输出: {{"scores": {{"维度": 分数}}, "feedback": "总体评价"}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": judge_prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def run_eval_pipeline(
    agent_fn,
    eval_cases: list[EvalCase],
) -> list[EvalResult]:
    """运行完整评测管线"""
    results = []

    for i, case in enumerate(eval_cases):
        print(f"评测 {i+1}/{len(eval_cases)}: {case.query[:50]}...")

        # 运行 Agent
        actual_output = agent_fn(case.query)

        # LLM 评判
        judgement = llm_as_judge(
            query=case.query,
            actual_output=actual_output,
            expected_answer=case.expected_answer,
            criteria=case.criteria,
        )

        result = EvalResult(
            case=case,
            actual_output=actual_output,
            scores=judgement["scores"],
            feedback=judgement["feedback"],
        )
        results.append(result)

    # 打印摘要
    all_scores = {}
    for r in results:
        for dim, score in r.scores.items():
            all_scores.setdefault(dim, []).append(score)

    print("\n=== 评测摘要 ===")
    for dim, scores in all_scores.items():
        avg = sum(scores) / len(scores)
        print(f"{dim}: {avg:.1f}/10")

    return results
```

## Human-in-the-loop 评测

自动评测有局限性，关键场景需要人工评审：

**适合自动评测的：**
- 格式是否正确
- 是否包含敏感词
- 延迟和成本指标
- 大规模回归测试

**需要人工评测的：**
- 创意内容质量
- 微妙的事实错误
- 语气和风格是否合适
- 边界情况和 Corner Case

实践建议：先用自动评测过滤掉明显的问题，再将需要细看的样本交给人工审核。

## Benchmark 与 A/B 测试

**Benchmark**：固定一组评测用例，每次修改 Prompt/模型后重新跑分，对比前后变化。

```python
# 版本对比
results_v1 = run_eval_pipeline(agent_v1, eval_cases)
results_v2 = run_eval_pipeline(agent_v2, eval_cases)

for dim in all_dimensions:
    avg_v1 = average(results_v1, dim)
    avg_v2 = average(results_v2, dim)
    delta = avg_v2 - avg_v1
    print(f"{dim}: v1={avg_v1:.1f} → v2={avg_v2:.1f} ({'+' if delta>0 else ''}{delta:.1f})")
```

**A/B 测试**：在生产环境中，将用户流量按比例分配到不同版本，收集真实用户反馈。

## 自测问题

<div class="card-quiz">
  <details>
    <summary>自测题 1：为什么 LLM-as-Judge 比字符串匹配更适合评测 Agent 输出？</summary>
    <div class="answer">LLM 输出是非确定性的，同一个问题可能有多种正确的表述方式。字符串匹配只能检查精确一致；LLM-as-Judge 能理解语义，判断不同表述是否表达了相同含义。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：Eval-Driven Development 中，为什么要先写评测再写 Prompt？</summary>
    <div class="answer">先定义"什么是好的输出"，才能客观衡量 Prompt 的效果。否则容易陷入主观判断，每次修改都不确定是改好了还是改坏了。评测集就像单元测试，是 Prompt 迭代的安全网。</div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：用 GPT-4o 作为 Judge 评测 GPT-4o 生成的内容，有什么潜在问题？</summary>
    <div class="answer">模型可能对自己风格的输出有偏好（self-preference bias），给出偏高的分数。最佳实践是用不同模型做 Judge（如用 Claude 评测 GPT 的输出），或结合人工评测交叉验证。</div>
  </details>
</div>

## 延伸阅读

- [Braintrust Eval 框架](https://www.braintrustdata.com/)
- [OpenAI Evals](https://github.com/openai/evals)
- [LLM-as-Judge 论文](https://arxiv.org/abs/2306.05685)
