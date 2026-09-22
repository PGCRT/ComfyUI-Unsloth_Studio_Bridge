---
name: ACESTEP-prompting
description: Write and refine ACE-Step 1.5 inputs — caption, lyrics, and metadata (bpm, keyscale, timesignature, vocal_language, duration) — for the CRT "ACE-Step AIO" node, acting as the external planner that replaces the 5Hz LM Chain-of-Thought pass. Use when drafting or improving ACE-Step prompts, choosing metadata, adapting lyrics across languages, using the SCH LoRA, or fixing weak vocals, genre drift, wrong language, bad structure, rushed phrasing, metadata conflicts, or songs that end early. Covers caption dimensions, structure/vocal/energy tags, singability, 50+ language codes, per-variant sampling defaults, and DiT-only operation.
---

# ACE-Step 1.5 Prompting (external planner mode)

ACE-Step 1.5 is **two models working together**:

- a **5Hz LM planner** that reasons about a song (Chain-of-Thought) and emits metadata + a caption rewrite + audio semantic codes;
- a **DiT executor** (2B or XL/4B; turbo / base / sft) that renders audio from the caption, lyrics and metadata.

This skill lets a **larger external LLM do the planner's job** by producing the exact fields the DiT consumes. You then run the node **DiT-only** so the small LM never rewrites or overrides your work.

> Official reference: `docs/en/Tutorial.md` ("About Caption / About Lyrics / About Music Metadata"), `acestep/constants.py`, `acestep/core/generation/handler/prompt_utils.py`.

---

## What the model actually reads

The DiT text encoder receives two strings built by the handler (`prompt_utils.py` / `conditioning_text.py`):

**Caption branch**
```
# Instruction
Fill the audio semantic mask based on the given conditions:

# Caption
<caption>

# Metas
- bpm: <bpm>
- timesignature: <timesignature>
- keyscale: <keyscale>
- duration: <N> seconds
<|endoftext|>
```

**Lyrics branch**
```
# Languages
<vocal_language>

# Lyric
<lyrics><|endoftext|>
```

So the only inputs that matter are: **caption**, **lyrics**, **bpm**, **keyscale**, **timesignature**, **duration**, **vocal_language**. Nothing else reaches the model — there is no negative prompt and no artist field.

---

## Replacing the 5Hz LM (required workflow)

What the LM normally does, and what the external planner can replace:

| LM task | External agent | How |
|---|---|---|
| CoT **metadata** (bpm/key/time-sig/language/duration) | ✅ replace | emit the `bpm`, `keyscale`, `timesignature`, `vocal_language`, `duration` fields |
| CoT **caption rewrite/expansion** | ✅ replace | write the final `caption` yourself |
| **Lyrics** formatting/transcription | ✅ replace | write the final `lyrics` yourself |
| **Audio semantic codes** (FSQ tokens that hint the arrangement) | ❌ not possible | model-internal; only the 5Hz LM produces these |

Because the codes cannot be produced externally, run **DiT-only**:

- `thinking = false`
- `lm_model = "none"`

The DiT then generates directly from caption + lyrics + metadata. This is the official "DiT-only" path (used on ≤6 GB GPUs). Quality comes from how well you specify the caption/lyrics/metadata — which is exactly the job of a bigger LLM.

If you want to keep the LM only for its audio codes while still using *your* caption/metadata, the official knobs are `use_cot_caption=False`, `use_cot_metas=False`, `use_cot_language=False` with `thinking=True` (not exposed in the CRT node yet — use `lm_model="none"` for the clean path).

---

## Output format (required)

Return **one JSON object**. No prose, no code fences, no comments.

```json
{
  "caption": "<comma-separated musical descriptors>",
  "lyrics": "<section tags + sung lines>",
  "bpm": 132,
  "keyscale": "F minor",
  "timesignature": "4/4",
  "vocal_language": "fr",
  "duration": 130,
  "instrumental": false
}
```

Field contract:

