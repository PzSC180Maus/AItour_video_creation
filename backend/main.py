import json
import uuid
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from task_manager import TaskManager
from tools import TaskContext, set_task_context, reset_task_context
from gen_token import generate_token
from agent_config import get_chat_bot, get_script_tool
from keling_config import KelingConfig, build_submit_payload, map_kling_status
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
from typing import Dict, Any, List, Optional

app = FastAPI()
task_manager = TaskManager()
task_manager.start_auto_cleanup()

my_cfg = KelingConfig(
    base_url="https://api-beijing.klingai.com",
    model_name="kling-v3-omni",
    mode="pro",
    duration="10",
    aspect_ratio="16:9",
)

class TaskRequest(BaseModel):
    openid: str
    task_id: Optional[str] = None
    token: Optional[str] = None
    spot_url: str = ""
    request: str = ""
    video_request: str = ""
    scriptContent: str = ""
    user_potrait: str = ""

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
        raise HTTPException(status_code=423, detail="缺少 task_data")
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

    task_id = (req.task_id or "").strip() or uuid.uuid4().hex

    # 允许重复 init：已存在时只校验归属，避免前端重进页面报 409
    try:
        task_manager.create_task(task_id, req.openid)
    except HTTPException as exc:
        if exc.status_code == 409:
            task_manager.verify_owner(task_id, req.openid)
        else:
            raise

    seed_user = (req.request or "").strip()
    if not seed_user:
        seed_user = "请先给我一句简短开场，并引导我补充旅行信息。"

    opening_response = _run_chat_once([{"role": "user", "content": seed_user}])

    # 落库首轮对话，供后续 chat/script 复用
    task_manager.append_message(task_id, {"role": "user", "content": seed_user})
    task_manager.append_message(task_id, {"role": "assistant", "content": opening_response})

    return {
        "success": True,
        "task_id": task_id,
        "response": opening_response,
    }


@app.post("/api/dialogue/chat")
def dialogue_chat(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_id = req.task_id.strip() if req.task_id else None
    if not task_id:
        raise HTTPException(status_code=444, detail="缺少 task_id")

    user_text = (req.request or "").strip()
    task_manager.append_message(task_id, {"role": "user", "content": user_text})
    task = task_manager.get_task(task_id)

    assistant_text = _run_chat_once(task.get("messages", []))
    task_manager.append_message(task_id, {"role": "assistant", "content": assistant_text})

    return {"success": True, "response": assistant_text}


@app.post("/api/script")
def get_script(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_id = req.task_id.strip() if req.task_id else None
    if not task_id:
        raise HTTPException(status_code=422, detail="缺少 task_id")

    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

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

    task_manager.update_step_data(task_id, {"script": result["script"]})
    return {"success": True, "response": result["script"]}


@app.post("/api/share")
def share(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_id = req.task_id.strip() if req.task_id else None
    if not task_id:
        raise HTTPException(status_code=422, detail="缺少 task_id")

    user_text = (req.request or "").strip()
    if not user_text:
        user_text = "请生成一段适合小红书或朋友圈发布的旅行文案。"

    task_manager.append_message(task_id, {"role": "user", "content": user_text})
    task = task_manager.get_task(task_id)

    assistant_text = _run_chat_once(task.get("messages", []))
    task_manager.append_message(task_id, {"role": "assistant", "content": assistant_text})

    return {"success": True, "response": assistant_text}


@app.post("/api/video")
def submit_video(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_id = req.task_id.strip() if req.task_id else None
    if not task_id:
        raise HTTPException(status_code=422, detail="缺少 task_id")

    task_manager.update_step_data(
        task_id,
        {
            "user_potrait_url": (req.user_potrait or "").strip() or None,
            "spot_url": (req.spot_url or "").strip() or None,
        },
    )

    stored_task = task_manager.get_task(task_id) or {}
    step_data = stored_task.get("step_data", {})

    image_urls = [
        url
        for url in [step_data.get("user_potrait_url"), step_data.get("spot_url")]
        if isinstance(url, str) and url.strip()
    ]
    if not image_urls:
        raise HTTPException(status_code=422, detail="缺少图片地址：user_potrait 或 spot_url")

    prompt = (req.video_request or "").strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="缺少 video_request")

    submit_payload = build_submit_payload(
        image_urls=image_urls,
        prompt=prompt,
        cfg=my_cfg,
    )

    kling_token = generate_token()

    headers = my_cfg.headers(kling_token)
    data = json.dumps(submit_payload).encode("utf-8")

    req_obj = urlrequest.Request(
        url=my_cfg.submit_url(),
        data=data,
        headers=headers,
        method="POST",
    )

    try:
        with urlrequest.urlopen(req_obj, timeout=500) as resp:
            resp_data = resp.read().decode("utf-8")
            kling_resp = json.loads(resp_data)
            print(kling_resp)
    except Exception as e:
        print("请求失败：", e)
        raise HTTPException(status_code=502, detail=f"可灵创建任务失败: {e}")

    if kling_resp.get("code") != 0:
        raise HTTPException(status_code=502, detail=f"可灵创建任务失败: {kling_resp.get('message', 'unknown')}")

    data = kling_resp.get("data") or {}
    task_status = data.get("task_status", "submitted")
    video_status = map_kling_status(task_status)
    kling_task_id = data.get("task_id")
    task_manager.delete_task(task_id)
    print(f"提交视频任务成功，token={kling_token}, task_id={kling_task_id}, video_status={video_status}")

    return {
        "success": video_status != "failed",
        "video_status": video_status,
        "task_id": kling_task_id,
        "token": kling_token,
    }


@app.post("/api/video/status")
def get_video_status(payload: TaskEnvelope):
    req = _unwrap(payload)
    kling_task_id = (req.task_id or "").strip()
    if not kling_task_id:
        return {"video_status": "idle", "video_url": None}

    token = (req.token or "").strip()
    if not token:
        raise HTTPException(status_code=422, detail="缺少 token")

    headers = my_cfg.headers(token)
    req_obj = urlrequest.Request(
        url=my_cfg.status_url(kling_task_id),
        headers=headers,
        method="GET",
    )

    try:
        with urlrequest.urlopen(req_obj, timeout=400) as resp:
            resp_data = resp.read().decode("utf-8")
            kling_resp = json.loads(resp_data)
            print(kling_resp)
    except Exception as e:
        print("请求失败：", e)
        raise HTTPException(status_code=502, detail=f"可灵状态查询HTTP错误: {e}")

    if kling_resp.get("code") != 0:
        raise HTTPException(
            status_code=502,
            detail=f"可灵状态查询失败: {kling_resp.get('message', 'unknown')}",
        )

    if not isinstance(kling_resp, dict):
        print("kling_resp 不是 dict:", kling_resp)
        raise HTTPException(status_code=502, detail="可灵响应格式错误")

    data = kling_resp.get("data") or {}
    task_status = data.get("task_status", "processing")
    video_status = map_kling_status(task_status)

    videos = ((data.get("task_result") or {}).get("videos") or [])
    video_url = None
    if videos and isinstance(videos[0], dict):
        video_url = videos[0].get("url")

    return {
        "success": video_status == "complete",
        "video_status": video_status,
        "video_url": video_url,
        "video_error": data.get("task_status_msg"),
    }

