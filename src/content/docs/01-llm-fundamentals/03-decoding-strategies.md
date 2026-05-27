---
title: "解码策略"
description: "LLM 如何一步步生成文本：Greedy Decoding、Temperature、Top-p/Top-k Sampling、Beam Search 及实际调参技巧。"
---

## LLM 如何生成文本？

大语言模型每次只生成**一个 token**。模型输出的是词表中每个 token 的概率分布，然后通过某种策略从中选择一个 token 作为输出。这个选择策略就是**解码策略（Decoding Strategy）**。

:::note[术语：Logits]
Logits 是模型输出的原始未归一化分数——词表中每个 token 都有一个 logit 值，值越大表示模型认为该 token 越可能是下一个词。Logits 经过 Softmax 后才变成概率分布。
:::

```
输入: "今天天气"

模型输出概率分布:
  "很"   → 0.35
  "不"   → 0.25
  "真"   → 0.20
  "挺"   → 0.10
  "太"   → 0.05
  其他   → 0.05

选哪个？→ 取决于解码策略
```

## Greedy Decoding（贪心解码）

最简单的策略：**每一步都选概率最高的 token**。

```python
def greedy_decode(model, input_ids, max_length):
    for _ in range(max_length):
        logits = model(input_ids)          # 获取概率分布
        next_token = logits.argmax(dim=-1) # 取最大概率
        input_ids = append(input_ids, next_token)
        if next_token == EOS:
            break
    return input_ids
```

**优点**：确定性输出，速度快。
**缺点**：生成内容单调重复，容易陷入局部最优。同样的输入永远产生同样的输出。

:::note[术语：EOS]
EOS（End of Sequence）是一个特殊的 token，表示序列结束。当模型生成 EOS 时，表示它认为回答已经完成，应该停止继续生成。
:::

## Temperature（温度）

Temperature 控制概率分布的"锐利程度"。公式：

$$
P(\text{token}_i) = \frac{\exp(\text{logit}_i / T)}{\sum_j \exp(\text{logit}_j / T)}
$$

```
Temperature 对概率分布的影响：

T = 0.1（低温）          T = 1.0（标准）         T = 2.0（高温）
  ▓▓▓▓▓▓▓                   ▓▓▓▓                     ▓▓▓
  ▓      ▓                  ▓  ▓▓                    ▓▓ ▓▓
  ▓      ░                  ▓  ▓ ▓▓                  ▓▓ ▓▓ ▓▓
  ▓      ░ ░                ▓  ▓ ▓ ▓▓               ▓▓ ▓▓ ▓▓ ▓▓
 ─┴──────┴─┴──             ─┴──┴─┴─┴─┴──           ─┴──┴──┴──┴──┴──
 几乎只选最高的            较均匀的分布             非常平坦，近似随机
 → 确定性强                → 适度创造性             → 高度随机
```

- $T \to 0$：趋近 Greedy Decoding
- $T = 1$：使用模型原始概率
- $T > 1$：更多随机性和创造性

## Top-k Sampling

只从概率最高的 k 个 token 中采样，忽略其余。

```python
def top_k_sampling(logits, k=50):
    top_k_logits, top_k_indices = logits.topk(k)
    probs = softmax(top_k_logits)
    selected = random_choice(top_k_indices, p=probs)
    return selected
```

**问题**：k 是固定的。当概率分布很集中时（如只有 2 个合理选项），k=50 会引入太多噪声；当分布平坦时，k=50 又可能太小。

## Top-p（Nucleus Sampling）

动态选择最小的 token 集合，使得它们的累计概率 $\geq p$。

```
示例 (p = 0.9):

Token    概率    累计概率    是否入选
─────    ────    ────────    ────────
"很"     0.35    0.35        ✓
"不"     0.25    0.60        ✓
"真"     0.20    0.80        ✓
"挺"     0.10    0.90        ✓  ← 累计达到 0.9，截断
"太"     0.05    0.95        ✗
其他     0.05    1.00        ✗
```

