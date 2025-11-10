import State from "./State";
import { GuardianShield } from "./GuardianShield.js";
import { ThunderStrike } from "./ThunderStrike.js";
import { RainDropEffect } from "./RainDropEffect.js";

export class ItemEffects {
  constructor(gameController = null) {
    this.gameController = gameController;
    this.activeEffects = new Map(); // Store active item effects
    this.initElements();
  }

  initElements() {
    // Item notification popup (should exist in HTML)
    this.itemNotification = document.getElementById("item-notification");
    if (!this.itemNotification) {
      console.warn("Item notification element not found in HTML");
    }

    // Package notification popup
    this.packageNotification = document.getElementById("package-notification");
    if (!this.packageNotification) {
      console.warn("Package notification element not found in HTML");
    }

    // Frenzy overlay elements
    this.frenzyOverlay = document.getElementById("frenzy-overlay");
    this.frenzyScoreBanner = this.frenzyOverlay?.querySelector(".frenzy-score-banner") || null;
    this.frenzyTimerEl = this.frenzyOverlay?.querySelector(".frenzy-timer") || null;

    // Overclock UI elements (will be created when needed)
    this.overclockBanner = null;
    this.overclockTimer = null;
    this.overclockContainer = null;
    
    // Guardian Shield UI elements
    this.shieldUI = null;
    this.shieldStatusDisplay = null;
    
    // Thunder Strike effect
    this.thunderStrike = null;
    this.rainDropEffect = null;
    this.frenzyUIInterval = null;
    this.frenzyUIAnimationFrame = null;
    this.frenzyPreviousMultiplier = 1;
    this.packageNotificationTimeout = null;
  }

  showItemNotification(itemName, targetPlayerName, cost) {
    if (!this.itemNotification) {
      console.warn("Cannot show item notification: element not found");
      return;
    }

    const itemNameEl = this.itemNotification.querySelector(".item-notification-item-name");
    const targetEl = this.itemNotification.querySelector(".item-target");
    const costEl = this.itemNotification.querySelector(".item-cost");

    if (itemNameEl) itemNameEl.textContent = itemName;
    if (targetEl) targetEl.textContent = `for ${targetPlayerName}`;
    if (costEl) costEl.textContent = `Cost: ${cost}`;

    // Remove active class first to reset animation
    this.itemNotification.classList.remove("active");
    
    // Force reflow
    void this.itemNotification.offsetWidth;
    
    // Show notification
    this.itemNotification.classList.add("active");

    // Hide after 4 seconds (animation handles the hiding)
    setTimeout(() => {
      this.itemNotification.classList.remove("active");
    }, 4000);
  }

  showPackageNotification(packageName, playerName, cost) {
    if (!this.packageNotification) {
      console.warn("Cannot show package notification: element not found");
      return;
    }

    const nameEl = this.packageNotification.querySelector(".package-notification-name");
    const playerEl = this.packageNotification.querySelector(".package-player-name");
    const costEl = this.packageNotification.querySelector(".package-cost");

    if (nameEl) nameEl.textContent = packageName;
    if (playerEl) playerEl.textContent = `Player: ${playerName}`;
    if (costEl) costEl.textContent = `Cost: ${cost}`;

    this.packageNotification.classList.remove("active");
    void this.packageNotification.offsetWidth;
    this.packageNotification.classList.add("active");

    if (this.packageNotificationTimeout) {
      clearTimeout(this.packageNotificationTimeout);
    }

    this.packageNotificationTimeout = setTimeout(() => {
      this.packageNotification?.classList.remove("active");
    }, 4500);
  }

