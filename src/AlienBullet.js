import {MeshBuilder, Vector3, StandardMaterial, Color3} from "@babylonjs/core";
import State from "./State";

export class AlienBullet {

  constructor(scene, playerMesh) {
    this.scene = scene;
    this.minY = -30;
    this.offset = -2;
    this.bulletSpeed = -0.5;
    this.bullet = new MeshBuilder.CreateBox("bullet", {
      width: 0.5,
      height: 3,
      depth: 1
    }, this.scene);
    this.bullet.position = new Vector3(
      playerMesh.position.x,
      playerMesh.position.y + this.offset,
      playerMesh.position.z
    );
    let bulletArc = Math.PI/6;
    this.bullet.rotate(new Vector3(0, 0, 1), (Math.random() * bulletArc) - bulletArc/2);
    this.bullet.checkCollisions = true;
    this.bullet.collisionGroup = 8;
    this.bullet.collisionMask = 49; // Can collide with player (1), barriers (16), and shield (32) = 1 + 16 + 32 = 49
    this.bullet.metadata = { type: "alienbullet" };

    // Trail particles for Precision Mode
    this.trailParticles = [];
    this.lastTrailTime = 0;
    this.trailInterval = 50; // Create trail particle every 50ms

    this.startBulletLoop();
  }

  startBulletLoop() {
    this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
      // Check if bullet was already blocked by shield before moving
      if (this.bullet.metadata && this.bullet.metadata.shieldBlocked) {
        this.destroyBullet();
        return;
      }

      // Apply slow-motion multiplier (affects alien bullets but not player movement)
      const effectiveDelta = State.delta * (State.slowMotionMultiplier || 1);
      let moveVector = this.bullet.calcMovePOV(0, this.bulletSpeed * effectiveDelta, 0);
      this.bullet.moveWithCollisions(moveVector);
      
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
      
      if (this.bullet.position.y < this.minY) {
        this.destroyBullet();
      }
      if (this.bullet.collider && this.bullet.collider.collidedMesh) {
        this.handleCollision();
      }

    });
  }

  createTrailParticle() {
    if (!this.bullet || this.bullet.isDisposed) return;
    
    const trail = MeshBuilder.CreateSphere(`alienBulletTrail_${Date.now()}_${Math.random()}`, {
      diameter: 0.3,
      segments: 4
    }, this.scene);
    
    trail.position = this.bullet.position.clone();
    
    // Create glowing material for trail (reddish for alien bullets)
    const trailMaterial = new StandardMaterial(`alienTrailMaterial_${Date.now()}`, this.scene);
    trailMaterial.emissiveColor = new Color3(1, 0.6, 0.6); // Light red/pink
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
    const collidedMesh = this.bullet.collider.collidedMesh;
    if (!collidedMesh || !collidedMesh.metadata) {
      return;
    }

    // Check if bullet was already blocked by shield
    if (this.bullet.metadata && this.bullet.metadata.shieldBlocked) {
      // Bullet was blocked by shield, don't process collision with player
      this.destroyBullet();
      return;
    }

    let collidedWithType = collidedMesh.metadata.type;
    
    // Check for guardian shield first (shouldn't happen if shield is working, but safety check)
    if (collidedWithType === "guardianShield") {
      const shield = collidedMesh.metadata.shield;
      if (shield && shield.isActive) {
        shield.blockBullet(this.bullet);
        this.destroyBullet();
        return;
      }
    }
    
    // Only hit player if shield didn't block it AND player is not protected by shield
    if (collidedWithType === "player") {
      // Check if player is protected by shield
      if (collidedMesh.metadata.shieldProtected) {
        // Player is protected by shield, don't damage
        this.destroyBullet();
        return;
      }
      
      // Double check that bullet wasn't blocked by shield
      if (!this.bullet.metadata || !this.bullet.metadata.shieldBlocked) {
        this.bullet.collider.collidedMesh.dispose(); // perform action with player meshes onDispose event.
        this.destroyBullet();
      }
    }
    if (collidedWithType === "barrier") {
      this.bullet.collider.collidedMesh.dispose();
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