```python
def top_p_sampling(logits, p=0.9):
    sorted_logits, sorted_indices = logits.sort(descending=True)
    cumulative_probs = softmax(sorted_logits).cumsum(dim=-1)
    # 移除累计概率超过 p 的 token
    mask = cumulative_probs - softmax(sorted_logits) >= p
    sorted_logits[mask] = -float('inf')
    probs = softmax(sorted_logits)
    selected = random_choice(sorted_indices, p=probs)
    return selected
```

Top-p 比 Top-k 更灵活：当模型很确信时，候选集自动缩小；当模型不确定时，候选集自动扩大。

## Beam Search

同时维护多条候选序列（beam），每步扩展概率最高的组合，最后选全局最优。

```
Beam Size = 2 示例：

Step 1:  "今天" → "天气"(0.4) / "很"(0.3)
Step 2:  "天气" → "天气很"(0.4×0.5) / "天气不"(0.4×0.3)
         "很"   → "很好"(0.3×0.6) / "很冷"(0.3×0.2)
最终选:  "天气很"(0.20) 和 "很好"(0.18)
→ 继续扩展...
```

**适用场景**：机器翻译等需要高质量确定性输出的任务。
**不适用**：开放式对话（生成内容太保守和重复）。

## 实际应用中的调参建议

| 场景 | Temperature | Top-p | 建议 |
|------|------------|-------|------|
| 代码生成 | 0.0-0.2 | — | 需要精确，低温或 Greedy |
| 数据提取/分类 | 0.0 | — | 确定性任务，用 Greedy |
| 通用对话 | 0.7-0.8 | 0.9 | 平衡创造性和连贯性 |
| 创意写作 | 0.9-1.2 | 0.95 | 鼓励多样性 |
| 头脑风暴 | 1.0-1.5 | 0.95 | 最大化创造性 |

**注意**：不同 API 的参数组合方式不同。OpenAI 建议只调 Temperature 或 Top-p 之一，不要同时调。Claude API 默认 Temperature=1，Top-p=0.999。

<div class="card-quiz">
  <details>
    <summary>自测题 1：Temperature=0 和 Greedy Decoding 有什么关系？</summary>
    <div class="answer">
      Temperature=0 时，Softmax 输出趋近 one-hot 分布——概率最高的 token 概率趋近 1，其余趋近 0，效果完全等同于 Greedy Decoding（每步选概率最大的 token）。实际实现中 T=0 通常直接用 argmax 跳过 Softmax 计算。<br/><br/>
      可以这样理解：Temperature 就像一个"冒险开关"。T=0 是最保守的设定，模型永远选最有把握的答案；T 越高，模型越愿意尝试低概率但可能更有创意的选项。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 2：为什么 Top-p 比 Top-k 更优？</summary>
    <div class="answer">
      Top-k 使用固定的候选数量（如 k=50），无法适应不同位置上概率分布的差异。比如在"中华人民共和____"这个位置，合理的下一个字只有"国"，但 k=50 会强行保留 50 个候选，引入大量噪声。<br/><br/>
      Top-p 根据累计概率动态调整候选集大小：模型很确信时（概率集中在少数 token 上），候选集自动缩小到 1-2 个；模型不确定时（概率分散），候选集自动扩大。这种自适应机制让采样质量更稳定，是目前大多数 API 的默认策略。
    </div>
  </details>
</div>

<div class="card-quiz">
  <details>
    <summary>自测题 3：为什么代码生成任务通常用低 Temperature？</summary>
    <div class="answer">
      代码有严格的语法规则，一个错误的 token（比如少一个括号、用错一个关键字）就可能导致整个程序无法运行。低 Temperature 让模型更倾向于选择概率最高（最可能正确）的 token，减少随机性带来的语法错误。<br/><br/>
      此外，代码任务通常有明确的"正确答案"，不需要创造性——<code>for i in range(10)</code> 就是比 <code>for i in range(9+1)</code> 更好的写法。而创意写作则相反，需要高 Temperature 来避免千篇一律的表达。
    </div>
  </details>
</div>

## 延伸阅读

- [The Curious Case of Neural Text Degeneration (Top-p 原始论文)](https://arxiv.org/abs/1904.09751)
- [Hugging Face: How to Generate Text](https://huggingface.co/blog/how-to-generate)
- [OpenAI API 参数文档](https://platform.openai.com/docs/api-reference/chat/create)
