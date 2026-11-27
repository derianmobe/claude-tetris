'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const WILD = 8;    // comodín (Tinte)
const GARBAGE = 9; // basura / bloque pre-colocado

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#ffffff', // comodín (se dibuja con degradado)
  '#7a7a8c', // basura
];

// ---- Skins (apariencia de los bloques) ----
// Cada skin define su paleta (mismo índice que COLORS) y cómo se pinta la base de un bloque.
// drawBlock() calcula el relleno (color plano o degradado del comodín) y delega aquí;
// el brillo/icono de los power-ups se dibuja después, igual para todas las skins.
// `fill` puede ser un degradado; `base` es siempre un color CSS (para sombras/bordes).
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    drawBlock(context, px, py, size, fill) {
      context.fillStyle = fill;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d000ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#2f7bff', // J
      '#ff8c00', // L
      '#ffffff', // comodín
      '#8a8aa8', // basura
    ],
    drawBlock(context, px, py, size, fill, base) {
      context.shadowColor = base;
      context.shadowBlur = size * 0.4;
      context.strokeStyle = fill;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      // núcleo translúcido del mismo color
      const a = context.globalAlpha;
      context.globalAlpha = a * 0.35;
      context.fillStyle = fill;
      context.fillRect(px + 4, py + 4, size - 8, size - 8);
      context.globalAlpha = a;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a8e6ef', // I
      '#fdf1a8', // O
      '#d9b8e8', // T
      '#bfe8c0', // S
      '#f6b8b8', // Z
      '#bcd7f7', // J
      '#fcd4a8', // L
      '#ffffff', // comodín
      '#c4c4d0', // basura
    ],
    drawBlock(context, px, py, size, fill) {
      const r = size * 0.25;
      roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
      context.fillStyle = fill;
      context.fill();
      // borde sutil para que los tonos claros se distingan en el tema claro
      context.strokeStyle = 'rgba(0,0,0,0.18)';
      context.lineWidth = 1;
      context.stroke();
      // brillo suave en la parte superior
      roundRectPath(context, px + size * 0.2, py + size * 0.15, size * 0.6, size * 0.2, size * 0.1);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: COLORS,
    drawBlock(context, px, py, size, fill) {
      const u = Math.max(1, Math.floor(size / 10)); // tamaño de un "píxel"
      context.fillStyle = fill;
      context.fillRect(px, py, size, size);
      // biselado: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      // textura de tablero de ajedrez en el interior
      context.fillStyle = 'rgba(0,0,0,0.12)';
      for (let yy = py + u * 2; yy < py + size - u * 2; yy += u)
        for (let xx = px + u * 2; xx < px + size - u * 2; xx += u)
          if (((xx - px) / u + (yy - py) / u) % 2 === 0) context.fillRect(xx, yy, u, u);
      // brillo de esquina
      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.fillRect(px + u * 2, py + u * 2, u * 2, u);
      context.fillRect(px + u * 2, py + u * 3, u, u);
    },
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600]; // indexado por líneas (0-3)
const MAX_COMBO_MULT = 8;
const PERFECT_CLEAR_BONUS = 3000;
const LINES_PER_POWER = 5;
const FREEZE_MS = 5000;

const POWERS = ['bomb', 'lightning', 'tint', 'gravity', 'freeze'];
const POWER_META = {
  bomb:      { icon: '💣', color: '#ff7043', name: 'BOMBA' },
  lightning: { icon: '⚡', color: '#ffee58', name: 'RAYO' },
  tint:      { icon: '🎨', color: '#ec407a', name: 'TINTE' },
  gravity:   { icon: '⬇', color: '#26c6da', name: 'GRAVEDAD' },
  freeze:    { icon: '❄', color: '#80d8ff', name: 'CONGELAR' },
};

