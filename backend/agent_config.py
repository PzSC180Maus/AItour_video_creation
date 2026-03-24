# agent_config.py
from qwen_agent.agents import Assistant
from tools import TravelScriptTool  # noqa: F401  (triggers @register_tool side-effect)

llm_cfg = {
    # Use the model service provided by DashScope:
    "model": "qwen-max-latest",
    "model_type": "qwen_dashscope",
    # "api_key": "YOUR_DASHSCOPE_API_KEY",
    # It will use the `DASHSCOPE_API_KEY` environment variable if 'api_key' is not set here.

    # (Optional) LLM hyperparameters for generation:
    "generate_cfg": {
        "top_p": 0.8
    }
}

# 系统指令
# 注意最后一条指令：让外层 Agent 直接透传工具结果，避免产生第三次 LLM 调用
SYSTEM_INSTRUCTION = """你是一个 AI 旅拍视频生成助手。你的任务是：
1. 与用户对话，了解他们的旅行经历和情感心境
2. 根据用户选择的景点和情感，生成视频脚本
3. 协助用户提交视频生成任务
4. 回答用户关于视频进度的查询

你总是用中文回复用户。回复要简洁、温暖、有共鸣。

[当 travel_script_gen 工具调用成功时，将返回结果中 script 字段的内容原样呈现给用户，不要改写或二次总结。]"""

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
