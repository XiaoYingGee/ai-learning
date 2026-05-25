---
title: "数据隔离"
description: "多租户数据隔离、工具权限边界、敏感信息脱敏与最小权限原则"
---

## 为什么数据隔离很重要

Agent 可以访问工具和数据源，如果没有严格的隔离，可能出现：

- **租户 A 的 Agent 读取租户 B 的数据**（跨租户泄露）
- **Agent 访问超出其职责范围的系统资源**（权限越界）
- **LLM 在回复中泄露训练数据或上下文中的敏感信息**（信息泄露）

## 多租户环境数据隔离

在 SaaS 场景中，多个租户共享 Agent 服务，必须确保数据严格隔离：

```python
from dataclasses import dataclass

@dataclass
class TenantContext:
    """租户上下文"""
    tenant_id: str
    user_id: str
    permissions: list[str]

class TenantIsolatedAgent:
    """租户隔离的 Agent"""

    def __init__(self, agent_core):
        self.agent_core = agent_core

    def run(self, tenant_ctx: TenantContext, query: str) -> str:
        # 1. 注入租户上下文到所有工具调用
        scoped_tools = self._scope_tools(tenant_ctx)

        # 2. 系统提示中强调数据边界
        system_prompt = (
            f"你正在为租户 {tenant_ctx.tenant_id} 服务。\n"
            f"你只能访问该租户的数据，不得查询或提及其他租户的信息。"
        )

        return self.agent_core.run(
            system_prompt=system_prompt,
            tools=scoped_tools,
            query=query,
        )

    def _scope_tools(self, ctx: TenantContext) -> list:
        """为工具注入租户过滤条件"""
        scoped = []
        for tool in self.agent_core.tools:
            # 包装工具，自动注入 tenant_id 过滤
            wrapped = TenantScopedTool(tool, ctx.tenant_id)
            scoped.append(wrapped)
        return scoped


class TenantScopedTool:
    """自动注入租户过滤的工具包装器"""

    def __init__(self, original_tool, tenant_id: str):
        self.original = original_tool
        self.tenant_id = tenant_id

    def execute(self, **kwargs):
        # 强制注入 tenant_id，覆盖任何用户提供的值
        kwargs["tenant_id"] = self.tenant_id
        return self.original.execute(**kwargs)
```

关键原则：**永远不要信任 LLM 输出的 tenant_id**。租户身份必须在代码层强制注入。

## 工具权限边界

不同角色的用户应该看到不同的工具集：

```python
ROLE_PERMISSIONS = {
    "viewer": ["search", "get_document"],
    "editor": ["search", "get_document", "update_document"],
    "admin": ["search", "get_document", "update_document",
              "delete_document", "manage_users"],
}

class PermissionGate:
    """权限门控"""

    def __init__(self, user_role: str):
        self.allowed_tools = set(ROLE_PERMISSIONS.get(user_role, []))

    def filter_tools(self, all_tools: list) -> list:
        """只返回用户有权使用的工具"""
        return [t for t in all_tools if t.name in self.allowed_tools]

    def check(self, tool_name: str) -> bool:
        if tool_name not in self.allowed_tools:
            raise PermissionError(
                f"权限不足: 角色无权使用 {tool_name}"
            )
        return True
```

## 敏感信息脱敏

Agent 处理的数据可能包含 PII（个人身份信息），需要在多个环节脱敏：

```python
import re

class DataMasker:
    """敏感信息脱敏器"""

    PATTERNS = {
        "phone": (r'1[3-9]\d{9}', lambda m: m.group()[:3] + "****" + m.group()[-4:]),
        "id_card": (r'\d{17}[\dXx]', lambda m: m.group()[:6] + "********" + m.group()[-4:]),
        "email": (r'([\w.-]+)@([\w.-]+)', lambda m: m.group(1)[:2] + "***@" + m.group(2)),
        "bank_card": (r'\d{16,19}', lambda m: m.group()[:4] + " **** **** " + m.group()[-4:]),
    }

    def mask(self, text: str) -> str:
        """脱敏文本中的敏感信息"""
        result = text
        for name, (pattern, replacer) in self.PATTERNS.items():
            result = re.sub(pattern, replacer, result)
        return result

    def mask_for_llm(self, text: str) -> tuple[str, dict]:
        """
        脱敏后保留映射，便于还原

        Returns:
            (masked_text, mapping)
        """
        mapping = {}
        counter = 0

        def create_replacer(pattern_name):
            nonlocal counter
            def replacer(match):
                nonlocal counter
                placeholder = f"[{pattern_name.upper()}_{counter}]"
                mapping[placeholder] = match.group()
                counter += 1
                return placeholder
            return replacer

        result = text
        for name, (pattern, _) in self.PATTERNS.items():
            result = re.sub(pattern, create_replacer(name), result)

        return result, mapping

# 使用
masker = DataMasker()
text = "请联系张三，手机 13812345678，邮箱 zhangsan@example.com"
masked, mapping = masker.mask_for_llm(text)
# masked: "请联系张三，手机 [PHONE_0]，邮箱 [EMAIL_1]"
# mapping: {"[PHONE_0]": "13812345678", "[EMAIL_1]": "zhangsan@example.com"}
```

工作流程：**用户输入 → 脱敏 → 发送给 LLM → 收到响应 → 还原占位符 → 返回用户**。LLM 全程不接触真实敏感数据。

## 最小权限原则

Agent 应该只拥有完成任务所需的**最小权限**：

| 原则 | 实践 |
|------|------|
| 只读优先 | 默认给 Agent 只读权限，写入需要显式授权 |
| 范围限制 | 文件访问限制在特定目录，数据库限制在特定表 |
| 时间限制 | 临时权限设置过期时间 |
| 审计日志 | 记录所有工具调用，支持事后审查 |
| 人工审批 | 高风险操作（删除、转账）需要人工确认 |

## 自测问题

<details>
<summary>1. 为什么不能让 LLM 自己判断 tenant_id？</summary>

LLM 可能被 Prompt Injection 攻击，被诱导输出其他租户的 ID。tenant_id 必须在应用代码层面强制注入，不经过 LLM。
</details>

<details>
<summary>2. 脱敏后再发给 LLM 有什么好处？</summary>

即使 LLM 的 API 被窃听或日志被泄露，敏感信息也不会暴露。同时也避免了 LLM 在回复中意外包含完整的敏感数据。
</details>

<details>
<summary>3. 为什么说"只读优先"是最重要的权限原则？</summary>

只读操作不会造成不可逆的损害。即使 Agent 被劫持，最多也只能读取数据（可通过其他措施限制范围），不会删除数据、发送恶意邮件或转账。
</details>

## 延伸阅读

- [OWASP LLM Top 10 - Insecure Output Handling](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [多租户隔离模式](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [最小权限原则](https://csrc.nist.gov/glossary/term/least_privilege)
