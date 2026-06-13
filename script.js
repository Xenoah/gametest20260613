const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: '#38bdf8',
  O: '#facc15',
  T: '#a78bfa',
  S: '#4ade80',
  Z: '#fb7185',
  J: '#60a5fa',
  L: '#fb923c',
};

const PIECES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

const boardCanvas = document.getElementById('board');
const nextCanvas = document.getElementById('next');
const ctx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restartBtn');
const autoPlayBtn = document.getElementById('autoPlayBtn');

let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let isPaused = false;
let gameOver = false;
let dropTimer = null;
let autoMode = false;
let autoPilotTimer = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(PIECES);
  const type = types[Math.floor(Math.random() * types.length)];
  return { type, matrix: cloneMatrix(PIECES[type]), x: 3, y: 0 };
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function spawnPiece() {
  if (!nextPiece) {
    nextPiece = randomPiece();
  }

  currentPiece = nextPiece;
  currentPiece.x = 3;
  currentPiece.y = 0;
  nextPiece = randomPiece();

  if (!canMove(currentPiece, 0, 0)) {
    gameOver = true;
    isPaused = true;
    updateStatus('Game Over! Press New Game to play again.');
    stopTimer();
  }

  render();
}

function canMove(piece, offsetX, offsetY, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;

      const newX = piece.x + x + offsetX;
      const newY = piece.y + y + offsetY;

      if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
      if (newY >= 0 && board[newY][newX]) return false;
    }
  }
  return true;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        const boardY = currentPiece.y + y;
        const boardX = currentPiece.x + x;
        if (boardY >= 0) board[boardY][boardX] = currentPiece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateHud();
    updateStatus(`Cleared ${cleared} line${cleared > 1 ? 's' : ''}!`);
    startTimer();
  }
}

function dropPiece() {
  if (gameOver || isPaused) return;

  if (canMove(currentPiece, 0, 1)) {
    currentPiece.y += 1;
  } else {
    mergePiece();
    clearLines();
    spawnPiece();
  }
  render();
}

function hardDrop() {
  if (gameOver || isPaused) return;

  while (canMove(currentPiece, 0, 1)) {
    currentPiece.y += 1;
    score += 1;
  }

  mergePiece();
  clearLines();
  spawnPiece();
  updateHud();
  render();
}

function movePiece(dx) {
  if (gameOver || isPaused) return;
  if (canMove(currentPiece, dx, 0)) {
    currentPiece.x += dx;
    render();
  }
}

function rotatePiece() {
  if (gameOver || isPaused) return;

  const rotated = rotateMatrix(currentPiece.matrix);
  const ghost = { ...currentPiece, matrix: rotated };

  if (canMove(ghost, 0, 0, ghost.matrix)) {
    currentPiece.matrix = rotated;
    render();
  }
}

function updateHud() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 2, BLOCK - 2);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK - 2, BLOCK - 2);
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        drawCell(x, y, COLORS[cell]);
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
      }
    }
  }

  if (currentPiece) {
    currentPiece.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(currentPiece.x + x, currentPiece.y + y, COLORS[currentPiece.type]);
        }
      });
    });
  }
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = 'rgba(15, 23, 42, 0.96)';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const piece = nextPiece || randomPiece();
  const matrix = piece.matrix;
  const offsetX = Math.floor((4 - matrix[0].length) / 2);

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        nextCtx.fillStyle = COLORS[piece.type];
        nextCtx.fillRect((x + offsetX) * 32 + 8, y * 32 + 8, 28, 28);
        nextCtx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
        nextCtx.strokeRect((x + offsetX) * 32 + 8, y * 32 + 8, 28, 28);
      }
    });
  });
}

function render() {
  drawBoard();
  drawNextPiece();
}

function startTimer() {
  clearInterval(dropTimer);
  const speed = Math.max(120, 700 - (level - 1) * 60);
  dropTimer = setInterval(() => {
    dropPiece();
  }, speed);
}

function stopTimer() {
  clearInterval(dropTimer);
}

function startAutoPilot() {
  stopAutoPilot();
  autoPilotTimer = setInterval(() => {
    if (!autoMode || gameOver || isPaused || !currentPiece) return;

    const action = Math.random();
    if (action < 0.35) {
      rotatePiece();
    } else if (action < 0.65) {
      movePiece(Math.random() < 0.5 ? -1 : 1);
    } else {
      dropPiece();
    }
  }, 140);
}

function stopAutoPilot() {
  clearInterval(autoPilotTimer);
}

function setAutoMode(enabled) {
  autoMode = enabled;
  autoPlayBtn.classList.toggle('active', enabled);
  autoPlayBtn.textContent = enabled ? 'Auto Play: ON' : 'Auto Play';
  updateStatus(enabled ? '自動運転モード' : (gameOver ? 'Game Over' : 'Ready'));

  if (enabled) {
    startAutoPilot();
  } else {
    stopAutoPilot();
  }
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  isPaused = false;
  gameOver = false;
  updateHud();
  updateStatus('Game started. Use arrows and space.');
  stopTimer();
  nextPiece = null;
  spawnPiece();
  startTimer();
}

window.addEventListener('keydown', (event) => {
  const key = event.key;

  if (key === 'p' || key === 'P') {
    event.preventDefault();
    if (!gameOver) {
      isPaused = !isPaused;
      updateStatus(isPaused ? 'Paused' : 'Running');
      if (isPaused) stopTimer();
      else startTimer();
      render();
    }
    return;
  }

  if (key === 'n' || key === 'N') {
    resetGame();
    return;
  }

  if (isPaused || gameOver) return;

  switch (key) {
    case 'ArrowLeft':
      event.preventDefault();
      movePiece(-1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      movePiece(1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      dropPiece();
      score += 1;
      updateHud();
      break;
    case 'ArrowUp':
      event.preventDefault();
      rotatePiece();
      break;
    case ' ':
    case 'Spacebar':
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
});

restartBtn.addEventListener('click', () => {
  resetGame();
});

autoPlayBtn.addEventListener('click', () => {
  setAutoMode(!autoMode);
});

updateHud();
updateStatus('Ready');
setAutoMode(false);
spawnPiece();
startTimer();
render();
