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
    lineHeight: 22.75,
    checkboxSize: 14,
    checkboxGap: 7,
    textareaPaddingLeft: 24,
    textareaPaddingRight: 68,
    weightButtonSize: 16,
    weightButtonGap: 4,
    weightStep: 0.1,
    minWeight: -1.0,
    maxWeight: 2.0,
    separatorColor: "#777",
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

function isExplicitSeparatorLine(line) {
    return /^\s*\/\/\s*,\s*\/\/\s*$/.test(line);
}

function isSeparatorLine(line) {
    return !line.trim() || isExplicitSeparatorLine(line);
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
    if (index < 0 || index >= lines.length || isSeparatorLine(lines[index])) return text;
    lines[index] = isDisabledLine(lines[index]) ? enableLine(lines[index]) : disableLine(lines[index]);
    return lines.join("\n");
}

function disableAll(text) {
    return normalizeNewlines(text)
        .split("\n")
        .map((line) => (isSeparatorLine(line) ? line : disableLine(line)))
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
        padding: `4.5px ${UI.textareaPaddingRight}px 0 ${UI.textareaPaddingLeft}px`,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        resize: "none",
        boxSizing: "border-box",
    });
}

function setEditMode(node, widget, enabled) {
    node.pslEditMode = Boolean(enabled);
    widget.hidden = !node.pslEditMode;

    if (node.pslEditMode) {
        configureTextarea(widget);
        requestAnimationFrame(() => configureTextarea(widget));
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
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, UI.buttonRadius);
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

function stripOuterWeight(text) {
    let processed = text.trim();
    let trailingComma = "";

    if (processed.endsWith(",")) {
        trailingComma = ",";
        processed = processed.slice(0, -1).trimEnd();
    }

    const weighted = processed.match(/^\s*\((.*)\s*:\s*([\d.\-]+)\s*\)\s*$/);
    if (weighted) {
        const weight = Number.parseFloat(weighted[2]);
        if (Number.isFinite(weight)) {
            return {
                body: weighted[1].trim(),
                weight,
                trailingComma,
            };
        }
    }

    const parenthesized = processed.match(/^\s*\((.*)\)\s*$/);
    if (parenthesized) processed = parenthesized[1].trim();

    return {
        body: processed,
        weight: 1.0,
        trailingComma,
    };
}

function parsePromptLine(line) {
    const disabled = isDisabledLine(line);
    let working = disabled ? enableLine(line).trimStart() : line.trimStart();

    const internalCommentIndex = working.indexOf("//");
    let promptPart = working;
    let commentPart = "";
    if (internalCommentIndex !== -1) {
        promptPart = working.slice(0, internalCommentIndex).trimEnd();
        commentPart = working.slice(internalCommentIndex);
    }

    const parsed = stripOuterWeight(promptPart);
    const promptText = `${parsed.body}${parsed.trailingComma}`;
    const displayText = commentPart ? `${promptText} ${commentPart}` : promptText;

    return {
        disabled,
        weight: parsed.weight,
        displayText,
    };
}

function adjustWeight(text, lineIndex, delta) {
    const lines = normalizeNewlines(text).split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length || isSeparatorLine(lines[lineIndex])) return text;

    const original = lines[lineIndex];
    const leading = original.match(/^\s*/)?.[0] ?? "";
    let working = original.slice(leading.length);
    let disabledPrefix = "";

    if (working.startsWith("//")) {
        const match = working.match(/^\/\/\s*/);
        disabledPrefix = match?.[0] ?? "// ";
        working = working.slice(disabledPrefix.length);
    }

    const internalCommentIndex = working.indexOf("//");
    let promptPart = working;
    let commentPart = "";
    if (internalCommentIndex !== -1) {
        promptPart = working.slice(0, internalCommentIndex).trimEnd();
        commentPart = working.slice(internalCommentIndex);
    }

    if (!promptPart.trim()) return text;

    const parsed = stripOuterWeight(promptPart);
    const nextWeight = Math.round(
        Math.min(UI.maxWeight, Math.max(UI.minWeight, parsed.weight + delta)) * 100,
    ) / 100;

    const weightedPrompt = Math.abs(nextWeight - 1.0) < 0.0001
        ? `${parsed.body}${parsed.trailingComma}`
        : `(${parsed.body}:${nextWeight.toFixed(2)})${parsed.trailingComma}`;

    const commentSuffix = commentPart ? `${commentPart.startsWith(" ") ? "" : " "}${commentPart}` : "";
    lines[lineIndex] = `${leading}${disabledPrefix}${weightedPrompt}${commentSuffix}`;
    return lines.join("\n");
}

function getTextWrapWidth(node) {
    // Match the textarea's effective text width so wrapping occurs at the same point.
    return Math.max(40, node.size[0] - UI.textareaPaddingLeft - UI.textareaPaddingRight);
}

