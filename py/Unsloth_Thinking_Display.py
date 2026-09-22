class CRT_UnslothThinkingDisplay:
    """Standalone live viewer for Unsloth Studio Bridge.

    No inputs, no outputs: place it anywhere in the workflow and it shows the
    bridge's thinking process in real time (plus live tok/s) via websocket
    pushes. Nothing to wire up.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "display"
    OUTPUT_NODE = True
    CATEGORY = "Unsloth Studio"

    DESCRIPTION = (
        "Standalone live viewer for Unsloth Studio Bridge. "
        "Shows the thinking process in real time with tok/s while the bridge "
        "streams. No inputs or outputs; just add it to the workflow."
    )

    def display(self, unique_id=None, prompt=None):
        return {}


NODE_CLASS_MAPPINGS = {
    "CRT_UnslothThinkingDisplay": CRT_UnslothThinkingDisplay,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CRT_UnslothThinkingDisplay": "Unsloth Studio Bridge Thinking Display",
}
