import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "CRT_UnslothThinkingDisplay";
const EVENT_NAME = "crt_unsloth_thinking";
const STYLE_ID = "crt-unsloth-thinking-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .crt-thinking-root {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      background: #0b0b0d; color: #e4e4e7;
      font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
      font-size: 12px; box-sizing: border-box;
      border: 1px solid #1c1c1f; border-radius: 6px; overflow: hidden;
    }
    .crt-thinking-head {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; background: #111114;
      border-bottom: 1px solid #1c1c1f;
      font-weight: 600; letter-spacing: 0.02em;
      user-select: none;
    }
    .crt-thinking-dot { width: 8px; height: 8px; border-radius: 50%; background: #52525b; flex-shrink: 0; }
    .crt-thinking-dot.running { background: #f59e0b; animation: crt-thinking-pulse 1s infinite ease-in-out; }
    .crt-thinking-dot.done { background: #22c55e; animation: none; }
    .crt-thinking-dot.error { background: #ef4444; animation: none; }
    @keyframes crt-thinking-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    .crt-thinking-stats { color: #a1a1aa; font-weight: 400; font-size: 11px; margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .crt-thinking-size { width: 70px; accent-color: #8b5cf6; cursor: pointer; flex-shrink: 0; }
  `;
  document.head.appendChild(style);
}

function collectDisplayNodes() {
  const graph = app.graph;
  if (!graph) return [];
  const list = graph._nodes || graph.nodes || [];
  return list.filter((n) => n && (n.type === NODE_NAME || n.comfyClass === NODE_NAME));
}

function setStatus(node, mode, text) {
  if (!node._crtThinkDot || !node._crtThinkStats) return;
  node._crtThinkDot.className = `crt-thinking-dot${mode ? ` ${mode}` : ""}`;
  node._crtThinkStats.textContent = text || "";
}

function formatStats(stats, done) {
  if (!stats) return done ? "done" : "thinking…";
  const parts = [];
  if (Number.isFinite(stats.tps) && stats.tps > 0) parts.push(`${stats.tps.toFixed(1)} tok/s`);
  if (Number.isFinite(stats.completion_tokens) && stats.completion_tokens > 0) {
    parts.push(`${Math.round(stats.completion_tokens)} tok`);
  }
  if (done && Number.isFinite(stats.elapsed) && stats.elapsed > 0) {
    parts.push(`${stats.elapsed.toFixed(1)}s`);
  }
  if (!parts.length) return done ? "done" : "thinking…";
  return done ? `done · ${parts.join(" · ")}` : parts.join(" · ");
}

function applySnapshot(node, thinking, done, error, stats) {
  if (!node._crtThinkPre) return;
  if (node._crtPendingFrame) cancelAnimationFrame(node._crtPendingFrame);
  node._crtPendingFrame = requestAnimationFrame(() => {
    node._crtPendingFrame = null;
    const el = node._crtThinkPre;
    const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    el.textContent = thinking || "";
    if (error) {
      setStatus(node, "error", String(error).slice(0, 120));
    } else if (done) {
      setStatus(node, "done", formatStats(stats, true));
    } else {
      setStatus(node, "running", formatStats(stats, false));
    }
    if (!done && stick) el.scrollTop = el.scrollHeight;
    if (done) el.scrollTop = el.scrollHeight;
    node.setDirtyCanvas?.(true, true);
  });
}

function clearView(node, text) {
  if (!node._crtThinkPre) return;
  if (node._crtPendingFrame) cancelAnimationFrame(node._crtPendingFrame);
  node._crtPendingFrame = null;
  node._crtThinkPre.textContent = "";
  setStatus(node, "running", text || "starting…");
  node.setDirtyCanvas?.(true, true);
}

function routeEvent(data) {
  if (!data) return;
  // Standalone viewer: every instance shows the latest bridge activity.
  for (const node of collectDisplayNodes()) {
    if (typeof node._crtThinkApply !== "function") continue;
    node._crtThinkApply(data);
  }
}

app.registerExtension({
  name: "UnslothStudio.ThinkingDisplay",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE_NAME) return;
    ensureStyles();

    const origCreated = nodeType.prototype.onNodeCreated;
    const origRemoved = nodeType.prototype.onRemoved;
    const origExecuted = nodeType.prototype.onExecuted;
    const origSerialize = nodeType.prototype.onSerialize;
    const origConfigure = nodeType.prototype.onConfigure;

    nodeType.prototype.onNodeCreated = function () {
      origCreated?.apply(this, arguments);
      this.bgcolor = "#0b0b0d";
      this.color = "#1c1c1f";
      if (!this.size || this.size[0] < 380 || this.size[1] < 200) this.size = [420, 360];

      const root = document.createElement("div");
      root.className = "crt-thinking-root";
      root.style.cssText += "width:100%;height:100%;display:flex;flex-direction:column;";

      const head = document.createElement("div");
      head.className = "crt-thinking-head";
      const dot = document.createElement("span");
      dot.className = "crt-thinking-dot";
      const title = document.createElement("span");
      title.textContent = "Thinking";
      const stats = document.createElement("span");
      stats.className = "crt-thinking-stats";
      stats.textContent = "idle";
      const sizeKnob = document.createElement("input");
      sizeKnob.type = "range";
      sizeKnob.min = "8";
      sizeKnob.max = "28";
      sizeKnob.step = "1";
      sizeKnob.className = "crt-thinking-size";
      sizeKnob.title = "Text size";
      head.append(dot, title, stats, sizeKnob);

      const thinkPre = document.createElement("pre");
      thinkPre.style.cssText =
        "flex:1;margin:0;padding:8px 10px;overflow-y:auto;min-height:0;" +
        "border-left:2px solid #8b5cf6;background:rgba(139,92,246,0.07);color:#c4b5fd;" +
        "font-family:ui-monospace,'Consolas','Monaco',monospace;font-size:11px;" +
        "white-space:pre-wrap;word-break:break-word;";
      thinkPre.textContent = "";

      root.append(head, thinkPre);
      root.addEventListener("mousedown", (e) => e.stopPropagation(), true);

      this.properties = this.properties || {};
      const savedSize = Number(this.properties.thinking_font_size) || 11;
      sizeKnob.value = String(savedSize);
      thinkPre.style.fontSize = `${savedSize}px`;
      sizeKnob.addEventListener("input", () => {
        const next = Number(sizeKnob.value) || 11;
        thinkPre.style.fontSize = `${next}px`;
        this.properties.thinking_font_size = next;
      });

      this._crtThinkDot = dot;
      this._crtThinkStats = stats;
      this._crtThinkPre = thinkPre;
      this._crtSizeKnob = sizeKnob;
      this._crtThinkApply = (data) =>
        applySnapshot(
          this,
          data.thinking || "",
          Boolean(data.done),
          data.error || null,
          data.stats || null
        );

      this.addDOMWidget("crt_thinking_view", "thinking", root, {
        serialize: false,
        computeSize: () => [this.size?.[0] || 420, this.size?.[1] || 360],
      });
      this.setDirtyCanvas?.(true, true);
    };

    nodeType.prototype.onExecuted = function (message) {
      origExecuted?.apply(this, arguments);
      // Display-only node: backend returns no payload. Keep the last live
      // snapshot; only settle a stale "running" status.
      try {
        const pick = (v) => (Array.isArray(v) ? String(v[0] ?? "") : v == null ? "" : String(v));
        const thinking = pick(message?.thinking);
        if (thinking) {
          applySnapshot(this, thinking, true, null, message?.stats || null);
        } else if (this._crtThinkDot?.classList.contains("running")) {
          setStatus(this, "done", this._crtThinkStats?.textContent || "done");
        }
      } catch {
        /* ignore malformed payloads */
      }
    };

    nodeType.prototype.onRemoved = function () {
      if (this._crtPendingFrame) cancelAnimationFrame(this._crtPendingFrame);
      this._crtPendingFrame = null;
      this._crtThinkApply = null;
      origRemoved?.apply(this, arguments);
    };

    nodeType.prototype.onSerialize = function (o) {
      origSerialize?.apply(this, arguments);
      o.properties = this.properties;
    };

    nodeType.prototype.onConfigure = function (info) {
      origConfigure?.apply(this, arguments);
      this.properties = info.properties || {};
      const size = Number(this.properties.thinking_font_size) || 11;
      if (this._crtThinkPre) this._crtThinkPre.style.fontSize = `${size}px`;
      if (this._crtSizeKnob) this._crtSizeKnob.value = String(size);
    };
  },

  async setup() {
    ensureStyles();
    api.addEventListener(EVENT_NAME, (e) => {
      try {
        routeEvent(e.detail);
      } catch (err) {
        console.warn("[CRT thinking display] event routing failed:", err);
      }
    });
    api.addEventListener("execution_start", () => {
      for (const node of collectDisplayNodes()) clearView(node, "starting…");
    });
  },
});