// Desafíos declarativos: loop()/lockPiece() leen estos campos.
const CHALLENGES = [
  { title: 'Contrarreloj', goal: 'Limpia 40 líneas en 2 minutos', targetLines: 40, timeLimitMs: 120000 },
  { title: 'Basura', goal: 'Sobrevive 90 s: sube basura cada 10 s', surviveMs: 90000, garbageEveryMs: 10000 },
  { title: 'Obstáculos', goal: 'Limpia 20 líneas con bloques pre-colocados', targetLines: 20, preFillRows: 5 },
  { title: 'Fantasma', goal: 'Limpia 15 líneas: las piezas se vuelven invisibles al caer', targetLines: 15, invisible: true },
  { title: 'Inverso', goal: 'Limpia 30 líneas con rotación inversa (nivel 5)', targetLines: 30, startLevel: 5, inverseRotation: true },
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const objectiveSection = document.getElementById('objective-section');
const objectiveEl = document.getElementById('objective');
const timerEl = document.getElementById('timer');
const progressEl = document.getElementById('progress');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const nextBtn = document.getElementById('next-btn');
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const menuMain = document.getElementById('menu-main');
const challengeList = document.getElementById('challenge-list');
const themeToggle = document.getElementById('theme-toggle');
const muteToggle = document.getElementById('mute-toggle');
const saveScoreBox = document.getElementById('save-score');
const saveScoreMsg = document.getElementById('save-score-msg');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');
const overlayRecords = document.getElementById('overlay-records');
const menuRecords = document.getElementById('menu-records');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const MAX_RECORDS = 5;
const NAME_MAX = 12;
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let skin = SKINS.retro;

let board, hidden, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let baseLevel, combo, b2b, lastMoveWasRotate, pendingPower, freezeMs, effects, challenge, mode, challengeIdx;
let maxCombo, pendingRecord;
let muted = false;
let audioCtx = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createHidden() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
}

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, mark: null, power: null, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// Marca una celda de la pieza como power-up. `mark` rota junto con `shape`.
function assignPower(piece) {
  const cells = [];
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) cells.push([r, c]);
  const [mr, mc] = cells[Math.floor(Math.random() * cells.length)];
  piece.mark = piece.shape.map(row => row.map(() => 0));
  piece.mark[mr][mc] = 1;
  piece.power = POWERS[Math.floor(Math.random() * POWERS.length)];
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

// dir > 0: horario, dir < 0: antihorario
function rotate(shape, dir) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (dir > 0) result[c][rows - 1 - r] = shape[r][c];
      else result[cols - 1 - c][r] = shape[r][c];
    }
  return result;
}

function tryRotate() {
  const dir = challenge && challenge.def.inverseRotation ? -1 : 1;
  const rotated = rotate(current.shape, dir);
  const rotatedMark = current.mark ? rotate(current.mark, dir) : null;
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.mark = rotatedMark;
      current.x += kick;
      lastMoveWasRotate = true;
      return;
    }
  }
}

// T-spin: pieza T, último movimiento fue rotación y 3 de 4 esquinas de la caja 3x3 ocupadas.
function isTSpin() {
  if (current.type !== 3 || !lastMoveWasRotate) return false;
  let filled = 0;
  for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    const nx = current.x + dx, ny = current.y + dy;
    if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) filled++;
  }
  return filled >= 3;
}

function merge() {
  const invisible = !!(challenge && challenge.def.invisible);
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        board[current.y + r][current.x + c] = current.shape[r][c];
        hidden[current.y + r][current.x + c] = invisible;
      }
}

// Una fila se borra si no tiene huecos; cada comodín cubre un hueco.
function isRowComplete(row) {
  let empty = 0, wild = 0;
  for (const v of row) {
    if (v === 0) empty++;
    else if (v === WILD) wild++;
  }
  return empty <= wild;
}

// Borra filas completas y devuelve los índices (aprox.) de las filas borradas.
function clearLines() {
  const rows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowComplete(board[r])) {
      rows.push(r);
      board.splice(r, 1);
      hidden.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      hidden.unshift(new Array(COLS).fill(false));
      r++;
    }
  }
  return rows;
}

function boardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

function clearCell(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return;
  burst(c * BLOCK + BLOCK / 2, r * BLOCK + BLOCK / 2, skin.colors[board[r][c]], 4);
  board[r][c] = 0;
  hidden[r][c] = false;
}

