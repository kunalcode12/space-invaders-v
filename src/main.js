import spaceinvadersConfig from "../spaceinvaders.config";
parseSelectedMode();
import {Engine} from "@babylonjs/core";
import {Environment} from "./Environment";
import State from "./State";
import {DeltaTime} from "./DeltaTime";
import {GameController} from "./GameController";
import {InputController} from "./InputController";
import {Starfield} from "./Starfield";
import {GameAssetsManager} from "./GameAssetsManager";
import {UIText} from "./UIText";
import {MobileInputs} from "./MobileInputs";
import {ArenaManager} from "./ArenaManager";
import {ArenaMonitoringUI} from "./ArenaMonitoringUI";
import {BoostEffects} from "./BoostEffects";
import {ItemEffects} from "./ItemEffects";


const canvas = document.querySelector('canvas');
const engine = new Engine(canvas, true);
const environment = new Environment(engine);

const stars = new Starfield(environment.scene);
const deltaTime = new DeltaTime(environment.scene);
const gameAssets = new GameAssetsManager(environment.scene);
const inputController = new InputController(environment.scene);
const UI = new UIText();
const gameController = new GameController(environment, inputController, gameAssets, UI);
window.gameController = gameController; // Make globally accessible for ThunderBullet

// Make gameAssets globally accessible for boost effects
window.gameAssets = gameAssets;

// Initialize Arena Manager
const arenaManager = new ArenaManager();
window.arenaManager = arenaManager; // Make it globally accessible

// Initialize Arena Monitoring UI
const arenaMonitoringUI = new ArenaMonitoringUI(arenaManager);
window.arenaMonitoringUI = arenaMonitoringUI;

// Initialize Boost Effects (will be initialized after gameAssets is ready)
let boostEffects = null;

// Initialize boost effects and item effects after game assets are loaded
let itemEffects = null;

function initBoostEffects() {
  if (gameAssets && gameAssets.isComplete) {
    boostEffects = new BoostEffects(gameController);
    window.boostEffects = boostEffects;
    
    // Initialize item effects
    itemEffects = new ItemEffects(gameController);
    window.itemEffects = itemEffects;
    
    // Setup boost received handler
    arenaManager.onBoostReceived = (boost) => {
      const amount = boost.amount || 0;
      const name = boost.name || "Viewer";
      
      console.log(`Boost received: ${amount} from ${name}`);
      
      // Handle boost effects
      if (boostEffects) {
        boostEffects.handleBoost(amount, name, boost.data);
        
        // Add screen flash for large boosts
        if (amount > 50) {
          boostEffects.addScreenEffect(amount > 100 ? "mega" : "large");
        }
      }
    };
    
    // Setup item drop handler
    arenaManager.onItemDrop = (itemData) => {
      console.log("Item drop received:", itemData);
      
      // Handle item effects
      if (itemEffects) {
        itemEffects.handleItemDrop(itemData);
      }
    };
  } else {
    // Wait for assets to load
    setTimeout(initBoostEffects, 100);
  }
}

initBoostEffects();

// Store streamUrl globally
let currentStreamUrl = null;

// Setup streamUrl input modal
function initStreamUrlModal() {
  const modal = document.getElementById("stream-url-modal");
  const input = document.getElementById("stream-url-input");
  const submitBtn = document.getElementById("stream-url-submit");
  const cancelBtn = document.getElementById("stream-url-cancel");
  const startArenaBtn = document.getElementById("start-arena");

  // Check if streamUrl exists in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlStreamUrl = urlParams.get("streamUrl");
  
  if (urlStreamUrl) {
    currentStreamUrl = urlStreamUrl;
    input.value = urlStreamUrl;
    if (startArenaBtn) {
      startArenaBtn.disabled = false;
    }
  } else {
    // Show modal on page load if no streamUrl in URL
    if (modal) {
      modal.classList.add("active");
    }
  }

  // Handle submit
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const streamUrl = input.value.trim();
      if (streamUrl) {
        currentStreamUrl = streamUrl;
        if (modal) {
          modal.classList.remove("active");
        }
        if (startArenaBtn) {
          startArenaBtn.disabled = false;
        }
      } else {
        alert("Please enter a valid stream URL");
      }
    });
  }

  // Handle cancel
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      // Use default streamUrl
      const urlParams = new URLSearchParams(window.location.search);
      const urlStreamUrl = urlParams.get("streamUrl");
      currentStreamUrl = urlStreamUrl || "https://twitch.tv/empireofbits";
      input.value = currentStreamUrl;
      if (modal) {
        modal.classList.remove("active");
      }
      if (startArenaBtn) {
        startArenaBtn.disabled = false;
      }
    });
  }

  // Handle Enter key in input
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        submitBtn?.click();
      }
    });
  }
}

// Initialize streamUrl modal on page load
initStreamUrlModal();

// Setup arena event handlers for UI updates
arenaManager.onStatusChange = (status) => {
  UI.updateArenaStatus(status, arenaManager.countdown);
};

arenaManager.onCountdownUpdate = (countdown) => {
  UI.updateArenaStatus(arenaManager.statusLabel, countdown);
};

