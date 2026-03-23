import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from task_manager import TaskManager
from tools import TaskContext, set_task_context, reset_task_context
from agent_config import get_chat_bot, get_script_tool

app = FastAPI()
task_manager = TaskManager()
task_manager.start_auto_cleanup()


class TaskRequest(BaseModel):
    task_id: str
    openid: str
    request: str = ""


class TaskEnvelope(BaseModel):
    task_data: TaskRequest


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text", "")
                if text:
                    parts.append(text)
        return "\n".join(parts).strip()
    return str(content or "")


def _unwrap(payload: TaskEnvelope) -> TaskRequest:
    if not payload or not payload.task_data:
        raise HTTPException(status_code=422, detail="缺少 task_data")
    return payload.task_data


def _run_chat_once(messages: list[dict]) -> str:
    bot = get_chat_bot()
    response_plain_text = ""

    for response in bot.run(messages=messages):
        # 每一轮流式输出都更新一次完整文本（取当前最新 assistant 内容）
        current_text = _extract_text(response[-1].get("content", "")) if response else ""
        if current_text:
            response_plain_text = current_text

    if not response_plain_text:
        raise HTTPException(status_code=500, detail="模型未返回内容")

    return response_plain_text


@app.post("/api/dialogue/init")
def dialogue_init(payload: TaskEnvelope):
    req = _unwrap(payload)

    # 允许重复 init：已存在时只校验归属，避免前端重进页面报 409
    try:
        task_manager.create_task(req.task_id, req.openid)
    except HTTPException as exc:
        if exc.status_code == 409:
            task_manager.verify_owner(req.task_id, req.openid)
        else:
            raise

    seed_user = (req.request or "").strip()
    if not seed_user:
        seed_user = "请先给我一句简短开场，并引导我补充旅行信息。"

    opening_response = _run_chat_once([{"role": "user", "content": seed_user}])

    # 落库首轮对话，供后续 chat/script 复用
    task_manager.append_message(req.task_id, {"role": "user", "content": seed_user})
    task_manager.append_message(
        req.task_id, {"role": "assistant", "content": opening_response}
    )

    return {
        "success": True,
        "task_id": req.task_id,
        "response": opening_response,
    }


@app.post("/api/dialogue/chat")
def dialogue_chat(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_manager.verify_owner(req.task_id, req.openid)

    user_text = (req.request or "").strip()
    
    task_manager.append_message(req.task_id, {"role": "user", "content": user_text})
    task = task_manager.get_task(req.task_id)

    assistant_text = _run_chat_once(task.get("messages", []))
    task_manager.append_message(req.task_id, {"role": "assistant", "content": assistant_text})

    return {"success": True, "response": assistant_text}


@app.post("/api/script")
def get_script(payload: TaskEnvelope):
    req = _unwrap(payload)
    task = task_manager.verify_owner(req.task_id, req.openid)

    ctx = TaskContext(
        task_id=task["task_id"],
        messages=task.get("messages", []),
        step_data=task.get("step_data", {}),
    )
    token = set_task_context(ctx)

    try:
        tool = get_script_tool()
        result = json.loads(
            tool.call(
                {
                    "extra_requirements": req.request,
                }
            )
        )
    finally:
        reset_task_context(token)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "脚本生成失败"))

    task_manager.update_step_data(req.task_id, {"script": result["script"]})
    return {"success": True, "response": result["script"]}


@app.post("/api/share")
def share(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_manager.verify_owner(req.task_id, req.openid)
    raise HTTPException(status_code=501, detail="功能待实现")


@app.post("/api/video")
def submit_video(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_manager.verify_owner(req.task_id, req.openid)
    raise HTTPException(status_code=501, detail="功能待实现")


@app.get("/api/video/status")
def get_video_status(task_id: str, openid: str):
    stored_task = task_manager.verify_owner(task_id, openid)
    step_data = stored_task.get("step_data", {})

    return {
        "success": stored_task.get("video_status") != "failed",
        "task_id": stored_task.get("task_id"),
        "video_status": stored_task.get("video_status", "idle"),
        "progress": step_data.get("progress", 0),
        "video_url": stored_task.get("video_url"),
        "cover_url": step_data.get("cover_url"),
        "error_message": step_data.get("video_error"),
    }

