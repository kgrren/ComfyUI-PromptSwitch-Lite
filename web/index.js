import { app } from "../../scripts/app.js";

const NODE_CLASS = "PromptSwitchLite";

const UI = {
    minWidth: 360,
    minHeight: 140,
    headerHeight: 34,
    contentTop: 42,
    sidePadding: 12,
    bottomPadding: 12,
    fontSize: 14,
    lineHeight: 20,
    checkboxSize: 14,
    checkboxGap: 7,
    rowGap: 4,
    buttonHeight: 24,
    buttonPaddingX: 9,
    buttonRadius: 5,
    fontFamily: "Tahoma, Verdana, Arial, Roboto, sans-serif",
};

function findTextWidget(node) {
    return node.widgets?.find((widget) => widget.name === "text") ?? null;
}

function normalizeNewlines(text) {
    return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isDisabledLine(line) {
    return line.trimStart().startsWith("//");
}

function disableLine(line) {
    if (!line.trim() || isDisabledLine(line)) return line;
    const leading = line.match(/^\s*/)?.[0] ?? "";
    return `${leading}// ${line.slice(leading.length)}`;
}

function enableLine(line) {
    if (!isDisabledLine(line)) return line;
    const leading = line.match(/^\s*/)?.[0] ?? "";
    const body = line.slice(leading.length).replace(/^\/\/\s?/, "");
    return leading + body;
}

function toggleLine(text, index) {
    const lines = normalizeNewlines(text).split("\n");
    if (index < 0 || index >= lines.length || !lines[index].trim()) return text;
    lines[index] = isDisabledLine(lines[index]) ? enableLine(lines[index]) : disableLine(lines[index]);
    return lines.join("\n");
}

function disableAll(text) {
    return normalizeNewlines(text)
        .split("\n")
        .map(disableLine)
        .join("\n");
}

function commitWidget(node, widget, value) {
    widget.value = value;
    widget.callback?.(value);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
}

function configureTextarea(widget) {
    const el = widget?.inputEl;
    if (!el) return;

    Object.assign(el.style, {
        fontFamily: UI.fontFamily,
        fontSize: `${UI.fontSize}px`,
        lineHeight: `${UI.lineHeight}px`,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        resize: "none",
        boxSizing: "border-box",
    });
}

function setEditMode(node, widget, enabled, { focus = true } = {}) {
    node.pslEditMode = Boolean(enabled);
    widget.hidden = !node.pslEditMode;

    if (node.pslEditMode) {
        configureTextarea(widget);
        requestAnimationFrame(() => {
            configureTextarea(widget);
            if (focus && widget.inputEl) {
                widget.inputEl.focus();
            }
        });
    }

    node.setDirtyCanvas?.(true, true);
}

function measureButton(ctx, label) {
    ctx.save();
    ctx.font = `${UI.fontSize - 1}px ${UI.fontFamily}`;
    const width = Math.ceil(ctx.measureText(label).width) + UI.buttonPaddingX * 2;
    ctx.restore();
    return width;
}

function drawButton(ctx, x, y, w, h, label, active = false) {
    ctx.save();
    const radius = UI.buttonRadius;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = active ? "#4b78c2" : "#353535";
    ctx.fill();
    ctx.strokeStyle = active ? "#7aa7ef" : "#555";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f2f2f2";
    ctx.font = `${UI.fontSize - 1}px ${UI.fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
    if (!text) return [""];
    const chars = Array.from(text);
    const lines = [];
    let current = "";

    for (const char of chars) {
        const candidate = current + char;
        if (current && ctx.measureText(candidate).width > maxWidth) {
            lines.push(current);
            current = char;
        } else {
            current = candidate;
        }
    }

    lines.push(current);
    return lines;
}

function layoutRows(node, ctx, text) {
    const lines = normalizeNewlines(text).split("\n");
    const rows = [];
    const textX = UI.sidePadding + UI.checkboxSize + UI.checkboxGap;
    const maxTextWidth = Math.max(40, node.size[0] - textX - UI.sidePadding);
    let y = UI.contentTop;

    ctx.save();
    ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;

    lines.forEach((line, index) => {
        if (!line.trim()) {
            rows.push({ index, line, empty: true, y, height: UI.lineHeight });
            y += UI.lineHeight;
            return;
        }

        const displayText = isDisabledLine(line) ? enableLine(line).trimStart() : line.trimStart();
        const wrapped = wrapText(ctx, displayText, maxTextWidth);
        const height = Math.max(UI.lineHeight, wrapped.length * UI.lineHeight);
        rows.push({ index, line, empty: false, displayText, wrapped, y, height });
        y += height + UI.rowGap;
    });

    ctx.restore();
    return { rows, totalHeight: y + UI.bottomPadding };
}

function drawNormalMode(node, ctx, widget) {
    const { rows, totalHeight } = layoutRows(node, ctx, widget.value);
    node.pslRows = rows;

    ctx.save();
    ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;
    ctx.textBaseline = "middle";

    for (const row of rows) {
        if (row.empty) continue;

        const disabled = isDisabledLine(row.line);
        const boxY = row.y + Math.max(0, (UI.lineHeight - UI.checkboxSize) / 2);
        const boxX = UI.sidePadding;

        if (!disabled) {
            // Original PromptSwitch uses #0F0 for the active checkbox accent.
            ctx.strokeStyle = "#0F0";
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, UI.checkboxSize, UI.checkboxSize);

            ctx.beginPath();
            ctx.moveTo(boxX + 3, boxY + 7);
            ctx.lineTo(boxX + 6, boxY + 10);
            ctx.lineTo(boxX + 12, boxY + 3);
            ctx.strokeStyle = "#0F0";
            ctx.lineWidth = 1.8;
            ctx.stroke();
        } else {
            ctx.strokeStyle = "#777";
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, UI.checkboxSize, UI.checkboxSize);
        }

        ctx.fillStyle = disabled ? "#888" : "#f1f1f1";
        const textX = UI.sidePadding + UI.checkboxSize + UI.checkboxGap;
        row.wrapped.forEach((part, i) => {
            ctx.fillText(part, textX, row.y + i * UI.lineHeight + UI.lineHeight / 2);
        });
    }

    ctx.restore();

    const desiredHeight = Math.max(UI.minHeight, Math.ceil(totalHeight));
    if (Math.abs(node.size[1] - desiredHeight) > 1) {
        node.size[1] = desiredHeight;
    }
}

function drawToolbar(node, ctx) {
    const y = 5;
    const h = UI.buttonHeight;
    const editLabel = node.pslEditMode ? "表示 (E)" : "編集 (E)";
    const offLabel = "全部OFF (A)";
    const editW = measureButton(ctx, editLabel);
    const offW = measureButton(ctx, offLabel);
    const gap = 8;
    const groupWidth = editW + gap + offW;
    const startX = Math.max(UI.sidePadding, (node.size[0] - groupWidth) / 2);
    const editX = startX;
    const offX = startX + editW + gap;

    node.pslButtons = {
        edit: { x: editX, y, w: editW, h },
        off: { x: offX, y, w: offW, h },
    };

    drawButton(ctx, editX, y, editW, h, editLabel, node.pslEditMode);
    drawButton(ctx, offX, y, offW, h, offLabel, false);
}

function pointInRect(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function handleNodeClick(node, pos, widget) {
    const [x, y] = pos;

    if (pointInRect(x, y, node.pslButtons?.edit)) {
        setEditMode(node, widget, !node.pslEditMode);
        return true;
    }

    if (pointInRect(x, y, node.pslButtons?.off)) {
        commitWidget(node, widget, disableAll(widget.value));
        return true;
    }

    if (!node.pslEditMode) {
        const row = node.pslRows?.find((item) => !item.empty && y >= item.y && y <= item.y + item.height);
        if (row) {
            commitWidget(node, widget, toggleLine(widget.value, row.index));
            return true;
        }
    }

    return false;
}

function isTextEntryTarget(event) {
    const target = event?.target;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

app.registerExtension({
    name: "qranoko.PromptSwitchLite",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_CLASS) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);

            const widget = findTextWidget(this);
            if (!widget) return;

            this.size[0] = Math.max(this.size[0], UI.minWidth);
            this.size[1] = Math.max(this.size[1], UI.minHeight);
            this.pslEditMode = false;
            this.pslRows = [];
            this.pslButtons = {};

            widget.hidden = true;
            widget.y = UI.contentTop;
            widget.options ??= {};
            widget.options.minHeight = Math.max(60, this.size[1] - UI.contentTop - UI.bottomPadding);
            configureTextarea(widget);

            const originalDraw = this.onDrawForeground;
            this.onDrawForeground = function (ctx) {
                originalDraw?.call(this, ctx);
                drawToolbar(this, ctx);
                if (!this.pslEditMode) drawNormalMode(this, ctx, widget);
                widget.hidden = !this.pslEditMode;
            };

            const originalMouseDown = this.onMouseDown;
            this.onMouseDown = function (event, pos, canvas) {
                if (handleNodeClick(this, pos, widget)) {
                    event?.preventDefault?.();
                    event?.stopPropagation?.();
                    return true;
                }
                return originalMouseDown?.apply(this, arguments);
            };

            const originalKeyDown = this.onKeyDown;
            this.onKeyDown = function (event) {
                // Do not steal ordinary letters while the textarea is being edited.
                // The toolbar remains available for leaving edit mode.
                if (!isTextEntryTarget(event)) {
                    if (event.key === "e" || event.key === "E") {
                        setEditMode(this, widget, !this.pslEditMode);
                        event.preventDefault();
                        event.stopPropagation();
                        return true;
                    }

                    if (event.key === "a" || event.key === "A") {
                        commitWidget(this, widget, disableAll(widget.value));
                        event.preventDefault();
                        event.stopPropagation();
                        return true;
                    }
                }

                return originalKeyDown?.apply(this, arguments);
            };

            const originalResize = this.onResize;
            this.onResize = function () {
                originalResize?.apply(this, arguments);
                this.size[0] = Math.max(this.size[0], UI.minWidth);
                this.size[1] = Math.max(this.size[1], UI.minHeight);
                widget.y = UI.contentTop;
                widget.options.minHeight = Math.max(60, this.size[1] - UI.contentTop - UI.bottomPadding);
                configureTextarea(widget);
            };

            requestAnimationFrame(() => {
                widget.hidden = true;
                configureTextarea(widget);
                this.setDirtyCanvas?.(true, true);
            });
        };
    },
});
