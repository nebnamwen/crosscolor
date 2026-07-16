# Crosscolor — Game Specification

A browser-based remake of Blendoku, a color-ordering puzzle game. The player arranges color tiles into a grid to form smooth gradients between fixed anchor cells.

---

## Technology Stack

- Pure HTML5 / CSS / JavaScript — no frameworks, no build step
- Two HTML pages: `index.html` (puzzle picker) and `play.html` (game)
- No runtime dependencies initially; a perceptual color space library may be added later as an enhancement (see [Color Pipeline](#color-pipeline))

---

## File Structure

```
index.html      — puzzle picker
play.html       — game
style.css       — all visual styling (shared)
grids.json      — puzzle definitions (fetched at startup)
```

JavaScript structure TBD; at minimum one shared module for grid loading and color pipeline, separate entry points for each page.

---

## Grid Definitions (grids.json)

Puzzles are hard-coded in `grids.json`. The top level is an array of difficulty tier objects, in display order. Each tier object has a `name` field and a `grids` array of grid objects.

Each grid object has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier; used as the `grid` query string parameter on `play.html` |
| `cells` | 2D array of integers | Row-major grid; values are cell-type bitmasks (see below) |

Grids have no display name. An optional `comment` field may be included for maintainer notes and is ignored by the game.

### Cell Type Encoding

Each integer in `cells` encodes cell presence and attributes as follows:

- `0` — cell is not part of the puzzle (absent)
- Non-zero — cell is in the puzzle; **subtract 1** and interpret the result as a bitmask of attributes:

| Attribute bit | Value (after subtracting 1) | Meaning |
|---|---|---|
| 0 | 1 | Anchor — shown to the player with its color locked; cannot be moved |
| 1 | 2 | Seed — color is randomly generated; used as an interpolation source |

Stored values and their meanings:

| Stored value | Attributes (value − 1) | Meaning |
|---|---|---|
| 0 | — | Not in grid |
| 1 | 0 | Normal placeable cell |
| 2 | 1 | Anchor (color is interpolated, shown to player as fixed) |
| 3 | 2 | Seed (color is randomly generated; player must place it) |
| 4 | 3 | Seed + anchor (color is randomly generated, shown to player as fixed) |

Attribute bit 2 (stored value 5–8) is reserved for future use. Keeping all values single-digit (0–9) preserves column alignment in JSON source while leaving one more attribute bit available — enough to encode, for example, a low-saturation constraint on certain cells.

### Validation Requirement

At startup, every grid in `grids.json` must be validated:

1. **Region seed count**: every region (see [Region Detection](#region-detection)) must have exactly 2 bounding seeds if all its cells are collinear, or exactly 3 bounding seeds otherwise. Grids that fail this check must be flagged as invalid and excluded from play.
2. **Connectivity**: all in-grid cells must form a single connected component (orthogonal adjacency).

---

## Region Detection

Seeds partition the puzzle into regions. A **region** is one connected component of non-seed cells together with the seed cells that border it. Connectivity is 4-directional (orthogonal only; diagonals are not connections).

Algorithm (seed-outward walk):

```
for each seed cell S:
    for each orthogonally adjacent normal (non-seed) cell N that is not yet marked:
        create a new region
        add S to region's seeds
        flood-fill from N:
            mark N; add N to region's cells
            for each orthogonal neighbor of N:
                if normal and unmarked: recurse
                if seed: add to region's seeds (do not recurse)
```

A seed whose orthogonal neighbors are all either seeds or already-marked cells contributes no new region for those adjacencies.

---

## Color Pipeline

### 1. Seed Color Generation

Assign a random RGB color to each seed cell. Colors are generated in sRGB space (the native CSS color space).

### 2. Gamma Expansion (sRGB → Linear)

Before any interpolation, convert all seed colors from sRGB to **linear light** values:

```
linear = (srgb / 255) ^ 2.2    (per channel)
```

All interpolation is performed in linear light space.

### 3. Interpolation

For each region:

- If the region has **2 bounding seeds** (1D region — all cells are collinear): interpolate linearly along the path. Each non-seed cell's color is determined by its distance (in cell hops along the path) between the two seeds.
- If the region has **3 bounding seeds** (2D region): fit an **affine function** `f(x, y) = ax + by + c` (independently per channel) through the three seed positions and their linear-light color values, then evaluate at each non-seed cell's grid coordinates `(col, row)`.

The affine function satisfies the invariant: *for any three collinear cells (orthogonally or diagonally), the middle cell's color is the average of the outer two.* This holds for all line directions by construction.

Seed cells shared between regions take their color from the seed assignment (step 1), not from interpolation.

### 4. Gamma Compression (Linear → sRGB)

After interpolation, convert all colors back to sRGB for display:

```
srgb = round(linear ^ (1 / 2.2) * 255)    (per channel)
```

### 5. Validation

After generating and converting all colors, check that the puzzle is valid and visually unambiguous.

**Out-of-gamut check**: after interpolating all cell colors, verify that every channel of every in-grid cell is within `[0, 255]`. Any cell can fall outside the representable color space if the affine function extrapolates beyond the seed colors' convex hull (common for cells in irregular region shapes, or the derived 4th corner of a quad). If any cell is out of gamut, reject and retry from step 1.

**Adjacent step check**: seed colors too close together produce gradients where even neighboring cells are indistinguishable. For every pair of in-grid cells that are orthogonally or diagonally adjacent, compute the Euclidean distance between their sRGB values. If any adjacent pair falls below a minimum threshold (TBD — smaller than the non-adjacent threshold), reject and retry from step 1.

**Non-adjacent distinguishability check**: the player's only information is color, so every in-grid tile (including anchors) must be distinguishable from every other in-grid tile it is not adjacent to. For every pair of in-grid cells that are not orthogonally or diagonally adjacent, compute the Euclidean distance between their sRGB values. If any such pair falls below a minimum threshold (TBD — start with ~20 on a 0–255 scale), reject and retry from step 1.

Both checks are cell-by-cell in sRGB space. Grids are small enough that the O(cells²) cost is not a concern.

The retry loop runs until a valid assignment is found — there is no hard cap. If any grid consistently takes a long time to generate, the fix is to improve the pipeline (e.g. constrain the initial seed color selection to avoid common failure modes), not to give up. A test harness function should be exposed to the browser console (e.g. `crosscolor.testGeneration(n)`) that runs the color pipeline against every grid in `grids.json` `n` times and logs the mean and worst-case time and iteration count per grid, to surface any pathological cases. All unit tests should follow the same pattern — exposed as functions on a `crosscolor` (or similar) global object, invokable from the browser's developer console, logging results to the console.

> **Note — geometric alternative**: a more efficient approach is to treat each region as a line segment (1D) or triangle/quad (2D) in RGB color cube space, then check that regions don't intersect except at shared seed corners, and that the angle at each shared corner is above a minimum. This is O(regions) rather than O(cells²) and catches structural problems rather than symptoms. The cell-by-cell approach above is preferred for readability.

### Future Enhancement

The gamma correction step (expand/compress with 2.2) will later be replaceable with a perceptual color space library (e.g. OKLCH) for more uniform-looking gradients across different hue regions. The pipeline structure is designed to make this substitution straightforward.

---

## UI Layout

The play area on `play.html` is an HTML `<table>`. Row order top-to-bottom:

1. **Palette rows** — `ceil(tileCount / gridWidth)` rows (1–2 in practice); not represented in `grids.json`
2. **Spacer row** — one implicit row of absent cells, creating visual separation
3. **Grid rows** — one row per row in the `cells` array

Each table cell contains a single `&nbsp;`. All visual treatment is applied via CSS and JavaScript (classes, inline styles for colors). When a new puzzle loads, the table is rewritten entirely.

### Palette

- Contains all non-anchor tiles before placement, in randomized order.
- Tiles are laid out left-to-right, top-to-bottom across the palette rows.
- When a tile moves from the palette to the grid, it leaves a **vacant slot** (hollow rounded square) in its original position. The palette layout does not reflow.
- Tiles can be moved back from the grid to vacant palette slots (or any vacant palette slot if the original is filled).
- A **Reshuffle** button randomizes the positions of unplaced tiles within the palette, filling from the left.

---

## Interaction Model

No drag-and-drop. All interaction is click-based:

- **Click a palette tile** (filled): selects it (highlighted state). A subsequent click on a vacant grid cell or vacant palette slot moves it there. A subsequent click on another filled tile (palette or grid) swaps them. A click on the same tile deselects it.
- **Click a grid tile** (player-placed): selects it. Same swap/move/deselect rules as above.
- **Click an anchor cell**: no effect.
- **Click a vacant cell** (palette or grid) with nothing selected: no effect.
- Only one tile can be selected at a time. Clicking a second tile while one is selected always swaps or moves, never chains a new selection.

---

## Visual Design

### Cell Appearance

| State | Appearance |
|-------|------------|
| Not in grid | No cell rendered (table cell is invisible/empty) |
| Vacant (in grid) | Hollow rounded square, neutral gray border, transparent fill |
| Vacant (in palette) | Small solid rounded square centered in the cell, neutral gray fill |
| Filled (player-placed or anchor) | Solid rounded square, filled with the tile's color |
| Selected | Filled rounded square with a highlighted border or glow |
| Anchor (solved state) | Small star marker in one corner |
| Any cell (puzzle solved) | Small star marker in one corner |

Cells have padding/gap between them. Exact sizing TBD during implementation.

### Light / Dark Mode

A toggle button on each page switches the background between black and white. The current state is persisted in `localStorage` and applied on page load, so the setting is preserved when navigating between `index.html` and `play.html`. All in-game colors (tile colors, border colors, star markers) must be visible against both backgrounds. The toggle affects only the background; it does not alter tile colors.

---

## Win Detection and Badges

### Win Condition

The puzzle is solved when every non-anchor, non-vacant grid cell contains the correct tile (i.e. the tile whose color matches the interpolated value for that cell position).

Correctness is checked after every tile placement.

### Badges

Two badges are tracked per puzzle attempt:

| Badge | Condition |
|-------|-----------|
| **Solved** | Puzzle is completed (all tiles correctly placed) |
| **Perfect** | Puzzle is completed and no tile was ever placed in an incorrect grid position during the attempt |

The perfect-run flag is a boolean that starts `true` and is permanently set to `false` the first time a tile is placed incorrectly anywhere in the grid. It is reset when a new attempt begins.

### Win Presentation

On solving, every cell in the grid receives a small star marker in one corner (anchors already had this marker; the rest gain it simultaneously). This is the primary win feedback. A short CSS transition or animation should accompany the stars appearing. No modal or overlay is required.

---

## Pages and Navigation

The game is split across two HTML pages:

### index.html — Puzzle Picker

The entry point. Displays all available puzzles organized into tabs by difficulty tier. Tab headers appear across the top of the page in the order tiers appear in `grids.json`.

Each puzzle is represented by a **shape preview**: a miniature HTML table generated from the grid's `cells` array using the same structure as the play area, but rendered at a small fixed size. All in-grid cells are shown as small solid gray squares (no colors, no hollow cells — too small to read). Absent cells are invisible.

Clicking a shape preview navigates to `play.html?grid=<id>`.

### play.html — Game

Loads the grid identified by the `grid` query string parameter, runs the color generation pipeline, and renders the play area. Includes a **back button** (or link) that returns to `index.html`.

On load:
1. Parse the `grid` query parameter; if missing or unrecognized, redirect to `index.html`.
2. Run the color generation pipeline for the selected grid.
3. Render the HTML table and initialize game state.

No progression system, unlocks, or persistence in the initial version.

---

## UI Refinements

Decisions on non-essential visual and interaction details, to be revisited during implementation. Items without a resolution are open questions.

| # | Topic | Decision |
|---|-------|----------|
| 1 | Cell sizing and gap | TBD during implementation |
| 2 | Selected tile highlight style | Highlighted border or glow — exact style TBD |
| 3 | Win animation | CSS transition on star markers appearing; exact timing TBD |
| 4 | Back button style on `play.html` | TBD |
| 5 | Tab style on `index.html` | TBD |
