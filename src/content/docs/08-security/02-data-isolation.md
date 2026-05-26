---
title: "数据隔离"
description: "多租户数据隔离、工具权限边界、敏感信息脱敏与最小权限原则"
---

:::tip[与其他章节的关联]
- **ch04 RAG**：权限感知检索（Permission-aware Retrieval）是 RAG 系统数据隔离的关键，详见 [RAG 章节](/04-rag/)
- **ch08/01 Prompt Injection**：数据隔离是 Injection 防御的架构层手段
:::

## 为什么数据隔离很重要

Agent 可以访问工具和数据源，如果没有严格的隔离，可能出现：

- **租户 A 的 Agent 读取租户 B 的数据**（跨租户泄露）
- **Agent 访问超出其职责范围的系统资源**（权限越界）
- **LLM 在回复中泄露训练数据或上下文中的敏感信息**（信息泄露）

:::note[术语：ACL]
**ACL（Access Control List，访问控制列表）** 是一种定义谁可以访问特定资源的权限机制。在企业知识库中，每个文档都关联一组 ACL 条目，标记哪些用户或用户组有读/写权限。向量检索时通过 ACL 过滤确保用户只能查到有权访问的内容。
:::

:::note[术语：SSO]
**SSO（Single Sign-On，单点登录）** 允许用户通过一次登录就能访问多个关联系统。在多租户 Agent 架构中，SSO 是识别用户身份和租户归属的常用入口，确保 tenant_id 在认证层就被正确绑定。
:::

:::note[术语：LDAP]
**LDAP（Lightweight Directory Access Protocol，轻量级目录访问协议）** 是企业中管理用户账号和组织结构的标准协议。Agent 系统通过 LDAP 查询用户的部门、角色和权限组，用于实现细粒度的数据访问控制。
:::

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

## 自测题

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 1：为什么不能让 LLM 自己判断 tenant_id？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">LLM 可能被 Prompt Injection 攻击，被诱导输出其他租户的 ID，从而导致跨租户数据泄露。tenant_id 必须在应用代码层面通过认证系统（如 SSO/LDAP）强制注入，完全绕过 LLM 的推理过程。这是"永不信任 LLM 输出的安全参数"原则的核心体现。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 2：脱敏后再发给 LLM 有什么好处？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">即使 LLM 的 API 被窃听、日志被泄露，或者模型提供商的数据安全出现问题，敏感信息也不会暴露。同时还能避免 LLM 在回复中意外包含完整的手机号、身份证号等敏感数据。这种方法的额外好处是减少了合规风险——许多数据保护法规要求最小化敏感数据的传输和存储。</div>
  </details>
</div>

<div style="border-left:4px solid #60a5fa;padding:.8rem 1.2rem;margin:.8rem 0;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
  <details>
    <summary style="font-weight:bold;color:#60a5fa;cursor:pointer;">自测题 3：为什么说"只读优先"是最重要的权限原则？</summary>
    <div style="margin-top:.8rem;font-size:.9rem;">只读操作不会造成不可逆的损害。即使 Agent 被劫持，最多也只能读取数据（可通过 ACL 进一步限制范围），不会删除数据、发送恶意邮件或执行转账。相比之下，写操作一旦执行就可能无法回退。因此在权限设计中，默认给 Agent 只读权限，所有写入操作都需要显式授权和人工审批。</div>
  </details>
</div>

## 延伸阅读

- [OWASP LLM Top 10 - Insecure Output Handling](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [多租户隔离模式](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [最小权限原则](https://csrc.nist.gov/glossary/term/least_privilege)
