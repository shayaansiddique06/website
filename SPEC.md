# Millennium Research — Landing Page Build Specification
### Authoritative brief for Claude Code (Fable 5). Build exactly to this document. Where a value is given, use it. Where an anti-pattern is listed, treat it as forbidden.

---

## TL;DR
- **Build a black-and-green single-page site whose entire aesthetic is engineered restraint** — aggressive contrast, generous whitespace, one saturated accent (green), typography-as-brand, and complete micro-states — the invariant decisions that make Stripe, Linear, and Vercel read as "expensive without being ostentatious," not the decorative tricks that make sites read as AI-generated.
- **Two custom, from-scratch centerpieces carry the page**: a Canvas 2D hero where 2,000–3,000 particles (colored by verification verdict) scatter and assemble into the glowing green infinity/Möbius logo via alpha-mask sampling, and a fully native "dataset viewer" section (never an iframe) with count-up stats (437 / 822 / 48 / 7,734), KaTeX-rendered theorem cards paired with highlighted Lean 4, and verdict-badge filtering.
- **The voice is terse and technical for frontier-lab researchers** — specific claims, named credibility signals (Google DeepMind, Scale AI/Mirendil, MIT Physics/USA physics team, Brown, Princeton, 3kVC pre-seed), zero marketing fluff, zero emoji, zero exclamation marks.

---

## Key Findings (design rationale distilled from research)

