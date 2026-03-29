import time
import threading
from copy import deepcopy
from typing import Dict, Optional, Any
from fastapi import HTTPException


class TaskManager:
    """
    任务管理器：按 task_id 隔离存储每个任务的状态
    MVP 阶段使用内存字典，生产环境可替换为 Redis
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._cleanup_interval = 300
        self._cleanup_started = False

    def _now(self) -> float:
        return time.time()

    def create_task(self, task_id: str, openid: str) -> Dict[str, Any]:
        """创建新任务，绑定 openid"""
        with self._lock:
            if task_id in self._store:
                raise HTTPException(status_code=409, detail="task_id 已存在")

            now = self._now()
            task_data: Dict[str, Any] = {
                "openid": openid,
                "task_id": task_id,
                "created_at": now,
                "last_accessed": now,
                "messages": [],
                "video_status": "idle",
                "video_url": None,
                "step_data": {
                    "spot_url": None,
                    "user_potrait_url": None,
                    "script": None,
                    "cover_url": None,
                },
            }
            self._store[task_id] = task_data
            return deepcopy(task_data)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务数据副本，避免锁外直接修改内部存储"""
        with self._lock:
            task_data = self._store.get(task_id)
            if task_data is None:
                return None
            return deepcopy(task_data)

    def touch_task(self, task_id: str) -> bool:
        """刷新任务最后访问时间"""
        with self._lock:
            if task_id not in self._store:
                return False
            self._store[task_id]["last_accessed"] = self._now()
            return True

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> bool:
        """
        更新任务数据
        约定：
        1. 顶层字段正常覆盖
        2. step_data 做增量合并，避免整块覆盖
        """
        with self._lock:
            if task_id not in self._store:
                return False

            task_data = self._store[task_id]
            updates = dict(updates)

            if "step_data" in updates:
                step_updates = updates.pop("step_data") or {}
                current_step_data = task_data.setdefault("step_data", {})
                if isinstance(step_updates, dict):
                    current_step_data.update(step_updates)

            task_data.update(updates)
            task_data["last_accessed"] = self._now()
            return True

    def update_step_data(self, task_id: str, step_updates: Dict[str, Any]) -> bool:
        """仅更新 step_data"""
        return self.update_task(task_id, {"step_data": step_updates})

    def append_message(self, task_id: str, message: Dict[str, Any]) -> bool:
        """追加对话消息到任务历史"""
        with self._lock:
            if task_id not in self._store:
                return False
            self._store[task_id]["messages"].append(message)
            self._store[task_id]["last_accessed"] = self._now()
            return True

    def verify_owner(self, task_id: str, openid: str) -> Dict[str, Any]:
        """
        验证 task_id 是否属于该 openid
        失败则抛出 HTTPException
        """
        with self._lock:
            task_data = self._store.get(task_id)

            if not task_data:
                raise HTTPException(status_code=405, detail="任务不存在或已过期")

            if task_data["openid"] != openid:
                print(
                    f"SECURITY ALERT: User {openid} tried to access task "
                    f"{task_id} owned by {task_data['openid']}"
                )
                raise HTTPException(status_code=403, detail="无权访问此任务")

            task_data["last_accessed"] = self._now()
            return deepcopy(task_data)

    def cleanup_expired(self, max_age_seconds: int = 3600):
        """清理过期任务"""
        with self._lock:
            now = self._now()
            expired_keys = [
                tid
                for tid, data in self._store.items()
                if now - data.get("last_accessed", 0) > max_age_seconds
            ]
            for tid in expired_keys:
                del self._store[tid]

            if expired_keys:
                print(f"清理了 {len(expired_keys)} 个过期任务")

    def start_auto_cleanup(self):
        """启动后台自动清理线程，只启动一次"""
        with self._lock:
            if self._cleanup_started:
                return
            self._cleanup_started = True

        def cleanup_loop():
            while True:
                time.sleep(self._cleanup_interval)
                self.cleanup_expired()

        thread = threading.Thread(target=cleanup_loop, daemon=True)
        thread.start()

    def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        with self._lock:
            if task_id not in self._store:
                return False
            del self._store[task_id]
            return True


task_manager = TaskManager()