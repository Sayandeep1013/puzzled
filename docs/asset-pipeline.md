# Hand-Drawn Asset Pipeline

How to produce the painterly illustrations for the hand-drawn redesign
(`design/handdrawn-v1`) in volume, fast, and — most importantly — **consistently**.

The UI chrome (borders, buttons, tab bar, line icons) is already generated
procedurally in Skia and needs **no assets**. This doc is only about the
illustrated art that code can't fake: the hero puzzle piece, trophy, avatar,
achievement badges, category tiles, and decorative stickers.

---

## 1. The asset list for this project

Every slot below already exists in code as a procedural placeholder, so finished
art is a drop-in replacement (see §7).

| Asset | Where it's used | Count |
|---|---|---|
| Hero puzzle piece (golden, shaded) | Home hero | 1 |
| Trophy | Well Done / results | 1 |
| Avatar portrait(s) | Profile | 1–5 |
| Category tiles (nature, animals, cities, art, food) | Explore | 5 |
| Achievement badges | Achievements | 6–20 |
| Coin / coin-stack | Shop | 2–3 |
| Glowing hint piece + sparkles | Hint overlay | 1–2 |
| Decorative stickers (stars, tape, confetti) | throughout | ~6 |

≈ **25–40 illustrations**. Small enough to hand-draw, large enough that
consistency and turnaround matter — which is exactly the sweet spot for a
locked-style AI batch.

---

## 2. The core problem: **consistency, not generation**

Any model can draw "a trophy." The hard part is drawing a trophy, a leaf, a paw,
and an owl that look like they came from **the same illustrator, the same day,
the same palette.** Everything below is organized around pinning style so a batch
reads as one set. Three levers, in order of power:

1. **Trained model / LoRA** — the model *learns* your style. Strongest.
2. **Style reference image** (`--sref`, IP-Adapter, "style ref") — every gen
   imitates one anchor image. Strong, zero training.
3. **Locked prompt + seed family** — same style clause + palette + seed range on
   every gen, changing only the subject noun. Baseline, always do this.

Use as many levers as the platform supports. A post-process **palette snap**
(§6) unifies whatever drift remains.

---

## 3. LoRA — deep dive

### What it is
A **LoRA** (Low-Rank Adaptation) is a tiny "style patch" (~10–150 MB) trained on
top of a big base model (SDXL, Flux, etc.). Instead of retraining billions of
parameters, it learns a small set of low-rank matrices that nudge the base model
toward *your* look. You then generate with `base model + your LoRA`, and every
image inherits the trained style. It is the single highest-leverage step for a
cohesive set: train once, generate on-brand forever.

### When it's worth it
- You need **≥15–20 assets** in one style (we do).
- You want the style reusable months later, or by teammates.
- You've got 10–30 reference images (drawn, or AI-generated-then-curated) that
  nail the look.

For a one-off of 3 images, skip the LoRA and just use a style reference (§4).

### Dataset preparation (the part that decides quality)
1. **Gather 15–30 images** in the exact target style. Sources: hand-drawn by you,
   a purchased storybook illustration pack (check the license), or a first AI
   batch made with a style reference (§4) that you then hand-cull to the best 20.
2. **Consistency over quantity.** 20 tightly-consistent images beat 60 mixed ones.
   All same palette, same line weight, same shading, same background treatment.
3. **Variety of *subject*, not *style*.** Include different objects/poses so the
   LoRA learns "the style," not "how to draw one trophy."
4. **Square, clean, high-res** (1024×1024). Transparent or uniform background.
5. **Caption each image.** Put a unique **trigger word** in every caption, e.g.
   `hdstyle`, then describe only the subject: `hdstyle illustration of a trophy,
   cream background`. Auto-captioning (BLIP/GPT-4o-vision) then a manual pass.

### Key training parameters
| Param | Sensible start | Notes |
|---|---|---|
| Base model | **Flux.1-dev** (best quality) or SDXL (cheaper, more tooling) | Flux LoRAs look painterly and hold style well |
| Steps | 1000–2000 | More isn't always better — watch for overcooking |
| Learning rate | 1e-4 (SDXL) / 1e-4–4e-4 (Flux) | Too high = artifacts; too low = weak style |
| Network rank (dim) | 16–32 | Higher = more capacity + bigger file; 16 is plenty for a style |
| Resolution | 1024 | Match your generation resolution |
| Trigger word | `hdstyle` (unique token) | Put in every caption; use it at inference |