  activateOverclock(duration = 6000) {
    console.log(`Overclock activated for ${duration}ms`);
    
    // Check if player controller exists
    if (!this.gameController || !this.gameController.playerController) {
      console.warn("PlayerController not available for Overclock effect");
      return;
    }

    const playerController = this.gameController.playerController;

    // Store original fire rate behavior
    if (!playerController.originalFireRate) {
      playerController.originalFireRate = {
        fireKeyDown: playerController.fireKeyDown,
        maxBullets: playerController.maxBullets,
      };
    }

    // Activate Overclock mode
    playerController.overclockActive = true;
    playerController.overclockDuration = duration;
    playerController.overclockStartTime = Date.now();
    playerController.overclockFireRate = 2; // 2x faster
    playerController.overclockTripleShot = true;

    // Create UI elements
    this.createOverclockUI();

    // Set timeout to deactivate
    const timeoutId = setTimeout(() => {
      this.deactivateOverclock();
    }, duration);

    // Store timeout ID
    playerController.overclockTimeoutId = timeoutId;

    // Update active effects
    this.activeEffects.set("overclock", {
      startTime: Date.now(),
      duration: duration,
      timeoutId: timeoutId,
    });

    console.log("Overclock effect activated");
  }

  createOverclockUI() {
    // Get or create container for Overclock UI
    this.overclockContainer = document.getElementById("overclock-ui-container");
    if (!this.overclockContainer) {
      this.overclockContainer = document.createElement("div");
      this.overclockContainer.id = "overclock-ui-container";
      this.overclockContainer.className = "overclock-ui-container";
      document.body.appendChild(this.overclockContainer);
    }

    // Show container
    this.overclockContainer.classList.add("active");

    // Create banner if it doesn't exist
    this.overclockBanner = document.getElementById("overclock-banner");
    if (!this.overclockBanner) {
      this.overclockBanner = document.createElement("div");
      this.overclockBanner.id = "overclock-banner";
      this.overclockBanner.className = "overclock-banner";
      this.overclockBanner.textContent = "OVERCLOCK!";
      this.overclockContainer.appendChild(this.overclockBanner);
    } else {
      // Reset banner if it already exists
      this.overclockBanner.classList.remove("fade-out");
      this.overclockBanner.style.opacity = "1";
    }

    // Create radial timer if it doesn't exist
    this.overclockTimer = document.getElementById("overclock-timer");
    if (!this.overclockTimer) {
      this.overclockTimer = document.createElement("div");
      this.overclockTimer.id = "overclock-timer";
      this.overclockTimer.className = "overclock-timer";
      this.overclockTimer.innerHTML = `
        <svg class="overclock-timer-svg" viewBox="0 0 100 100">
          <circle class="overclock-timer-bg" cx="50" cy="50" r="45"></circle>
          <circle class="overclock-timer-progress" cx="50" cy="50" r="45"></circle>
        </svg>
        <div class="overclock-timer-text">6s</div>
      `;
      this.overclockContainer.appendChild(this.overclockTimer);
    } else {
      // Reset timer if it already exists
      this.overclockTimer.classList.remove("fade-out");
      this.overclockTimer.style.opacity = "1";
      const progressCircle = this.overclockTimer.querySelector(".overclock-timer-progress");
      if (progressCircle) {
        progressCircle.style.strokeDashoffset = "0";
      }
    }

    // Start UI update loop
    this.startOverclockUIUpdate();
  }

  startOverclockUIUpdate() {
    if (this.overclockUIInterval) {
      clearInterval(this.overclockUIInterval);
    }

    this.overclockUIInterval = setInterval(() => {
      this.updateOverclockUI();
    }, 50); // Update every 50ms for smooth animation
  }

  updateOverclockUI() {
    const playerController = this.gameController?.playerController;
    if (!playerController || !playerController.overclockActive) {
      this.stopOverclockUIUpdate();
      this.hideOverclockUI();
      return;
    }

    const elapsed = Date.now() - playerController.overclockStartTime;
    const remaining = Math.max(0, playerController.overclockDuration - elapsed);
    const progress = Math.max(0, remaining / playerController.overclockDuration);
    const seconds = Math.max(0, Math.ceil(remaining / 1000));

    // Update timer text
    if (this.overclockTimer) {
      const timerText = this.overclockTimer.querySelector(".overclock-timer-text");
      if (timerText) {
        timerText.textContent = `${seconds}s`;
      }

      // Update progress circle
      const progressCircle = this.overclockTimer.querySelector(".overclock-timer-progress");
      if (progressCircle) {
        const circumference = 2 * Math.PI * 45; // 2 * PI * radius (45)
        const offset = circumference * (1 - progress);
        progressCircle.style.strokeDashoffset = offset;
      }
    }

    // If time is up, stop updating
    if (remaining <= 0) {
      this.stopOverclockUIUpdate();
      this.hideOverclockUI();
    }
  }

