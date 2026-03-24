import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from task_manager import TaskManager
from tools import TaskContext, set_task_context, reset_task_context
from agent_config import get_chat_bot, get_script_tool
from keling_config import KelingConfig, build_submit_payload, map_kling_status
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError



app = FastAPI()
task_manager = TaskManager()
task_manager.start_auto_cleanup()

my_cfg = KelingConfig(
    base_url="https://api-beijing.klingai.com",
    api_key="你的token",
    model_name="kling-v1-6",
    mode="pro",
    duration="5",
    aspect_ratio="16:9",
)

class TaskRequest(BaseModel):
         openid : str
         task_id : str
         spot_url: str
         request: str = ""
         video_request: str = ""
         scriptContent: str = ""
         user_potrait: str

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

    prompt = (req.request or "").strip()
    if not prompt:
        prompt = "请生成一段适合小红书或朋友圈发布的旅行文案。"

    response_text = _run_chat_once([{"role": "user", "content": prompt}])
    return {"success": True, "response": response_text}


@app.post("/api/video")
def submit_video(payload: TaskEnvelope):
    req = _unwrap(payload)
    task_manager.verify_owner(req.task_id, req.openid)

    task_manager.update_step_data(
        req.task_id,
        {
            "spot_url": (req.spot_url or "").strip() or None,
            "user_potrait_url": (req.user_potrait or "").strip() or None,
        },
    )

    stored_task = task_manager.get_task(req.task_id) or {}
    step_data = stored_task.get("step_data", {})

    image_urls = [
        url
        for url in [step_data.get("spot_url"), step_data.get("user_potrait_url")]
        if isinstance(url, str) and url.strip()
    ]
    if not image_urls:
        raise HTTPException(status_code=422, detail="缺少图片地址：spot_url 或 user_potrait")

    prompt = (req.video_request or "").strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="缺少 video_request")

    submit_payload = build_submit_payload(
        image_urls=image_urls,
        prompt=prompt,
        external_task_id=req.task_id,
        cfg=my_cfg,
    )

    req_obj = urlrequest.Request(
        url=my_cfg.submit_url(),
        data=json.dumps(submit_payload).encode("utf-8"),
        headers=my_cfg.headers(),
        method="POST",
    )

    try:
        with urlrequest.urlopen(req_obj, timeout=30) as resp:
            kling_resp = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        raise HTTPException(status_code=502, detail=f"可灵接口HTTP错误: {e.code}")
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"可灵接口连接失败: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"可灵接口异常: {str(e)}")

    if kling_resp.get("code") != 0:
        raise HTTPException(status_code=502, detail=f"可灵创建任务失败: {kling_resp.get('message', 'unknown')}")

    data = kling_resp.get("data") or {}
    task_status = data.get("task_status", "submitted")
    video_status = map_kling_status(task_status)

    task_manager.update_task(
        req.task_id,
        {
            "video_status": video_status,
            "step_data": {"kling_task_id": data.get("task_id")},
        },
    )

    return {
        "success": video_status != "failed",
        "video_status": video_status,
        "kling_task_id": data.get("task_id"),
    }


@app.get("/api/video/status")
def get_video_status(task_id: str, openid: str):
    task_manager.verify_owner(task_id, openid)
    stored_task = task_manager.get_task(task_id) or {}
    step_data = stored_task.get("step_data", {})

    kling_task_id = step_data.get("kling_task_id")
    if not kling_task_id:
        return {"video_status": "idle", "video_url": None}

    req_obj = urlrequest.Request(
        url=my_cfg.status_url(kling_task_id),
        headers=my_cfg.headers(),  # 使用自定义 keling config 的鉴权头
        method="GET",
    )

    try:
        with urlrequest.urlopen(req_obj, timeout=30) as resp:
            kling_resp = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        raise HTTPException(status_code=502, detail=f"可灵状态查询HTTP错误: {e.code}")
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"可灵状态查询连接失败: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"可灵状态查询异常: {str(e)}")

    if kling_resp.get("code") != 0:
        raise HTTPException(
            status_code=502,
            detail=f"可灵状态查询失败: {kling_resp.get('message', 'unknown')}",
        )

    data = kling_resp.get("data") or {}
    task_status = data.get("task_status", "processing")
    video_status = map_kling_status(task_status)

    videos = ((data.get("task_result") or {}).get("videos") or [])
    video_url = None
    if videos and isinstance(videos[0], dict):
        video_url = videos[0].get("url")

    # 回写本地任务状态，便于后续复用
    task_manager.update_task(
        task_id,
        {
            "video_status": video_status,
            "video_url": video_url if video_status == "complete" else None,
            "step_data": {"video_error": data.get("task_status_msg")},
        },
    )

    is_final = video_status in ("complete", "failed")

    response = {
        "success": video_status == "complete",
        "video_status": video_status,
        "video_url": video_url,
    }

    if is_final:
        task_manager.delete_task(task_id)

    return response


