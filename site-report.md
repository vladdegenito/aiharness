# AIHarness — Premium Showcase Site Report

Replaces the minimal UI in `public/` with a single-page, animated, vanilla-JS showcase.
100% static + vanilla JS, no build step, no framework. Google Fonts via `<link>` only.

## Files
- `public/index.html` — semantic HTML5 landmarks, all sections, nav, demo form, standards matrix.
- `public/styles.css` — design system (CSS custom properties: surfaces, signal-cyan accent, severity scale, type, space), responsive grids, scroll-reveal, reduced-motion fallback.
- `public/architecture.js` — animated pipeline (the centerpiece), mobile nav, scroll-reveal IntersectionObserver.
- `public/app.js` — live demo wired to the real `/api/*` contract; XSS-safe finding rendering.

## Sections (single page, in-page nav)
1. Hero — direct "Yes —" headline, hybrid subhead, two CTAs (Run a live scan → #demo, See how it works → #architecture), property badges.
2. Animated architecture diagram — 6 hoverable/clickable stages: Inputs → Orchestrator Worker (Hono) → Cloudflare Queue → ScanRunner (DO + Container + Semgrep) → AI Triage (model-agnostic adapter) → Output (SARIF 2.1.0 + audit log). Each reveals a blurb + the standards it satisfies.
3. How it works — 4 cards: deterministic SAST, AI triage as a layer, evidence-based confidence, auditable output; BYO-key note.
4. Live demo — language select, BYO-key password + privacy note, code textarea, "Load a vulnerable sample" + "Scan"; animated progress, severity/confidence color-coded finding cards, Download SARIF.
5. Standards & best practices matrix — 9 grouped cards, all 21 required authoritative links (open in new tab), EO-14110 honest footnote.
6. Use cases — CI/PR gate, pre-acquisition audit, OT/ICS (IEC 62443), second-opinion over SAST, SBOM/supply-chain.
7. Trust & data governance — 6 cards.
8. We scan ourselves — 0 prod-dep vulns, 148-component SBOM, SARIF 2.1.0 schema-validated; honest "needs review" framing.
9. Footer — restated one-line answer, live-scan link, "Built on Cloudflare Workers · Durable Objects · Containers".

## Animation technique
- The pipeline is inline DOM (built by JS) + CSS, animated with a single `requestAnimationFrame` loop in `architecture.js`: nodes light in sequence (`.lit` class on a timed step) and a CSS-styled "packet" pulse travels the rail left→right via `transform: translateX`. An IntersectionObserver pauses the rAF loop when the section is offscreen (perf). Hover/focus/click selects a stage and populates the detail panel (built with createElement/textContent).
- Scroll-reveal: `.reveal` elements fade/translate in via IntersectionObserver.
- Micro-interactions: button lift, card hover borders, animated progress dot.

## Demo integration (real API contract)
- `POST /api/scans` with `{ language, apiKey, files: [{ path, content }] }`; on non-OK, shows the response text (handles 400/413).
- Polls `GET /api/scans/:id` every 2s up to ~150s (75 attempts); maps status queued→scanning→triaging→completed/failed onto the progress UI; transient network errors retry.
- `completed` renders findings + sets `Download SARIF` to `GET /api/scans/:id/sarif`. `failed` shows error and renders any partial findings.
- Sample loader fills the textarea with a planted-vuln Python sample (subprocess shell=True command injection CWE-78 + string-concat SQL injection CWE-89).

## Security
- All finding fields (cwe, severity, confidence, verdict, file, startLine, message, explanation, remediation) rendered with `createElement` + `.textContent` only. No finding field touches innerHTML (verified: only innerHTML occurrence is a comment).
- `confidence`/`severity`/`verdict` validated against allowlists before use in className.

## Accessibility / reduced motion
- Semantic landmarks (header/nav/main/section/footer), skip link, labelled controls, aria-live on status + arch detail, visible focus states, keyboard-operable stages (buttons) and nav toggle.
- `prefers-reduced-motion`: rAF pulse hidden, transitions/animations neutralized, reveals shown immediately, smooth-scroll disabled, first stage lit as a static legible state. No-JS/no-IntersectionObserver also reveals all content.
- Responsive mobile→desktop with a collapsible nav.

## Verification run
- `node --check public/app.js` → OK
- `node --check public/architecture.js` → OK
- All `$()`/getElementById IDs in JS confirmed present in index.html.
- POST URL/method/body and poll/SARIF URLs match the contract exactly.
- No finding field interpolated into innerHTML.
- All nav `#anchors` resolve to section IDs; all 21 standards URLs present and correct.
