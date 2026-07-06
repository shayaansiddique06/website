# Millennium Research — design conventions

Dark-only, black-and-green, border-first. Vanilla HTML + CSS: no framework, no provider. Every design must link `styles.css` (it `@import`s `fonts/fonts.css`) and set page background `var(--bg)`; body text uses `var(--font-body)` at 17px with letter-spacing -0.025em.

## Tokens (CSS custom properties — the only styling vocabulary)
Surfaces: `--bg` `--surface` `--surface-2`; hairlines `--border` `--border-strong` (1px borders are the elevation system — box-shadow only on true overlays).
Text: `--text` `--text-muted` `--text-faint`. Never pure #FFF or #000.
Accent: `--accent` (the ONLY green safe for text/UI), `--accent-bright` (glow/hover only — fails as body text policy, not contrast), `--accent-dim` (borders/keylines).
Verdicts: `--v-faithful` `--v-unfaithful` `--v-uncertain` `--v-pending` (+ `--v-pending-ink` — required for pending SMALL text; raw `--v-pending` is 3.4:1, keylines/large only).
Type: `--font-display` (Fraunces — headings only), `--font-body` (Geist), `--font-mono` (JetBrains Mono — data, code, metadata, labels).
Motion: exactly two curves `--ease-out` (entrances) `--ease-std` (hover/state) and three durations `--dur-hover` (150ms) `--dur-state` (300ms) `--dur-enter` (600ms). No bounce, no scale beyond 1.02, hover lift ≤ 4px. Wrap non-essential animation in `@media (prefers-reduced-motion: no-preference)`.
Layout: `.container` (max 1200px), `.section` (fluid 64–128px vertical padding), `--nav-h`.

## Component classes (use these, don't invent parallels)
- Buttons: `.btn-primary` (green pill — the ONE pill per screen), `.btn-secondary` (8px-radius outline), `.link-underline` (animated text link).
- Filter chips: `button.chip` with `data-filter` + `aria-pressed` — pressed state colors itself by verdict.
- Verdict badges: `span.badge` with `data-verdict="faithful|unfaithful|uncertain|pending"` — pill, tinted surface, text label always present (never color alone).
- Stats: `ul.stats > li.stat[data-verdict]` containing `.stat-num` (display face, tabular-nums), `.stat-label` (mono), optional `.stat-sub`. Verdict-colored keyline via the `data-verdict` attr.
- Theorem cards: `li.card[data-verdict]` > `.card-head` (`.card-id` + `.badge`), `.card-panels` > `.panel.panel-tex` / `.panel.panel-lean` (each with `.panel-cap`), `.card-meta` footer. Lean code tokens: `.tok-kw` `.tok-type` `.tok-tac` `.tok-com` `.tok-bad`.
- Credentials: `.advisor` (`.advisor-role`/`.advisor-inst`/`.advisor-note`), `.bench` band with `.inst` emphasis, `.backing`, `.kicker` (mono uppercase label).

## Hard rules
Green appears only on: logo, one primary CTA per screen, accents/keylines, verdict-faithful. Everything else is grayscale on near-black. No gradients except the single hero bloom. No emoji, no exclamation marks. Radius: 8px for cards/buttons; pill reserved for the primary CTA (badges are the one sanctioned pill exception).

## Where the truth lives
Read `styles.css` (tokens at top, every component style below) and `SPEC.md` (the full authoritative build spec) before styling anything. Working examples: `components/*/*/*.html` and the full page at `index.html` (interactive behavior in `main.js`).

## Idiomatic snippet
```html
<section class="section" style="background:var(--bg)">
  <div class="container">
    <span class="kicker">verifier bench</span>
    <h2>The corpus, as it stands.</h2>
    <p class="section-sub">A live snapshot of verification verdicts.</p>
    <span class="badge" data-verdict="faithful">faithful</span>
    <a class="btn-primary" href="#contact">Request dataset access</a>
  </div>
</section>
```

---

## Project contents

- `index.html` / `styles.css` / `main.js` — the production landing page (single page, vanilla).
- `components/pages/LandingPage` — full-page preview card.
- `components/foundations/{Colors,Type}` — token and type-scale references.
- `components/components/{Buttons,Badges,Stats,TheoremCard}` — interactive element references.
- `components/sections/TeamCredentials` — credential callout patterns.
- `fonts/` — self-hosted Fraunces / Geist / JetBrains Mono (woff2 + fonts.css).
- `assets/` — the original logo artwork (logo-nav.png is alpha-keyed for dark surfaces).
- `SPEC.md` — the authoritative build specification.