// ---- Power-ups ----
function applyPower(piece) {
  let pr = -1, pc = -1;
  for (let r = 0; r < piece.mark.length; r++)
    for (let c = 0; c < piece.mark[r].length; c++)
      if (piece.mark[r][c]) { pr = piece.y + r; pc = piece.x + c; }
  const meta = POWER_META[piece.power];
  addText(meta.name, meta.color);
  sfx.power();
  effects.flash = 0.6;

  switch (piece.power) {
    case 'bomb':
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) clearCell(pr + dr, pc + dc);
      break;
    case 'lightning':
      if (Math.random() < 0.5) for (let c = 0; c < COLS; c++) clearCell(pr, c);
      else for (let r = 0; r < ROWS; r++) clearCell(r, pc);
      break;
    case 'tint': {
      const counts = new Array(8).fill(0);
      for (const row of board) for (const v of row) if (v >= 1 && v <= 7) counts[v]++;
      let best = 0;
      for (let i = 1; i <= 7; i++) if (counts[i] > counts[best]) best = i;
      if (best) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === best) board[r][c] = WILD;
      }
      break;
    }
    case 'gravity':
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = ROWS - 1; r >= 0; r--)
          if (board[r][c]) col.push([board[r][c], hidden[r][c]]);
        for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
          board[r][c] = col[i] ? col[i][0] : 0;
          hidden[r][c] = col[i] ? col[i][1] : false;
        }
      }
      break;
    case 'freeze':
      freezeMs = FREEZE_MS;
      break;
  }
}

// ---- Puntuación, combo y niveles ----
function applyScore(cleared, tspin, perfect, rows) {
  if (cleared) combo++; else combo = -1;
  if (cleared) maxCombo = Math.max(maxCombo, combo + 1); // cadena de limpiezas seguidas (sin tope)

  if (cleared) {
    for (const r of rows) burst(COLS * BLOCK / 2, r * BLOCK + BLOCK / 2, '#ffffff', 10, COLS * BLOCK);
    effects.flash = 0.5;
    const prevPowerStep = Math.floor(lines / LINES_PER_POWER);
    lines += cleared;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
    if (Math.floor(lines / LINES_PER_POWER) > prevPowerStep) pendingPower = true;
  }

  const base = tspin ? (TSPIN_SCORES[cleared] || 0) : (LINE_SCORES[cleared] || 0);
  let pts = base * level;

  if (tspin) {
    addText(cleared ? `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared]}` : 'T-SPIN', '#ba68c8');
    sfx.tspin();
  }

  if (cleared) {
    const mult = Math.min(combo + 1, MAX_COMBO_MULT);
    pts *= mult;
    if (cleared === 4) addText('TETRIS', '#4dd0e1');
    if (combo >= 1) addText(`COMBO x${mult}`, '#ffd54f');

    const difficult = tspin || cleared === 4;
    if (difficult) {
      if (b2b) {
        pts = Math.round(pts * 1.5);
        addText('BACK-TO-BACK', '#ff8a65');
      }
      b2b = true;
    } else {
      b2b = false;
    }
    if (!tspin) sfx.clear(cleared, combo);
  }

  if (perfect) {
    pts += PERFECT_CLEAR_BONUS * level;
    addText('PERFECT CLEAR!', '#69f0ae');
    effects.flash = 1;
    sfx.perfect();
  }

  score += pts;
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy !== current.y) lastMoveWasRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveWasRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  merge();
  if (current.power) applyPower(current);
  const rows = clearLines();
  const perfect = rows.length > 0 && boardEmpty();
  applyScore(rows.length, tspin, perfect, rows);
  lastMoveWasRotate = false;
  checkChallenge();
  if (!gameOver) spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (pendingPower) {
    assignPower(next);
    pendingPower = false;
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 1 ? `x${Math.min(combo + 1, MAX_COMBO_MULT)}` : '-';
  updateObjective();
}

// ---- Desafíos ----
function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateObjective() {
  if (!challenge) {
    objectiveSection.classList.add('hidden');
    return;
  }
  const d = challenge.def;
  objectiveSection.classList.remove('hidden');
  objectiveEl.textContent = d.goal;
  if (d.timeLimitMs) timerEl.textContent = formatTime(d.timeLimitMs - challenge.elapsed);
  else if (d.surviveMs) timerEl.textContent = formatTime(d.surviveMs - challenge.elapsed);
  else timerEl.textContent = formatTime(challenge.elapsed);
  progressEl.textContent = d.targetLines ? `Líneas: ${lines}/${d.targetLines}` : '';
}

