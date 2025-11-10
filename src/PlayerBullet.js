import {Axis, Color3, MeshBuilder, Scalar, Space, Vector3, StandardMaterial} from "@babylonjs/core";
import spaceinvadersConfig from "../spaceinvaders.config";
import {Explosion} from "./Explosion";
import State from "./State";

export class PlayerBullet {

  constructor(gameAssets, scene, playerMesh, xOffset = 0, isOverclock = false) {
    this.scene = scene;
    this.gameAssets = gameAssets;
    this.isOverclock = isOverclock;
    this.maxY = 120;
    if (spaceinvadersConfig.actionCam) {
      this.maxY = 400;
    }
    this.offset = 2;
    this.bulletSpeed = 1.25;
    this.bullet = new MeshBuilder.CreateBox("bullet", {
      width: 0.5,
      height: 4,
      depth: 1
    }, this.scene);
    this.bullet.position = new Vector3(
      playerMesh.position.x + xOffset,
      playerMesh.position.y + this.offset,
      playerMesh.position.z
    );
    this.bullet.metadata = {"type": "playerbullet"};
    this.bullet.collisionGroup = 4;
    this.bullet.collisionMask = 18;
    
    // Trail particles for Precision Mode
    this.trailParticles = [];
    this.lastTrailTime = 0;
    this.trailInterval = 50; // Create trail particle every 50ms
    
    // Apply Overclock visual effect (cyan glow)
    if (isOverclock) {
      this.applyOverclockEffect();
    }
    
    this.startBulletLoop();
  }

  applyOverclockEffect() {
    // Create cyan material for Overclock bullets
    if (!this.scene.overclockMaterial) {
      this.scene.overclockMaterial = new StandardMaterial("overclockMaterial", this.scene);
      this.scene.overclockMaterial.emissiveColor = new Color3(0, 1, 1); // Cyan
      this.scene.overclockMaterial.diffuseColor = new Color3(0, 0.8, 1);
      this.scene.overclockMaterial.specularColor = new Color3(0, 1, 1);
    }
    
    // Apply material to bullet
    this.bullet.material = this.scene.overclockMaterial;
  }

  startBulletLoop() {
    this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
      // Apply slow-motion multiplier to player bullets (but player movement/fire is unaffected)
      const effectiveDelta = State.delta * (State.slowMotionMultiplier || 1);
      this.bullet.moveWithCollisions(new Vector3(0, this.bulletSpeed * effectiveDelta, 0))
      
      // Create trail particles during Precision Mode
      if (State.precisionModeActive) {
        const currentTime = Date.now();
        if (currentTime - this.lastTrailTime >= this.trailInterval) {
          this.createTrailParticle();
          this.lastTrailTime = currentTime;
        }
      }
      
      // Update and cleanup trail particles
      this.updateTrailParticles();
      
      if (this.bullet.position.y > this.maxY) {
        this.destroyBullet();
      }
      if (this.bullet.collider.collidedMesh) {
        this.handleCollision();
      }
      this.bullet.checkCollisions = true;
    });
  }

  createTrailParticle() {
    if (!this.bullet || this.bullet.isDisposed) return;
    
    const trail = MeshBuilder.CreateSphere(`bulletTrail_${Date.now()}_${Math.random()}`, {
      diameter: 0.3,
      segments: 4
    }, this.scene);
    
    trail.position = this.bullet.position.clone();
    
    // Create glowing material for trail
    const trailMaterial = new StandardMaterial(`trailMaterial_${Date.now()}`, this.scene);
    trailMaterial.emissiveColor = new Color3(0.8, 0.9, 1); // Light blue/cyan
    trailMaterial.alpha = 0.7;
    trail.material = trailMaterial;
    trail.renderingGroupId = 2;
    
    this.trailParticles.push({
      mesh: trail,
      material: trailMaterial,
      startTime: Date.now(),
      duration: 300, // Fade out over 300ms
      startPosition: this.bullet.position.clone()
    });
  }

  updateTrailParticles() {
    const currentTime = Date.now();
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const trail = this.trailParticles[i];
      if (!trail.mesh || trail.mesh.isDisposed) {
        this.trailParticles.splice(i, 1);
        continue;
      }
      
      const elapsed = currentTime - trail.startTime;
      const progress = elapsed / trail.duration;
      
      if (progress >= 1) {
        trail.mesh.dispose();
        this.trailParticles.splice(i, 1);
      } else {
        // Fade out and shrink
        trail.material.alpha = 0.7 * (1 - progress);
        trail.mesh.scaling.scaleInPlace(1 - progress * 0.5);
      }
    }
  }

  handleCollision() {
    let collidedWithType = (this.bullet.collider.collidedMesh.metadata).type;

    // If the collidedMesh has lives, destroy the bullet and subtract a life and exit the function
    if (this.bullet.collider.collidedMesh.metadata?.lives > 0) {
      this.bullet.collider.collidedMesh.metadata.lives -= 1;

      if (spaceinvadersConfig.oldSchoolEffects.enabled) {
        if (this.bullet.collider.collidedMesh.metadata.type ==="mothership"){
          this.bullet.collider.collidedMesh.rotate(Axis.Z, Scalar.RandomRange(-0.25, 0.25), Space.WORLD);

        }else {
          this.bullet.collider.collidedMesh.rotate(Axis.Z, Scalar.RandomRange(-0.25, 0.25), Space.LOCAL);
        }
      } else {
        this.bullet.collider.collidedMesh.rotate(Axis.X, Scalar.RandomRange(-0.3, 0.3), Space.LOCAL);
      }
      new Explosion(this.bullet, 10, 1, this.scene);
      this.destroyBullet();
      this.gameAssets.sounds.alienExplosion.play(0, 0.15, 1);
      return;
    }

    // No lives left so destroy the collidedMesh.
    if (collidedWithType === "alien") {
      this.bullet.collider.collidedMesh.dispose(); // perform action with meshes onDispose event.
      this.destroyBullet();
    }
    if (collidedWithType === "barrier") {
      this.bullet.collider.collidedMesh.dispose(); // perform action with meshes onDispose event.
      this.destroyBullet();
    }
    if (collidedWithType === "mothership") {
      this.bullet.collider.collidedMesh.dispose(); // perform action with meshes onDispose event.
      this.destroyBullet();
    }
  }

  destroyBullet() {
    this.scene.onBeforeRenderObservable.remove(this.bulletObserver);
    
    // Clean up trail particles
    for (const trail of this.trailParticles) {
      if (trail.mesh && !trail.mesh.isDisposed) {
        trail.mesh.dispose();
      }
    }
    this.trailParticles = [];
    
    this.bullet.dispose();
    this.disposed = true; // Tells our game loop to destroy this instance.
  }
}