function layoutRows(node, ctx, text) {
    const lines = normalizeNewlines(text).split("\n");
    const rows = [];
    const maxTextWidth = getTextWrapWidth(node);
    let y = UI.contentTop;

    ctx.save();
    ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;

    lines.forEach((line, index) => {
        if (isSeparatorLine(line)) {
            rows.push({ index, line, separator: true, y, height: UI.lineHeight });
            y += UI.lineHeight;
            return;
        }

        const parsed = parsePromptLine(line);
        const wrapped = wrapText(ctx, parsed.displayText, maxTextWidth);
        const height = Math.max(UI.lineHeight, wrapped.length * UI.lineHeight);
        rows.push({
            index,
            line,
            separator: false,
            ...parsed,
            wrapped,
            y,
            height,
        });
        y += height;
    });

    ctx.restore();
    return { rows, totalHeight: y + UI.bottomPadding };
}

function drawCheckbox(ctx, x, y, checked) {
    ctx.save();
    ctx.strokeStyle = checked ? "#0F0" : "#777";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, UI.checkboxSize, UI.checkboxSize);

    if (checked) {
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 7);
        ctx.lineTo(x + 6, y + 10);
        ctx.lineTo(x + 12, y + 3);
        ctx.strokeStyle = "#0F0";
        ctx.lineWidth = 1.8;
        ctx.stroke();
    }
    ctx.restore();
}

function drawSeparator(ctx, node, row) {
    const centerY = row.y + UI.lineHeight / 2;
    ctx.save();
    ctx.strokeStyle = UI.separatorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(UI.sidePadding, centerY);
    ctx.lineTo(node.size[0] - UI.sidePadding, centerY);
    ctx.stroke();
    ctx.restore();
}

function drawWeightButton(ctx, x, y, label) {
    const buttonY = y + (UI.lineHeight - UI.weightButtonSize) / 2;
    ctx.save();
    ctx.fillStyle = "#333";
    ctx.fillRect(x, buttonY, UI.weightButtonSize, UI.weightButtonSize);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, buttonY + 0.5, UI.weightButtonSize - 1, UI.weightButtonSize - 1);
    ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, x + UI.weightButtonSize / 2, buttonY + UI.weightButtonSize / 2 + 0.25);
    ctx.restore();
}

function drawWeightControls(node, ctx, row) {
    const plusX = node.size[0] - UI.sidePadding - UI.weightButtonSize;
    const minusX = plusX - UI.weightButtonGap - UI.weightButtonSize;

    drawWeightButton(ctx, minusX, row.y, "-");
    drawWeightButton(ctx, plusX, row.y, "+");

    node.pslWeightAreas.push({
        type: "decrease",
        lineIndex: row.index,
        x: minusX,
        y: row.y,
        w: UI.weightButtonSize,
        h: UI.lineHeight,
    });
    node.pslWeightAreas.push({
        type: "increase",
        lineIndex: row.index,
        x: plusX,
        y: row.y,
        w: UI.weightButtonSize,
        h: UI.lineHeight,
    });

    if (Math.abs(row.weight - 1.0) > 0.0001) {
        const label = row.weight.toFixed(2);
        ctx.save();
        ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;
        ctx.fillStyle = row.disabled ? "#888" : "#ddd";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(label, minusX - 6, row.y + UI.lineHeight / 2);
        ctx.restore();
    }
}

function drawNormalMode(node, ctx, widget) {
    const { rows, totalHeight } = layoutRows(node, ctx, widget.value);
    node.pslRows = rows;
    node.pslWeightAreas = [];

    ctx.save();
    ctx.font = `${UI.fontSize}px ${UI.fontFamily}`;
    ctx.textBaseline = "middle";

    for (const row of rows) {
        if (row.separator) {
            drawSeparator(ctx, node, row);
            continue;
        }

        const boxY = row.y + (UI.lineHeight - UI.checkboxSize) / 2;
        const boxX = UI.sidePadding;
        drawCheckbox(ctx, boxX, boxY, !row.disabled);

        ctx.fillStyle = row.disabled ? "#888" : "#f1f1f1";
        const textX = UI.sidePadding + UI.checkboxSize + UI.checkboxGap;
        row.wrapped.forEach((part, i) => {
            ctx.fillText(part, textX, row.y + i * UI.lineHeight + UI.lineHeight / 2);
        });

        drawWeightControls(node, ctx, row);
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
        const weightArea = node.pslWeightAreas?.find((area) => pointInRect(x, y, area));
        if (weightArea) {
            const delta = weightArea.type === "increase" ? UI.weightStep : -UI.weightStep;
            commitWidget(node, widget, adjustWeight(widget.value, weightArea.lineIndex, delta));
            return true;
        }

        const row = node.pslRows?.find(
            (item) => !item.separator && y >= item.y && y <= item.y + item.height,
        );
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
            this.pslWeightAreas = [];

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
                // Edit-mode switching itself never focuses the textarea automatically.
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
