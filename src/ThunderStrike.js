import { MeshBuilder, Vector3, StandardMaterial, Color3 } from "@babylonjs/core";
import { Explosion } from "./Explosion";
import State from "./State";

export class ThunderStrike {
  constructor(scene, gameAssets, alienFormation, playerController, duration = 3000) {
    this.scene = scene;
    this.gameAssets = gameAssets;
    this.alienFormation = alienFormation;
    this.playerController = playerController;
    this.duration = duration;
    this.startTime = Date.now();
    this.isActive = true;
    this.lightningBolts = [];
    
    // Create screen flicker overlay
    this.createScreenFlicker();
    
    // Activate thunder bullet mode in player controller
    this.activateThunderBullets();
    
    // Create background thunder effects
    this.startBackgroundThunder();
    
    // Set timeout to deactivate
    this.timeoutId = setTimeout(() => {
      this.deactivate();
    }, duration);
  }

  createScreenFlicker() {
    // Get or create flicker overlay
    this.flickerOverlay = document.getElementById("thunder-flicker-overlay");
    if (!this.flickerOverlay) {
      this.flickerOverlay = document.createElement("div");
      this.flickerOverlay.id = "thunder-flicker-overlay";
      this.flickerOverlay.className = "thunder-flicker-overlay";
      document.body.appendChild(this.flickerOverlay);
    }
  }

  activateThunderBullets() {
    console.log("Thunder Strike activated - Thunder bullets enabled!");
    
    // Initial screen flash
    this.flashScreen();
    
    // Activate thunder bullet mode in player controller
    if (this.playerController) {
      this.playerController.activateThunderStrike(this.duration);
    }
  }

  startBackgroundThunder() {
    // Create random background lightning flashes
    this.backgroundThunderInterval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(this.backgroundThunderInterval);
        return;
      }
      
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.duration) {
        this.deactivate();
        return;
      }
      
      // Random background lightning flash
      if (Math.random() < 0.6) {
        this.createBackgroundLightningFlash();
      }
      
      // Random screen flicker
      if (Math.random() < 0.4) {
        this.flashScreen();
      }
    }, 400 + Math.random() * 600); // Every 400-1000ms
  }

  createBackgroundLightningFlash() {
    // Create a random vertical lightning flash in the background
    const flashX = (Math.random() - 0.5) * 80; // Random X position
    const flashHeight = 60 + Math.random() * 40;
    const flashY = 30 + Math.random() * 40; // Upper area
    
    const flash = MeshBuilder.CreateBox(`backgroundThunder_${Date.now()}`, {
      width: 0.3 + Math.random() * 0.4,
      height: flashHeight,
      depth: 0.05
    }, this.scene);

    flash.position.x = flashX;
    flash.position.y = flashY;
    flash.position.z = -10; // Far background

    const flashMaterial = new StandardMaterial(`backgroundThunderMaterial_${Date.now()}`, this.scene);
    flashMaterial.emissiveColor = new Color3(0.8, 0.9, 1);
    flashMaterial.alpha = 0.5;
    flash.material = flashMaterial;
    flash.renderingGroupId = 0;

    // Fade out quickly
    setTimeout(() => {
      if (flash && !flash.isDisposed) {
        const fadeInterval = setInterval(() => {
          if (flashMaterial.alpha > 0) {
            flashMaterial.alpha -= 0.15;
          } else {
            clearInterval(fadeInterval);
            if (flash && !flash.isDisposed) {
              flash.dispose();
            }
          }
        }, 20);
      }
    }, 80);
  }


  flashScreen() {
    if (!this.flickerOverlay) return;
    
    // Add flash class
    this.flickerOverlay.classList.add("active");
    
    // Remove after short duration
    setTimeout(() => {
      if (this.flickerOverlay) {
        this.flickerOverlay.classList.remove("active");
      }
    }, 50 + Math.random() * 50); // 50-100ms flash
  }

  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;

    // Deactivate thunder bullets in player controller
    if (this.playerController) {
      this.playerController.deactivateThunderStrike();
    }

    // Clear background thunder interval
    if (this.backgroundThunderInterval) {
      clearInterval(this.backgroundThunderInterval);
      this.backgroundThunderInterval = null;
    }

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Clean up lightning bolts
    for (const bolt of this.lightningBolts) {
      if (bolt.mesh && !bolt.mesh.isDisposed) {
        bolt.mesh.dispose();
      }
    }
    this.lightningBolts = [];

    // Don't remove screen flicker overlay (it's shared and should stay in DOM)
    // Just ensure it's not active
    if (this.flickerOverlay) {
      this.flickerOverlay.classList.remove("active");
    }

    console.log("Thunder Strike deactivated");
  }

  dispose() {
    this.deactivate();
  }
}

