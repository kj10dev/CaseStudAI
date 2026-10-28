# Case Study Generator: Agent Build Brief

> **Audience:** a coding agent. Read this whole file, then build `case-study-generator.js` exactly as specified.
> **Owner:** Kode-Jo, junior web developer who sells product-focused frontend redesigns to small business owners.
> **Why this exists:** small business founders lose sales to outdated, hard-to-navigate sites. A credible before/after case study is the proof that makes a founder think "I want this for my business" and reply to the email. This tool turns raw project material into that proof.

## Run the implementation

The generator is available as a dependency-free Node.js CLI:

```sh
node case-study-generator.js --help
node case-study-generator.js --url https://your-new-site.com --repo ./your-project --images ./screenshots
```

It can also be launched with `npm run case-study -- --help`. Node.js 20+ is required.
For local generation, install Ollama and a text model (or a vision model when using screenshots), then use `--provider ollama --model <model>`. Hosted Anthropic and OpenAI providers read keys from `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`; project evidence requires consent before it is sent to a hosted provider. Generated case studies and their `.facts.json` sidecars are saved to disk.

---

## 1. What to build

A single JavaScript file, `case-study-generator.js`, that runs as an interactive CLI (Node.js 20+, ES modules, **no required runtime dependencies**; use built-ins such as `readline/promises`, `fetch`, `fs/promises`, `child_process.execFile`).

It must:

1. **Receive input**: a website URL, a GitHub repo (URL or local path), or a set of images (before/after screenshots).
2. **Review the information**: gather evidence about the *previous* site and the *new* site.
3. **Ask the user a few questions**: targeted, adaptive probing for what the evidence cannot tell us (goals, metrics, constraints, client quote).
4. **Generate the case study** with an LLM, in exactly this structure:
   1. **The project summary**
   2. **The challenge**
   3. **What we did**
   4. **The result**

The LLM may be a hosted model or an **open-source model** (see section 5). The script must work with either.

---

## 2. Before writing code: research step (mandatory)

The owner asked that the agent check the internet for best practices before generating the script. Do a short research pass (web search) on:

- Web design case study structure and storytelling
- Before/after redesign metrics and how to report them honestly
- Conversion-focused copywriting for small-business audiences

Summarise findings in a code comment block at the top of the script under `// BEST PRACTICES APPLIED`. A prior research pass already established the following; verify and extend it, do not just copy it:

| Practice | How the script must apply it |
|---|---|
| Three-part narrative (challenge, solution, results) plus a CTA is the standard case study backbone | Use the four required sections and end with a CTA |
| Keep length around 500 to 1,500 words, broken up with subheads | Default target 600 to 900 words; configurable via `--length` |
| Baseline ("before") metrics are the credibility anchor; percentage claims without a starting number are untrustworthy | Always ask for before numbers. If the user has none, write the Result qualitatively and **never invent figures** |
| Specific metrics beat vague claims (for example "1.2% to 2.8%") | Prompt the user for exact before/after values, dates and measurement tool |
| Compare like with like: same pages, same traffic sources, a 2 to 4 week window each side, and watch seasonality | Ask about the measurement window; add a caveat line when it is short or unknown |
| Conversion rate is the headline metric; bounce rate, speed (Core Web Vitals / Lighthouse), mobile conversion and lead quality support it | Offer these as the metric menu in the questions |
| Conversion and SEO effects can take months to show; early numbers are incomplete | If the project is under about 3 months old, add an honest "early results" note |
| Specific CTAs outperform generic "contact us" | End with a concrete next step tied to the owner's offer (reply to this email to start a project) |
| Avoid jargon; explain design decisions in plain language a non-designer founder understands | Reading level target: grade 8 to 10. Explain decisions in terms of customer outcomes |
| Visuals matter: before/after screenshots, charts, pull quotes | Output includes an image placeholder plan and a pull-quote slot |

Keep the research step inside the build process. The shipped script itself does **not** need to browse the web (the "Wayback Machine" fetch in section 4.2 is the one allowed exception).

---

## 3. CLI behaviour

