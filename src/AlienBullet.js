import {MeshBuilder, Vector3} from "@babylonjs/core";
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

    this.startBulletLoop();
  }

  startBulletLoop() {
    this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
      // Check if bullet was already blocked by shield before moving
      if (this.bullet.metadata && this.bullet.metadata.shieldBlocked) {
        this.destroyBullet();
        return;
      }

      let moveVector = this.bullet.calcMovePOV(0, this.bulletSpeed * State.delta, 0);
      this.bullet.moveWithCollisions(moveVector);
      if (this.bullet.position.y < this.minY) {
        this.destroyBullet();
      }
      if (this.bullet.collider && this.bullet.collider.collidedMesh) {
        this.handleCollision();
      }

    });
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
    this.bullet.dispose();
    this.disposed = true; // Tells our game loop to destroy this instance.
  }
}
