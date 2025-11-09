import {Axis, Color3, MeshBuilder, Scalar, Space, Vector3, StandardMaterial} from "@babylonjs/core";
import spaceinvadersConfig from "../spaceinvaders.config";
import {Explosion} from "./Explosion";
import State from "./State";

export class ThunderBullet {
  constructor(gameAssets, scene, playerMesh, alienFormation, xOffset = 0) {
    this.scene = scene;
    this.gameAssets = gameAssets;
    this.alienFormation = alienFormation;
    this.maxY = 120;
    if (spaceinvadersConfig.actionCam) {
      this.maxY = 400;
    }
    this.offset = 2;
    this.bulletSpeed = 1.25;
    this.startX = playerMesh.position.x + xOffset;
    this.columnDestroyed = false; // Flag to prevent multiple column destructions
    
    // Create thunder bullet with lightning effects
    this.createThunderBullet();
    
    this.bullet.position = new Vector3(
      this.startX,
      playerMesh.position.y + this.offset,
      playerMesh.position.z
    );
    this.bullet.metadata = {
      type: "thunderbullet",
      startX: this.startX
    };
    this.bullet.collisionGroup = 4;
    this.bullet.collisionMask = 18;
    
    // Create lightning trail effect
    this.createLightningTrail();
    
    // Create background thunder effects
    this.createBackgroundThunder();
    
    this.startBulletLoop();
  }

  createThunderBullet() {
    // Create a more elongated bullet with jagged edges for thunder effect
    this.bullet = MeshBuilder.CreateBox("thunderBullet", {
      width: 0.6,
      height: 6,
      depth: 1
    }, this.scene);

    // Create bright white/cyan lightning material
    const thunderMaterial = new StandardMaterial("thunderBulletMaterial", this.scene);
    thunderMaterial.emissiveColor = new Color3(1, 1, 1); // Bright white
    thunderMaterial.diffuseColor = new Color3(0.7, 0.85, 1); // Cyan tint
    thunderMaterial.specularColor = new Color3(1, 1, 1);
    thunderMaterial.alpha = 0.95;
    this.bullet.material = thunderMaterial;
    this.bullet.renderingGroupId = 1; // Render on top
    
    // Add pulsing glow effect
    this.startPulseEffect();
  }

  startPulseEffect() {
    // Pulse the bullet's emissive color
    this.pulseInterval = setInterval(() => {
      if (this.bullet && this.bullet.material && !this.bullet.isDisposed) {
        const time = Date.now() / 100;
        const pulse = Math.sin(time) * 0.3 + 0.7; // Pulse between 0.7 and 1.0
        this.bullet.material.emissiveColor = new Color3(pulse, pulse, 1);
      } else {
        clearInterval(this.pulseInterval);
      }
    }, 50);
  }

  createLightningTrail() {
    // Create lightning particles that follow the bullet
    this.lightningParticles = [];
    this.particleCount = 0;
    this.maxParticles = 5; // Limit particles to prevent performance issues
    this.particleInterval = setInterval(() => {
      if (this.bullet && !this.bullet.isDisposed && this.particleCount < this.maxParticles) {
        this.spawnLightningParticle();
        this.particleCount++;
      } else {
        if (this.particleInterval) {
          clearInterval(this.particleInterval);
          this.particleInterval = null;
        }
      }
    }, 150); // Spawn particle every 150ms (reduced frequency)
  }

  spawnLightningParticle() {
    // Create small lightning particle
    const particle = MeshBuilder.CreateSphere(`lightningParticle_${Date.now()}`, {
      diameter: 0.3 + Math.random() * 0.2,
      segments: 4
    }, this.scene);

    // Position near bullet with random offset
    if (!this.bullet || this.bullet.isDisposed) return;
    
    particle.position.x = this.bullet.position.x + (Math.random() - 0.5) * 1;
    particle.position.y = this.bullet.position.y + (Math.random() - 0.5) * 2;
    particle.position.z = this.bullet.position.z;

    const particleMaterial = new StandardMaterial(`lightningParticleMaterial_${Date.now()}`, this.scene);
    particleMaterial.emissiveColor = new Color3(
      0.8 + Math.random() * 0.2,
      0.9 + Math.random() * 0.1,
      1
    );
    particleMaterial.alpha = 0.8;
    particle.material = particleMaterial;
    particle.renderingGroupId = 1;

    this.lightningParticles.push({
      mesh: particle,
      startTime: Date.now(),
      duration: 200 + Math.random() * 100
    });

    // Fade out and dispose
    setTimeout(() => {
      if (particle && !particle.isDisposed) {
        const fadeInterval = setInterval(() => {
          if (particleMaterial && particleMaterial.alpha > 0) {
            particleMaterial.alpha -= 0.1;
          } else {
            clearInterval(fadeInterval);
            if (particle && !particle.isDisposed) {
              particle.dispose();
            }
            const index = this.lightningParticles.findIndex(p => p.mesh === particle);
            if (index !== -1) {
              this.lightningParticles.splice(index, 1);
              this.particleCount = Math.max(0, this.particleCount - 1);
            }
          }
        }, 30);
      }
    }, 100);
  }