```
node case-study-generator.js [options]

Options
  --url <https://...>        Live website of the NEW site
  --repo <url|path>          GitHub URL or local path to a git repo
  --images <dir|files...>    Folder or list of screenshots (before/after)
  --provider <name>          anthropic | openai | ollama | openai-compatible (default: auto)
  --model <name>             Model name for the chosen provider
  --base-url <url>           For ollama / OpenAI-compatible servers (for example http://localhost:11434)
  --out <path>               Output file (default: ./case-study-<slug>-<date>.md)
  --format <md|html|json>    Default md. html = single self-contained page
  --length <short|standard|long>   about 400 / 750 / 1200 words
  --no-questions             Skip interview; use only gathered evidence (flag gaps instead of guessing)
  --yes                      Accept sensible defaults in prompts
  --help
```

If no input flag is supplied, start an interactive prompt: "Do you have a website URL, a GitHub repo, or screenshots?" Allow combining sources.

### Flow

```
collect input -> gather evidence -> evidence summary shown to user
   -> adaptive interview (max about 8 questions) -> confirm facts
   -> LLM generate -> self-check pass -> write output
```

Show the user a short **evidence summary** before the interview ("Here is what I found; correct me if wrong"). This is the "review the information" step.

---

## 4. Evidence gathering

### 4.1 GitHub repo / git history: find the "before" version

Goal: identify the last commit **before a major UI change** so the old site can be compared with the new one.

- Accept a GitHub URL (shallow clone is **not** enough; clone with full history into a temp dir via `git clone --no-checkout`, or use the GitHub REST API if `GITHUB_TOKEN` is set) or a local path.
- Use `execFile('git', [...args])` only. **Never** `exec` with string interpolation (shell injection risk). Validate repo URLs against `https://github.com/<owner>/<repo>`.
- **Never run, install or build code from the repo.** Read-only analysis.
- Detect candidate "major UI change" commits by scoring each commit:
  - Churn in UI files: `*.css, *.scss, *.html, *.jsx, *.tsx, *.vue, *.svelte, *.kt` (Compose/XML layouts), `tailwind.config.*`, theme/design-token files
  - Large file renames/moves in `src/`, `components/`, `pages/`, `layouts/`
  - Dependency swaps in `package.json` (for example adding/removing a UI framework)
  - Commit message keywords: `redesign, rebuild, revamp, refactor ui, new design, v2, theme, migrate, rewrite, overhaul`
  - Spikes versus the median commit size
- Present the **top 3 candidates** with date, message, files changed and score. Ask the user to confirm which one is the "major change". Default to the highest score.
- Take the parent of the confirmed commit as **BEFORE** and `HEAD` (or user-chosen ref) as **AFTER**.
- Produce an evidence bundle: commit log between BEFORE and AFTER (messages only, truncated), `git diff --stat`, list of added/removed dependencies, changed design tokens (colors, fonts, spacing), page/route list before vs after, and README/CHANGELOG excerpts.
- Optional: if the user opts in, check out BEFORE into a temp worktree **only to read static files** (HTML/CSS) and extract: nav item count, number of CTAs, heading structure, colour palette, font stack.

### 4.2 Website URL

- Fetch the live page (respect `robots.txt`; set a clear User-Agent; timeout 10s).
- Extract: title, meta description, heading outline, nav links count, primary CTA labels, forms count, image count with and without `alt`, viewport meta tag, structured data presence.
- Optional "before" lookup via the Wayback Machine availability API (`https://archive.org/wayback/available?url=...&timestamp=...`). Ask the user for an approximate "before" date. If a snapshot exists, extract the same fields and compare.
- If `lighthouse` is installed locally, offer to run it; otherwise ask for numbers. Never fabricate scores.

### 4.3 Images (screenshots / mockups)

