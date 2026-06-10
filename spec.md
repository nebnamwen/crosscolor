# Crosscolor — Game Specification

A browser-based remake of Blendoku, a color-ordering puzzle game. The player arranges color tiles into a grid to form smooth gradients between fixed anchor cells.

---

## Technology Stack

- Pure HTML5 / CSS / JavaScript — no frameworks, no build step
- Single HTML file entry point (`index.html`), with separate `style.css` and `game.js`
- No runtime dependencies initially; a perceptual color space library may be added later as an enhancement (see [Color Pipeline](#color-pipeline))

---

## File Structure

```
index.html      — shell, loads style.css and game.js
style.css       — all visual styling
game.js         — all game logic
grids.json      — puzzle definitions (fetched at startup)
```

---

## Grid Definitions (grids.json)

Puzzles are hard-coded in `grids.json`. The top level is an object whose keys are difficulty tier names (e.g. `"beginner"`, `"intermediate"`, `"advanced"`). Each tier is an array of grid objects.

Each grid object has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `cells` | 2D array of integers | Row-major grid; values are cell-type bitmasks (see below) |

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

Seeds partition the puzzle into regions. A **region** is defined as:

> One connected component of non-seed in-grid cells, together with all seed cells that are orthogonally adjacent to any cell in that component.

Algorithm:

1. Collect all non-seed in-grid cells.
2. Find connected components using 4-connectivity (orthogonal adjacency only; diagonals are not connections).
3. For each component, find all seed cells adjacent to any cell in the component — these are the region's **bounding seeds**.
4. A seed shared between two components belongs to both regions.

Seeds themselves are not members of any component in the flood-fill, but they are included in the final region definition as boundary nodes.

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

- Maximum retry attempts: 20. If all fail, log a warning and use the last generated set.

> **Note — geometric alternative**: a more efficient approach is to treat each region as a line segment (1D) or triangle/quad (2D) in RGB color cube space, then check that regions don't intersect except at shared seed corners, and that the angle at each shared corner is above a minimum. This is O(regions) rather than O(cells²) and catches structural problems rather than symptoms. The cell-by-cell approach above is preferred for readability.

### Future Enhancement

The gamma correction step (expand/compress with 2.2) will later be replaceable with a perceptual color space library (e.g. OKLCH) for more uniform-looking gradients across different hue regions. The pipeline structure is designed to make this substitution straightforward.

---

## UI Layout

The play area is an HTML `<table>`. Rows are ordered top-to-bottom as:

1. **Palette rows** (1–2 rows, determined by `ceil(tileCount / gridWidth)`) — not represented in `grids.json`
2. **Grid rows** — one table row per row in the `cells` array

Each table cell contains a single `&nbsp;`. All visual treatment is applied via CSS and JavaScript (classes, inline styles for colors).

When a different puzzle is selected, the table is rewritten entirely.

Row order in the table:

1. **Palette rows** (1–2 rows)
2. **Spacer row** — one implicit row of absent cells, creating visual separation between palette and grid
3. **Grid rows** — one row per row in the `cells` array

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
| Vacant (in grid or palette) | Hollow rounded square, neutral gray border, transparent fill |
| Filled (player-placed or anchor) | Solid rounded square, filled with the tile's color |
| Selected | Filled rounded square with a highlighted border or glow |
| Anchor (solved state) | Small star marker in one corner |
| Any cell (puzzle solved) | Small star marker in one corner |

Cells have padding/gap between them. Exact sizing TBD during implementation.

### Light / Dark Mode

A toggle button switches the page background between black and white. All in-game colors (tile colors, border colors, star markers) must be visible against both backgrounds. The toggle affects only the background; it does not alter tile colors.

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

## Puzzle Selection

A simple puzzle picker (outside the play area) lists difficulty tiers and the puzzles within each. Selecting a puzzle:

1. Runs the color generation pipeline for that grid.
2. Rewrites the HTML table.
3. Resets game state (selection, perfect-run flag, placement state).

No progression system, unlocks, or persistence in the initial version.