function updateStatus() {
  let text = '';
  if (freezeMs > 0) text = `❄ CONGELADO ${(freezeMs / 1000).toFixed(1)}s`;
  else if (challenge && challenge.def.inverseRotation) text = '↺ ROTACIÓN INVERSA';
  if (statusEl.textContent !== text) statusEl.textContent = text;
}

function preFill(rowCount) {
  for (let r = ROWS - rowCount; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (Math.random() < 0.65) board[r][c] = GARBAGE;
    board[r][Math.floor(Math.random() * COLS)] = 0; // al menos un hueco por fila
  }
}

function addGarbageRow() {
  if (board[0].some(v => v)) { finish(false); return; }
  board.shift();
  hidden.shift();
  const row = new Array(COLS).fill(GARBAGE);
  row[Math.floor(Math.random() * COLS)] = 0;
  board.push(row);
  hidden.push(new Array(COLS).fill(false));
  while (collide(current.shape, current.x, current.y) && current.y > -2) current.y--;
  if (collide(current.shape, current.x, current.y)) finish(false);
}

function checkChallenge() {
  if (!challenge || gameOver) return;
  const d = challenge.def;
  if (d.targetLines && lines >= d.targetLines) finish(true);
  else if (d.surviveMs && challenge.elapsed >= d.surviveMs) finish(true);
  else if (d.timeLimitMs && challenge.elapsed >= d.timeLimitMs) finish(false, 'TIEMPO AGOTADO');
}

function tickChallenge(dt) {
  const d = challenge.def;
  challenge.elapsed += dt;
  if (d.garbageEveryMs) {
    challenge.garbageAccum += dt;
    if (challenge.garbageAccum >= d.garbageEveryMs) {
      challenge.garbageAccum -= d.garbageEveryMs;
      addGarbageRow();
    }
  }
  if (!gameOver) checkChallenge();
}

// ---- Efectos visuales ----
function addText(text, color) {
  effects.texts.push({ text, color, age: 0, life: 1400, y: 300 + effects.texts.length * 28 });
}

function burst(x, y, color, count, spreadX) {
  for (let i = 0; i < count; i++) {
    effects.particles.push({
      x: x + (spreadX ? (Math.random() - 0.5) * spreadX : 0),
      y,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.25,
      age: 0,
      life: 500 + Math.random() * 300,
      color,
    });
  }
}

function advanceEffects(dt) {
  effects.flash = Math.max(0, effects.flash - dt / 350);
  for (const p of effects.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.0006 * dt;
  }
  effects.particles = effects.particles.filter(p => p.age < p.life);
  for (const t of effects.texts) {
    t.age += dt;
    t.y -= 0.03 * dt;
  }
  effects.texts = effects.texts.filter(t => t.age < t.life);
}

function drawEffects() {
  if (effects.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${effects.flash * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (freezeMs > 0) {
    ctx.fillStyle = 'rgba(128,216,255,0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  for (const p of effects.particles) {
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  for (const t of effects.texts) {
    ctx.globalAlpha = Math.min(1, (t.life - t.age) / 400);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t.text, canvas.width / 2, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, canvas.width / 2, t.y);
  }
  ctx.globalAlpha = 1;
}

// ---- Sonido (Web Audio sintetizado) ----
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window['webkitAudioContext'])(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, dur, type, vol, delay) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol || 0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

const sfx = {
  clear(n, comboCount) {
    const base = 330 * Math.pow(1.122, Math.min(Math.max(comboCount, 0), 10));
    for (let i = 0; i <= n; i++) tone(base * (1 + i * 0.25), 0.14, 'square', 0.05, i * 0.07);
  },
  tspin() { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'sawtooth', 0.05, i * 0.06)); },
  perfect() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.09)); },
  power() { tone(220, 0.25, 'sawtooth', 0.06); tone(440, 0.25, 'square', 0.04, 0.05); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.1)); },
  lose() { [330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.06, i * 0.12)); },
};