**What actually makes a site read as "Apple/Stripe/Linear-grade" rather than AI-generated.** Across primary sources (Apple's Human Interface Guidelines and WWDC20 "The details of UI typography," Vercel's published Web Interface Guidelines, Rauno Freiberg's craft writing, and reverse-engineering breakdowns of apple.com) the differentiators are consistent and *not* decorative: (1) **optical letter-spacing** — tighten tracking as type grows; Apple ships SF Pro in Text (<20px) and Display (≥20px) optical sizes and uses roughly −0.43px tracking at 17px body; (2) **high contrast plus more whitespace than feels necessary** ("take the spacing that feels like enough, then double it"); (3) **monochrome foundation plus one meaning-driven accent**; (4) **border-first elevation** (1px hairlines, not drop shadows) as documented in Vercel's measured design tokens (#171717/#ffffff, 1px #ebebeb borders, shadows reserved for overlays); (5) **completeness of micro-states** — every interactive element gets default/hover/focus/active/disabled; (6) **a defined, small motion vocabulary** (a handful of curves and durations, no bounce/overshoot).

**What makes sites read as AI slop (the blocklist is evidence-based).** Per 925Studios' 2026 AI-slop analysis, the tell-tales are "distributional convergence": Inter-with-system-fallback typography, blue-purple gradients, oversized vague hero headlines ("Build the future"), uniform 16px-radius card grids, glassmorphism, and generic three-column icon+title+blurb sections. The antidote is **specificity** — Stripe's "Financial infrastructure for the internet," Linear's "Plan and build products" — and **distinctive typography** (Linear's custom type, Stripe's bespoke serif, Vercel's Geist).

**Scroll animation stack for a no-framework static site (2026).** The current consensus (artofstyleframe 2026 benchmarks, Motion's performance tier list, GSAP's own docs): **CSS handles ~80% of UI animation at zero bundle cost on the compositor thread**; the Web Almanac 2024 found 91.7% of mobile pages use a CSS transition vs 18.4% loading a JS animation library. **IntersectionObserver + CSS transitions** is the most performant path for section reveals. **CSS scroll-driven animations (view-timeline, Chrome 115+/Safari 17.4+) deliberately exclude pinning.** Reach for **GSAP ScrollTrigger only if the pipeline scene genuinely needs pinning** (its core tree-shakes to ~22KB; MIT-licensed since the 2025 Webflow acquisition, so the old "GSAP is paid" objection is void). Animate **transform/opacity only**; use `will-change` sparingly.

**Dark-theme green-on-black is a contrast trap that must be engineered.** Material Design and multiple accessibility sources agree: avoid pure #000000 (halation/eye-strain) and avoid saturated pure #00ff00 (visual vibration on dark). Use a near-black with a faint green cast and a **desaturated, WCAG-safe green** for text/UI, reserving the brighter green strictly for glow/hover.

**Hero particle morph is well-trodden and has concrete parameters** (Mamboleoo "convert an image into particles," Frank's Laboratory particle-text, Codrops interactive particles). The canonical technique is alpha-mask sampling of an offscreen canvas + per-particle lerp to a home coordinate + inverse-distance mouse repulsion. Concrete budgets and constants are specified in full below.

---

## 1. Design Philosophy & Anti-Pattern Blocklist

**Philosophy.** The site is an *instrument*, presented by researchers. It should feel closer to a well-typeset paper or a benchmark leaderboard than a SaaS landing page. Confidence comes from precision and whitespace, not adjectives. The keystone narrative: the verified corpus is a **measurement tool** for characterizing model behavior on verified mathematical reasoning — the **strength-structured formalization lattice** is the differentiator, not commodity training data.

**Anti-pattern blocklist — do NOT produce any of these:**
- No purple→blue or any "AI gradient." The only saturated hue on the page is brand green.
- No Inter (or system-sans-with-fallback) as the display face. No gradient-fill text.
- No glassmorphism cards, no floating/blurred blobs, no ambient gradient orbs, no mouse-tracking spotlight cards.
- No emoji anywhere. No exclamation marks. No superlatives ("revolutionary," "unleash," "cutting-edge," "amazing," "seamless," "world-class").
- No three-column icon+title+blurb feature grid.
- No fake testimonials; no logo wall implying customers that do not exist.
- No embedded iframe / bolted-on artifact for the dataset viewer — it is a native section.
- No pure `#000000` background; no pure `#FFFFFF` body text; no pure `#00FF00` green.
- No bounce, elastic overshoot, or spring easing. No scale-on-hover beyond 1.02. No hover lift beyond −4px.
- No autoplaying sound, no cookie-wall, no newsletter modal.

---

## 2. Design Tokens (complete)

### 2.1 Color (CSS custom properties)
```css
:root{
  /* Surfaces — near-black with a faint green cast; never pure black (avoids halation) */
  --bg:            #0A0C0B;
  --surface:       #101312;
  --surface-2:     #161A18;
  --border:        rgba(255,255,255,0.08);   /* hairline, border-first elevation */
  --border-strong: rgba(255,255,255,0.14);

  /* Text — never pure white */
  --text:          #E8ECEA;                  /* primary */
  --text-muted:    #8A938E;                  /* secondary / metadata */
  --text-faint:    rgba(255,255,255,0.45);

  /* Accent — desaturated, WCAG-safe green on --bg; bright reserved for glow/hover only */
  --accent:        #21C46A;                  /* body-safe green (≥4.5:1 on --bg) */
  --accent-bright: #3BE38A;                  /* hover, glow, active only */
  --accent-dim:    #157A43;                  /* borders/underlays */

  /* Verdict palette (also drives particle colors) */
  --v-faithful:    #21C46A;
  --v-unfaithful:  #E5484D;   /* Radix Colors "Red 9" — designed solid accent step, white-fg-safe */
  --v-uncertain:   #E8B339;
  --v-pending:     #5A6B63;   /* desaturated slate-green, reads as "inert" */
}
```
Contrast requirements below are per **W3C WCAG 2.1**: body text must meet **SC 1.4.3 Contrast (Minimum), 4.5:1**; large text (≥24px, or ≥18.5px bold) may use **3:1**; UI components and graphical objects must meet **SC 1.4.11 Non-Text Contrast, 3:1** against adjacent colors. Verify `--accent`, all verdict colors, and `--text-muted` against `--bg` and `--surface` before shipping.

### 2.2 Typography
Use a **two-to-three family system** (never one default sans):
- **Display/headings:** a serif with mathematical/editorial authority (recommend **Fraunces** or **Newsreader**), OR a distinctive technical grotesque if a sans is preferred (**Space Grotesque**). Pick one; do not mix serif and grotesque display.
- **Body:** a clean neutral sans (recommend a Söhne-like or **Geist Sans**).
- **Data / theorems / Lean / metadata:** a monospace — **JetBrains Mono** (or Geist Mono).

Type scale (`px` / `rem`) and optical tracking. Tracking follows Apple's principle of tightening as size grows; the body value of **−0.025em ≈ −0.43px at 17px** matches Apple's SF Pro Text spec exactly (note: −0.011em would be only −0.19px, which is too loose — use −0.025em):

| Role | Size px / rem | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| Hero display | 72 / 4.5 | 500–600 | −0.03em | 1.05 (unitless) |
| H2 section | 40 / 2.5 | 600 | −0.02em | 1.1 |
| H3 | 24 / 1.5 | 600 | −0.015em | 1.2 |
| Body | 17 / 1.0625 | 400 | −0.025em | 1.5 |
| Small / caption | 14 / 0.875 | 400 | −0.01em | 1.45 |
| Mono data | 15 / 0.9375 | 400/500 | 0 | 1.5 |

Use `clamp()` for hero and H2 so they scale fluidly (e.g. hero `clamp(2.5rem, 6vw, 4.5rem)`), keeping unitless line-heights so lines never overlap when zoomed. Enable `font-variant-numeric: tabular-nums` on all statistics.

### 2.3 Spacing
4px base scale: **4, 8, 12, 16, 24, 32, 48, 64, 96, 128**. Section vertical padding **96–128px desktop / 64px mobile**. Container `max-width: 1200px`; prose blocks `max-width: 65ch`. Card internal padding 24–32px; element gaps 16–32px. Be systematic — never mix 16px rhythm in one section with 24px in another.

### 2.4 Motion (the entire vocabulary — do not exceed it)
```css
:root{
  /* Primary entrance / scroll reveal — easeInOutExpo (easings.net; basis of Apple-style smooth motion) */
  --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
  /* Hover / small state changes — Material Design "standard" curve (MUI: "the most common easing curve") */
  --ease-std:  cubic-bezier(0.4, 0, 0.2, 1);

  --dur-hover: 150ms;   /* hover, focus rings */
  --dur-state: 300ms;   /* toggles, filter transitions, nav backdrop */
  --dur-enter: 600ms;   /* scroll-reveal entrances */
}
```
- **Entrance pattern:** `opacity: 0 → 1`, `translateY: 24px → 0`, 600ms `--ease-out`, children staggered 80ms.
- **Constraints:** hover lift ≤ −4px; scale strictly within 0.98–1.02; **never** bounce/overshoot.
- Wrap every non-essential animation in `@media (prefers-reduced-motion: no-preference)`.

### 2.5 Borders / radius / glow
- **Border-first elevation:** default surfaces defined by a 1px `--border`; use `box-shadow` only for true overlays (mobile menu, popovers).
- **Radius:** 8px for cards/inputs/buttons; **pill (9999px) reserved for the single primary CTA**. Nested radii must be concentric (child radius ≤ parent).
- **Glow (tasteful, layered — used only on the logo, hero CTA, and active verdict badges):**
```css
/* Logo/accent bloom — layered small→large, low opacity, green */
text-shadow: 0 0 8px rgba(59,227,138,.35), 0 0 24px rgba(33,196,106,.25);
/* Interactive glow ramps up on hover only */
box-shadow: 0 0 0 1px var(--accent-dim), 0 0 24px rgba(33,196,106,.20);
```
Keep blur radii modest (Chromium under-paints blur vs Firefox); animate glow only on hover, inside a reduced-motion guard.

---

## 3. Tech Stack
- **Vanilla HTML + CSS + JS.** Single `index.html` with a `<style>` block and one `<script>`, or a minimal split (`index.html`, `styles.css`, `main.js`). No React, Next, Tailwind runtime, or component framework.
- **Scroll reveals:** IntersectionObserver toggling an `.is-visible` class; animation via CSS transitions on transform/opacity.
- **Pipeline scroll scene:** CSS `position: sticky` + IntersectionObserver progress. Add **GSAP ScrollTrigger only if true pinning is required** (import core + ScrollTrigger only; ~22KB). Prefer the CSS/sticky path first.
- **LaTeX:** KaTeX via jsDelivr CDN with the **auto-render** extension (`renderMathInElement`), `throwOnError:false`. KaTeX renders synchronously without reflow — call it on `DOMContentLoaded` and re-run after any dynamic card injection so raw LaTeX never flashes.
- **Lean 4 highlighting:** `highlightjs-lean` (leanprover-community) registered with highlight.js, OR a hand-rolled tokenizer, styled with a **custom green-on-black theme** (keywords `--accent`, types `--accent-bright`, tactics muted, comments `--text-faint`, `sorry`/`admit` in `--v-unfaithful`). Do not ship a stock Okaidia/Tomorrow theme.
- **Count-up:** hand-rolled (IntersectionObserver + `requestAnimationFrame`, easeOutExpo). No external count library needed.
- **Canvas hero:** hand-rolled Canvas 2D (spec §5).

---

## 4. Section-by-Section Specification

> Copy is final-draft. Voice: declarative, technical, no hedging, no exclamation. All numbers verbatim.

### 4.1 Hero
- **Layout:** full-viewport (`100dvh`) canvas behind left-aligned (or centered) text; nav overlaid, transparent at top.
- **Headline:** `Machine-verified mathematics for frontier models.`
- **Subhead:** `Millennium Research converts arXiv mathematics into machine-checked Lean 4 proofs, then structures the verified corpus as an instrument for measuring model reasoning.`
- **Primary CTA (filled pill, green):** `Request dataset access` → anchors to `#contact`.
- **Secondary (text link with animated underline):** `For investors` → `#contact`.
- **Behavior:** on first load particles assemble into the logo (§5); nav gains backdrop blur + hairline bottom border after ~40px scroll.
- **Responsive:** below 768px, reduce particle count (§5), headline via `clamp()`, CTAs stack full-width.

### 4.2 The Problem / Thesis (`#thesis`)
- **Layout:** two columns (thesis prose left ~60%, callout list right ~40%); stacks on mobile.
- **H2:** `Correct is not the same as measurable.`
- **Body:** `Reinforcement learning from verifiable rewards removed reward-model error from mathematics and code: a deterministic checker replaces a learned judge. It did not remove specification gaming. Models still exploit what a verifier fails to enforce — a proof can compile without capturing the theorem it claims. A corpus that is only machine-checked is not enough. To characterize reasoning, the corpus must be structured along the axis the checker ignores: faithfulness.`
- **Right callout list (mono labels, hairline dividers):**
  - `Compiles ≠ faithful` — a Lean proof can typecheck while proving the wrong statement.
  - `Faithfulness is a separate axis` — measured, not assumed.
  - `Strength-structured lattice` — proofs organized by logical strength, not just pass/fail.

### 4.3 Pipeline (`#pipeline`) — four-stage faithfulness pipeline
- **Layout:** sticky scroll scene. A pinned diagram column on one side; four stages reveal sequentially as the reader scrolls (IntersectionObserver progress driving `.is-active` on each stage; GSAP pin only if needed).
- **H2:** `A four-stage faithfulness pipeline.`
- **Stages (mono numeral, title, one line each):**
  1. **`Compile`** — the candidate Lean 4 proof must typecheck against Mathlib. Syntactic and reasoning validity in one gate.
  2. **`Symbolic equivalence`** — the formal statement is checked for symbolic equivalence to the source theorem, catching statements that compile but drift.
  3. **`Back-translation`** — the Lean statement is translated back to natural language and compared to the arXiv original, surfacing meaning loss.
  4. **`LLM tie-breaker`** — residual disagreements are adjudicated by a model judge calibrated against the human-gold set.
- **Supporting strip below (mono, muted):** `Human-gold labeled dataset · Automated faithfulness judge · Eval harness with frozen test set · Intern review portal (KaTeX)`.
- Each stage animates a verdict flow indicator; keep motion to opacity/transform.

### 4.4 Dataset (`#dataset`) — native integrated viewer (full spec §6)
- **H2:** `The corpus, as it stands.`
- **Sub:** `A live snapshot of verification verdicts across the current formalization run.`
- Stat counters + theorem cards + verdict filter, all native (§6).

### 4.5 Research (`#research`)
- **H2:** `What the corpus measures.`
- **Layout:** three stacked research vectors (NOT a symmetric icon grid) — each a wide row with a mono kicker, H3, and 2–3 sentences.
  - **`Specification gaming on verified math`** — Verified rewards make one class of exploits concrete: the verifier's own gaps. The corpus is built to elicit and label where formal proofs satisfy the checker while violating intent.
  - **`Weakening attractors in self-improving reasoners`** — When a model self-improves on math it verifies, iterated updates can drift toward weaker but easier-to-verify statements. The strength-structured lattice makes that drift measurable across proof strength.
  - **`The strength-structured formalization lattice`** *(keystone — give it the most visual weight)* — Proofs are organized not as pass/fail but as a lattice ordered by logical strength, so a corpus consumer can measure *how strong* a model's verified reasoning is, not merely *whether* it passed.

### 4.6 Team & Advisors (`#team`) — credibility signals must pop
- **H2:** `Team and advisors.`
- **Design directive:** present credentials as **inline credential callouts**, not a generic social-proof logo wall. Institution names set in the display face at large size with the green accent as a keyline; roles in mono. Give this section high contrast and whitespace so the names read instantly.
- **Founders (two cards, portrait-optional):**
  - **Shayaan Siddique** — Co-founder & CTO. `Putnam top ~8%. Built a fine-tuned Putnam model that generated inbound interest from Anthropic and xAI.`
  - **Ibrahim** — Co-founder. `Brown University.`
- **Advisors (inline callouts, each a single strong line):**
  - `Ex-lead of engineering, Scale AI — now at Mirendil`
  - `Researcher, Google DeepMind`
- **Verifier bench (a distinct callout band):** `Human verification by current MIT Physics and USA national physics team members, and mathematicians from Brown and Princeton.`
- **Backing (mono, understated but present):** `Pre-seed backed by 3kVC (~$3.6M valuation).`
- Do not fabricate photos, quotes, or additional logos.

### 4.7 Contact (`#contact`)
- **H2:** `Access.`
- **Primary block (for the primary audience — frontier labs):** `Dataset access requests` — short form or a `mailto:` CTA button: `Request dataset access`. Fields if a form: name, lab/organization, email, intended use (textarea). Copy: `For frontier labs evaluating verified mathematical reasoning. We share sample shards under NDA.`
- **Secondary block (investors):** `Investor contact` — text link / secondary button. Copy: `For investors: reach the founders directly.`
- Footer: wordmark (glowing green infinity ribbon, small), copyright, minimal.

**Global nav:** sticky, transparent at top → `backdrop-filter: blur(12px)` + `--surface` at ~70% + 1px bottom border once scrolled (300ms `--ease-std`). Anchor links: `Thesis · Pipeline · Dataset · Research · Team · Access`. **Scroll-spy** highlights the active section (IntersectionObserver on sections; active link gets `--accent` + a short animated underline). Enable `html{scroll-behavior:smooth}` and set `scroll-margin-top` (≈ nav height + 16px) on every section target so anchors don't hide under the nav. Mobile: hamburger → full-height overlay menu, `inert` on the rest of the page while open, focus-trapped.

---

## 5. Hero Particle Animation — near-implementable spec
**Technique:** image-to-particles / alpha-mask sampling + scatter-and-assemble (per Mamboleoo "How to convert an image into particles"; mouse-repulsion per Frank's Laboratory particle-text; threshold logic per Codrops). Canvas 2D, vanilla JS.

**Architecture / loop:**
1. **Two canvases.** An **offscreen** canvas draws the logo (green infinity/Möbius ribbon) at a modest source size (a few hundred px wide max — pixel cost is quadratic). A **visible** full-viewport canvas renders particles.
2. **Sample targets.** `offscreenCtx.getImageData(0,0,w,h)`; iterate pixels with a **stride** (every 3rd–4th pixel desktop, 5th–6th mobile). For each pixel where **alpha > 128**, create a particle with `targetX/targetY` = pixel coord scaled+centered onto the visible canvas, and read RGB to inform verdict color (see mapping). Compute stride to hit the count budget: `stride = ceil(sqrt(sampledPixels / targetCount))`.
3. **Particle budget (60fps):** **2,000–3,000 desktop; 600–1,000 mobile** (conservative floors from the Rousset/HTML5-Potatoes sprite benchmark; 2026 hardware exceeds these). Draw base particles with `fillRect(x,y,size,size)` (size 1–3) — cheaper than `arc()`. Reserve `arc` + glow for a small highlighted subset only; do **not** apply per-particle `shadowBlur` (roughly halves throughput). Achieve the "glow" with a single CSS `filter: blur()`/box-shadow layer or a separate low-count glow canvas.
4. **Assemble (Apple-smooth):** each frame, per-particle lerp toward home: `p.x += (p.targetX - p.x) * ease` with **ease ≈ 0.1** (jitter each particle 0.08–0.12 to avoid lockstep). Initialize particles scattered at random viewport positions; on load they converge to the logo. Optional row/index stagger for a cascading assemble.
5. **Mouse repulsion:**
```js
const dx = mouse.x - p.x, dy = mouse.y - p.y;
const dist = Math.hypot(dx, dy);
const radius = isMobile ? 100 : 150;
if (dist < radius){
  const force = (radius - dist) / radius;      // 1 at cursor → 0 at edge
  p.x -= (dx/dist) * force * p.density;         // push AWAY
  p.y -= (dy/dist) * force * p.density;
} else {
  p.x += (p.baseX - p.x) * 0.1;                 // ease home
  p.y += (p.baseY - p.y) * 0.1;
}
```
`p.density = Math.random()*30 + 1` (organic, varied push). Store `baseX/baseY` (home) separately from live `x/y`.
6. **DPR:** `const dpr = Math.min(window.devicePixelRatio||1, isMobile?1.5:2); canvas.width=cssW*dpr; canvas.height=cssH*dpr; canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);` Recompute on resize (setTransform is absolute — no compounding).
7. **Pause offscreen:** IntersectionObserver (`threshold:0.1`) on the canvas cancels `requestAnimationFrame` when the hero leaves the viewport and resumes on re-entry; also handle `visibilitychange`.
8. **Reduced motion:** if `matchMedia('(prefers-reduced-motion: reduce)').matches`, **skip scatter and the loop entirely** — set every particle to its target and draw one static frame (the assembled logo still shows; meaning is preserved per WCAG 2.3.3). Re-evaluate on the media query's `change` event.

**Verdict color mapping (particles):** distribute particle colors to echo the corpus — **faithful green dominant** (`--v-faithful`/`--accent-bright` variants), with a minority of `--v-unfaithful`, `--v-uncertain`, and `--v-pending` particles seeded roughly in proportion to the dataset counts (437 : 822 : 48 : 7,734 → keep pending sparse/dim so the logo reads as predominantly green). This visually ties the hero to the dataset section.

**Adaptive fallback:** sample FPS over the first ~30 frames; if <55fps, reduce particle count ~30–40% and/or drop the glow subset.

---

## 6. Dataset Viewer Section — native spec
Rebuild as a first-class section in the site's design system. **No iframe, no external widget.**

**6.1 Stat counters (exact numbers).** Four stat blocks in a row (stack 2×2 then 1-col on mobile):
- `437` **Faithful** (`--v-faithful`)
- `822` **Unfaithful** (`--v-unfaithful`) — with a mono sub-line: `91 human · 731 agent-filtered`
- `48` **Uncertain** (`--v-uncertain`)
- `7,734` **Pending** (`--v-pending`)

Count-up: IntersectionObserver fires **once** when the block enters view; animate 0→target over ~2000ms with easeOutExpo via `requestAnimationFrame`; format `7,734` with a thousands separator; `font-variant-numeric: tabular-nums` so digits don't jitter. Each number in the display face at large size; label in mono; a 1px verdict-colored keyline under each.

**6.2 Theorem sample cards.** A grid (2-up desktop, 1-up mobile) of representative cards. Each card:
- **Header row:** mono theorem id (e.g. `thm:2406.01940-L3`) + a **verdict badge** top-right.
- **Two panels side-by-side** (stack on mobile): **left = source LaTeX** rendered by KaTeX (`renderMathInElement`, `throwOnError:false`); **right = Lean 4** with the custom green-on-black highlighter.
- **Footer meta (mono, muted):** arXiv source tag · pipeline stage that produced the verdict.
- Use 3–5 realistic sample theorems drawn from formalization examples (e.g. an inequality or number-theory lemma) so the panels look authentic; keep LaTeX/Lean short enough to render cleanly.

**6.3 Verdict badge design.** Pill, 1px verdict-colored border, verdict-colored text on a subtle tinted surface (e.g. `color-mix` of verdict color into `--surface`); **include the text label** ("faithful"/"unfaithful"/"uncertain"/"pending") — never rely on color alone (WCAG SC 1.4.1). Only the active/faithful badge may carry a subtle glow.

**6.4 Filter interaction.** A row of verdict filter chips (`All · Faithful · Unfaithful · Uncertain · Pending`). Clicking toggles card visibility with a 300ms `--ease-std` opacity+`translateY(8px)` transition (fade/slide, not layout jump). Active chip styled with its verdict color. Keyboard-operable (`button` elements, visible focus).

---

## 7. Accessibility & Performance Requirements
- **Lighthouse targets:** Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- **Motion:** every animation respects `prefers-reduced-motion: reduce` (hero renders static assembled logo; scroll reveals become instant visibility; count-up jumps to final value).
- **Contrast (WCAG 2.1):** body text ≥ **4.5:1** (SC 1.4.3); large text ≥ **3:1**; UI components / verdict badges / focus rings ≥ **3:1** (SC 1.4.11). Never convey verdict by color alone (SC 1.4.1) — always pair with a text label.
- **Semantics:** one `<h1>` (hero), logical `<h2>/<h3>` order, `<nav>`, `<main>`, `<section>` with `aria-labelledby`, `<footer>`. Landmarks and skip-link.
- **Focus:** visible `outline: 2px solid var(--accent); outline-offset: 3px;` on all interactive elements; never remove without a visible replacement. Focus-trap the mobile menu; `inert` the background while open.
- **Anchors:** `scroll-behavior: smooth` + `scroll-margin-top` on all targets.
- **Performance hygiene:** animate transform/opacity only; DPR capped (§5); rAF paused offscreen; KaTeX and highlighter deferred; `<meta name="theme-color" content="#0A0C0B">` and `color-scheme: dark`; images (if any) lazy-loaded and dimensioned to avoid CLS; fonts `font-display: swap` with subsetting.

---

## 8. Final QA Checklist (Claude Code must verify before done)
- [ ] Hero holds ~60fps on a mid-tier mobile profile; DPR capped (2 desktop / 1.5 mobile); rAF cancelled when hero is offscreen and on tab blur.
- [ ] `prefers-reduced-motion` renders a static, fully-assembled logo and disables all reveals/count-ups with no layout jank.
- [ ] Particle colors reflect verdict distribution; logo reads predominantly green; pending particles sparse/dim.
- [ ] KaTeX renders every theorem statement; no raw `$...$` flash on load or after filtering.
- [ ] Lean 4 blocks use the custom green-on-black theme (not a stock theme); `sorry`/`admit` flagged.
- [ ] Count-up fires exactly once per stat on scroll-in; final values read **437 / 822 (91 human · 731 agent-filtered) / 48 / 7,734** with thousands separator and tabular figures.
- [ ] Verdict badges show text labels (not color-only); filter chips toggle cards with the 300ms fade/slide; all keyboard-operable.
- [ ] Sticky nav: transparent→blurred transition, scroll-spy active states, smooth scroll, `scroll-margin-top` correct; mobile menu focus-trapped + `inert` background.
- [ ] Credibility signals present, prominent, and exact: Google DeepMind; ex-lead of engineering at Scale AI now at Mirendil; MIT Physics / USA national physics team; Brown; Princeton; 3kVC pre-seed ~$3.6M; Shayaan Siddique (Putnam top ~8%, Putnam model → Anthropic/xAI inbound); Ibrahim (Brown).
- [ ] Anti-pattern audit passes: no AI gradients, no Inter display, no glassmorphism/blobs/spotlight, no emoji, no exclamation marks, no icon-grid, no fake testimonials, no iframe dataset, no pure black/white/#00ff00, no bounce easing.
- [ ] Tokens applied consistently: 4px spacing scale, motion limited to the two curves + three durations, border-first elevation, pill only on the primary CTA, concentric radii.
- [ ] Contrast verified (4.5:1 text / 3:1 UI) for `--accent`, `--text-muted`, and all four verdict colors on `--bg` and `--surface`.
- [ ] Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95.

---

### Caveats
- **Particle counts are conservative floors.** The 2,000–3,000 desktop / 600–1,000 mobile figures derive from an older sprite benchmark (Intel HD3000-class hardware); 2026 devices comfortably exceed them, so treat these as safe minimums and let the adaptive FPS sampler raise or lower the count. The one real risk is the *glow* — per-particle `shadowBlur` is expensive; achieve bloom with a single blurred layer, not per-particle shadows.
- **Font recommendations are directional.** Fraunces/Newsreader/Space Grotesque/JetBrains Mono are chosen to escape the "Inter default" tell and to signal a mathematics brand; any distinctive, well-hinted display+mono pairing that holds the same personality is acceptable. Do not fall back to a lone system sans.
- **GSAP is optional, not default.** Build the pipeline scene with CSS sticky + IntersectionObserver first; only introduce GSAP ScrollTrigger if genuine pinning/scrubbing is required, importing core + ScrollTrigger only.
- **Copy is drafted from the provided company context and should be founder-reviewed** before launch — particularly the research descriptions (specification gaming, weakening attractors, the lattice), which state technical positioning that must match the team's exact claims. The dataset numbers (437 / 822 / 48 / 7,734) are a point-in-time snapshot; wire them as easily-editable constants so they can be updated without touching layout.
- **Two green shades are load-bearing.** `--accent (#21C46A)` is the only color safe for text/UI on the near-black background; `--accent-bright (#3BE38A)` is for glow/hover only. Swapping them will either fail contrast or introduce the pure-green "vibration" the design explicitly avoids.
