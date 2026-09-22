"""
ComfyUI-Unsloth_Studio_Bridge

Nodes for connecting ComfyUI to the model currently loaded in Unsloth Studio,
plus a standalone live thinking display.
"""

from .py.Unsloth_Studio_Bridge import UnslothLLM
from .py.Unsloth_Thinking_Display import CRT_UnslothThinkingDisplay

NODE_CLASS_MAPPINGS = {
    "UnslothLLM": UnslothLLM,
    "CRT_UnslothThinkingDisplay": CRT_UnslothThinkingDisplay,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "UnslothLLM": "Unsloth Studio Bridge",
    "CRT_UnslothThinkingDisplay": "Unsloth Studio Bridge Thinking Display",
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