Signs of **overfitting**: the model reproduces training images verbatim, warps on
new subjects, ignores prompt changes. Fix by lowering steps/LR or adding data.

### Where to train a LoRA (easiest → most control)

- **Replicate — `ostris/flux-dev-lora-trainer`** *(recommended start)*
  1. Zip your captioned images.
  2. Open the trainer model page → upload zip → set `trigger_word`,
     `steps` (~1000), `lora_rank` (16).
  3. Run (~20–30 min, a few dollars). Output is a hosted LoRA you can call
     immediately via the Replicate API for batch generation.
  - Pros: no GPU, one-click, instantly usable in a script. Best on-ramp.

- **fal.ai — `flux-lora-fast-training`**
  - Same idea, very fast (~5 min), cheap, clean API. Great for iterating on the
    dataset (train → eyeball → re-train). Generation endpoint `flux-lora` accepts
    your LoRA URL + prompt.

- **Civitai on-site trainer**
  - Upload images in the browser, auto-caption, train SDXL/Flux LoRA with buck
    credits, generate on-site. Most beginner-friendly UI; big community of style
    LoRAs to study. Watch licensing if you publish.

- **Local (`kohya_ss` GUI or ComfyUI)**
  - Full control, free after hardware. Needs a ≥12–16 GB VRAM GPU and patience.
    Only worth it if you'll train many models.

### Using the trained LoRA
Inference prompt = `trigger word + style clause + subject`, e.g.
`hdstyle, hand-drawn storybook illustration, soft colored-pencil shading, muted
terracotta and sage palette, a golden jigsaw puzzle piece, centered, transparent
background`. Fix the seed range, generate 4 variants per subject, cull.

---

## 4. Platforms that focus on **asset generation** (and how to use each)

Ranked for *this* use case (cohesive 2D illustrated game/app assets).

### Scenario.gg — *built for game assets, strongest consistency*
Purpose-built for studios: you **train custom models** on your art and generate
matching assets forever. Supports style + character consistency, transparent PNG
export, upscaling, and a **REST API** for batch/headless runs.
- **How:** Create a project → **Train a model** (upload 15–30 style refs, name it)
  → in Generate, select your model, write the subject, set transparent background
  → batch-generate → download PNGs. Automate the same via their API with a subject
  list. Best fit if you want a durable, on-brand asset factory.

### Leonardo.ai — *game-art focused, generous free tier*
Game-oriented platform with **custom model training**, **Elements** (style
add-ons), style-reference images, transparent-background export, and an API.
- **How:** Training → **Datasets** (upload refs) → Train Model → generate with that
  model + "Transparent" toggle. Or skip training and use **Image Guidance → Style
  Reference** with one anchor image for zero-train consistency.

### Recraft — *brand/style sets + true vector output*
Designed for consistent brand assets. Killer feature: it can output **SVG
vectors**, and you can **create a reusable "Style"** from your images so every
generation matches. Great for icons/badges you want crisp at any size.
- **How:** Create a **Style** (upload refs) → generate with that style → export SVG
  or PNG. Vectors drop straight into a Skia/SVG renderer. API available.

### Midjourney — *best raw illustration quality, no training*
No custom training, but **style references** make it batch-consistent:
- `--sref <image-url-or-code>` locks the look across every prompt.
- `--sref random` then reuse the printed code to keep a whole set on one style.
- **Moodboards / style tuner** to bake a named style.
- **How:** `a golden jigsaw puzzle piece, storybook illustration --sref <code>
  --seed 1234`, then swap only the subject noun per asset. Downside: no API/
  transparent export — you'll `rembg` afterward (§5).

### Flux (via fal.ai or Replicate) — *the API-first workhorse + LoRA*
Best when you want the whole thing **headless and scripted**. Pair with your
trained LoRA (§3) for max consistency, or use a style reference. Clean APIs, cheap,
fast; ideal engine behind the batch script in §5.

### Ideogram — *reliable consistent sets, handles text*
Strong at coherent sets and any asset that needs legible lettering (badges with
words). Style reference + fixed seed. Simple web UI + API.

### Adobe Firefly — *commercially-safe + style match*
Trained on licensed/Adobe-stock data, so output is **safe for commercial use** —
worth it if licensing worries you. Has "Style reference" and structure controls,
plus Illustrator's generative vector features for line art.