| Field | Type | Rules |
|---|---|---|
| `caption` | string | one line, comma-separated descriptors; **never** put bpm/key/time-sig here |
| `lyrics` | string | `\n`-separated; section tags on their own lines; blank line between sections; `[Instrumental]` if no vocals |
| `bpm` | int | 30–300; omit or `null` to let the DiT guess (keep 60–180 for reliability) |
| `keyscale` | string | `"<Note><accidental> <major|minor>"`, e.g. `"C major"`, `"F# minor"`, `"Bb major"`; `""` = auto |
| `timesignature` | string | `"4/4"` (default), `"3/4"`, `"6/8"`; `""` = auto |
| `vocal_language` | string | ISO-ish code from the list below; `"unknown"` = auto |
| `duration` | number | 10–600 seconds (target; actual may drift) |
| `instrumental` | bool | `true` disables vocals regardless of lyrics |

Valid `vocal_language` codes:
`ar az bg bn ca cs da de el en es fa fi fr he hi hr ht hu id is it ja ko la lt ms ne nl no pa pl pt ro ru sa sk sr sv sw ta te th tl tr uk ur vi yue zh unknown`

Suggested node settings for external-planner mode:
`thinking=false`, `lm_model="none"`, `steps/cfg/shift` per the variant table below.

---

## The caption (most important input)

One comma-separated line. Order descriptors most-important-first. Aim for **8–20 concrete descriptors**. Formats from simple tags to natural language all work; specificity wins.

Recommended order:
```
<language>, <genre/subgenre/era>, <mood/energy>, <vocal (gender/range/delivery/timbre)>,
<lead instruments>, <rhythm section (bass/drums/groove)>, <production/mix>, <era>
```

Dimensions to draw from (official list):

| Dimension | Examples |
|---|---|
| Style/Genre | hip-hop, French rap, trap, drill, R&B, pop, rock, jazz, electronic, lo-fi, synthwave |
| Emotion/Atmosphere | melancholic, uplifting, aggressive, dreamy, dark, nostalgic, brooding, intimate |
| Instruments | 808s, detuned piano, reversed guitar, synth pads, strings, brass, electric bass |
| Timbre texture | warm, bright, crisp, muddy, airy, punchy, lush, raw, polished, gritty |
| Era reference | 90s boom-bap, 2000s, 2010s, 2020s, modern trap |
| Production | lo-fi, hi-fi, live, studio-polished, wide reverb, punchy master |
| Vocal | male baritone, female breathy, raspy, falsetto, autotuned hooks, spoken-word, choir |
| Speed/rhythm | slow, mid-tempo, driving, laid-back, syncopated hi-hats |
| Structure hints | building intro, anthemic chorus, dramatic bridge, fade-out |

Rules:

- **Descriptors, not instructions.** Noun phrases only — no imperative sentences.
- **Combine dimensions.** "sad piano ballad, breathy female vocal" beats "a sad song".
- **Specific beats vague.** Name instruments, texture, era, production.
- **Texture words steer the mix** (warm/crisp/airy/punchy).
- **Never put bpm / key / time-signature in the caption** — they belong in metadata (official recommendation). Duplicating them causes conflicts.
- **Avoid conflicts.** Don't ask for classical strings *and* hardcore metal at once. If you must mix styles, either repeat the dominant one or express it as **temporal evolution**: "starts as soft strings, middle turns to distorted metal, ends hip-hop".
- **Don't describe the artist.** Use genre/era/instrument/production, not performer names.
- **More detail = more control; less detail = more surprise.** Choose deliberately.
- Keep the caption **consistent with the lyrics language and imagery**.

### LoRA note (SCH)

The SCH ACE-Step LoRA was trained on captions in the dataset style:
`<language>, <genre>, <subgenre>, <mood...>, <energy>, <instruments...>, <vocal>, <production...>, <era>`
(e.g. `French, Hip-Hop, French Rap, confident, assertive, energetic, high, drums, bass, samples, male, modern trap-influenced, 2020s`). Write captions in that distribution and put bpm/key in metadata to stay in-distribution.

---

## The lyrics (temporal script)

Lyrics carry the words **and** the arrangement via tags. Section tags are the strongest control.

### Section tags (own line, blank line between sections)