- Accept PNG/JPG/WebP in a folder or as paths. Ask which are BEFORE and which are AFTER (infer from filenames like `before-home.png`, `after-home.png`; confirm with the user).
- Send images to a **vision-capable** model (Claude, GPT-4-class, or open-source such as Llama 3.2 Vision / Qwen-VL via Ollama). If the chosen model has no vision support, say so and fall back to asking the user to describe each image.
- Ask the model to describe and **compare** each pair: layout, navigation clarity, visual hierarchy, typography, colour/contrast, CTA visibility and placement, mobile friendliness, trust signals (reviews, contact info, product imagery), clutter.
- Output of this step = a structured list of **observed changes and improvements**, each tagged `observed` (visible in the image) versus `inferred` (reasoned). Only `observed` items may be stated as fact in the case study. Phrase `inferred` items as intent or rationale ("aimed to...").
- If images are the only input, the **improvements list is the main output basis** for "What we did" and a qualitative "The result".

---

## 5. LLM layer (hosted or open source)

Implement a small provider interface so the rest of the code does not care which model runs:

```js
// async generate({ system, messages, images?, json? }) -> string
```

Providers to implement:

| Provider | Notes |
|---|---|
| `anthropic` | Messages API; key from `ANTHROPIC_API_KEY`; supports images |
| `openai` | Chat Completions; key from `OPENAI_API_KEY`; supports images |
| `ollama` | **Open-source default.** `POST {base}/api/chat` at `http://localhost:11434`; models like `llama3.1`, `qwen2.5`, `mistral`; vision via `llama3.2-vision` or `llava` |
| `openai-compatible` | Any server exposing `/v1/chat/completions` (LM Studio, vLLM, llama.cpp server, OpenRouter) via `--base-url` |

Auto-detect order for `--provider auto`: `ANTHROPIC_API_KEY`, then `OPENAI_API_KEY`, then a reachable Ollama at localhost. If none works, print setup help and exit non-zero.

Rules:
- Never hard-code or log API keys. Read from environment only.
- Handle failures gracefully: timeouts, rate limits (exponential backoff, max 3 tries), malformed JSON (retry once with a repair prompt).
- Small open-source models are weaker: keep prompts short and structured, and generate **section by section** when the provider is `ollama` or `openai-compatible`.
- Tell the user clearly when their repo or images are being sent to a third-party API. Ask for consent on first run. Local providers (Ollama) send nothing off-machine.

---

## 6. The interview (probe the user)

Ask **a few** questions (target 5 to 8, hard cap 10). Do not ask for anything already found in the evidence. Use the LLM to pick follow-ups, but always cover these **core slots** if missing:

1. **Client and context:** Who is the business, what do they sell, who are their customers? (consent to name them or keep anonymous?)
2. **The problem in their words:** What was failing on the old site? (hard navigation, slow, not mobile friendly, confusing checkout, no clear product pages)
3. **Goal:** What did the owner want to change (sales, enquiries, bookings, trust)?
4. **Your role and constraints:** What did *you* personally design/build? Budget, timeline, tools, limits (for example no CMS migration).
5. **Key decisions:** The 2 to 3 biggest design/UX decisions and **why** you made them.
6. **Results:** Before and after numbers (conversion rate, bounce rate, load time or Lighthouse, mobile traffic, enquiries/orders), the measurement window, and the tool used. If there are no numbers, say so; offer to record **qualitative** results (client feedback, fewer support questions, easier updates).
7. **Proof:** A client quote or testimonial (verbatim, with permission).
8. **Next step / CTA:** What should a reader do now? (default: reply to the email to start a project)

Interview rules:
- One question at a time. Show examples of good answers. Allow `skip`.
- If an answer is vague ("it improved a lot"), probe once for something specific ("improved how? Any number, even approximate? Label approximate figures as such").
- Echo back a **fact sheet** at the end for confirmation. The user may edit any line before generation.

---

## 7. Generation

### 7.1 Required output format

```markdown
# <Client / Project name>: <one-line outcome headline>

## The project summary
2 to 4 sentences: who the client is, what was built, your role, timeframe, headline result.

## The challenge
The business problem in human terms, evidence of what was wrong with the old site (from commits, screenshots or live comparison), and what was at stake (lost sales, confused customers).

## What we did
The approach and the key design decisions, each tied to the problem it solved.
Include: research or audit, UX/UI changes, tech choices, before/after visuals list.
Use short subheads or a list when it helps scanning.

## The result
Quantified outcomes with before -> after, window and tool. Qualitative proof and the client quote.
Honest caveats (small sample, short window, seasonality).

---
**Want this for your business?** <specific CTA, default: reply to this email and we will start with a free review of your current site.>
```

