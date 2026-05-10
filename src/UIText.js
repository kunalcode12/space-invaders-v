import State from "./State";

export class UIText {

  playAgainPressed = false;
  randNum = Math.floor(Math.random() * 10);
  gameHints = [
    'You start with a number of lives but if invaders get past you, it\'s game over.',
    'By 1982, Space Invaders was the highest-grossing entertainment product at the time.',
    'Alien formations get stronger, larger and more aggressive with each level.',
    'British paper, The Times, ranked Space Invaders No. 1 on its list of "The ten most influential video games ever".',
    'Destroy motherships for a huge score bonus.',
    'Tomohiro Nishikado developed Space Invaders in 1978. His name was never put on the game for contractual reasons.'
  ]

  constructor() {
    this.startButtonInit();
    this.modeSelectorInit();
    this.arenaStartButtonInit();
  }

  startButtonInit() {
    const startGameBtn = document.getElementById("start-game");
    if (startGameBtn) {
      startGameBtn.addEventListener('click', (el) => {
        this.startButtonClick(el)
      });
    }
  }

  arenaStartButtonInit() {
    const startArenaBtn = document.getElementById("start-arena");
    if (startArenaBtn) {
      startArenaBtn.addEventListener('click', () => {
        this.arenaStartButtonClick();
      });
    }
  }

  modeSelectorInit() {
    let selector = document.getElementById("change-mode");
    let mode = parseInt(window.localStorage.getItem('mode') ?? 0);
    selector.getElementsByTagName('option')[mode].selected = true;

    selector.onchange = (function (el) {
      window.localStorage.setItem("mode", selector.value);
      location.reload();
    });

  }

  startButtonClick(el) {
    this.hideTitleScreen();
    State.state = "STARTGAME";
  }

  arenaStartButtonClick() {
    // This will be handled by the ArenaManager
    if (window.onArenaStartClick) {
      window.onArenaStartClick();
    }
  }

  updateArenaStatus(status, countdown = null) {
    const statusText = document.getElementById("arena-status-text");
    const countdownContainer = document.getElementById("arena-countdown-container");
    const countdownText = document.getElementById("arena-countdown-text");
    const startGameBtn = document.getElementById("start-game");
    const startArenaBtn = document.getElementById("start-arena");

    if (statusText) {
      statusText.className = `arena-status-text status-${status}`;
      const statusLabels = {
        pending: "PENDING",
        live: "LIVE",
        completed: "COMPLETED",
        stopped: "STOPPED",
      };
      statusText.textContent = statusLabels[status] || status.toUpperCase();
    }

    if (countdownContainer && countdownText) {
      if (countdown !== null && countdown !== undefined) {
        countdownContainer.style.display = "block";
        countdownText.textContent = `${countdown}s`;
      } else {
        countdownContainer.style.display = "none";
      }
    }

    // Start game is always available (offline play). When arena is live, hide START ARENA only.
    if (startGameBtn) {
      startGameBtn.style.display = "block";
      startGameBtn.disabled = false;
      if (startArenaBtn) {
        startArenaBtn.style.display = status === "live" ? "none" : "block";
      }
    }
  }

  updateArenaGameId(gameId) {
    const gameIdElement = document.getElementById("arena-game-id");
    if (gameIdElement && gameId) {
      gameIdElement.textContent = `Game ID: ${gameId}`;
      gameIdElement.style.display = "block";
    }
  }

  enable() {
    let UI = document.querySelector("#ui");
    UI.classList.add("active");
  }

  disable() {
    let UI = document.querySelector("#ui");
    UI.classList.remove("active");
  }

  showGameUI() {
    this.enable();
    let UI = document.querySelector("#game-ui");
    UI.classList.add("active");
  }

  hideGameUI() {
    let UI = document.querySelector("#game-ui");
    UI.classList.remove("active");
  }

  showGameOver() {
    this.enable();
    let UI = document.querySelector("#panel-game-over");
    UI.classList.add("active");
  }

  hideGameOver() {
    let UI = document.querySelector("#panel-game-over");
    UI.classList.remove("active");
  }

  showGameHints() {
    this.newGameHint();
    this.enable();
    let UI = document.querySelector("#panel-game-hints");
    UI.classList.add("active");
  }

  hideGameHints() {
    let UI = document.querySelector("#panel-game-hints");
    UI.classList.remove("active");
  }

  newGameHint() {
    let i = ((this.randNum + State.level) % this.gameHints.length)
    document.querySelector("#panel-game-hints .value").innerHTML = this.gameHints[i];
  }

  showPlayAgain() {
    let UI = document.querySelector("#panel-play-again");
    UI.classList.add("active");
    UI.onclick = () => {
      this.playAgainPressed = true;
    }
  }

  hidePlayAgain() {
    let UI = document.querySelector("#panel-play-again");
    UI.classList.remove("active");
    this.playAgainPressed = false;
  }

  showNewHighScore() {
    this.enable();
    document.querySelector("#panel-new-highscore .value").innerHTML = window.localStorage.getItem('highScore');
    let UI = document.querySelector("#panel-new-highscore");
    UI.classList.add("active");
  }

  hideNewHighScore() {
    let UI = document.querySelector("#panel-new-highscore");
    UI.classList.remove("active");
  }

  showTitleScreen() {
    this.enable();
    let UI = document.querySelector("#title-screen");
    UI.classList.add("active");
    let buttons = document.querySelector("#intro");
    buttons.classList.add("active");
  }

  hideTitleScreen() {
    let UI = document.querySelector("#title-screen");
    UI.classList.remove("active");
    let buttons = document.querySelector("#intro");
    buttons.classList.remove("active");
  }

  hideLoadingScreen() {
    let loading = document.querySelector("#loading");
    loading.classList.remove('active');
  }
}
