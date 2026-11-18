# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter. The README is in Spanish; UI strings (e.g. "PAUSA", "Puntuación") are Spanish too.

## Running

Open `index.html` directly, or serve the directory (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

All logic lives in `game.js` (single script, `'use strict'`, global mutable state declared on one `let` line near the top). `index.html` supplies the DOM ids it looks up (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); renaming an id requires updating `game.js`.

- **Board/pieces**: `board` is a `ROWS×COLS` (20×10) matrix of color indices (0 = empty). `PIECES` and `COLORS` are indexed 1–7 (index 0 is `null`), and the same index is stored in the shape cells and in `board`, so a cell value doubles as its color lookup.
- **Game loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum`, and gravity-drops when it exceeds `dropInterval`. Pause and game over stop the loop via `cancelAnimationFrame(animId)`; unpausing restarts it. `init()` resets all state and is also the restart handler.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next`, generates a new `next`, and ends the game if the new piece collides. Level/score/`dropInterval` updates happen inside `clearLines()`.
- **Rotation**: `rotateCW` rotates the matrix; `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]` (no vertical kicks, CW only).
- **Scoring**: line clears use `LINE_SCORES × level`; soft drop gives +1 per cell, hard drop +2 per cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` redraws everything each frame (grid, board, ghost piece at 0.2 alpha via `ghostY()`, current piece); `drawNext()` renders the preview on its own canvas. `BLOCK` (30px) must stay in sync with canvas sizes in `index.html`/`style.css`.
- **Input**: single `keydown` listener (arrows, `X` rotate, `Space` hard drop, `P` pause).
