# nodes.py

import os


class PromptSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": True,
                    },
                ),
            },
            "optional": {
                "prefix": (
                    "STRING",
                    {
                        "forceInput": True,
                    },
                ),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process"
    CATEGORY = "utils"

    def process(self, text, prefix=None):
        lines = []

        for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            stripped = line.strip()

            if not stripped:
                continue

            if stripped.startswith("//"):
                continue

            lines.append(line)

        current_text = "\n".join(lines)

        parts = []

        if prefix is not None:
            prefix = str(prefix).strip()
            if prefix:
                parts.append(prefix)

        if current_text:
            parts.append(current_text)

        return ("\n".join(parts),)


NODE_CLASS_MAPPINGS = {
    "PromptSwitch": PromptSwitch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptSwitch": "Prompt Switch",
}

WEB_DIRECTORY = os.path.join(
    os.path.dirname(os.path.realpath(__file__)),
    "web",
)
