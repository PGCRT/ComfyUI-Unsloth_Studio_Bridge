# ComfyUI-Unsloth Studio Bridge

ComfyUI nodes that connect to the model currently loaded in
[Unsloth Studio](https://github.com/unslothai/studio) and chat with it.

> **Temporary repository.** These nodes were split out of
> [CRT-Nodes](https://github.com/PGCRT/CRT-Nodes) for ComfyUI registry
> packaging and will be re-merged into CRT-Nodes. Prefer CRT-Nodes once the
> nodes are back there.

## Install

Clone into `ComfyUI/custom_nodes/`, or install from the ComfyUI registry /
Manager. No extra Python packages are needed.

## Nodes

### Unsloth Studio Bridge

Chats with the model loaded in Studio, with optional image input, URL fetching
and live thinking output. Outputs the answer as a `STRING`.

- `prompt`, `seed`, `temperature`, `top_p`, `top_k` — sampling. Set the
  sampling values to `-1` to use the server's active defaults.
- `image` (optional) — vision input, needs a vision-capable model.
- `url_web_search` (optional socket) — extra links to fetch, one per line.
- `unsloth_server_url` — where to connect. See [Connecting](#connecting).
- `studio_api_key` — an `sk-unsloth-...` key or your Studio password. Leave
  empty for automatic local auth; required for a remote Studio.
- `retain_last_response` — keep the last N answers in context across runs.
- `cache_skills` — reuse the server's prompt cache between runs.
- `disable_thinking` — ask supported models for a direct answer.
- `include_reasoning` — append the model's reasoning to the output.
- `disable_web_search` — turn off URL fetching and web search.
- `unload_model_after_run` — free the model's VRAM after the run; the next run
  reloads it with the same settings through the Studio API.
- `live_display` — stream thinking and answer tokens to the display node.

### Unsloth Studio Bridge Thinking Display

Output-less live viewer. Add it anywhere in the workflow and it shows the
bridge's thinking in real time with tok/s and token counts. Nothing to wire up.

## Connecting

- **Local Studio (default)** — leave `unsloth_server_url` at
  `http://127.0.0.1:8888`. The bridge finds the active llama-server port in
  Studio's logs and authenticates locally on its own.
- **Remote Studio** — enter the Studio address, for example
  `http://192.168.10.100:8444` (the `http://192.168.10.100:8444/api` form also
  works), and fill in `studio_api_key`. On the remote Studio, use a key or
  password, or enable keyless API access (inference scope) in Settings. A model
  must be loaded.
- **Raw llama-server** — any llama-server base URL works, with or without auth.

## Skills

The `skills/` folder holds optional `.md` files the bridge loads through its
`skills_path` input: every `.md` file in the folder and its subfolders is
appended to the system prompt as extra context.

## Requirements

- Unsloth Studio running with a model loaded. Image input needs a vision model.
- ComfyUI; no extra dependencies.

## Links

- Unsloth Studio: <https://github.com/unslothai/studio>
- CRT-Nodes: <https://github.com/PGCRT/CRT-Nodes>
