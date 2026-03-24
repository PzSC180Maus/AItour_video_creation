import json
import json5
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union
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


_task_context: ContextVar[Optional[TaskContext]] = ContextVar(
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
    """基于完整对话历史生成旅拍视频脚本"""

    description = "读取当前任务完整对话历史，并生成 15-30 秒旅拍视频脚本"
    parameters = {
        "type": "object",
        "properties": {
            "style": {
                "type": "string",
                "description": "可选，指定视频风格",
            },
            "spot_name": {
                "type": "string",
                "description": "可选，指定景点名称",
            },
            "emotion": {
                "type": "string",
                "description": "可选，指定用户情绪",
            },
            "extra_requirements": {
                "type": "string",
                "description": "可选，补充要求，例如用户对脚本设计、台词语气、镜头偏好",
            },
        },
        "required": [],
    }

    def __init__(self, cfg: Optional[Dict] = None):
        super().__init__(cfg)
        llm_cfg = self.cfg.get("llm_cfg", {})
        if not llm_cfg:
            raise ValueError("llm_cfg is required for travel_script_gen")
        self.llm = get_chat_model(llm_cfg)

    def call(self, params: Union[str, dict], **kwargs) -> str:
        """
        仅负责生成脚本并返回结果。
        持久化（写入 task_manager）由调用方路由处理器完成。
        """
        ctx = _task_context.get()

        try:
            if ctx is None:
                return json.dumps(
                    {
                        "success": False,
                        "error": "当前没有绑定 TaskContext，上下文不可用",
                    },
                    ensure_ascii=False,
                )

            if isinstance(params, str):
                params_dict = json5.loads(params)
            else:
                params_dict = params or {}

            override_emotion = str(params_dict.get("emotion", "")).strip()
            override_spot_name = str(params_dict.get("spot_name", "")).strip()
            override_style = str(params_dict.get("style", "")).strip()
            extra_requirements = str(params_dict.get("extra_requirements", "")).strip()

            history_text = "\n".join(
                f"{item.get('role', 'unknown')}: {str(item.get('content', '')).strip()}"
                for item in ctx.messages
                if str(item.get("content", "")).strip()
            )

            if not history_text and not any(
                [override_emotion, override_spot_name, override_style, extra_requirements]
            ):
                return json.dumps(
                    {
                        "success": False,
                        "error": "没有可用于生成脚本的历史对话或补充信息",
                    },
                    ensure_ascii=False,
                )

            system_prompt = (
                "你是专业旅拍视频脚本策划师。\n"
                "请基于用户完整历史对话，直接生成一个 15-30 秒的旅拍视频脚本。\n"
                "要求：\n"
                "1. 你需要自己从历史对话中判断景点、情绪、风格、叙事重点和关键画面\n"
                "2. 如果外部给了明确的景点、情绪、风格要求，优先采用外部要求\n"
                "3. 输出严格聚焦单一主题，不要平行展开\n"
                "4. 输出格式为：镜头 + 分镜 + 台词 + 时长 + 音乐建议\n"
                "5. 只输出最终脚本文本，不要输出解释、分析过程、前缀、标题或 JSON"
            )

            user_prompt = (
                "以下是当前任务的完整历史对话，请根据这些内容直接生成最终视频脚本。\n\n"
                f"历史对话：\n{history_text or '无'}\n\n"
                f"外部指定景点：{override_spot_name or '无'}\n"
                f"外部指定情绪：{override_emotion or '无'}\n"
                f"外部指定风格：{override_style or '无'}\n"
                f"额外要求：{extra_requirements or '无'}\n\n"
                "请输出最终脚本文本。"
            )

            messages = [
                Message(role=SYSTEM, content=[ContentItem(text=system_prompt)]),
                Message(role=USER, content=[ContentItem(text=user_prompt)]),
            ]

            *_, last = self.llm.chat(messages=messages)
            content = last[-1].get("content", [])

            script_parts = []
            for item in content:
                text = item.get("text", "")
                if text:
                    script_parts.append(text)

            script = "\n".join(script_parts).strip()

            if not script:
                return json.dumps(
                    {
                        "success": False,
                        "error": "模型返回为空",
                    },
                    ensure_ascii=False,
                )

            # 不在此处持久化 —— 调用方（路由处理器）收到 task_id + script 后
            # 自行调用 task_manager.update_step_data(task_id, {"script": script})
            return json.dumps(
                {
                    "success": True,
                    "script": script,
                    "task_id": ctx.task_id,
                },
                ensure_ascii=False,
            )

        except Exception as exc:
            return json.dumps(
                {
                    "success": False,
                    "error": str(exc),
                },
                ensure_ascii=False,
            )