// ---- Render ----
function drawBlock(context, x, y, colorIndex, size, alpha, power) {
  if (!colorIndex) return;
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  let fill, base;
  if (colorIndex === WILD) {
    const h = (performance.now() / 8) % 360;
    const g = context.createLinearGradient(px, py, px + size, py + size);
    g.addColorStop(0, `hsl(${h}, 85%, 65%)`);
    g.addColorStop(1, `hsl(${(h + 140) % 360}, 85%, 65%)`);
    fill = g;
    base = `hsl(${h}, 85%, 65%)`;
  } else {
    fill = base = skin.colors[colorIndex];
  }
  skin.drawBlock(context, px, py, size, fill, base);
  if (power) {
    const meta = POWER_META[power];
    context.shadowColor = meta.color;
    context.shadowBlur = 8 + 6 * Math.sin(performance.now() / 150);
    context.strokeStyle = meta.color;
    context.lineWidth = 2;
    context.strokeRect(px + 2, py + 2, size - 4, size - 4);
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
    context.font = `${Math.floor(size * 0.55)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    context.fillText(meta.icon, px + size / 2, py + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawPiece(context, piece, ox, oy, size, alpha, withPower) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) {
        const power = withPower && piece.mark && piece.mark[r][c] ? piece.power : null;
        drawBlock(context, ox + c, oy + r, piece.shape[r][c], size, alpha, power);
      }
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!hidden[r][c]) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  drawPiece(ctx, current, current.x, ghostY(), BLOCK, 0.2, false);

  // current piece
  drawPiece(ctx, current, current.x, current.y, BLOCK, 1, true);

  drawEffects();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const offX = Math.floor((4 - next.shape[0].length) / 2);
  const offY = Math.floor((4 - next.shape.length) / 2);
  drawPiece(nextCtx, next, offX, offY, NB, 1, true);
}

// ---- Flujo de partida ----
function showOverlay(title, sub, win, showNext) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', !!win);
  overlayScore.textContent = sub;
  nextBtn.classList.toggle('hidden', !showNext);
  restartBtn.textContent = challenge ? 'Reintentar' : 'Reiniciar';
  saveScoreBox.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function finish(won, title) {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  const hasNext = won && challenge && challengeIdx < CHALLENGES.length - 1;
  showOverlay(
    title || (won ? '¡NIVEL SUPERADO!' : 'GAME OVER'),
    `Puntuación: ${score.toLocaleString()}`,
    won,
    hasNext
  );
  if (mode === 'classic') recordGameEnd();
  if (won) sfx.win(); else sfx.lose();
  draw();
}

// ---- Récords (localStorage) ----
// 'highscores': top 5 [{name, score, lines, level, combo, date}]; 'bestStats': {combo, lines} históricos.
function toCount(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function loadHighscores() {
  let list = null;
  try { list = JSON.parse(localStorage.getItem('highscores')); } catch (e) {}
  if (!Array.isArray(list)) return [];
  return list
    .filter(e => e && typeof e === 'object' && Number.isFinite(e.score) && e.score > 0)
    .map(e => ({
      name: (typeof e.name === 'string' && e.name.trim().slice(0, NAME_MAX)) || 'Anónimo',
      score: Math.floor(e.score),
      lines: toCount(e.lines),
      level: toCount(e.level),
      combo: toCount(e.combo),
      date: typeof e.date === 'string' ? e.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function saveHighscores(list) {
  try { localStorage.setItem('highscores', JSON.stringify(list)); } catch (e) {}
}

function loadBestStats() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('bestStats')); } catch (e) {}
  return { combo: toCount(s && s.combo), lines: toCount(s && s.lines) };
}

// Posición (0-based) que ocuparía `value` en el top, o -1 si no entra. Empates: el anterior queda arriba.
function recordRank(list, value) {
  if (value <= 0) return -1;
  const idx = list.findIndex(e => value > e.score);
  if (idx !== -1) return idx;
  return list.length < MAX_RECORDS ? list.length : -1;
}

function renderRecords(container, highlightIdx) {
  const list = loadHighscores();
  const best = loadBestStats();
  container.replaceChildren();

  const title = document.createElement('span');
  title.className = 'records-title';
  title.textContent = 'RÉCORDS';
  container.appendChild(title);

  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'records-empty';
    empty.textContent = 'Sin récords todavía';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const h of ['#', 'Nombre', 'Puntos', 'Lín.', 'Combo']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    const body = table.createTBody();
    list.forEach((e, i) => {
      const tr = body.insertRow();
      if (i === highlightIdx) tr.className = 'highlight';
      if (e.date) tr.title = `${e.date} · nivel ${e.level}`;
      const cells = [i + 1, e.name, e.score.toLocaleString(), e.lines, e.combo >= 2 ? `x${e.combo}` : '-'];
      for (const v of cells) tr.insertCell().textContent = v; // textContent: el nombre nunca se interpreta como HTML
    });
    container.appendChild(table);
  }

  const stats = document.createElement('span');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${best.combo >= 2 ? `x${best.combo}` : '-'} · Máx. líneas: ${best.lines}`;
  container.appendChild(stats);
}

// Fin de partida clásica: actualiza estadísticas y, si la puntuación entra en el top, pide el nombre.
function recordGameEnd() {
  const best = loadBestStats();
  const updated = { combo: Math.max(best.combo, maxCombo), lines: Math.max(best.lines, lines) };
  try { localStorage.setItem('bestStats', JSON.stringify(updated)); } catch (e) {}

  const rank = recordRank(loadHighscores(), score);
  pendingRecord = rank === -1 ? null : { score, lines, level, combo: maxCombo };
  renderRecords(overlayRecords, -1);
  overlayRecords.classList.remove('hidden');
  if (pendingRecord) {
    saveScoreMsg.textContent = `¡Nuevo récord! Puesto #${rank + 1}`;
    let lastName = '';
    try { lastName = localStorage.getItem('lastName') || ''; } catch (e) {}
    nameInput.value = lastName.slice(0, NAME_MAX);
    saveScoreBox.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  }
}

function submitRecord() {
  if (!pendingRecord) return;
  const typed = nameInput.value.trim().slice(0, NAME_MAX);
  const name = typed || 'Anónimo';
  if (typed) try { localStorage.setItem('lastName', typed); } catch (e) {}
  const list = loadHighscores();
  const rank = recordRank(list, pendingRecord.score);
  if (rank !== -1) {
    list.splice(rank, 0, { name, ...pendingRecord, date: new Date().toISOString().slice(0, 10) });
    saveHighscores(list.slice(0, MAX_RECORDS));
  }
  pendingRecord = null;
  saveScoreBox.classList.add('hidden');
  nameInput.blur();
  renderRecords(overlayRecords, rank);
}

function endGame() {
  finish(false);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '', false, false);
  }
}

