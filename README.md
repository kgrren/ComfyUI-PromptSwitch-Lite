# ComfyUI-PromptSwitch-Lite

A minimal prompt input custom node for ComfyUI inspired by ComfyUI-PromptSwitch.

## Features

- Normal mode / edit mode button at the top-left
- "All OFF" button at the top-right
- Keyboard shortcuts only for those two actions
  - `E`: toggle normal/edit mode
  - `A`: turn every non-empty line OFF
- Normal and edit modes use the same `14px / 20px` typography
- Normal mode wraps long lines instead of truncating them
- Click a row in normal mode to toggle that line ON/OFF
- OFF state is stored as a leading `// ` in the text
- No random selection, weights, title tags, compact mode, batch logic, or other PromptSwitch extras

## Install

Clone or copy this directory into:

```text
ComfyUI/custom_nodes/ComfyUI-PromptSwitch-Lite
```

Restart ComfyUI and reload the browser.

The node appears as:

```text
utils/text > Prompt Switch Lite
```

## Behavior

Input text:

```text
masterpiece,
// low quality,
cinematic lighting,
```

Output:

```text
masterpiece,
cinematic lighting,
```

Blank lines and OFF lines are preserved in the editor, but omitted from the node output.

## Keyboard note

While the textarea itself has focus, plain `E` / `A` are treated as normal text input so typing is never blocked. Use the toolbar button to leave edit mode. In normal node focus, `E` and `A` work as shortcuts.

## License

MIT. This project is a clean, minimal implementation inspired by the interaction concept of Boba-svg/ComfyUI-PromptSwitch; it does not copy its large frontend implementation.
