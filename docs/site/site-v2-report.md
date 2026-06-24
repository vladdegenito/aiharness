# AIHarness Showcase — v2 (light premium + Matrix-terminal demo)

## Design approach
Evolved the existing dark site into a **light, premium** marketing surface aimed at an
enterprise security buyer. Off-white background (`#f6f8f9` / `#ffffff` panels) with a faint
teal wash, dark high-contrast ink (`#0e1726`), and **one restrained accent** — a technical
teal/green (`--signal: #07a883`) that deliberately bridges into the Matrix terminal's phosphor
green. Amber/red are reserved exclusively for finding severities. Crisp cards with subtle
borders + layered shadows (`--shadow-sm/--shadow/--shadow-lg`), generous whitespace, Sora
display + Inter body + JetBrains Mono for technical labels. All content sections from the prior
version are preserved (hero, animated architecture, how-it-works, demo, standards matrix with
every authoritative source link + EO-14110-revoked footnote, use cases, trust, self-scan,
footer), restyled for light. The animated architecture diagram is kept and restyled.

## Bug fix 1 — content can never stay invisible (reveal fallback)
- An inline `<head>` script adds `class="js"` to `<html>` **before** CSS applies.
- The `opacity:0` start-state is scoped to `html.js .reveal:not(.in)` only. With JS disabled
  (no `.js` class) or once `.in` is added, content is fully visible.
- `architecture.js` runs the IntersectionObserver to add `.in`, **plus two safety nets**:
  (1) on `window.load`, a 600 ms timeout force-reveals everything; (2) an unconditional
  2500 ms `setTimeout` force-reveals everything regardless of the load event. So nothing can
  remain hidden even if the observer never fires.
- `prefers-reduced-motion`: a media block forces `opacity:1 / transform:none` on all reveals —
  content just shows, no animation.
- **Verified in-browser: 0 of 44 `.reveal` elements had computed `opacity:0` after load.**

## Bug fix 2 — architecture renders reliably on load
- `architecture.js` builds the diagram inside `init()`, invoked on `DOMContentLoaded`
  (or immediately if the DOM is already parsed) — **not** gated behind any observer. The
  IntersectionObserver is used *only* to pause/resume the decorative pulse animation to save
  cycles; the build already happened. A `data-built` guard prevents a double build.
- Nodes/edges/detail/pulse are styled DOM elements appended via `createElement` (no SVG
  namespace pitfalls). **Verified in-browser: 6 `.arch-node` built, detail panel populated
  ("Code in"), `.arch-pulse` present.** The traveling pulse + per-node `.lit` highlight loop
  via `requestAnimationFrame`.

## Terminal + code-rain technique
- The demo is a dark terminal panel (`#0a0f0a`, phosphor green `#39ff14`/`#00ff9c`) embedded in
  the light page, with window chrome (traffic-light dots + `aiharness@cf:~$` title) and a
  blinking CSS cursor.
- **Code rain**: a `<canvas id="rain">` behind the text, driven by `requestAnimationFrame`.
  DPR-capped (≤2), columns recomputed on resize, translucent fade for glyph trails, bright
  "head" glyphs. Dimmed to `opacity:.22` via CSS so text stays readable. An IntersectionObserver
  starts/stops the loop only while the terminal is on-screen. Under `prefers-reduced-motion` it
  renders a single static dim pass and the cursor stops blinking.
- Scan output **streams as terminal lines**: a typewriter command line, then `> POST … 202
  queued`, each status change, a `── findings ──` rule, one line per finding, and the SARIF
  line. Severity/verdict are color-coded (green=confirmed/secure, amber=medium/uncertain,
  red=high/critical).

## Demo API contract (incl. optional-key handling)
- `POST /api/scans` with `{ language, files:[{path,content}] }`. **`apiKey` is OMITTED by
  default** — the server uses its configured demo key. A collapsed `<details>` "Use your own
  Anthropic API key (optional)" reveals a password field with the envelope-encrypted/shredded
  privacy note; only if the user types a non-empty key is `apiKey` added to the body.
  **Verified in-browser: default POST body had NO `apiKey` property.** A 400/error body is
  surfaced verbatim as a red terminal line.
- Textarea defaults to the planted-vuln Python sample (subprocess `shell=True` cmd injection +
  string-concat SQL injection); "Load sample" + "Run scan" + language select (python/js/java/go).
- Polls `GET /api/scans/:id` every 2 s up to ~150 s (75 attempts), streaming each status change
  (queued→scanning→triaging→completed/failed). `GET /api/scans/:id/sarif` is offered as a
  download link + `[ download ]` terminal token on completion.
- **Security**: every finding field (`cwe`, `severity`, `confidence`, `verdict`, `file`,
  `startLine`, `message`, `explanation`, `remediation`) is rendered via `textContent` /
  `createTextNode` only — no `innerHTML` interpolation anywhere. `severity`/`confidence`/
  `verdict` are validated against allowlists before being used as `tok-*` className tokens.

## Verification run
- `node --check public/app.js` → OK; `node --check public/architecture.js` → OK.
- Every JS `getElementById`/`$()` ID has a matching element in `index.html` (cross-checked).
- 24 authoritative standards links present (CWE/OWASP/SARIF/NIST SSDF+AI-RMF/ISO 27001+42001/
  SLSA/CycloneDX/CISA/SOC2/ISA-IEC-62443/ISO-5055) + EO-14110-revoked footnote intact.
- Live browser test (Playwright, stubbed API): architecture built, all reveals visible, light
  theme applied, terminal streamed the spec'd output, findings color-coded, SARIF link shown,
  POST omitted `apiKey`. Only console error was a benign `favicon.ico` 404.