`[Intro] [Verse] [Verse 1] [Pre-Chorus] [Chorus] [Bridge] [Outro]`
Dynamic: `[Build] [Drop] [Breakdown]`
Instrumental: `[Instrumental] [Guitar Solo] [Piano Interlude]`
Special: `[Fade Out] [Silence]`

### Combine a tag with a style with `-` (use sparingly)

```
[Chorus - anthemic]
[Bridge - whispered]
[Verse - spoken word]
```
Do **not** stack many descriptors inside one tag — the model may sing the tag or get confused.

### Vocal / energy tags

Vocal: `[raspy vocal] [whispered] [falsetto] [powerful belting] [spoken word] [harmonies] [call and response] [ad-lib]`
Energy: `[high energy] [low energy] [building energy] [explosive] [melancholic] [euphoric] [dreamy] [aggressive]`

### Singability rules

- **6–10 syllables per line** is the sweet spot; keep the same position across verses within ±1–2.
- **One thought per line**; break on a natural breath.
- **UPPERCASE = higher intensity** (shouting). Use for peak chorus lines only.
- **Parentheses = background vocals/harmonies**: `We rise together (together)`.
- **Vowel extension** for held notes (`Feeeling so aliiive`) — unstable, use rarely.
- **Blank line between every section.**
- **Repeat the chorus word-for-word.**
- Keep **one point of view, tense, and core metaphor** for the whole song.
- **No performance notes, chord names, or metadata inside the lyrics.**

### Song shape (~2.5–3.5 min)

```
[Intro]
[Verse 1]     4–8 lines
[Pre-Chorus]  2–4 lines   (optional)
[Chorus]      4–8 lines
[Verse 2]
[Chorus]
[Bridge]      2–4 lines   (contrast)
[Chorus]
[Outro]       1–2 lines or [Instrumental]
```

### Avoid "AI-flavored" lyrics

- no adjective stacking ("neon skies, electric hearts, endless dreams");
- no forced/chaotic rhymes;
- no verse content bleeding into the chorus;
- no lines too long to breathe;
- no mixed metaphors.

### Instrumental

Use `[Instrumental]` (or descriptive instrumental tags) and set `instrumental=true`. The style/instruments go in the **caption**, not the lyrics.

---

## Metadata (optional fine control)

The DiT treats these as **anchors**, not exact commands (a requested 120 BPM may render 118–122).

| Field | Range / format | Notes |
|---|---|---|
| `bpm` | 30–300 | 60–80 slow, 90–120 mid, 130–180 fast; extremes unstable |
| `keyscale` | `<Note><#/b> <major\|minor>` | common keys stable (C, G, D, Am, Em); rare keys may shift |
| `timesignature` | `4/4`, `3/4`, `6/8` | 4/4 most reliable; 5/4, 7/8 advanced |
| `vocal_language` | code list above | must match the lyrics language |
| `duration` | 10–600 s | 30–60 s and 2–4 min stable; very long risks repetition |

Leave a field empty/`null` to let the DiT auto-infer.

---

## Consistency (the #1 quality lever)

Caption, lyrics and metadata must tell the **same story**:

