import os
from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class KelingConfig:
    base_url: str = os.getenv("KLING_BASE_URL", "https://api-beijing.klingai.com")
    api_key: str = os.getenv("KLING_API_KEY", "")
    model_name: str = os.getenv("KLING_MODEL_NAME", "kling-v1-6")
    mode: str = os.getenv("KLING_MODE", "pro")
    duration: str = os.getenv("KLING_DURATION", "5")
    aspect_ratio: str = os.getenv("KLING_ASPECT_RATIO", "16:9")

    def submit_url(self) -> str:
        return f"{self.base_url}/v1/videos/multi-image2video"

    def status_url(self, kling_task_id: str) -> str:
        return f"{self.base_url}/v1/videos/multi-image2video/{kling_task_id}"

    def headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise ValueError("KLING_API_KEY 未配置")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }


def build_submit_payload(
    image_urls: List[str],
    prompt: str,
    negative_prompt: str = "",
    callback_url: str = "",
    external_task_id: str = "",
    cfg: KelingConfig = None,
) -> Dict[str, Any]:
    cfg = cfg or KelingConfig()

    return {
        "model_name": cfg.model_name,
        "image_list": [{"image": url} for url in image_urls],
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "mode": cfg.mode,
        "duration": cfg.duration,
        "aspect_ratio": cfg.aspect_ratio,
        "callback_url": callback_url,
        "external_task_id": external_task_id,
    }


def map_kling_status(task_status: str) -> str:
    status = (task_status or "").lower()
    if status in ("submitted", "processing"):
        return "processing"
    if status == "succeed":
        return "complete"
    if status == "failed":
        return "failed"
    return "idle"