function loop(ts) {
  const dt = Math.min(Math.max(ts - lastTime, 0), 100);
  lastTime = ts;
  if (challenge) tickChallenge(dt);
  if (!gameOver) {
    if (freezeMs > 0) {
      freezeMs = Math.max(0, freezeMs - dt);
      dropAccum = 0;
    } else {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
          lastMoveWasRotate = false;
        } else {
          lockPiece();
        }
      }
    }
  }
  advanceEffects(dt);
  draw();
  updateStatus();
  if (challenge) updateObjective();
  if (gameOver) return; // finish() corrió dentro de este frame: no reagendar
  animId = requestAnimationFrame(loop);
}

function init(modeName, idx) {
  mode = modeName || 'classic';
  challengeIdx = idx || 0;
  const def = mode === 'challenge' ? CHALLENGES[challengeIdx] : null;
  challenge = def ? { def, idx: challengeIdx, elapsed: 0, garbageAccum: 0 } : null;
  baseLevel = (def && def.startLevel) || 1;

  board = createBoard();
  hidden = createHidden();
  score = 0;
  lines = 0;
  level = baseLevel;
  combo = -1;
  maxCombo = 0;
  pendingRecord = null;
  b2b = false;
  lastMoveWasRotate = false;
  pendingPower = false;
  freezeMs = 0;
  effects = { texts: [], particles: [], flash: 0 };
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  if (def && def.preFillRows) preFill(def.preFillRows);
  next = randomPiece();
  spawn();
  updateHUD();
  updateStatus();
  overlay.classList.add('hidden');
  menu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Menú ----
function showMenu() {
  cancelAnimationFrame(animId);
  gameOver = true; // bloquea el input mientras el menú está abierto
  overlay.classList.add('hidden');
  challengeList.classList.add('hidden');
  menuMain.classList.remove('hidden');
  renderRecords(menuRecords, -1);
  menu.classList.remove('hidden');
}

function buildChallengeList() {
  CHALLENGES.forEach((def, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn challenge-btn';
    const title = document.createElement('span');
    title.textContent = `${i + 1}. ${def.title}`;
    const goal = document.createElement('small');
    goal.textContent = def.goal;
    btn.append(title, goal);
    btn.addEventListener('click', () => init('challenge', i));
    challengeList.appendChild(btn);
  });
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn-secondary';
  back.textContent = '← Volver';
  back.addEventListener('click', () => {
    challengeList.classList.add('hidden');
    menuMain.classList.remove('hidden');
  });
  challengeList.appendChild(back);
}

document.getElementById('menu-classic').addEventListener('click', () => init('classic'));
document.getElementById('menu-challenge').addEventListener('click', () => {
  menuMain.classList.add('hidden');
  challengeList.classList.remove('hidden');
});
restartBtn.addEventListener('click', () => init(mode, challengeIdx));
nextBtn.addEventListener('click', () => init('challenge', challengeIdx + 1));
menuBtn.addEventListener('click', showMenu);
buildChallengeList();

saveBtn.addEventListener('click', () => {
  submitRecord();
  saveBtn.blur();
});
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitRecord(); }
});
resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los récords?')) return;
  try {
    localStorage.removeItem('highscores');
    localStorage.removeItem('bestStats');
  } catch (e) {}
  renderRecords(menuRecords, -1);
});

