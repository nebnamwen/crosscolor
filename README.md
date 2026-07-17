# Crosscolor

A browser-based color gradient puzzle game — a remake of *Blendoku* by Lonely Few. See [about.html](about.html) for more details.

Created by Benjamin Newman and Claude Code.

---

## Running the game

No build step. Serve the project root over HTTP and open `index.html`:

```
python3 -m http.server
# then open http://localhost:8000
```

Opening `index.html` directly from the filesystem won't work — `fetch('grids.json')` is blocked on `file://` URLs in most browsers.

## Running the tests

```
node test.js          # 10 iterations per grid (default)
node test.js 50       # 50 iterations per grid
```

The test runner reports mean and worst-case attempt counts and timing for every grid. Since color generation retries until it passes validation, this is the main thing worth benchmarking when changing thresholds or puzzle shapes. No external dependencies — requires only Node.js.

## Adding puzzles to grids.json

`grids.json` is a top-level array of tier objects:

```json
[
  { "name": "Simple", "grids": [ ... ] },
  { "name": "Medium", "grids": [ ... ] }
]
```

Each grid is a 2D array of integers. All rows must have the same length; use `0` to pad cells outside the puzzle shape. Cell values:

| Value | Meaning |
|-------|---------|
| `0`   | Absent (empty space outside the puzzle shape) |
| `1`   | Normal cell (movable tile) |
| `2`   | Anchor (fixed tile, not movable) |
| `3`   | Seed (color source, movable) |
| `4`   | Seed + anchor (color source, fixed) |

### Rules for valid grids

- Every region must have **2, 3, or 4 seeds**. A region is all cells reachable from a seed by 4-connectivity (up/down/left/right), not crossing other seeds.
- Seeds must **not be directly adjacent** to each other (orthogonally).
- Each seed must have **at least one adjacent normal cell** — an isolated seed is invalid.
- A region with exactly **2 seeds** must be 1-dimensional: all cells in the same row or column.

Grids are auto-validated on load and errors are logged to the browser console. You can also call `crosscolor.validateAllGrids(grids)` manually from the console.

## File overview

| File | Purpose |
|------|---------|
| `crosscolor.js` | All shared logic (color generation, region detection, validation, theme). Exposes `window.crosscolor`. |
| `index.js` | Puzzle picker page logic |
| `play.js` | Game page logic (rendering, interaction, win detection) |
| `about.js` | About page (minimal — just theme init) |
| `style.css` | All styles; play area sizes driven by `--tile-size` CSS variable set by JS |
| `grids.json` | Puzzle data |
| `test.js` | Node.js test runner (no browser needed) |
| `spec.md` | Feature specification and implementation plan |

## Key constants to know

In `crosscolor.js`:
- `ADJ_THRESHOLD` — minimum sRGB Euclidean distance between adjacent cells (currently 22)
- `NONADJ_THRESHOLD` — minimum sRGB Euclidean distance between any two cells (currently 30)

Higher values produce more visually distinct gradients but require more generation retries. Run `node test.js 50` after changing these to check retry counts.

In `play.js`:
- `GAP_RATIO` — tile gap as a fraction of tile size (4/48 ≈ 0.083), used for adaptive sizing calculations