- instruments in the caption ↔ instrumental tags in the lyrics;
- emotion/energy in the caption ↔ energy tags in the lyrics;
- vocal description in the caption ↔ vocal tags / casing in the lyrics;
- caption language == `vocal_language` == lyrics language;
- bpm/key/time-sig consistent with the style (don't say "slow ballad" and set `bpm=160`).

Conflicts degrade output — the model fuses badly instead of resolving.

---

## Per-variant sampling defaults (set these in the node)

| Variant | `steps` | `cfg` | `shift` | CFG/ADG |
|---|---|---|---|---|
| turbo (2B/XL) | 8 | 1.0 | 3.0 | no CFG; `use_adg=false` |
| sft | 50 | 7.0 | 3.0 | CFG on; ADG optional |
| base (2B/XL) | 32 (up to 100) | 7.0 | 3.0 | CFG on; `use_adg` optional; `cfg_interval` usable |

`dcw="auto"` (on for turbo, off for base). Keep `seed` fixed while iterating prompts; vary it to explore.

---

## Failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Wrong language / accent | caption language missing or ≠ lyrics | name language first in caption; write lyrics in it; set `vocal_language` |
| Genre ignored | caption too vague / genre buried | add concrete instruments + production + era; move genre earlier |
| Words rushed / garbled | lines too long/dense | shorten to 6–10 syllables; simpler words; more line breaks |
| Monotonous / no lift | flat structure | add `[Pre-Chorus]`/`[Bridge]` contrast; `[Chorus - anthemic]`; bigger chorus arrangement in caption |
| Chorus doesn't hit | weak contrast | repeat hook, uppercase peak line, describe a bigger arrangement |
| Vocals thin / missing | vocal not described | add gender/range/delivery/timbre to caption; check `instrumental=false` |
| Muddy / over-reverbed | production unspecified | add production/mix/texture descriptors |
| Metadata ignored | conflicting caption | remove bpm/key words from caption; keep metadata consistent |
| Song ends early | duration too short / token limit | raise `duration`; trim lyrics |
| LoRA has no effect | out-of-distribution caption or wrong base | match the training caption style; use the same base variant the LoRA was trained on |

---

## Checklist before generating

- [ ] Output is a single JSON object with the 8 fields, no extra text
- [ ] `caption` is one comma-separated line, 8–20 concrete descriptors, **no bpm/key/time-sig**
- [ ] caption language == `vocal_language` == lyrics language
- [ ] lyrics use section tags on their own lines with blank lines between sections
- [ ] 6–10 syllables/line, consistent within a section; chorus repeated word-for-word
- [ ] uppercase only for intensity; parentheses only for backing vocals
- [ ] `bpm`/`keyscale`/`timesignature` in metadata, consistent with the caption
- [ ] `duration` set; `instrumental` correct
- [ ] node set to `thinking=false`, `lm_model="none"` (external-planner mode)
- [ ] sampling defaults match the loaded DiT variant
- [ ] SCH LoRA: caption in the training distribution

---

## Mapping to the CRT "ACE-Step AIO" node

| Skill field | Node input |
|---|---|
| `caption` | `caption` (or `caption_override`) |
| `lyrics` | `lyrics` (or `lyrics_override`) |
| `bpm` | `bpm` (`0` = auto) |
| `keyscale` | `keyscale` (`""` = auto) |
| `timesignature` | `timesignature` (`""` = auto) |
| `vocal_language` | `vocal_language` |
| `duration` | `duration` |
| `instrumental` | `instrumental` |
| planner mode | `thinking=false`, `lm_model="none"` |
| sampler | `steps`, `cfg`, `shift`, `sampler_mode`, `use_adg`, `cfg_interval_start/end`, `dcw` |
| SCH LoRA | `lora_path`, `lora_scale` |

Minimal API payload for the `AceStepAIO` node:

```json
{
  "class_type": "AceStepAIO",
  "inputs": {
    "model": "acestep-v15-xl-base",
    "caption": "<caption>",
    "lyrics": "<lyrics>",
    "duration": 130,
    "seed": -1,
    "steps": 0,
    "cfg": 0,
    "shift": 0,
    "bpm": 132,
    "keyscale": "F minor",
    "timesignature": "4/4",
    "vocal_language": "fr",
    "instrumental": false,
    "thinking": false,
    "lm_model": "none",
    "lora_path": "C:\\ComfyUI_windows_portable\\ComfyUI\\models\\loras\\acestep 1.5\\SCH_AceStep15XL_LoRA_000003750.safetensors",
    "lora_scale": 1.0,
    "quantization": "none",
    "offload_to_cpu": false,
    "device": "auto",
    "attention": "auto",
    "sampler_mode": "euler",
    "use_adg": false,
    "cfg_interval_start": 0.0,
    "cfg_interval_end": 1.0,
    "dcw": "auto",
    "audio_format": "flac",
    "save_output": true,
    "save_path": ""
  }
}
```

Note: `steps=0`, `cfg=0`, `shift=0` mean "auto" and resolve to the per-variant defaults above; you may also set them explicitly. The agent should still fix `seed` when comparing prompt edits.
