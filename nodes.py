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
            },
            "optional": {
                "prefix": (
                    "STRING",
                    {
                        "forceInput": True,
                    },
                )
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "render"
    CATEGORY = "utils/text"

    def render(self, text, prefix=None):
        # UI state is serialized into the text itself: lines beginning with // are OFF.
        # Empty lines are ignored in the output, but preserved in the editor widget.
        enabled_lines = []

        for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            stripped = raw_line.strip()
            if not stripped:
                continue
            if raw_line.lstrip().startswith("//"):
                continue
            enabled_lines.append(stripped)

        current_text = "\n".join(enabled_lines)

        # Allow Prompt Switch Lite nodes to be chained through the optional prefix input.
        # Prefix is placed before this node's enabled prompt lines.
        prefix_text = (prefix or "").replace("\r\n", "\n").replace("\r", "\n").strip()

        if prefix_text and current_text:
            result = f"{prefix_text}\n{current_text}"
        elif prefix_text:
            result = prefix_text
        else:
            result = current_text

        return (result,)


NODE_CLASS_MAPPINGS = {
    "PromptSwitchLite": PromptSwitchLite,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptSwitchLite": "Prompt Switch Lite",
}