  createBackgroundThunder() {
    // Create background lightning flashes that appear randomly
    this.backgroundFlashCount = 0;
    this.maxBackgroundFlashes = 3; // Limit background flashes
    this.thunderFlashInterval = setInterval(() => {
      if (this.bullet && !this.bullet.isDisposed && this.backgroundFlashCount < this.maxBackgroundFlashes) {
        this.createBackgroundLightning();
        this.backgroundFlashCount++;
      } else {
        if (this.thunderFlashInterval) {
          clearInterval(this.thunderFlashInterval);
          this.thunderFlashInterval = null;
        }
      }
    }, 500 + Math.random() * 500); // Every 500-1000ms (reduced frequency)
  }

  createBackgroundLightning() {
    // Create a vertical lightning flash in the background
    const flashX = this.bullet.position.x + (Math.random() - 0.5) * 40;
    const flashHeight = 50 + Math.random() * 30;
    
    const flash = MeshBuilder.CreateBox("backgroundThunder", {
      width: 0.2 + Math.random() * 0.3,
      height: flashHeight,
      depth: 0.05
    }, this.scene);

    flash.position.x = flashX;
    flash.position.y = this.bullet.position.y + flashHeight / 2;
    flash.position.z = this.bullet.position.z - 5; // Behind bullet

    const flashMaterial = new StandardMaterial("backgroundThunderMaterial", this.scene);
    flashMaterial.emissiveColor = new Color3(0.9, 0.95, 1);
    flashMaterial.alpha = 0.6;
    flash.material = flashMaterial;
    flash.renderingGroupId = 0; // Background

    // Fade out quickly
    setTimeout(() => {
      if (flash && !flash.isDisposed) {
        const fadeInterval = setInterval(() => {
          if (flashMaterial.alpha > 0) {
            flashMaterial.alpha -= 0.2;
          } else {
            clearInterval(fadeInterval);
            if (flash && !flash.isDisposed) {
              flash.dispose();
            }
          }
        }, 20);
      }
    }, 50);
  }

  startBulletLoop() {
    this.bulletObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.disposed || !this.bullet || this.bullet.isDisposed) {
        return;
      }

