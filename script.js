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
  return { type, matrix: cloneMatrix(PIECES[type]), x: 3, y: 0, rotation: 0 };
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

function canPlace(matrix, x, y, targetBoard = board) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;

      const nextX = x + col;
      const nextY = y + row;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return false;
      if (nextY >= 0 && targetBoard[nextY][nextX]) return false;
    }
  }
  return true;
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

function clearLines(targetBoard = board) {
  let cleared = 0;
  const nextBoard = targetBoard.map((row) => [...row]);

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (nextBoard[y].every(Boolean)) {
      nextBoard.splice(y, 1);
      nextBoard.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  return { board: nextBoard, cleared };
}

function applyLines(targetBoard) {
  const result = clearLines(targetBoard);
  return result;
}

function evaluateBoard(nextBoard, cleared, landingHeight) {
  const heights = Array(COLS).fill(0);
  for (let col = 0; col < COLS; col += 1) {
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (nextBoard[row][col]) {
        heights[col] = ROWS - row;
        break;
      }
    }
  }

  const aggregateHeight = heights.reduce((sum, height) => sum + height, 0);
  const bumpiness = heights.slice(1).reduce((sum, height, index) => sum + Math.abs(height - heights[index]), 0);
  const maxHeight = Math.max(...heights);

  let holes = 0;
  for (let col = 0; col < COLS; col += 1) {
    let seenBlock = false;
    for (let row = 0; row < ROWS; row += 1) {
      if (nextBoard[row][col]) {
        seenBlock = true;
      } else if (seenBlock) {
        holes += 1;
      }
    }
  }

  const well = heights.slice(0, -1).reduce((sum, height, index) => {
    const nextHeight = heights[index + 1];
    return sum + Math.max(0, Math.min(height, nextHeight) - 1);
  }, 0);

  return cleared * 12000
    - aggregateHeight * 10
    - holes * 100
    - bumpiness * 30
    - maxHeight * 6
    - landingHeight * 5
    - well * 18;
}

function getRotatedMatrix(matrix, rotations) {
  let result = cloneMatrix(matrix);
  for (let i = 0; i < rotations; i += 1) {
    result = rotateMatrix(result);
  }
  return result;
}

function findBestMove(piece = currentPiece) {
  if (!piece) return null;

  let best = null;

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const matrix = getRotatedMatrix(PIECES[piece.type], rotation);
    const maxX = COLS - matrix[0].length;

    for (let x = 0; x <= maxX; x += 1) {
      if (!canPlace(matrix, x, 0)) continue;

      let y = 0;
      while (canPlace(matrix, x, y + 1)) y += 1;
      const nextBoard = board.map((row) => [...row]);

      for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < matrix[row].length; col += 1) {
          if (matrix[row][col]) {
            nextBoard[y + row][x + col] = piece.type;
          }
        }
      }

      const clearedResult = clearLines(nextBoard);
      const score = evaluateBoard(clearedResult.board, clearedResult.cleared, y);

      if (!best || score > best.score) {
        best = { score, x, y, rotation, matrix, cleared: clearedResult.cleared };
      }
    }
  }

  return best;
}

function clearLinesFromBoard(targetBoard) {
  return clearLines(targetBoard);
}

function clearLines() {
  const result = clearLinesFromBoard(board);
  board = result.board;

  if (result.cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[result.cleared] * level;
    lines += result.cleared;
    level = Math.floor(lines / 10) + 1;
    updateHud();
    updateStatus(`Cleared ${result.cleared} line${result.cleared > 1 ? 's' : ''}!`);
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
    currentPiece.rotation = (currentPiece.rotation + 1) % 4;
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

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPoliticianFace(context, px, py, type) {
  const x = px + 2;
  const y = py + 2;
  const w = BLOCK - 4;
  const h = BLOCK - 4;

  context.save();
  roundedRectPath(context, x, y, w, h, 8);
  context.fillStyle = COLORS[type];
  context.shadowColor = 'rgba(8, 15, 25, 0.35)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  context.lineWidth = 1;
  context.stroke();

  const faceX = x + w * 0.5;
  const faceY = y + h * 0.46;
  const faceR = Math.min(w, h) * 0.22;

  context.fillStyle = '#fde68a';
  context.beginPath();
  context.arc(faceX, faceY, faceR, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#111827';
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(faceX - faceR * 0.35, faceY - faceR * 0.08, faceR * 0.18, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(faceX + faceR * 0.35, faceY - faceR * 0.08, faceR * 0.18, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = '#111827';
  context.fillRect(x + w * 0.32, y + h * 0.56, w * 0.36, 2);
  context.beginPath();
  context.moveTo(x + w * 0.30, y + h * 0.68);
  context.quadraticCurveTo(x + w * 0.50, y + h * 0.75, x + w * 0.70, y + h * 0.68);
  context.stroke();

  context.fillStyle = '#1f2937';
  context.fillRect(x + w * 0.26, y + h * 0.20, w * 0.48, h * 0.10);
  context.fillRect(x + w * 0.18, y + h * 0.80, w * 0.18, h * 0.10);
  context.fillRect(x + w * 0.64, y + h * 0.80, w * 0.18, h * 0.10);

  context.restore();
}

function drawCell(x, y, type) {
  drawPoliticianFace(ctx, x * BLOCK, y * BLOCK, type);
}

function drawBoard() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        drawCell(x, y, cell);
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
          drawCell(currentPiece.x + x, currentPiece.y + y, currentPiece.type);
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
        drawPoliticianFace(nextCtx, (x + offsetX) * 32 + 8, y * 32 + 8, piece.type);
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

    const best = findBestMove();
    if (!best) return;

    const currentRotation = currentPiece.rotation || 0;
    const neededRotations = (best.rotation - currentRotation + 4) % 4;

    if (neededRotations > 0) {
      rotatePiece();
      return;
    }

    if (currentPiece.x < best.x) {
      movePiece(1);
      return;
    }
    if (currentPiece.x > best.x) {
      movePiece(-1);
      return;
    }

    if (!canMove(currentPiece, 0, 1)) return;

    if (currentPiece.x === best.x && currentRotation === best.rotation) {
      hardDrop();
      return;
    }

    dropPiece();
  }, 70);
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