  hideOverclockUI() {
    if (this.overclockContainer) {
      this.overclockContainer.classList.remove("active");
    }
  }

  stopOverclockUIUpdate() {
    if (this.overclockUIInterval) {
      clearInterval(this.overclockUIInterval);
      this.overclockUIInterval = null;
    }
  }

  removeOverclockUI() {
    // Hide container
    this.hideOverclockUI();
    
    // Add fade-out animation to elements
    if (this.overclockBanner) {
      this.overclockBanner.classList.add("fade-out");
    }

    if (this.overclockTimer) {
      this.overclockTimer.classList.add("fade-out");
    }

    // Clean up after animation
    setTimeout(() => {
      // Don't remove elements, just hide them so they can be reused
      if (this.overclockContainer) {
        this.overclockContainer.classList.remove("active");
      }
    }, 500);

    this.stopOverclockUIUpdate();
  }

  deactivateOverclock() {
    console.log("Deactivating Overclock");

    const playerController = this.gameController?.playerController;
    if (!playerController) return;

    // Clear timeout if exists
    if (playerController.overclockTimeoutId) {
      clearTimeout(playerController.overclockTimeoutId);
      playerController.overclockTimeoutId = null;
    }

    // Restore original fire rate
    playerController.overclockActive = false;
    playerController.overclockFireRate = 1;
    playerController.overclockTripleShot = false;

    // Remove UI
    this.removeOverclockUI();

    // Remove from active effects
    this.activeEffects.delete("overclock");

    console.log("Overclock effect deactivated");
  }

  handleItemDrop(itemData) {
    const itemName = itemData?.itemName || itemData?.name || "Unknown Item";
    const targetPlayerName = itemData?.targetPlayerName || "Unknown Player";
    const cost = itemData?.cost || 0;
    const stats = itemData?.stats || [];
    const description = itemData?.description || "";

    console.log("Item drop received:", itemName, targetPlayerName, cost, stats);

    // Show notification
    this.showItemNotification(itemName, targetPlayerName, cost);

    // Handle specific items - check by name (case-insensitive)
    const itemNameLower = itemName.toLowerCase();
    
    if (itemNameLower.includes("overclock")) {
      // Get duration from stats or use default 6 seconds
      let duration = 6000; // 6 seconds default (6000ms)
      
      // Check if stats contain duration information
      // The effect description says "for 6s", but we should check stats
      const overdriveStat = stats.find(stat => 
        stat.name && (stat.name.toLowerCase().includes("overdrive") || stat.name.toLowerCase().includes("duration"))
      );
      
      // Check description for duration (e.g., "for 6 s" or "for 6s")
      const durationMatch = description.match(/(\d+)\s*s/i);
      if (durationMatch) {
        duration = 10 * 1000; // Convert seconds to milliseconds
      } else if (overdriveStat && overdriveStat.currentValue) {
        // Use currentValue if available (might be in seconds or some other unit)
        duration = 10 * 1000; // Assume it's in seconds
      }

      console.log(`Activating Overclock for ${duration}ms (${duration/1000}s)`);

      // Activate Overclock effect
      this.activateOverclock(duration);
    } else if (itemNameLower.includes("guardian shield") || itemNameLower.includes("shield")) {
      // Get duration from stats or use default 4 seconds
      let duration = 4000; // 4 seconds default (4000ms) - always 4 seconds as per requirements
      let maxHits = 3; // Default 3 hits
      
      // Check stats for shield information (Aegis stat)
      const aegisStat = stats.find(stat => 
        stat.name && stat.name.toLowerCase().includes("aegis")
      );
      
      // Use Aegis currentValue as maxHits if available
      if (aegisStat && aegisStat.currentValue) {
        maxHits = aegisStat.currentValue || 3;
      }
      
      // Check for hit count in description (e.g., "blocks 3")
      const hitsMatch = description.match(/blocks?\s+(\d+)/i);
      if (hitsMatch) {
        maxHits = parseInt(hitsMatch[1]);
      }
      
      // Duration is always 4 seconds as specified
      duration = 8000;

      console.log(`Activating Guardian Shield for ${duration}ms (${duration/1000}s) with ${maxHits} hits`);

      // Activate Guardian Shield effect
      this.activateGuardianShield(duration, maxHits);
    } else if (itemNameLower.includes("thunder strike") || itemNameLower.includes("thunder")) {
      // Get duration from stats or use default 3 seconds
      let duration = 3000; // 3 seconds default (3000ms)
      
      // Check stats for thunder strike information
      const stormStat = stats.find(stat => 
        stat.name && stat.name.toLowerCase().includes("storm")
      );
      
      // Check description for duration
      const durationMatch = description.match(/(\d+)\s*s/i);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 1000;
      }
      
      // Duration is always 3 seconds as specified
      duration = 3000;

      console.log(`Activating Thunder Strike for ${duration}ms (${duration/1000}s)`);

      // Activate Thunder Strike effect
      this.activateThunderStrike(duration);
    } else if (itemNameLower.includes("precision mode") || itemNameLower.includes("precision")) {
      // Get duration from stats or use default 5 seconds
      let duration = 5000; // 5 seconds default (5000ms)
      
      // Check description for duration (e.g., "for 4 s" or "for 4s")
      const durationMatch = description.match(/(\d+)\s*s/i);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 1000;
      }
      
