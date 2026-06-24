# Hero + 3D Architecture — single-screen flagship rework

## What changed
The previously-separate `.hero` section and `#architecture` `.section` were fused
into ONE `.firstscreen` element that is `height: 100vh; max-height: 100vh` and a
vertical flexbox. Everything below the first screen (how-it-works, demo, standards,
use-cases, trust, self-scan, footer) is untouched and still renders.

## How the single-screen fit was achieved
- `.firstscreen { height:100vh; display:flex; flex-direction:column }`. Inside,
  `.firstscreen-inner` is also a column flexbox: a fixed-height condensed hero
  (`.hero-top`, `flex:0 0 auto`) sits on top, and the pipeline (`.arch`, `flex:1`)
  fills and vertically-centers the remaining space.
- Hero was condensed: smaller headline clamp (`1.7–2.55rem`), one-line lede,
  smaller CTAs and badge pills, tighter margins. No always-visible detail panel.
- The old always-visible `.arch-detail` stacked panel (which broke the fit) was
  REMOVED. Per-stage detail + standards chips now live in a `.node-tip` OVERLAY
  that is `position:absolute`, `visibility:hidden` by default and only appears on
  `:hover`/`:focus-visible` — it consumes zero layout, so the default state always
  fits one screen.

## The 3D extrusion / perspective technique
- Scene: `.arch-scene { perspective: 950px; perspective-origin: 50% 32% }`.
- The 6-column grid `.arch-stage-track` is tilted in space:
  `transform: rotateX(32deg) rotateY(-2deg) rotateZ(-1.5deg) translateZ(-20px)`
  with `transform-style: preserve-3d`, so the row clearly recedes as a pipeline.
- Each node is a genuinely EXTRUDED block:
  - The `.arch-node` button is the lit TOP/front face (`translateZ(18px)`).
  - Two pseudo-faces build solid side walls: `.node-face-side` is
    `rotateY(52deg)` off the right edge, `.node-face-bottom` is `rotateX(-58deg)`
    off the bottom edge — both shaded, and they turn teal when the node is lit/active.
  - A stack of stepped, offset box-shadows fakes the extruded THICKNESS plus a wide
    soft CAST SHADOW on the lit `.arch-floor` ground plane (a blurred radial ellipse
    `rotateX(62deg)` behind the row).
- Dimensional connectors: `.arch-link` is a raised beam (`translateZ(22px)`) with a
  glowing rail; an energy `.arch-link-packet` rides it, position driven by the
  `--flow` CSS var the rAF loop updates (existing JS).
- Pulse: the existing rAF loop adds `.lit` stage-by-stage; lit nodes pop forward
  (`translateZ(56px)`) and glow, then settle. Hover pops to `translateZ(70px)`.
- `prefers-reduced-motion`: the JS branch adds `.lit` to all nodes and completes all
  connectors — final lit 3D state, no looping motion.
- Tooltips are counter-rotated (`rotateX(-26deg)`) to face the viewer and the
  first/last tooltips are pinned inward so they never cause horizontal overflow.

## Playwright measurements (proof)
At 1440×900:
- `document.querySelectorAll('.arch-node').length === 6` ✓
- `.firstscreen` getBoundingClientRect().height === 900 (≤ 905) ✓
- no horizontal overflow: scrollWidth 1425 === clientWidth 1425 ✓
- no node content overflow: overflowingNodes = [] ✓
- last-node hover: still no horizontal overflow ✓
At 1280×800:
- 6 nodes ✓, height === 800 ✓, no horizontal overflow ✓, overflowingNodes = [] ✓
Below-the-fold sections (how/demo/standards/use-cases/trust/self-scan) all present
and rendering unchanged.
`node --check` passes for architecture.js and app.js.