### OpenAI `gpt-image-1` — *easiest API, great prompt-following*
No training, but excellent at following a detailed locked prompt and supports
transparent backgrounds directly via API. Good default engine if you already have
an OpenAI key.

### Honorable mentions
- **Layer.ai / Rosebud** — game-asset platforms with style-consistency tooling.
- **PixelLab** — only if you ever want a pixel-art variant.
- **Civitai generator** — free-ish generation using community/your LoRAs.

### Quick comparison

| Platform | Custom training | Transparent PNG | Vector/SVG | API | Best for |
|---|---|---|---|---|---|
| Scenario.gg | ✅ | ✅ | — | ✅ | Durable on-brand asset factory |
| Leonardo.ai | ✅ | ✅ | — | ✅ | Game art, free tier |
| Recraft | Styles | ✅ | ✅ | ✅ | Crisp icons/badges, brand sets |
| Midjourney | `--sref` only | ✗ (post) | — | ✗ | Highest illustration quality |
| Flux + LoRA | ✅ (LoRA) | ✅ | — | ✅ | Headless scripted batches |
| Ideogram | Style ref | ✅ | — | ✅ | Consistent sets w/ text |
| Firefly | Style ref | ✅ | ✅ (Ai) | ✅ | Commercial-safe |
| gpt-image-1 | ✗ | ✅ | — | ✅ | Easiest API default |

---

## 5. The automated pipeline (glue)

Turn "make an asset" into "add a line to a manifest, rerun a script."

```
assets-manifest.json         # [{ name, subject, category }]
        │
        ▼
  generate (API: Flux+LoRA / Scenario / gpt-image-1)   # locked style prompt + subject
        │
        ▼
  background removal (rembg local, or remove.bg API)   # transparent PNG
        │
        ▼
  palette snap (quantize to theme hexes)               # unify color drift  → §6
        │
        ▼
  trim + center on fixed canvas, export @1x/@2x/@3x
        │
        ▼
  write assets/illustrations/<name>.png  +  regenerate  illustrations.ts registry
```

- **Manifest-driven:** one source of truth; adding art = one JSON line.
- **`illustrations.ts`** auto-maps `name → require('...')`, so wiring is zero-effort
  and type-safe.
- **4 variants per subject** on first pass → contact sheet → cull → lock the seed.
- A single Node script runs the whole chain against whichever image API has a key.

*(I can build this script + manifest + registry on request; it plugs directly into
the placeholder slots.)*

---

## 6. Style bible for this project

Reuse this **verbatim**; change only the subject noun.

**Master style clause**
> hand-drawn storybook spot illustration, warm cream paper background, soft
> colored-pencil shading, thin dark-ink outline, muted palette, flat gentle
> lighting, centered single subject, sticker style, slight hand-drawn wobble

**Palette (snap outputs to these — from `src/shared/theme.ts`)**
`#F6F2EA` canvas · `#8E7BA6` primary purple · `#E7B95A` gold · `#B9CDBD` sage ·
`#D89B93` rose · `#E86E45` terracotta · `#2B2622` ink

**Subjects** (feed as the batch list)
`golden jigsaw puzzle piece` · `winner's trophy` · `friendly owl avatar` ·
`leaf` · `paw print` · `city skyline` · `artist palette` · `bowl of food` ·
`coin`, `coin stack` · `glowing puzzle piece with sparkles` · `gold star` ·
`ribbon medal` · `calendar` · `strip of washi tape` · `confetti burst`

**Do:** transparent background, consistent line weight, one light source.
**Don't:** gradients-heavy 3D renders, photoreal, drop shadows, neon.

---

## 7. Wiring finished art into the app

The screens already render procedural placeholders (`<SketchIcon name="trophy">`,
`<SketchIcon name="puzzle">`, avatar/category frames). To swap in real art:

1. Drop PNGs into `assets/illustrations/`.
2. Add them to the auto-generated `illustrations.ts` registry.
3. Replace the placeholder node in each slot with
   `<Image source={illustrations.trophy} />` (or an `<Illustration name="trophy"/>`
   wrapper). Layout, sizing, and framing are unchanged — the slots were built for
   this.

No screen refactor needed; it's a per-slot one-liner.

---

## 8. Licensing note

- **Training data you don't own** (scraped art, other artists' work) can make
  outputs legally unsafe to ship. Train on art you own/commissioned or on a
  properly-licensed pack.
- **Commercial-safe by construction:** Adobe Firefly (licensed training set).
- Check each platform's commercial-use terms for your plan tier before shipping.
