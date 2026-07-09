const LINES = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

const FACE_KEYS = ['U', 'D', 'L', 'R', 'F', 'B'];

export function createGame({ cube3D, statusEl, statusBarEl, playerBadgeEl, bannerEl, bannerMessageEl, newGameBtn, setupEl, rulesEl, p1Input, p2Input, nextBtn, startBtn, confetti }) {
  const state = {
    phase: 'place', // 'place' | 'rotate'
    activePlayer: 'X',
    gameOver: true, // blocks interaction until names are entered and the game starts
    resetToken: 0,
    names: { X: 'Spieler 1', O: 'Spieler 2' },
  };

  function getPhase() {
    return state.phase;
  }

  function isGameOver() {
    return state.gameOver;
  }

  function getResetToken() {
    return state.resetToken;
  }

  function playerLabel() {
    return state.names[state.activePlayer];
  }

  function updateStatusText() {
    if (state.gameOver) return;
    const action = state.phase === 'place' ? 'setze dein Zeichen auf ein leeres Feld' : 'drehe eine Ebene des Würfels';
    statusEl.textContent = `${playerLabel()} — ${action}`;
    playerBadgeEl.textContent = state.activePlayer === 'X' ? '✕' : '◯';
    statusBarEl.classList.toggle('player-x', state.activePlayer === 'X');
    statusBarEl.classList.toggle('player-o', state.activePlayer === 'O');
  }

  function pulseStatus() {
    statusBarEl.classList.remove('pulse');
    void statusBarEl.offsetWidth; // restart the CSS animation
    statusBarEl.classList.add('pulse');
  }

  function showBanner(message) {
    bannerMessageEl.textContent = message;
    bannerEl.hidden = false;
  }

  function hideBanner() {
    bannerEl.hidden = true;
  }

  function placeMark(stickerRecord) {
    if (state.gameOver || state.phase !== 'place') return;
    if (stickerRecord.mark) return;
    cube3D.placeMark(stickerRecord, state.activePlayer);
    if (declareResultIfAny()) return;
    state.phase = 'rotate';
    updateStatusText();
    pulseStatus();
  }

  function checkWinAndDraw() {
    const faces = cube3D.computeFaceGrids();
    let xWins = false;
    let oWins = false;
    for (const key of FACE_KEYS) {
      const grid = faces[key];
      for (const line of LINES) {
        const vals = line.map(([r, c]) => grid[r][c]);
        if (vals[0] && vals[0] === vals[1] && vals[1] === vals[2]) {
          if (vals[0] === 'X') xWins = true;
          else oWins = true;
        }
      }
    }
    return { xWins, oWins };
  }

  // Checks for a win or a full-board draw; ends the game and returns true if found.
  function declareResultIfAny() {
    const { xWins, oWins } = checkWinAndDraw();
    if (xWins || oWins) {
      state.gameOver = true;
      if (xWins && oWins) showBanner(`${state.names.X} und ${state.names.O} vervollständigen gleichzeitig eine Reihe — geteilter Sieg!`);
      else showBanner(`${xWins ? `${state.names.X} (X)` : `${state.names.O} (O)`} gewinnt!`);
      confetti.start();
      return true;
    }
    if (cube3D.isFull()) {
      state.gameOver = true;
      showBanner('Unentschieden — der Würfel ist voll.');
      return true;
    }
    return false;
  }

  function onMoveCommitted(token) {
    if (token !== state.resetToken) return; // stale callback from before a reset
    if (state.gameOver) return;

    if (declareResultIfAny()) return;

    state.activePlayer = state.activePlayer === 'X' ? 'O' : 'X';
    state.phase = 'place';
    updateStatusText();
    pulseStatus();
  }

  function resetGame() {
    state.resetToken++;
    cube3D.reset();
    state.phase = 'place';
    state.activePlayer = 'X';
    state.gameOver = false;
    hideBanner();
    confetti.clear();
    updateStatusText();
    pulseStatus();
  }

  function showSetup() {
    state.gameOver = true; // block cube interaction while the dialog is open
    hideBanner();
    confetti.stop();
    p1Input.value = state.names.X === 'Spieler 1' ? '' : state.names.X;
    p2Input.value = state.names.O === 'Spieler 2' ? '' : state.names.O;
    statusEl.textContent = 'Spielernamen eingeben, um zu starten';
    statusBarEl.classList.remove('player-x', 'player-o');
    playerBadgeEl.textContent = '';
    rulesEl.hidden = true;
    setupEl.hidden = false;
    p1Input.focus();
  }

  function goToRules() {
    state.names.X = p1Input.value.trim() || 'Spieler 1';
    state.names.O = p2Input.value.trim() || 'Spieler 2';
    setupEl.hidden = true;
    rulesEl.hidden = false;
    statusEl.textContent = 'Lies die Spielregeln, um zu starten';
  }

  function startGame() {
    rulesEl.hidden = true;
    resetGame();
  }

  newGameBtn.addEventListener('click', showSetup);
  nextBtn.addEventListener('click', goToRules);
  startBtn.addEventListener('click', startGame);
  const nextOnEnter = (e) => { if (e.key === 'Enter') goToRules(); };
  p1Input.addEventListener('keydown', nextOnEnter);
  p2Input.addEventListener('keydown', nextOnEnter);

  showSetup();

  return { getPhase, isGameOver, getResetToken, placeMark, onMoveCommitted, resetGame };
}
