import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import State from "./State";

export class RainDropEffect {
  constructor(gameController, options = {}) {
    this.gameController = gameController;
    this.scene = gameController?.scene;
    this.duration = options.duration ?? 5000;
    this.pointValue = options.pointValue ?? 10;
    this.spawnIntervalMs = options.spawnInterval ?? 150;
    this.dropSpeed = options.dropSpeed ?? 0.9;
    this.collectRadius = options.collectRadius ?? 5;
    this.maxDrops = options.maxDrops ?? 80;
    this.drops = [];
    this.spawnTimer = null;
    this.updateObserver = null;
    this.endTimer = null;
    this.startTime = null;
    this.isActive = false;
    this.hiddenAliens = [];
    this.motherShipWasEnabled = false;
    this.onComplete = options.onComplete ?? null;
    this.banner = null;
    this.packageData = options.packageData;
  }

  start() {
    if (this.isActive || !this.scene || !this.gameController) {
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();
    State.rainDropActive = true;

    this.showBanner();
    this.pauseAlienThreats();
    this.spawnTimer = setInterval(() => this.spawnDrop(), this.spawnIntervalMs);
    this.updateObserver = this.scene.onBeforeRenderObservable.add(() => this.update());
    this.endTimer = setTimeout(() => this.stop(), this.duration);

    // Immediate visual flourish
    this.triggerUIBurst();
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }

    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }

    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }

    this.clearDrops();
    this.resumeAlienThreats();
    this.hideBanner();

    State.rainDropActive = false;

    if (typeof this.onComplete === "function") {
      this.onComplete();
    }
  }

  spawnDrop() {
    if (!this.scene || this.drops.length >= this.maxDrops) return;

    const spawnX = (Math.random() * 100) - 50; // Range -50 to 50
    const spawnY = 90 + Math.random() * 20;
    const spawnZ = 0;

    const points = this.pointValue + Math.floor(Math.random() * this.pointValue);
    const dropVisual = this.createDropVisual(spawnX, spawnY, spawnZ, points);
    if (!dropVisual) return;

    const dropData = {
      mesh: dropVisual.mesh,
      material: dropVisual.material,
      texture: dropVisual.texture,
      speed: this.dropSpeed + Math.random() * 0.5,
      points,
      collected: false,
    };

    this.drops.push(dropData);
  }

  update() {
    if (!this.isActive) return;

    const playerMesh = this.gameController?.playerController?.playerMesh;
    if (!playerMesh) return;

    const delta = State.delta;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (!drop.mesh || drop.mesh.isDisposed()) {
        this.drops.splice(i, 1);
        continue;
      }

      drop.mesh.position.y -= drop.speed * delta;
      drop.mesh.position.x += Math.sin(Date.now() / 150 + i) * 0.12 * delta; // gentle sway
      drop.mesh.rotation.z = Math.sin(Date.now() / 200) * 0.25;

      if (!drop.collected) {
        const distance = Vector3.Distance(drop.mesh.position, playerMesh.position);
        if (distance <= this.collectRadius) {
          drop.collected = true;
          this.collectPoints(drop);
          this.disposeDrop(drop, i);
          continue;
        }
      }

      if (drop.mesh.position.y < -15) {
        this.disposeDrop(drop, i);
      }
    }
  }

  collectPoints(drop) {
    const points = drop.points || this.pointValue;
    const awardedPoints = State.addScore(points);
    if (this.gameController?.gameGUI) {
      this.gameController.gameGUI.update();
    }

    if (window.boostEffects && typeof window.boostEffects.createPointsDrop === "function") {
      window.boostEffects.createPointsDrop(awardedPoints);
    }

    this.createCollectionBurst(drop.mesh.position.clone());
    this.showCollectionPopup(drop.mesh.position.clone(), awardedPoints);
  }

  disposeDrop(drop, index) {
    if (drop.mesh && !drop.mesh.isDisposed()) {
      drop.mesh.dispose();
    }
    if (drop.material) {
      drop.material.dispose();
    }
    if (drop.texture) {
      drop.texture.dispose();
    }
    this.drops.splice(index, 1);
  }

  clearDrops() {
    for (const drop of this.drops) {
      if (drop.mesh && !drop.mesh.isDisposed()) {
        drop.mesh.dispose();
      }
      if (drop.material) {
        drop.material.dispose();
      }
    }
    this.drops = [];
  }

  pauseAlienThreats() {
    const alienFormation = this.gameController?.alienFormation;
    if (!alienFormation) return;

    // Hide aliens visually
    this.hiddenAliens = [];
    for (const alien of alienFormation.aliens) {
      if (alien?.mesh && !alien.mesh.isDisposed()) {
        this.hiddenAliens.push(alien.mesh);
        alien.mesh.metadata = alien.mesh.metadata || {};
        alien.mesh.metadata._rainDropOriginalVisibility = alien.mesh.visibility;
        alien.mesh.visibility = 0;
      }
    }

    // Destroy existing alien bullets
    if (alienFormation.bullets?.length) {
      for (const bullet of alienFormation.bullets) {
        if (bullet?.destroyBullet) {
          bullet.destroyBullet();
        }
      }
      alienFormation.bullets.length = 0;
    }

    // Pause MotherShip
    if (alienFormation.motherShip) {
      this.motherShipWasEnabled = alienFormation.motherShip.enabled;
      alienFormation.motherShip.disable();
    }
  }

  resumeAlienThreats() {
    const alienFormation = this.gameController?.alienFormation;
    if (!alienFormation) return;

    for (const mesh of this.hiddenAliens) {
      if (mesh && !mesh.isDisposed()) {
        const originalVisibility = mesh.metadata?._rainDropOriginalVisibility ?? 1;
        mesh.visibility = originalVisibility;
      }
    }
    this.hiddenAliens = [];

    if (alienFormation.motherShip && this.motherShipWasEnabled) {
      alienFormation.motherShip.enable();
    }
  }

  triggerUIBurst() {
    if (window.boostEffects && typeof window.boostEffects.showPointsDropping === "function") {
      window.boostEffects.showPointsDropping(this.pointValue * 2, 18);
    }
  }

  showBanner() {
    if (typeof document === "undefined") return;

    this.banner = document.getElementById("rain-drop-banner");
    if (!this.banner) {
      this.banner = document.createElement("div");
      this.banner.id = "rain-drop-banner";
      this.banner.className = "rain-drop-banner";
      this.banner.innerHTML = `
        <div class="rain-drop-title">RAIN DROP BONUS!</div>
        <div class="rain-drop-subtitle">Collect the falling points for massive rewards</div>
        <div class="rain-drop-timer">5.0s</div>
      `;
      document.body.appendChild(this.banner);
    }

    this.banner.classList.add("active");
    this.startBannerTimer();
  }

  hideBanner() {
    if (this.banner) {
      this.banner.classList.remove("active");
    }
  }

  startBannerTimer() {
    if (!this.banner) return;
    const timerEl = this.banner.querySelector(".rain-drop-timer");
    if (!timerEl) return;

    const updateTimer = () => {
      if (!this.isActive) {
        timerEl.textContent = "0.0s";
        return;
      }
      const remainingMs = Math.max(0, this.duration - (Date.now() - this.startTime));
      timerEl.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
      if (this.isActive) {
        requestAnimationFrame(updateTimer);
      }
    };

    requestAnimationFrame(updateTimer);
  }

  createCollectionBurst(position) {
    if (!this.scene) return;

    const burstMesh = MeshBuilder.CreateSphere(`rainDropBurst_${Date.now()}`, {
      diameter: 0.5,
      segments: 4,
    }, this.scene);

    burstMesh.position = position.clone();
    burstMesh.isPickable = false;
    const burstMaterial = new StandardMaterial(`rainDropBurstMaterial_${Date.now()}`, this.scene);
    burstMaterial.emissiveColor = new Color3(1, 1, 1);
    burstMaterial.diffuseColor = new Color3(1, 1, 0.6);
    burstMaterial.alpha = 0.9;
    burstMesh.material = burstMaterial;

    const startTime = Date.now();
    const burstDuration = 300;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / burstDuration;
      burstMesh.scaling = new Vector3(1 + progress * 2, 1 + progress * 2, 1 + progress * 2);
      burstMaterial.alpha = Math.max(0, 0.9 * (1 - progress));
      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(observer);
        burstMesh.dispose();
        burstMaterial.dispose();
      }
    });
  }

  createDropVisual(x, y, z, points) {
    if (!this.scene) return null;

    const dropMesh = MeshBuilder.CreateDisc(`rainDropDisc_${Date.now()}_${Math.random()}`, {
      radius: 2.2,
      tessellation: 32,
      sideOrientation: Mesh.DOUBLESIDE,
    }, this.scene);

    dropMesh.position = new Vector3(x, y, z);
    dropMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    dropMesh.isPickable = false;
    dropMesh.renderingGroupId = 2;
    dropMesh.scaling = new Vector3(1.15, 1.15, 1.15);

    const baseTexture = new DynamicTexture(`rainDropBaseTexture_${Date.now()}`, { width: 512, height: 512 }, this.scene, false);
    const ctx = baseTexture.getContext();

    ctx.clearRect(0, 0, 512, 512);

    const gradient = ctx.createRadialGradient(256, 220, 60, 256, 256, 240);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.45, "rgba(135, 206, 250, 0.95)");
    gradient.addColorStop(0.75, "rgba(30, 144, 255, 0.95)");
    gradient.addColorStop(1, "rgba(0, 90, 200, 0.95)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 20;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(256, 256, 215, 0, Math.PI * 2);
    ctx.stroke();

    // Gloss highlight
    const highlightGradient = ctx.createRadialGradient(180, 180, 30, 200, 200, 150);
    highlightGradient.addColorStop(0, "rgba(255,255,255,0.85)");
    highlightGradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(210, 205, 160, 0, Math.PI * 2);
    ctx.fill();

    // Inner circle
    ctx.fillStyle = "rgba(0, 0, 40, 0.55)";
    ctx.beginPath();
    ctx.arc(256, 256, 150, 0, Math.PI * 2);
    ctx.fill();

    // Text label
    ctx.font = "bold 180px 'Press Start 2P', Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`+${points}`, 266, 265);

    ctx.font = "bold 180px 'Press Start 2P', Arial";
    ctx.fillStyle = "rgba(0, 255, 220, 0.9)";
    ctx.fillText(`+${points}`, 256, 255);

    baseTexture.update(false);

    const combinedMaterial = new StandardMaterial(`rainDropMaterial_${Date.now()}`, this.scene);
    combinedMaterial.diffuseTexture = baseTexture;
    combinedMaterial.opacityTexture = baseTexture;
    combinedMaterial.emissiveTexture = baseTexture;
    combinedMaterial.disableLighting = true;
    combinedMaterial.alpha = 0.9;
    dropMesh.material = combinedMaterial;

    return {
      mesh: dropMesh,
      material: combinedMaterial,
      texture: baseTexture,
    };
  }

  showCollectionPopup(position, points) {
    if (!this.scene) return;

    const popupMesh = MeshBuilder.CreatePlane(`rainDropPopup_${Date.now()}`, {
      size: 6,
    }, this.scene);

    popupMesh.position = position.add(new Vector3(0, 2, 0));
    popupMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    popupMesh.isPickable = false;
    popupMesh.renderingGroupId = 2;

    const popupTexture = new DynamicTexture(`rainDropPopupTexture_${Date.now()}`, { width: 512, height: 512 }, this.scene, false);
    const ctx = popupTexture.getContext();

    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.arc(256, 256, 186, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "bold 160px 'Press Start 2P', Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#00ffcc";
    ctx.fillText(`+${points}`, 256, 256);

    popupTexture.update(false);

    const popupMaterial = new StandardMaterial(`rainDropPopupMaterial_${Date.now()}`, this.scene);
    popupMaterial.diffuseTexture = popupTexture;
    popupMaterial.opacityTexture = popupTexture;
    popupMaterial.emissiveTexture = popupTexture;
    popupMaterial.disableLighting = true;
    popupMesh.material = popupMaterial;

    const startTime = Date.now();
    const popupDuration = 600;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / popupDuration;
      popupMesh.position.y += 0.03 * State.delta;
      popupMaterial.alpha = Math.max(0, 1 - progress);
      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(observer);
        popupMesh.dispose();
        popupMaterial.dispose();
        popupTexture.dispose();
      }
    });
  }
}