document.addEventListener('pointerdown', ensureAudio);

document.addEventListener('keydown', e => {
  // escribir en un campo de texto (nombre del récord) no debe mover piezas
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  ensureAudio();
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveWasRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveWasRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  if (!gameOver) updateHUD();
});

let themeAnimTimer;

// --grid depende del tema y de la skin (neón la sobrescribe en style.css)
function refreshGridColor() {
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
}

function setTheme(theme, animate) {
  const root = document.documentElement;
  if (animate) {
    // la clase activa las transiciones de color solo durante el cambio
    root.classList.add('theme-anim');
    clearTimeout(themeAnimTimer);
    themeAnimTimer = setTimeout(() => root.classList.remove('theme-anim'), 400);
  }
  root.dataset.theme = theme;
  const isLight = theme === 'light';
  themeToggle.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  refreshGridColor();
  try { localStorage.setItem('theme', theme); } catch (e) {}
  // si el juego está en pausa o terminado el loop no corre: redibujar
  if (current && (paused || gameOver)) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  themeToggle.blur(); // evita que Space active el botón durante la partida
});

function setMuted(value) {
  muted = value;
  muteToggle.textContent = muted ? '🔇' : '🔊';
  muteToggle.setAttribute('aria-pressed', String(muted));
  try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) {}
}

muteToggle.addEventListener('click', () => {
  setMuted(!muted);
  muteToggle.blur();
});

function setSkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = 'retro';
  skin = SKINS[name];
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  refreshGridColor();
  try { localStorage.setItem('skin', name); } catch (e) {}
  // si el juego está en pausa o terminado el loop no corre: redibujar
  if (current && (paused || gameOver)) { draw(); drawNext(); }
}

for (const [key, s] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = s.label;
  skinSelect.appendChild(opt);
}

skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas cambien la skin durante la partida
});

// Si el select queda enfocado (p. ej. cerrado con Escape), las teclas de juego no deben
// cambiar la skin: se cancela la acción del select y el evento sigue hasta el handler global.
skinSelect.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyP'].includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
setTheme(savedTheme);

let savedMuted = false;
try { savedMuted = localStorage.getItem('muted') === '1'; } catch (e) {}
setMuted(savedMuted);

let savedSkin = 'retro';
try { savedSkin = localStorage.getItem('skin') || 'retro'; } catch (e) {}
setSkin(savedSkin);

// Arranca mostrando el menú: se prepara el estado para poder redibujar, pero sin correr el loop.
init('classic');
showMenu();
