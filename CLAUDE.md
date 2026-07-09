# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser game combining a 3D Rubik's Cube with Tic-Tac-Toe, built with plain HTML/CSS/JS and three.js — deliberately **no build tool, no npm, no bundler**. three.js is loaded from a pinned CDN version via an import map in `index.html`. Keep it that way: new code goes into plain ES modules under `js/`, and third-party additions should be avoided or CDN-pinned in the import map.

All player-facing text is **German**.

## Running

ES modules don't load over `file://`, so serve the directory:

```
python3 serve.py
```

Then open http://localhost:5500. `serve.py` is a tiny static server that adds `Cache-Control: no-store` to every response — plain `python3 -m http.server` lets the browser aggressively cache ES modules, so edits appear not to take effect until a hard refresh. Use `serve.py` while developing.

There are no tests and no lint setup; verification is done by driving the game in a browser (synthetic PointerEvents dispatched on `#three-canvas` work for automation — see Gameplay rules below for the flow to exercise). Note: when driving via a viewport-emulating tool, trust `getBoundingClientRect`/projection readings over screenshots — the page's emulated `innerWidth/Height` can differ from the screenshot surface.

## Gameplay rules (drive all logic decisions)

- Two players (X and O, names entered at startup). Per turn: **place** a mark on any empty sticker (click), then **rotate** exactly one layer (drag on the cube; 90° or 180° both count as one move).
- Win = 3 same marks in a row/col/diagonal on a single face's 3×3 grid. Checked **both** immediately after placement and after each committed rotation (`declareResultIfAny` in `game.js`). Draw = all 54 stickers filled, no line.
- Dragging on the background orbits the camera (inspection); this never counts as a move.

## Architecture

Five ES modules under `js/`, wired together by `main.js` (scene/camera/renderer/OrbitControls bootstrap):

- **`cube.js`** — `Cube3D`: builds 26 cubies (core skipped), each with white sticker planes on outward faces; marks are 3D child meshes of their sticker. Owns turn animation (`beginTurn`/`previewTurn`/`commitTurn`/`cancelTurn`) and the win-check data (`computeFaceGrids`).
- **`interaction.js`** — pointer gesture state machine: click-to-place vs drag-to-turn vs drag-to-orbit.
- **`game.js`** — turn/phase state machine (`place` → `rotate` → next player), win/draw detection, all UI text (status bar, dialogs, banner), two-step startup flow (intro+names dialog → rules dialog).
- **`confetti.js`** — self-contained canvas confetti on win.
- **`main.js`** — bootstrap and DOM element lookup. `fitCameraToViewport()` (called on init and resize) pulls the camera to a distance that frames the whole cube in both dimensions — on portrait/narrow screens the horizontal FOV is the tighter constraint, so it backs off further. It preserves the current orbit direction so a resize doesn't reset the user's rotation.

### Core invariant: integer game state, float visuals

All win-check-relevant state is **pure integers**, never derived from three.js transforms: each cubie has `grid {x,y,z} ∈ {-1,0,1}` and each sticker a `currentNormal` (signed unit axis). After a committed turn, both are updated by the same `rotateIntVec()` (normals rotate like positions). Quaternions/positions on meshes are visuals only — game logic must never read them. If you add logic that needs "where is this sticker," use `currentNormal` + `grid`, not world coordinates.

### Turn mechanics (the tricky part)

- During a turn, affected cubies are re-parented into `Cube3D.turningGroup` via `Object3D.attach()`, rotated live during the drag, then baked back with `group.attach()` + integer updates in `_finish()`. Marks travel automatically (they're children of sticker meshes).
- Drag-to-turn math (`interaction.js`): the hit sticker's normal N gives two in-plane axes; their screen-space projections are computed **once** at threshold-crossing; the dominant drag direction picks which axis is "pushed," the *other* axis is the rotation axis, layer = hit cubie's grid coord on that axis, and the rotation sign comes from `cross(R, N) · dominantAxis`. On release the angle snaps to the nearest multiple of 90° — snapping to 0 cancels (no move consumed).
- **OrbitControls coexistence**: `interaction.js` registers `pointerdown` in the capture phase and synchronously sets `controls.enabled = false` when claiming a turn-drag, so OrbitControls (bubble phase) never sees it. Re-enabled on pointerup/cancel.

### Guards against races

- `game.js` `resetToken` + `cube3D._generation`: a reset mid-animation invalidates the in-flight `commitTurn` callback and the transform bake. Preserve both checks when touching reset/animation code.
- `game.state.gameOver = true` doubles as the "startup dialogs open" interaction blocker.
