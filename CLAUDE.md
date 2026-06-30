# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser-based games built with vanilla HTML5 Canvas and plain JavaScript. No build step, no dependencies, no server required — open any `.html` file directly in a browser.

## Running the games

- **Pixel Assault** (top-down shooter): open `index.html` in a browser
- **Tic Tac Toe**: open `tictactoe.html` in a browser

To open from the terminal:
```
start index.html        # Windows
```

There are no tests, no linter, and no build pipeline. Verification is done by opening the file in a browser and playing it.

## Git workflow

After every meaningful unit of work — a feature added, a bug fixed, a refactor completed — commit and push immediately. Never accumulate multiple unrelated changes in one commit. The goal is that GitHub always reflects the current working state of the project.

```
git add <files>
git commit -m "type: short description"
git push
```

Commit types in use: `feat`, `fix`, `docs`, `refactor`. Remote is `origin` (GitHub: `preciousokorie/pixel-assault`). Branch is `master`.

On Windows, use PowerShell here-strings for multi-line commit messages:
```powershell
git commit -m @'
feat: short summary

Longer body if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
'@
```

## Pixel Assault architecture (`index.html` + `game.js`)

`index.html` is a thin shell — canvas element, dark body styles, one `<script src="game.js">` tag. All logic is in `game.js` (~900 lines).

**State machine** — a single `gameState` string (`'MENU'`, `'PLAYING'`, `'LEVEL_TRANSITION'`, `'GAME_OVER'`) drives the main loop's `switch`. Each state has a paired `update*` and `render*` function.

**Game loop** — `requestAnimationFrame` with a `dt` cap of 50ms to prevent physics explosions on tab resume.

**Input** — two global dicts: `keys` (keydown/keyup), `mouse` (x, y, pressed, clicked). `mouse.clicked` is a one-frame pulse cleared at the end of every `gameLoop` tick. Mouse coordinates are scaled to canvas logical resolution to handle CSS-resized canvases.

**Entity model** — three classes (`Player`, `Enemy`, `Bullet`) plus `Particle` for effects. All are stored in module-level arrays (`enemies[]`, `bullets[]`, `particles[]`) and filtered each frame with `.filter(x => !x.dead)`. Collision is circle-circle against these arrays.

**Enemy behaviour** is data-driven: `ENEMY_CONFIG` maps type name → stats. One `Enemy` class handles all four types (`grunt`, `runner`, `tank`, `shooter`) via `if (this.type === ...)` branches in `update()` and `draw()`.

**Level system** — `LEVELS[0..5]` defines hand-crafted waves per level; `generateLevel(n)` handles levels 7+. `buildSpawnQueue()` round-robins wave types into a flat array. `spawnTimer` counts down and pops one entry per tick.

**Rendering** — everything is drawn with Canvas 2D `fillRect`/`arc` (no image files). Render order per frame: background → grid → particles → enemies → player → bullets → scanline overlay → HUD → state overlay.

**Audio** — Web Audio API oscillators only (`playSound(freq, type, duration, vol)`). `audioCtx` is initialized on first user click to satisfy browser autoplay policy.

**Persistence** — high score only, via `localStorage` key `pixelAssaultHi`.

## Style conventions

- `'use strict'` at top of JS files
- Canvas colors defined in a single `C` object at the top of `game.js`
- No comments except section headers (`// ─── SECTION ───`)
- All drawing is done in `render*` functions; `update*` functions must not draw
- State transitions happen in `update*` functions only, never in `render*`
