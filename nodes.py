class PromptSwitchLite:
    """A minimal line-toggle prompt editor for ComfyUI."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": True,
                        "dynamicPrompts": True,
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "render"
    CATEGORY = "utils/text"

    def render(self, text):
        # UI state is serialized into the text itself: lines beginning with // are OFF.
        # Empty lines are ignored in the output, but preserved in the editor widget.
        enabled_lines = []

        for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            stripped = raw_line.strip()
            if not stripped:
                continue
            if raw_line.lstrip().startswith("//"):
                continue
            enabled_lines.append(raw_line.strip())

        return ("\n".join(enabled_lines),)


NODE_CLASS_MAPPINGS = {
    "PromptSwitchLite": PromptSwitchLite,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptSwitchLite": "Prompt Switch Lite",
}
