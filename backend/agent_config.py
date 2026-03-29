# agent_config.py
import dashscope
from qwen_agent.agents import Assistant
from tools import TravelScriptTool  # noqa: F401  (triggers @register_tool side-effect)

llm_cfg = {
    # Use the model service provided by DashScope:
    "model": "qwen-plus",
    "model_type": "qwen_dashscope",
    "api_key": "sk-9d52a1862f1042fba5242652c3fd85e5",
    "base_http_api_url": "https://dashscope.aliyuncs.com/api/v1",
    "base_websocket_api_url": "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
    # It will use the `DASHSCOPE_API_KEY` environment variable if 'api_key' is not set here.

    # (Optional) LLM hyperparameters for generation:
    "generate_cfg": {
        "top_p": 0.8,
        "temperature": 0.4,
    }
}

# 系统指令
SYSTEM_INSTRUCTION = """你是一个 AI 旅拍用户调研引导专家。你的任务是：
[输入处理项目]
1. 与用户对话，了解他们的旅行经历和情感心境
2. 根据用户的分享，分析他们的旅行偏好和需求
[输出项目，请选择一下合适的一项输出给用户]
1. 回应用户情感，心境，展现共鸣和理解
2. 给出旅拍视频脚本建议（不是完整脚本），选取适合的元素{包括镜头设计，视频风格，人物台词，与景色动作互动}进行组合，

[格式要求]
1. 回应用户时，保持简洁、温暖、有共鸣，避免冗长和官方语言
2. 给出旅拍视频脚本建议时，保持专业、具体、有创意，避免模糊和泛泛而谈
3. 要像朋友间微信聊天一样自然，对话节奏是放松的，少于150字，避免过度分析和总结
4. 当用户没有分享旅行经历时，可以先引导用户分享旅行经历和情感心境，暂时不需要给出旅拍视频脚本建议
5. 用户没有要求生成脚本时，不要生成旅拍视频脚本"""

# 工具列表
TOOLS = ["travel_script_gen"]

# 全局共享 Agent 实例（无状态，可在多请求间复用）
GLOBAL_BOT = Assistant(
    llm=llm_cfg,
    system_message=SYSTEM_INSTRUCTION,
    function_list=TOOLS,
)

CHAT_BOT = Assistant(llm=llm_cfg, system_message=SYSTEM_INSTRUCTION, function_list=[])
SCRIPT_BOT = Assistant(llm=llm_cfg, system_message=SYSTEM_INSTRUCTION, function_list=TOOLS)

def get_bot() -> Assistant:
    """获取 Agent 实例（全局共享）"""
    return GLOBAL_BOT

def get_chat_bot(): return CHAT_BOT
def get_script_bot(): return SCRIPT_BOT

# 工具实例
SCRIPT_TOOL = TravelScriptTool(cfg={"llm_cfg": llm_cfg})

def get_script_tool() -> TravelScriptTool:
    return SCRIPT_TOOL
