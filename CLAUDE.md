# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter. The README is in Spanish; UI strings (e.g. "PAUSA", "Puntuación") are Spanish too.

## Running

Open `index.html` directly, or serve the directory (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

All logic lives in `game.js` (single script, `'use strict'`, global mutable state declared on one `let` line near the top). `index.html` supplies the DOM ids it looks up (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`); renaming an id requires updating `game.js`.

- **Board/pieces**: `board` is a `ROWS×COLS` (20×10) matrix of color indices (0 = empty). `PIECES` is indexed 1–7; `COLORS` is indexed 1–9 (index 0 is `null`): 1–7 are tetrominoes, `WILD` (8) is a rainbow joker, `GARBAGE` (9) is gray. The same index is stored in the shape cells and in `board`, so a cell value doubles as its color lookup. `hidden` is a parallel boolean matrix (invisible-pieces challenge); it is spliced/shifted together with `board`.
- **Combo/scoring**: `lockPiece()` → `isTSpin()` → `merge()` → `applyPower()` (if the piece has one) → `clearLines()` (returns cleared row indices, no scoring) → `applyScore()` (combo multiplier up to x8, T-spin table, B2B x1.5, Perfect Clear bonus, lines/level/`dropInterval`, sets `pendingPower` every 5 lines) → `checkChallenge()` → `spawn()`. `lastMoveWasRotate` feeds T-spin detection.
- **Power-ups**: `assignPower()` marks one cell of a piece (`piece.mark` matrix, rotated together with `shape`) with `piece.power` (`POWERS`/`POWER_META`). `spawn()` assigns it to the new `next` when `pendingPower`. A row clears when its empty cells ≤ its `WILD` cells (`isRowComplete`). Freeze uses `freezeMs`, decremented by `dt` in `loop()`.
- **Challenges**: `CHALLENGES` is declarative (`targetLines`, `timeLimitMs`, `surviveMs`, `garbageEveryMs`, `preFillRows`, `invisible`, `startLevel`, `inverseRotation`). `init(mode, idx)` builds `challenge`; `tickChallenge(dt)` drives timers/garbage; `finish(won, title)` shows the result overlay. All timers use the loop's clamped `dt`, so they respect pause. Level = `baseLevel + floor(lines/10)`.
- **Menu/effects/sound**: `#menu` overlay is shown at load (`showMenu()`), the menu button in the result overlay returns to it. `effects` (floating texts, particles, flash) is advanced in `loop()` and drawn by `drawEffects()`. Sound is synthesized with Web Audio (`sfx`, `tone`); `AudioContext` is created on first input; mute persists in `localStorage`.
- **Records**: classic mode only. `finish()` calls `submitRecord()` (top 5 + all-time `bestCombo`/`maxLines` in `localStorage['records']`; entry saved immediately with last `playerName`), then `showRecordResult()`. The `#record-name` input renames the saved entry live by `id`. `renderRecords(container, highlight)` builds the table with `textContent` (names are user input); used in `#overlay-records` and `#menu-records`. `maxCombo` = longest streak of clearing locks in the game.
- **Game loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum`, and gravity-drops when it exceeds `dropInterval`. Pause and game over stop the loop via `cancelAnimationFrame(animId)`; unpausing restarts it. `init()` resets all state and is also the restart handler.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next`, generates a new `next`, and ends the game if the new piece collides. Level/score/`dropInterval` updates happen inside `clearLines()`.
- **Rotation**: `rotateCW` rotates the matrix; `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]` (no vertical kicks, CW only).
- **Scoring**: line clears use `LINE_SCORES × level`; soft drop gives +1 per cell, hard drop +2 per cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` redraws everything each frame (grid, board, ghost piece at 0.2 alpha via `ghostY()`, current piece); `drawNext()` renders the preview on its own canvas. `BLOCK` (30px) must stay in sync with canvas sizes in `index.html`/`style.css`.
- **Theming**: colors are CSS variables in `style.css` (`:root` = dark default, `[data-theme="light"]` overrides). `setTheme()` in `game.js` sets `data-theme`, caches `--grid` into `gridColor` for the canvas, persists to `localStorage`, and redraws if paused/game over.
- **Input**: single `keydown` listener (arrows, `X` rotate, `Space` hard drop, `P`/`Escape` pause). `heldKeys`/`blockedKeys` (with a `keyup` listener) ignore keys still held when resuming until released.
- **Pause menu**: `#pause-menu` overlay (`pauseGame()`/`resumeGame()`/`togglePause()`): resume, restart, controls sub-view, main menu, and a start-level stepper (`startLevel`, 1–15, persisted in `localStorage`) that sets `baseLevel` for the next classic game (challenges keep their own `startLevel`).
