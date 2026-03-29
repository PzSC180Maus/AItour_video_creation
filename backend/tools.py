import json
import json5
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Dict, List
from pydantic import BaseModel

from qwen_agent.llm import get_chat_model
from qwen_agent.llm.schema import SYSTEM, USER, ContentItem, Message
from qwen_agent.tools.base import BaseTool, register_tool


# ---------- Per-request task context (injected by the route handler) ----------

@dataclass
class TaskContext:
    """路由处理器在调用 Agent 前预填充，工具通过 ContextVar 读取，无需直接访问 TaskManager。"""
    task_id: str
    messages: List[Dict] = field(default_factory=list)
    step_data: Dict = field(default_factory=dict)


_task_context: ContextVar[TaskContext] = ContextVar(
    "task_context",
    default=None,
)


def set_task_context(ctx: TaskContext) -> object:
    """在路由处理器中、调用 Agent 之前调用，注入当前请求的任务上下文。
    返回 token，处理结束后需在 finally 块中调用 reset_task_context(token)。
    """
    return _task_context.set(ctx)


def reset_task_context(token: object) -> None:
    """在 finally 块中调用，恢复 ContextVar，防止跨请求泄漏。"""
    _task_context.reset(token)


# ---------- Tool ----------

@register_tool("travel_script_gen")
class TravelScriptTool(BaseTool):
    description = "读取当前任务完整对话历史，并生成 10 秒旅拍视频脚本"
    parameters = {
        "type": "object",
        "properties": {
            "extra_requirements": {
                "type": "string",
                "description": "可选，用户补充要求。通常来自前端 request。",
            },
        },
        "required": [],
    }

    def __init__(self, cfg=None):
        super().__init__(cfg)
        llm_cfg = (self.cfg or {}).get("llm_cfg", {})
        self.llm = get_chat_model(llm_cfg) if llm_cfg else None

    @staticmethod
    def _extract_text(content):
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    text = str(item.get("text", "")).strip()
                    if text:
                        parts.append(text)
            return "\n".join(parts).strip()
        return str(content or "").strip()

    def call(self, params, **kwargs):
        ctx = _task_context.get()
        try:
            if ctx is None:
                return json.dumps(
                    {"success": False, "error": "当前没有绑定 TaskContext，上下文不可用"},
                    ensure_ascii=False,
                )

            if self.llm is None:
                return json.dumps(
                    {"success": False, "error": "travel_script_gen 未配置 llm_cfg"},
                    ensure_ascii=False,
                )

            if isinstance(params, str):
                params_dict = json5.loads(params)
            else:
                params_dict = params or {}

            extra_requirements = str(params_dict.get("extra_requirements", "")).strip()

            history_lines = []
            for msg in ctx.messages or []:
                role = str(msg.get("role", "unknown")).strip() or "unknown"
                text = self._extract_text(msg.get("content", ""))
                if text:
                    history_lines.append(f"{role}: {text}")
            history_text = "\n".join(history_lines).strip()

            if not history_text and not extra_requirements:
                return json.dumps(
                    {"success": False, "error": "没有可用于生成脚本的历史对话或补充信息"},
                    ensure_ascii=False,
                )

            system_prompt = (
                "你是专业旅拍视频脚本策划师。\n"
                "请严格按以下结构输出，且只输出最终脚本正文：\n"
                "【景点名称】\n"
                "1行，只写景点名称；若历史中未明确，则写“未明确景点”。\n\n"
                "【情绪锚点】\n"
                "1句，沿用用户原话关键词，不超过30字。\n\n"
                "【分镜脚本】\n"
                "输出3个镜头；每个镜头必须包含：镜头、动作、台词、时长。\n"
                "镜头时长约束：镜头1为3秒，镜头2为3秒，镜头3为4秒。\n\n"
                "【音乐与节奏建议】\n"
                "给出音乐类型、节奏变化与情绪推进建议。\n\n"
                "硬性约束：\n"
                "1. 总时长必须为10秒。\n"
                "2. 禁止输出JSON、解释、分析过程、额外寒暄。\n"
                "3. 内容必须可执行、画面明确,注意对人物主体叙述。"
            )

            user_prompt = (
                "请基于以下内容生成脚本。\n\n"
                f"历史对话：\n{history_text or '无'}\n\n"
                f"额外要求：{extra_requirements or '无'}\n"
            )

            messages = [
                Message(role=SYSTEM, content=[ContentItem(text=system_prompt)]),
                Message(role=USER, content=[ContentItem(text=user_prompt)]),
            ]

            *_, last = self.llm.chat(messages=messages)
            raw_content = last[-1].get("content", []) if last else []

            if isinstance(raw_content, str):
                script = raw_content.strip()
            else:
                parts = []
                for item in raw_content:
                    if isinstance(item, dict):
                        t = str(item.get("text", "")).strip()
                        if t:
                            parts.append(t)
                script = "\n".join(parts).strip()

            if not script:
                return json.dumps(
                    {"success": False, "error": "模型返回为空"},
                    ensure_ascii=False,
                )

            return json.dumps(
                {"success": True, "script": script, "task_id": ctx.task_id},
                ensure_ascii=False,
            )

        except Exception as exc:
            return json.dumps(
                {"success": False, "error": str(exc)},
                ensure_ascii=False,
            )