      try {
        this.bullet.moveWithCollisions(new Vector3(0, this.bulletSpeed * State.delta, 0));
        if (this.bullet.position.y > this.maxY) {
          this.destroyBullet();
          return;
        }
        if (this.bullet.collider && this.bullet.collider.collidedMesh && !this.columnDestroyed) {
          this.handleCollision();
        }
        this.bullet.checkCollisions = true;
      } catch (e) {
        console.warn("Error in thunder bullet loop:", e);
        this.destroyBullet();
      }
    });
  }

  handleCollision() {
    // Prevent multiple collision handling
    if (this.columnDestroyed || this.disposed) {
      return;
    }

    const collidedMesh = this.bullet.collider.collidedMesh;
    if (!collidedMesh || !collidedMesh.metadata) {
      return;
    }

    let collidedWithType = collidedMesh.metadata.type;

    // If the collidedMesh has lives, destroy the bullet and subtract a life
    if (collidedMesh.metadata?.lives > 0) {
      collidedMesh.metadata.lives -= 1;
      try {
        new Explosion(this.bullet, 10, 1, this.scene);
      } catch (e) {
        console.warn("Error creating explosion:", e);
      }
      this.destroyBullet();
      if (this.gameAssets && this.gameAssets.sounds && this.gameAssets.sounds.alienExplosion) {
        this.gameAssets.sounds.alienExplosion.play(0, 0.15, 1);
      }
      return;
    }

    // Handle alien collision - destroy entire vertical column
    if (collidedWithType === "alien") {
      this.destroyVerticalColumn(collidedMesh);
      // Don't destroy bullet immediately - let it continue briefly for visual effect
      setTimeout(() => {
        this.destroyBullet();
      }, 100);
      return;
    }

    // Handle other collisions normally
    if (collidedWithType === "barrier") {
      collidedMesh.dispose();
      this.destroyBullet();
    }
    if (collidedWithType === "mothership") {
      collidedMesh.dispose();
      this.destroyBullet();
    }
  }

  destroyVerticalColumn(hitAlienMesh) {
    if (!this.alienFormation || !this.alienFormation.aliens) {
      return;
    }

    // Prevent multiple column destructions from the same bullet
    if (this.columnDestroyed) {
      return;
    }
    this.columnDestroyed = true;

    // Get the X position of the hit alien (column position)
    const hitX = hitAlienMesh.position.x;
    
    // Calculate column tolerance based on formation spacing
    // Aliens in the same column should have similar X positions
    const spacing = this.alienFormation.levelParams?.spacing?.x || 9;
    const columnTolerance = spacing * 0.4; // 40% of spacing for tolerance (accounts for movement)

    // Find all aliens in the same column (same X position within tolerance)
    const columnAliens = this.alienFormation.aliens.filter(alien => {
      if (!alien || !alien.mesh || alien.mesh.isDisposed) return false;
      
      const alienX = alien.mesh.position.x;
      const distance = Math.abs(alienX - hitX);
      
      // Match aliens in the same vertical column
      return distance <= columnTolerance;
    });

    console.log(`Thunder Strike destroying ${columnAliens.length} enemies in column at X=${hitX.toFixed(2)}`);

    // Create massive lightning effect at hit point
    this.createColumnLightning(hitX);

    // Destroy all aliens in the column with bonus points
    // Use requestAnimationFrame for smoother performance instead of many setTimeout calls
    let destroyedCount = 0;
    const destroyNext = () => {
      if (destroyedCount >= columnAliens.length) {
        // All enemies destroyed, update score
        if (this.gameController && this.gameController.gameGUI) {
          this.gameController.gameGUI.update();
        }
        return;
      }

      const alien = columnAliens[destroyedCount];
      if (alien && alien.mesh && !alien.mesh.isDisposed) {
        // Double points for thunder strike
        const originalScore = alien.mesh.metadata?.scoreValue || 10;
        alien.mesh.metadata.scoreValue = originalScore * 2;
        
        // Create electric explosion
        this.createElectricExplosion(alien.mesh);
        
        // Destroy the alien
        alien.mesh.dispose();
        destroyedCount++;
        
        // Continue with next enemy after short delay
        if (destroyedCount < columnAliens.length) {
          setTimeout(() => requestAnimationFrame(destroyNext), 20); // 20ms delay
        } else {
          // All done, update score
          if (this.gameController && this.gameController.gameGUI) {
            setTimeout(() => {
              this.gameController.gameGUI.update();
            }, 50);
          }
        }
      } else {
        destroyedCount++;
        if (destroyedCount < columnAliens.length) {
          requestAnimationFrame(destroyNext);
        }
      }
    };

    // Start destruction sequence
    requestAnimationFrame(destroyNext);

    // Play thunder sound
    if (this.gameAssets && this.gameAssets.sounds) {
      try {
        if (this.gameAssets.sounds.alienExplosion) {
          this.gameAssets.sounds.alienExplosion.play(0, 0.4, 1);
        }
      } catch (e) {
        console.warn("Error playing thunder sound:", e);
      }
    }
  }

  createColumnLightning(xPosition) {
    // Create a massive vertical lightning bolt that spans the entire column
    // This should extend from top to bottom of the formation
    const boltHeight = 120; // Tall enough to cover entire formation
    const segments = 8 + Math.floor(Math.random() * 4); // 8-11 segments (reduced for performance)
    const segmentHeight = boltHeight / segments;
    const startY = this.bullet.position.y + 40; // Start above bullet

    for (let i = 0; i < segments; i++) {
      const segment = MeshBuilder.CreateBox(`columnLightning_${Date.now()}_${i}`, {
        width: 1.2 + Math.random() * 0.8, // Wider segments
        height: segmentHeight,
        depth: 0.1
      }, this.scene);

      // Jagged lightning effect with random X offsets
      const xOffset = (Math.random() - 0.5) * 2.5;
      segment.position.x = xPosition + xOffset;
      segment.position.y = startY - (i * segmentHeight);
      segment.position.z = this.bullet.position.z;

      const boltMaterial = new StandardMaterial(`columnLightningMaterial_${Date.now()}_${i}`, this.scene);
      boltMaterial.emissiveColor = new Color3(1, 1, 1); // Bright white
      boltMaterial.diffuseColor = new Color3(0.6, 0.8, 1); // Cyan tint
      boltMaterial.specularColor = new Color3(1, 1, 1);
      boltMaterial.alpha = 0.98;
      segment.material = boltMaterial;
      segment.renderingGroupId = 2; // Render on top

      // Fade out with slight delay for cascading effect
      setTimeout(() => {
        if (segment && !segment.isDisposed) {
          const fadeInterval = setInterval(() => {
            if (boltMaterial && boltMaterial.alpha > 0) {
              boltMaterial.alpha -= 0.12;
            } else {
              clearInterval(fadeInterval);
              if (segment && !segment.isDisposed) {
                segment.dispose();
              }
            }
          }, 12);
        }
      }, 30 + i * 10); // Staggered fade for cascading effect
    }

    // Create electric particles along the column
    this.createColumnParticles(xPosition, startY, boltHeight);

    // Screen flash
    this.flashScreen();
  }

  createColumnParticles(xPosition, startY, height) {
    // Create electric particles along the entire column
    // Reduced particle count to prevent performance issues
    const particleCount = Math.min(15 + Math.floor(Math.random() * 10), 25); // Max 25 particles
    
    for (let i = 0; i < particleCount; i++) {
      const particle = MeshBuilder.CreateSphere(`columnParticle_${Date.now()}_${i}`, {
        diameter: 0.3 + Math.random() * 0.4,
        segments: 4
      }, this.scene);

      particle.position.x = xPosition + (Math.random() - 0.5) * 3;
      particle.position.y = startY - (Math.random() * height);
      particle.position.z = this.bullet.position.z;

      const particleMaterial = new StandardMaterial(`columnParticleMaterial_${Date.now()}_${i}`, this.scene);
      particleMaterial.emissiveColor = new Color3(
        0.7 + Math.random() * 0.3,
        0.8 + Math.random() * 0.2,
        1
      );
      particleMaterial.alpha = 0.9;
      particle.material = particleMaterial;
      particle.renderingGroupId = 2;

      // Animate and fade out
      const startTime = Date.now();
      const duration = 400 + Math.random() * 200;
      const velocity = new Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.08
      );

      const animateParticle = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration || particle.isDisposed) {
          if (particle && !particle.isDisposed) {
            particle.dispose();
          }
          return;
        }

        particle.position.addInPlace(velocity);
        const progress = elapsed / duration;
        particleMaterial.alpha = 0.9 * (1 - progress);
        particle.scaling.scaleInPlace(1 - progress * 0.6);

        requestAnimationFrame(animateParticle);
      };

      animateParticle();
    }
  }

  createElectricExplosion(mesh) {
    if (!mesh || mesh.isDisposed) return;
    
    try {
      // Create larger explosion for thunder strike
      new Explosion(mesh, 30, 1.3, this.scene);
    } catch (e) {
      console.warn("Error creating electric explosion:", e);
    }
  }

  flashScreen() {
    const flickerOverlay = document.getElementById("thunder-flicker-overlay");
    if (flickerOverlay) {
      flickerOverlay.classList.add("active");
      setTimeout(() => {
        flickerOverlay.classList.remove("active");
      }, 50 + Math.random() * 30);
    }
  }

  destroyBullet() {
    // Clear intervals
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
    }
    if (this.particleInterval) {
      clearInterval(this.particleInterval);
    }
    if (this.thunderFlashInterval) {
      clearInterval(this.thunderFlashInterval);
    }

    // Dispose particles
    for (const particle of this.lightningParticles) {
      if (particle.mesh && !particle.mesh.isDisposed) {
        particle.mesh.dispose();
      }
    }
    this.lightningParticles = [];

    // Remove observer
    if (this.bulletObserver) {
      this.scene.onBeforeRenderObservable.remove(this.bulletObserver);
    }

    // Dispose bullet
    if (this.bullet && !this.bullet.isDisposed) {
      this.bullet.dispose();
    }

    this.disposed = true;
  }
}