### 7.2 Writing rules (put these in the system prompt)

- Audience: a busy small-business owner, not a designer. Plain language, no jargon, outcomes before features.
- Narrative: past tense, specific, and written as story (problem, journey, payoff).
- **Ground every claim in the fact sheet.** If a fact is missing, write around it or add a visible `[ADD: ...]` placeholder. **Never invent metrics, quotes, client names, dates or tools.**
- Clearly distinguish measured results from intent and opinion.
- Use first-person plural "we" or first-person singular "I" per user choice (ask once).
- Include a **pull quote** line and an **image plan** (for example "Hero before/after split", "Mobile nav comparison") as HTML comments or a short appendix so the user knows what visuals to add.
- Headline must contain the strongest true outcome; if there is none, use the problem-solved framing.

### 7.3 Self-check pass

After drafting, run a second LLM call (or deterministic checks) that verifies:
- All four sections are present and in order
- Every number in the draft appears in the fact sheet (regex-extract numbers and compare)
- No placeholder left unflagged
- Word count is within the target
- Reading level is plain

If a check fails, regenerate only the failing section once; otherwise print warnings alongside the file.

---

## 8. Output

- Default: a Markdown file (path from `--out`).
- `--format html`: a single self-contained, responsive HTML file (inline CSS, semantic headings, readable typography, high-contrast, before/after image slots, sticky CTA). No external dependencies.
- `--format json`: structured sections plus the fact sheet and evidence summary (useful for rendering in the owner's portfolio).
- Also save `<out>.facts.json` so the user can re-run generation without redoing the interview (`--facts <file>` to reuse).
- Print a closing summary: file path, word count, warnings, and the list of `[ADD: ...]` items still to fill.

---

## 9. Quality, safety and privacy

- Do not exfiltrate repo contents beyond what the user approved; redact `.env`, secrets, keys and tokens found in diffs (simple regex scan, skip those files).
- Obtain client consent flags (name usage, logo, quote) and reflect them in the output.
- Fail clearly with actionable messages (missing git, private repo, no network, no model available).
- Code quality: small pure functions, JSDoc on public functions, clear separation (`inputs/`, `evidence/`, `llm/`, `interview/`, `render/` can be sections within the single file marked by banner comments), consistent error handling, no global mutable state.
- Include a `--dry-run` that prints the prompts without calling any model.

---

## 10. Acceptance criteria

The build is done when all of these pass:

- [ ] `node case-study-generator.js --help` prints usage
- [ ] A GitHub repo input surfaces 3 candidate "major UI change" commits and uses the confirmed parent as BEFORE
- [ ] A live URL input extracts structural data and offers an optional Wayback "before"
- [ ] An images-only input produces an observed-versus-inferred list of changes and improvements, then asks probing questions
- [ ] The interview asks no more than 10 questions, skips anything already known, and ends with a confirmable fact sheet
- [ ] Output contains exactly the four required sections plus the CTA, within the length target
- [ ] No invented numbers: a test with zero metrics yields a qualitative result and `[ADD: ...]` placeholders
- [ ] Works with at least one hosted provider **and** one open-source path (Ollama)
- [ ] `--dry-run` works with no network and no API key
- [ ] No runtime dependencies required (`npm install` not needed)

---

## 11. Suggested build order for the agent

1. Research pass; write the `BEST PRACTICES APPLIED` comment block
2. Provider interface plus Ollama and one hosted provider
3. Fact-sheet schema and interview engine
4. Evidence collectors: images, then URL, then git history
5. Prompt templates and section generator
6. Self-check pass
7. Renderers (md, html, json)
8. Tests with three sample inputs (repo, URL, screenshots); fix; document in `--help`