      // Check stats for Time Freeze value
      const timeFreezeStat = stats.find(stat => 
        stat.name && stat.name.toLowerCase().includes("time freeze")
      );
      
      // Duration is always 5 seconds as specified
      duration = 5000;

      console.log(`Activating Precision Mode for ${duration}ms (${duration/1000}s)`);

      // Activate Precision Mode effect
      this.activatePrecisionMode(duration);
    }

    // Add more item handlers here as needed
  }

  handlePackageDrop(packageData) {
    const packageName = packageData?.packageName || packageData?.name || "Unknown Package";
    const targetPlayerName = packageData?.playerName || packageData?.player?.name || "Unknown Player";
    const cost = packageData?.cost || 0;
    const stats = packageData?.stats || [];
    const description = packageData?.description || "";

    console.log("Package drop received:", packageName, targetPlayerName, cost, stats);

    this.showPackageNotification(packageName, targetPlayerName, cost);

    const packageNameLower = packageName.toLowerCase();
    if (packageNameLower.includes("rain drop") || packageNameLower.includes("raindrop")) {
      this.activateRainDropEffect(5000, packageData);
    } else if (packageNameLower.includes("frenzy")) {
      let duration = 8000;
      const adrenalineStat = stats.find((stat) =>
        stat?.name && (stat.name.toLowerCase().includes("adrenaline") || stat.name.toLowerCase().includes("duration"))
      );
      if (adrenalineStat?.currentValue) {
        duration = Math.max(5000, Number(adrenalineStat.currentValue) * 200);
      }
      this.activateFrenzyMode(duration, packageData);
    }
  }

  activateGuardianShield(duration = 4000, maxHits = 3) {
    console.log(`Guardian Shield activated for ${duration}ms with ${maxHits} hits`);
    
    // Check if player controller exists
    if (!this.gameController || !this.gameController.playerController) {
      console.warn("PlayerController not available for Guardian Shield effect");
      return;
    }

    const playerController = this.gameController.playerController;

    // Activate shield in PlayerController
    playerController.activateGuardianShield(duration, maxHits);

    // Create shield UI
    this.createShieldUI();

    // Set timeout to deactivate
    const timeoutId = setTimeout(() => {
      this.deactivateGuardianShield();
    }, duration);

    // Update active effects
    this.activeEffects.set("guardianShield", {
      startTime: Date.now(),
      duration: duration,
      maxHits: maxHits,
      timeoutId: timeoutId,
    });

    console.log("Guardian Shield effect activated");
  }

  createShieldUI() {
    // Create or get shield UI container
    let shieldUIContainer = document.getElementById("shield-ui-container");
    if (!shieldUIContainer) {
      shieldUIContainer = document.createElement("div");
      shieldUIContainer.id = "shield-ui-container";
      shieldUIContainer.className = "shield-ui-container";
      document.body.appendChild(shieldUIContainer);
    }

    // Create shield status display
    this.shieldStatusDisplay = document.getElementById("shield-status-display");
    if (!this.shieldStatusDisplay) {
      this.shieldStatusDisplay = document.createElement("div");
      this.shieldStatusDisplay.id = "shield-status-display";
      this.shieldStatusDisplay.className = "shield-status-display";
      shieldUIContainer.appendChild(this.shieldStatusDisplay);
    }

    // Show UI
    shieldUIContainer.classList.add("active");
    this.shieldStatusDisplay.classList.add("active");

    // Start UI update loop
    this.startShieldUIUpdate();
  }

  startShieldUIUpdate() {
    if (this.shieldUIInterval) {
      clearInterval(this.shieldUIInterval);
    }

    this.shieldUIInterval = setInterval(() => {
      this.updateShieldUI();
    }, 100); // Update every 100ms
  }

  updateShieldUI() {
    const playerController = this.gameController?.playerController;
    if (!playerController) {
      this.stopShieldUIUpdate();
      return;
    }

    const shieldStatus = playerController.getShieldStatus();
    
    if (!shieldStatus || !shieldStatus.active) {
      this.stopShieldUIUpdate();
      this.hideShieldUI();
      return;
    }

    // Update shield status display
    if (this.shieldStatusDisplay) {
      const hitsText = `${shieldStatus.remainingHits}/${shieldStatus.maxHits}`;
      const timeText = `${Math.ceil(shieldStatus.remainingTime / 1000)}s`;
      this.shieldStatusDisplay.innerHTML = `
        <div class="shield-status-label">SHIELD</div>
        <div class="shield-status-hits">${hitsText} HITS</div>
        <div class="shield-status-time">${timeText}</div>
      `;
      
      // Update visual based on remaining hits
      this.shieldStatusDisplay.className = `shield-status-display active hits-${shieldStatus.remainingHits}`;
    }
  }

  stopShieldUIUpdate() {
    if (this.shieldUIInterval) {
      clearInterval(this.shieldUIInterval);
      this.shieldUIInterval = null;
    }
  }

  hideShieldUI() {
    const shieldUIContainer = document.getElementById("shield-ui-container");
    if (shieldUIContainer) {
      shieldUIContainer.classList.remove("active");
    }
    if (this.shieldStatusDisplay) {
      this.shieldStatusDisplay.classList.remove("active");
    }
  }

  deactivateGuardianShield() {
    console.log("Deactivating Guardian Shield");

    const playerController = this.gameController?.playerController;
    if (!playerController) return;

    // Deactivate shield in PlayerController
    playerController.deactivateGuardianShield();

    // Hide UI
    this.hideShieldUI();
    this.stopShieldUIUpdate();

    // Remove from active effects
    const effectData = this.activeEffects.get("guardianShield");
    if (effectData && effectData.timeoutId) {
      clearTimeout(effectData.timeoutId);
    }
    this.activeEffects.delete("guardianShield");

    console.log("Guardian Shield effect deactivated");
  }

  activateThunderStrike(duration = 3000) {
    console.log(`Thunder Strike activated for ${duration}ms`);
    
    // Check if game controller exists and has alien formation
    if (!this.gameController) {
      console.warn("GameController not available for Thunder Strike effect");
      return;
    }

    const alienFormation = this.gameController.alienFormation;
    if (!alienFormation) {
      console.warn("AlienFormation not available for Thunder Strike effect");
      return;
    }

    const playerController = this.gameController.playerController;
    if (!playerController) {
      console.warn("PlayerController not available for Thunder Strike effect");
      return;
    }

    // Deactivate existing thunder strike if any
    if (this.thunderStrike) {
      this.thunderStrike.deactivate();
      this.thunderStrike = null;
    }

    // Create new Thunder Strike effect
    this.thunderStrike = new ThunderStrike(
      this.gameController.scene,
      this.gameController.gameAssets,
      alienFormation,
      playerController,
      duration
    );
    
    // Store reference to gameController for score updates
    this.thunderStrike.gameController = this.gameController;

    // Set timeout to deactivate
    const timeoutId = setTimeout(() => {
      this.deactivateThunderStrike();
    }, duration);

    // Update active effects
    this.activeEffects.set("thunderStrike", {
      startTime: Date.now(),
      duration: duration,
      timeoutId: timeoutId,
    });

    console.log("Thunder Strike effect activated");
  }

  activateRainDropEffect(duration = 5000, packageData = null) {
    console.log(`Rain Drop bonus activated for ${duration}ms`);

    if (!this.gameController) {
      console.warn("GameController not available for Rain Drop effect");
      return;
    }

    // Deactivate existing rain drop effect if active
    this.deactivateRainDropEffect();

    const rainDropEffect = new RainDropEffect(this.gameController, {
      duration,
      pointValue: this.extractRainDropPointValue(packageData),
      packageData,
      onComplete: () => {
        this.activeEffects.delete("rainDrop");
        this.rainDropEffect = null;
      },
    });

    rainDropEffect.start();
    this.rainDropEffect = rainDropEffect;

    this.activeEffects.set("rainDrop", {
      startTime: Date.now(),
      duration,
      instance: rainDropEffect,
    });
  }

  deactivateRainDropEffect() {
    if (this.rainDropEffect) {
      this.rainDropEffect.stop();
      this.rainDropEffect = null;
      this.activeEffects.delete("rainDrop");
    }
  }

  extractRainDropPointValue(packageData) {
    const defaultValue = 25;
    if (!packageData?.stats?.length) return defaultValue;

    const bonusStat = packageData.stats.find((stat) =>
      stat?.name?.toLowerCase().includes("bonus") ||
      stat?.name?.toLowerCase().includes("points")
    );

    if (bonusStat?.currentValue) {
      return Math.max(5, Math.round(Number(bonusStat.currentValue) / 2));
    }

    return defaultValue;
  }

  activateFrenzyMode(duration = 8000, packageData = null) {
    console.log(`Frenzy Mode activated for ${duration}ms`);

    if (!this.gameController || !this.gameController.playerController) {
      console.warn("PlayerController not available for Frenzy Mode effect");
      return;
    }

    // Deactivate existing frenzy if active
    this.deactivateFrenzyMode();

    const playerController = this.gameController.playerController;
    const speedMultiplier = 1.5;
    const fireRateMultiplier = 1.5;

    this.frenzyPreviousMultiplier = State.scoreMultiplier || 1;
    State.scoreMultiplier = Math.max(State.scoreMultiplier || 1, 2);

    playerController.activateFrenzyMode(duration, {
      speedMultiplier,
      fireRateMultiplier,
    });

    this.showFrenzyOverlay(duration);

    if (typeof document !== "undefined" && document.body) {
      document.body.classList.add("frenzy-active");
    }

    const timeoutId = setTimeout(() => {
      this.deactivateFrenzyMode();
    }, duration);

    this.activeEffects.set("frenzyMode", {
      startTime: Date.now(),
      duration,
      timeoutId,
      previousMultiplier: this.frenzyPreviousMultiplier,
    });
  }

  showFrenzyOverlay(duration) {
    if (!this.frenzyOverlay) {
      console.warn("Frenzy overlay element not found");
      return;
    }

    this.frenzyOverlay.classList.add("active");
    if (this.frenzyScoreBanner) {
      this.frenzyScoreBanner.classList.add("active");
    }
    this.startFrenzyUIUpdate(duration);
  }

  hideFrenzyOverlay() {
    if (this.frenzyOverlay) {
      this.frenzyOverlay.classList.remove("active");
    }
    if (this.frenzyScoreBanner) {
      this.frenzyScoreBanner.classList.remove("active");
    }
    this.stopFrenzyUIUpdate();
  }

  startFrenzyUIUpdate(duration) {
    this.stopFrenzyUIUpdate();
    const startTime = Date.now();

    const update = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      if (this.frenzyTimerEl) {
        this.frenzyTimerEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
      }
      if (remaining > 0 && this.frenzyOverlay?.classList.contains("active")) {
        this.frenzyUIAnimationFrame = requestAnimationFrame(update);
      }
    };

    this.frenzyUIAnimationFrame = requestAnimationFrame(update);
  }

  stopFrenzyUIUpdate() {
    if (this.frenzyUIAnimationFrame) {
      cancelAnimationFrame(this.frenzyUIAnimationFrame);
      this.frenzyUIAnimationFrame = null;
    }
    if (this.frenzyTimerEl) {
      this.frenzyTimerEl.textContent = "";
    }
  }

  deactivateFrenzyMode() {
    const effectData = this.activeEffects.get("frenzyMode");
    if (effectData?.timeoutId) {
      clearTimeout(effectData.timeoutId);
    }
    this.activeEffects.delete("frenzyMode");

    if (this.gameController?.playerController) {
      this.gameController.playerController.deactivateFrenzyMode();
    }

    if (effectData) {
      if ((State.scoreMultiplier || 1) <= 2) {
        State.scoreMultiplier = effectData.previousMultiplier || 1;
      }
    } else if ((State.scoreMultiplier || 1) <= 2) {
      State.scoreMultiplier = 1;
    }

    this.hideFrenzyOverlay();

    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("frenzy-active");
    }

    console.log("Frenzy Mode effect deactivated");
  }

  deactivateThunderStrike() {
    console.log("Deactivating Thunder Strike");

    // Deactivate thunder strike
    if (this.thunderStrike) {
      this.thunderStrike.deactivate();
      this.thunderStrike = null;
    }

    // Remove from active effects
    const effectData = this.activeEffects.get("thunderStrike");
    if (effectData && effectData.timeoutId) {
      clearTimeout(effectData.timeoutId);
    }
    this.activeEffects.delete("thunderStrike");

    console.log("Thunder Strike effect deactivated");
  }

  activatePrecisionMode(duration = 5000) {
    console.log(`Precision Mode activated for ${duration}ms`);
    
    // Check if game controller exists
    if (!this.gameController) {
      console.warn("GameController not available for Precision Mode effect");
      return;
    }

    // Activate slow-motion (0.5× speed for everything except player)
    State.slowMotionMultiplier = 0.5;
    State.precisionModeActive = true;

    // Create visual effects
    this.createPrecisionModeUI();

    // Lower sound pitch
    this.lowerSoundPitch(true);

    // Set timeout to deactivate
    const timeoutId = setTimeout(() => {
      this.deactivatePrecisionMode();
    }, duration);

    // Update active effects
    this.activeEffects.set("precisionMode", {
      startTime: Date.now(),
      duration: duration,
      timeoutId: timeoutId,
    });

    console.log("Precision Mode effect activated");
  }

  createPrecisionModeUI() {
    // Create screen edge darkening overlay
    let precisionOverlay = document.getElementById("precision-mode-overlay");
    if (!precisionOverlay) {
      precisionOverlay = document.createElement("div");
      precisionOverlay.id = "precision-mode-overlay";
      precisionOverlay.className = "precision-mode-overlay";
      document.body.appendChild(precisionOverlay);
    }

    // Show overlay
    precisionOverlay.classList.add("active");

    // Enable bullet trails
    if (this.gameController && this.gameController.playerController) {
      this.gameController.playerController.precisionModeTrails = true;
    }
    
    // Enable trails for alien bullets too
    if (this.gameController && this.gameController.alienFormation) {
      this.gameController.alienFormation.precisionModeTrails = true;
    }
  }

  lowerSoundPitch(lower = true) {
    // Lower pitch by adjusting playback rate (0.5× speed = lower pitch)
    const pitchMultiplier = lower ? 0.5 : 1.0;
    
    if (window.gameAssets && window.gameAssets.sounds) {
      const sounds = window.gameAssets.sounds;
      
      // Store original playback rates if not already stored
      if (!sounds._originalPlaybackRates) {
        sounds._originalPlaybackRates = {};
      }
      
      // Apply pitch change to all sounds
      for (const [soundName, sound] of Object.entries(sounds)) {
        if (sound && sound._sound) {
          // Babylon.js Sound wraps the native AudioBufferSourceNode
          const audioBufferSourceNode = sound._sound;
          
          if (lower && !sounds._originalPlaybackRates[soundName]) {
            sounds._originalPlaybackRates[soundName] = audioBufferSourceNode?.playbackRate?.value || 1.0;
          }
          
          try {
            // Try to set playbackRate on the underlying audio node
            if (audioBufferSourceNode && audioBufferSourceNode.playbackRate !== undefined) {
              if (audioBufferSourceNode.playbackRate.value !== undefined) {
                audioBufferSourceNode.playbackRate.value = pitchMultiplier;
              } else {
                audioBufferSourceNode.playbackRate = pitchMultiplier;
              }
            }
          } catch (e) {
            // If direct access fails, try using the Sound's playbackRate property
            if (sound.playbackRate !== undefined) {
              sound.playbackRate = pitchMultiplier;
            }
          }
        }
      }
    }
  }

  restoreSoundPitch() {
    // Restore original pitch
    if (window.gameAssets && window.gameAssets.sounds) {
      const sounds = window.gameAssets.sounds;
      
      if (sounds._originalPlaybackRates) {
        for (const [soundName, originalRate] of Object.entries(sounds._originalPlaybackRates)) {
          const sound = sounds[soundName];
          if (sound && sound._sound) {
            const audioBufferSourceNode = sound._sound;
            try {
              if (audioBufferSourceNode && audioBufferSourceNode.playbackRate !== undefined) {
                if (audioBufferSourceNode.playbackRate.value !== undefined) {
                  audioBufferSourceNode.playbackRate.value = originalRate;
                } else {
                  audioBufferSourceNode.playbackRate = originalRate;
                }
              }
            } catch (e) {
              if (sound.playbackRate !== undefined) {
                sound.playbackRate = originalRate;
              }
            }
          }
        }
        // Clear stored rates
        sounds._originalPlaybackRates = {};
      }
    }
  }

  deactivatePrecisionMode() {
    console.log("Deactivating Precision Mode");

    // Restore normal speed
    State.slowMotionMultiplier = 1;
    State.precisionModeActive = false;

    // Remove visual effects
    const precisionOverlay = document.getElementById("precision-mode-overlay");
    if (precisionOverlay) {
      precisionOverlay.classList.remove("active");
    }

    // Disable bullet trails
    if (this.gameController && this.gameController.playerController) {
      this.gameController.playerController.precisionModeTrails = false;
    }
    
    if (this.gameController && this.gameController.alienFormation) {
      this.gameController.alienFormation.precisionModeTrails = false;
    }

    // Restore sound pitch
    this.lowerSoundPitch(false);
    this.restoreSoundPitch();

    // Remove from active effects
    const effectData = this.activeEffects.get("precisionMode");
    if (effectData && effectData.timeoutId) {
      clearTimeout(effectData.timeoutId);
    }
    this.activeEffects.delete("precisionMode");

    console.log("Precision Mode effect deactivated");
  }

  dispose() {
    // Deactivate all active effects
    for (const [effectName, effectData] of this.activeEffects) {
      if (effectName === "overclock") {
        this.deactivateOverclock();
      } else if (effectName === "guardianShield") {
        this.deactivateGuardianShield();
      } else if (effectName === "thunderStrike") {
        this.deactivateThunderStrike();
      } else if (effectName === "precisionMode") {
        this.deactivatePrecisionMode();
      } else if (effectName === "rainDrop") {
        this.deactivateRainDropEffect();
      } else if (effectName === "frenzyMode") {
        this.deactivateFrenzyMode();
      }
    }

    this.activeEffects.clear();
    this.stopOverclockUIUpdate();
    this.stopShieldUIUpdate();
  }
}

