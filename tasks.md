# Crosscolor — Task List

Roughly in implementation order. Later phases depend on earlier ones.

---

## Phase 1 — Data

- [ ] Add enough grids to `grids.json` to begin development (a few per tier, covering the main shape types)
- [ ] Write grid validation (region seed count, connectivity) and run against `grids.json` at startup

## Phase 2 — Color Pipeline

- [ ] Seed color generation (random sRGB)
- [ ] Gamma expansion (sRGB → linear)
- [ ] Region detection (seed-outward walk)
- [ ] 1D interpolation (linear along path between 2 seeds)
- [ ] 2D interpolation (affine function from 3 seeds)
- [ ] Gamma compression (linear → sRGB)
- [ ] Validation: out-of-gamut check
- [ ] Validation: adjacent step threshold check
- [ ] Validation: non-adjacent distinguishability check
- [ ] Retry loop (no hard cap — keep trying until valid assignment found)
- [ ] Expose a `crosscolor` global object on game pages for console-accessible testing
- [ ] Test harness: `crosscolor.testGeneration(n)` — runs the color pipeline against every grid N times and logs mean and worst-case time and iteration count per grid

## Phase 3 — index.html (Puzzle Picker)

- [ ] Fetch and parse `grids.json`
- [ ] Render difficulty tier tabs
- [ ] Render shape preview miniatures (tiny gray HTML tables)
- [ ] Navigate to `play.html?grid=<id>` on preview click
- [ ] Light/dark mode toggle (persisted via localStorage)

## Phase 4 — play.html (Game)

- [ ] Parse `grid` query parameter; redirect to `index.html` if missing/invalid
- [ ] Run color pipeline for selected grid
- [ ] Render play area HTML table (palette rows + spacer + grid rows)
- [ ] Render palette (randomized tile order)
- [ ] Render anchor cells (colored, locked, star marker)
- [ ] Render vacant cells (hollow gray rounded square)
- [ ] Interaction: select / deselect tile
- [ ] Interaction: move tile (palette → grid, grid → palette, grid → grid)
- [ ] Interaction: swap tiles
- [ ] Reshuffle button
- [ ] Perfect-run flag (reset on new attempt, cleared on incorrect placement)
- [ ] Win detection (check after every placement)
- [ ] Win presentation (stars appear on all cells with CSS transition)
- [ ] Back button / link to `index.html`
- [ ] Light/dark mode toggle (persisted via localStorage)

## Phase 5 — Polish

- [ ] Complete `grids.json` with the full puzzle set for release
- [ ] Tune adjacent step threshold
- [ ] Tune non-adjacent distinguishability threshold
- [ ] Visual refinements (see UI Refinements section of spec.md)
- [ ] Test across light and dark backgrounds
- [ ] Test on mobile (touch events if needed)
