# 3D Single-Viewport Architecture — Redesign Report

## Scope
Rebuilt only the architecture section of the AIHarness light site:
- `public/index.html` — wrapped the pipeline track in an `.arch-scene` perspective container.
- `public/architecture.js` — new 6-stage data (short stage title + one-line sublabel), 3D node markup with extruded faces + connectors, RAF-driven pulse loop, hover/focus detail, reduced-motion final-lit state.
- `public/styles.css` — new 3D architecture block, condensed hero, responsive stacking. All other sections untouched.

## The 3D technique
- **Perspective scene:** `.arch-scene { perspective: 1350px; perspective-origin: 50% 26%; }` establishes the 3D camera; the node row (`.arch-stage-track`) is a 6-column CSS grid with `transform-style: preserve-3d` and `transform: rotateX(17deg) translateZ(-14px)`, so the row reads as solid objects receding into depth (a slight dimensional tilt, not flat).
- **Extruded nodes:** each node is a glassy light card (`linear-gradient` front face, crisp 1px edge, inset highlight) plus two pseudo-faces:
  - `.node-face-top` — a green edge-light bleed above the card.
  - `.node-face-side` — a right-hand side wall (`rotateY(40deg)`, gradient from light to shadow) that gives the solid extruded-block look.
- **Real depth shadows:** layered `box-shadow` (inset top highlight + two soft drop shadows) on the light background; lit/active states deepen the shadow and add a teal glow.
- **Connectors:** `.arch-link` beams sit in the depth plane (`translateZ(6px)`) between adjacent nodes; an `.arch-link-packet` (radial-gradient orb) rides along them.

## Animation
- A `requestAnimationFrame` loop steps a "lit" stage every 1150ms. The active node gets `.lit` (pops forward via `translateZ(28px)` + green glow), the leaving connector gets `.flowing`, and a CSS custom property `--flow` (0..1) drives the packet's `translateX` along the connector. Paused via IntersectionObserver when off-screen.
- **Reduced motion:** the RAF loop is skipped; all nodes + connectors are set to their final lit/complete state with `--flow:1` and packet transitions disabled. No looping motion.

## Guaranteeing fit + text-inside
- **Fit (no horizontal scroll):** the track is a `grid-template-columns: repeat(6, 1fr)` grid (equal fractional columns) instead of the old flex+overflow row, so six nodes always share the available width with zero horizontal scroll. `.arch-stage { min-width: 0 }` lets cells shrink. The rightmost node keeps `margin-right: 13px` so its 3D side wall stays inside the track box — making the container's `scrollWidth === clientWidth`.
- **Text inside:** each node uses a flex-column `.node-content` with real padding (`1.05rem`); the sublabel (`.node-sub`) has `overflow-wrap: anywhere; hyphens: auto` and wraps freely; `min-height: 132px` reserves room. No truncation/ellipsis anywhere.
- **Responsive:** ≤1100px → 3-column grid with reduced tilt; ≤640px → single-column flat stack. Six nodes still fit in one desktop row down to ~1100px.

## Single-viewport approach
Condensed the hero (smaller top/bottom padding, tighter h1 clamp `2.1–3.3rem` with `max-width: 18ch`, reduced lede/CTA/badge margins) and the architecture section (smaller top padding, tighter section-head + sub). On 1440×900 the hero bottom is ~637px and the 3D node row begins ~829px — the nodes are visible in the first screen, with the detail panel just below the fold. Other sections remain below, unchanged.

## Playwright verification (1440×900, served via local HTTP so absolute asset paths resolve)
Final assertions (`browser_evaluate`):
- `document.querySelectorAll('.arch-node').length === 6` → **6** ✓
- track `scrollWidth (1112) <= clientWidth (1112)` → **no horizontal overflow** ✓
- per-node `scrollHeight <= clientHeight` → **no node text overflow** (empty list) ✓
- document `scrollWidth <= clientWidth` → **no page horizontal scrollbar** ✓
- Hover ScanRunner → detail panel updates to "04 ScanRunner", does not overflow viewport ✓
- Checked at 1440, 1100 (six in a row), 600 (stacked) — all clean, no text overflow, no horizontal scroll at any width.

Screenshots confirmed visually: six glassy extruded nodes in perspective with side-wall depth and soft shadows, teal-lit popped node + connector packets, text fully inside, hero+arch reading as one screen.

`node --check public/architecture.js && node --check public/app.js` → **JS OK**.