arenaManager.onArenaBegins = (data) => {
  UI.updateArenaStatus("live", null);
  console.log("Arena has begun! Game can now start.");
};

// Setup boost received handler - will be set up in initBoostEffects

// Handle arena start button click
window.onArenaStartClick = async () => {
  const startArenaBtn = document.getElementById("start-arena");
  
  // Check if streamUrl is set
  if (!currentStreamUrl) {
    // Show modal to get streamUrl
    const modal = document.getElementById("stream-url-modal");
    if (modal) {
      modal.classList.add("active");
    }
    return;
  }

  if (startArenaBtn) {
    startArenaBtn.disabled = true;
    startArenaBtn.textContent = "CONNECTING...";
  }

  try {
    // Get token from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("authToken") || 
                  urlParams.get("token") ||
                  localStorage.getItem("authToken") || 
                  localStorage.getItem("token") || 
                  "";

    console.log("Token:", token);

    if (!token) {
      alert("No authentication token found. Please provide a token in the URL or localStorage.");
      if (startArenaBtn) {
        startArenaBtn.disabled = false;
        startArenaBtn.textContent = "START ARENA";
      }
      return;
    }

    // Use currentStreamUrl
    const streamUrl = currentStreamUrl;

    console.log("Initializing arena with token:", token ? "Present" : "Missing");
    console.log("Stream URL:", streamUrl);

    const result = await arenaManager.initializeArena(streamUrl, token);

    if (result.success && result.data) {
      console.log("Arena initialized successfully:", result.data);
      UI.updateArenaGameId(result.data.gameId);
      
      // Show arena status container
      const arenaStatusContainer = document.getElementById("arena-status-container");
      if (arenaStatusContainer) {
        arenaStatusContainer.style.display = "block";
      }
      
      // Show monitoring UI
      arenaMonitoringUI.show();
      
      // Update button
      if (startArenaBtn) {
        startArenaBtn.textContent = "ARENA CONNECTED";
        startArenaBtn.style.display = "none";
      }
    } else {
      console.error("Failed to initialize arena:", result.error);
      alert(`Failed to initialize arena: ${result.error || "Unknown error"}`);
      if (startArenaBtn) {
        startArenaBtn.disabled = false;
        startArenaBtn.textContent = "START ARENA";
      }
    }
  } catch (error) {
    console.error("Error starting arena:", error);
    alert(`Error starting arena: ${error.message || "Unknown error"}`);
    if (startArenaBtn) {
      startArenaBtn.disabled = false;
      startArenaBtn.textContent = "START ARENA";
    }
  }
};

// Handle arena disconnect
window.addEventListener("arena-disconnected", () => {
  const startArenaBtn = document.getElementById("start-arena");
  const startGameBtn = document.getElementById("start-game");
  
  if (startArenaBtn) {
    startArenaBtn.disabled = false;
    startArenaBtn.textContent = "START ARENA";
    startArenaBtn.style.display = "block";
  }
  
  if (startGameBtn) {
    startGameBtn.style.display = "none";
    startGameBtn.disabled = true;
  }
  
  UI.updateArenaStatus("pending", null);
  UI.updateArenaGameId(null);
  
  // Hide arena status container
  const arenaStatusContainer = document.getElementById("arena-status-container");
  if (arenaStatusContainer) {
    arenaStatusContainer.style.display = "none";
  }
  
  arenaMonitoringUI.hide();
});

// Set default FPS to 60.
// Low FPS in oldSchoolEffects mode
let lastRenderTime = 0;
let FPS = 60;
if (spaceinvadersConfig.oldSchoolEffects.enabled) FPS = 18;

engine.runRenderLoop(() => {
  if (gameAssets.isComplete) {
    switch (State.state) {
      case "LOADING":
        break;
      case "TITLESCREEN":
        gameController.titleScreen();
        break;
      case "STARTGAME":
        Engine.audioEngine.unlock();
        gameController.startGame();
        break;
      case "NEXTLEVEL":
        gameController.nextLevel();
        break;
      case "GAMELOOP":
        gameController.checkStates();
        break;
      case "ALIENSWIN":
        gameController.aliensWin();
        break;
      case "CLEARLEVEL":
        gameController.clearLevel();
        break;
      case "GAMEOVER":
        gameController.gameOver();
        break;
      default:
        // does nothing.
        break;
    }
    // Force a low FPS if required by oldSchoolEffects mode.
    let timeNow = Date.now();
    while (timeNow - lastRenderTime < 1000 / FPS) {
      timeNow = Date.now()
    }
    lastRenderTime = timeNow;
    window.scrollTo(0, 0);
    environment.scene.render();
  }
});

window.addEventListener('resize', () => {
  engine.resize();
});

function parseSelectedMode() {
  let mode = parseInt(window.localStorage.getItem('mode') ?? 0);
  document.querySelector("body").classList.add("mode"+mode);
  switch (mode) {
    case 0:
      break;
    case 1:
      spaceinvadersConfig.oldSchoolEffects.enabled = true;
      break;
    case 2:
      spaceinvadersConfig.actionCam = true;
      break;
    default:
      break;
  }
}
