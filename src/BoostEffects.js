import State from "./State";

export class BoostEffects {
  constructor(gameController = null) {
    this.gameController = gameController;
    this.initElements();
  }

  initElements() {
    this.boostNotification = document.getElementById("boost-notification");
    this.boostAmountEl = document.querySelector(".boost-notification-amount");
    this.boostNameEl = document.querySelector(".boost-notification-name");
    this.pointsDropContainer = document.getElementById("points-drop-container");
    this.specialMoveOverlay = document.getElementById("special-move-overlay");
    this.specialMoveEffect = document.querySelector(".special-move-effect");
  }

  showBoostNotification(amount, name) {
    if (!this.boostNotification || !this.boostAmountEl || !this.boostNameEl) {
      return;
    }

    // Remove existing classes
    this.boostNotification.classList.remove("boost-large", "boost-mega", "active");

    // Determine boost size class
    if (amount > 100) {
      this.boostNotification.classList.add("boost-mega");
    } else if (amount > 50) {
      this.boostNotification.classList.add("boost-large");
    }

    // Update content
    this.boostAmountEl.textContent = `+${amount}`;
    this.boostNameEl.textContent = `from ${name}`;

    // Show notification
    this.boostNotification.classList.add("active");

    // Hide after animation completes
    setTimeout(() => {
      this.boostNotification.classList.remove("active", "boost-large", "boost-mega");
    }, 3000);
  }

  createPointsDrop(amount, x = null, isLarge = false) {
    if (!this.pointsDropContainer) return;

    const dropItem = document.createElement("div");
    dropItem.className = `points-drop-item ${isLarge ? "large" : ""}`;
    dropItem.textContent = `+${amount}`;

    // Random X position if not specified
    const xPosition = x !== null ? x : Math.random() * window.innerWidth;
    dropItem.style.left = `${xPosition}px`;
    dropItem.style.top = "0px";

    this.pointsDropContainer.appendChild(dropItem);

    // Remove after animation
    setTimeout(() => {
      if (dropItem.parentNode) {
        dropItem.parentNode.removeChild(dropItem);
      }
    }, isLarge ? 4000 : 3000);
  }

  showPointsDropping(amount, count = 10) {
    // Create multiple point drops for visual effect
    for (let i = 0; i < count; i++) {
      const delay = i * 100; // Stagger the drops
      const x = (window.innerWidth / count) * i + Math.random() * 50;
      const isLarge = amount > 100;

      setTimeout(() => {
        this.createPointsDrop(amount, x, isLarge);
      }, delay);
    }
  }

  showSpecialMove(amount) {
    if (!this.specialMoveOverlay || !this.specialMoveEffect) return;

    // Update effect text
    if (amount > 200) {
      this.specialMoveEffect.textContent = "ULTRA MEGA BOOST!";
    } else if (amount > 150) {
      this.specialMoveEffect.textContent = "MEGA BOOST!";
    } else {
      this.specialMoveEffect.textContent = "SPECIAL BOOST!";
    }

    // Show overlay
    this.specialMoveOverlay.classList.add("active");

    // Create particle effects
    this.createParticleEffects();

    // Hide after 2 seconds
    setTimeout(() => {
      this.specialMoveOverlay.classList.remove("active");
    }, 2000);
  }

  createParticleEffects() {
    if (!this.specialMoveOverlay) return;

    const particlesContainer = document.querySelector(".special-move-particles");
    if (!particlesContainer) return;

    // Clear existing particles
    particlesContainer.innerHTML = "";

    // Create multiple particles in a circle pattern
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.style.position = "absolute";
      particle.style.width = "8px";
      particle.style.height = "8px";
      const colors = ["#f0f", "#ff0", "#0ff", "#f00", "#0f0"];
      const color = colors[i % colors.length];
      particle.style.background = color;
      particle.style.borderRadius = "50%";
      particle.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
      particle.style.left = "50%";
      particle.style.top = "50%";
      particle.style.transform = "translate(-50%, -50%)";

      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 80 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      // Create a simple fade and move animation using CSS
      particle.style.animation = `particleMove 2s ease-out forwards`;
      particle.style.animationDelay = `${(i % 10) * 0.05}s`;
      particle.style.setProperty("--move-x", `${dx}px`);
      particle.style.setProperty("--move-y", `${dy}px`);

      particlesContainer.appendChild(particle);

      // Remove after animation
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 2000 + (i % 10) * 50);
    }
  }

  handleBoost(amount, name, data = null) {
    // Add points to game score
    if (this.gameController) {
      // Check if game is in progress (GAMELOOP state)
      if (State.state === "GAMELOOP" || State.state === "STARTGAME" || State.state === "NEXTLEVEL") {
        const awarded = State.addScore(amount);
        // Update GUI if it exists
        if (this.gameController.gameGUI) {
          this.gameController.gameGUI.update();
        }
        console.log(`Added ${awarded} points to score. New score: ${State.score}`);
      } else {
        // Even if game isn't started, we can still show the effects
        console.log(`Boost received: ${amount} from ${name} (Game not started yet)`);
      }
    }

    // Show boost notification
    this.showBoostNotification(amount, name);

    // Handle different boost amounts
    if (amount === 25) {
      // 25 points: Simple effect
      this.createPointsDrop(amount, window.innerWidth / 2);
      this.playBoostSound("small");
    } else if (amount === 50) {
      // 50 points: Medium effect
      this.createPointsDrop(amount, window.innerWidth / 2);
      this.playBoostSound("medium");
    } else if (amount > 50 && amount <= 100) {
      // 50-100 points: Large effect with multiple drops
      this.showPointsDropping(amount, 15);
      this.playBoostSound("large");
    } else if (amount > 100) {
      // >100 points: Special move with overlay
      this.showSpecialMove(amount);
      this.showPointsDropping(amount, 20);
      this.playBoostSound("mega");
    } else {
      // Small boosts: Just notification
      this.createPointsDrop(amount, window.innerWidth / 2);
      this.playBoostSound("small");
    }
  }

  playBoostSound(type) {
    // Play sound effects if available
    if (window.gameAssets && window.gameAssets.sounds) {
      try {
        // Use existing game sounds or create new ones
        if (type === "mega" && window.gameAssets.sounds.clearLevel) {
          window.gameAssets.sounds.clearLevel.play();
        } else if (type === "large" && window.gameAssets.sounds.levelStart) {
          window.gameAssets.sounds.levelStart.play();
        } else if (window.gameAssets.sounds.alienExplosion) {
          window.gameAssets.sounds.alienExplosion.play();
        }
      } catch (error) {
        console.warn("Could not play boost sound:", error);
      }
    }
  }

  // Add visual screen effects for boosts
  addScreenEffect(type) {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    // Add flash effect
    const flash = document.createElement("div");
    flash.style.position = "fixed";
    flash.style.top = "0";
    flash.style.left = "0";
    flash.style.width = "100%";
    flash.style.height = "100%";
    flash.style.pointerEvents = "none";
    flash.style.zIndex = "1300";
    flash.style.background = type === "mega" ? "rgba(255, 0, 255, 0.3)" : "rgba(0, 255, 0, 0.2)";
    flash.style.animation = "fadeOut 0.5s ease-out forwards";

    document.body.appendChild(flash);

    setTimeout(() => {
      if (flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
    }, 500);
  }
}

// Add fadeOut animation if not exists
if (!document.getElementById("fadeOutKeyframes")) {
  const style = document.createElement("style");
  style.id = "fadeOutKeyframes";
  style.textContent = `
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

