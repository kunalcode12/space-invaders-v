import { MeshBuilder, Vector3, StandardMaterial, Color3, Scalar } from "@babylonjs/core";
import { Explosion } from "./Explosion";

export class GuardianShield {
  constructor(scene, playerMesh, gameAssets, duration = 4000, maxHits = 3) {
    this.scene = scene;
    this.playerMesh = playerMesh;
    this.gameAssets = gameAssets;
    this.duration = duration;
    this.maxHits = maxHits;
    this.currentHits = 0;
    this.startTime = Date.now();
    this.isActive = true;
    this.rotationSpeed = 0.05; // Rotation speed per frame
    this.rotationAngle = 0;
    this.shieldRadius = 3; // Distance from player
    
    // Create shield mesh
    this.createShield();
    
    // Start update loop
    this.startShieldLoop();
    
    // Set timeout to deactivate
    this.timeoutId = setTimeout(() => {
      this.deactivate();
    }, duration);
  }

  createShield() {
    // Create a torus (donut) shape for the rotating shield
    this.shieldMesh = MeshBuilder.CreateTorus("guardianShield", {
      diameter: this.shieldRadius * 2,
      thickness: 0.3,
      tessellation: 32
    }, this.scene);

    // Create glowing material
    this.shieldMaterial = new StandardMaterial("shieldMaterial", this.scene);
    this.shieldMaterial.emissiveColor = new Color3(0, 0.8, 1); // Cyan/blue glow
    this.shieldMaterial.diffuseColor = new Color3(0, 0.5, 1);
    this.shieldMaterial.specularColor = new Color3(0, 1, 1);
    this.shieldMaterial.alpha = 0.7; // Semi-transparent
    this.shieldMaterial.backFaceCulling = false;
    
    // Enable transparency
    this.shieldMesh.material = this.shieldMaterial;
    this.shieldMesh.renderingGroupId = 1; // Render on top
    
    // Set collision properties - use a sphere collider for better detection
    this.shieldMesh.checkCollisions = true;
    this.shieldMesh.collisionGroup = 32; // Unique collision group for shield (32 = 2^5)
    this.shieldMesh.collisionMask = 8; // Collide with alien bullets (group 8)
    
    // Create a larger invisible collision sphere around the shield for better bullet interception
    this.collisionSphere = MeshBuilder.CreateSphere("shieldCollisionSphere", {
      diameter: this.shieldRadius * 2.5, // Larger than visible shield
      segments: 16
    }, this.scene);
    this.collisionSphere.isVisible = false; // Invisible
    this.collisionSphere.checkCollisions = true;
    this.collisionSphere.collisionGroup = 32;
    this.collisionSphere.collisionMask = 8;
    this.collisionSphere.parent = this.shieldMesh;
    this.collisionSphere.position = Vector3.Zero();
    
    this.shieldMesh.metadata = {
      type: "guardianShield",
      shield: this
    };
    this.collisionSphere.metadata = {
      type: "guardianShield",
      shield: this
    };
    
    // Also check collisions manually for better detection
    this.lastCollisionCheck = Date.now();
    
    // Position shield at player position
    this.updatePosition();
    
    // Create inner glow ring
    this.createInnerGlow();
    
    // Create crack effects container
    this.cracks = [];
    
    // Make player temporarily invincible to bullets while shield is active
    this.protectPlayer();
  }
  
  protectPlayer() {
    // Store reference to player controller via the playerMesh's parent or scene
    // We need to access the PlayerController to use its invincibility system
    // For now, we'll use a different approach: modify the player's collision mask
    // to prevent collisions with alien bullets (group 8)
    
    if (this.playerMesh && this.playerMesh.metadata) {
      // Store original collision state
      this.originalPlayerCollisions = {
        checkCollisions: this.playerMesh.checkCollisions,
        collisionMask: this.playerMesh.collisionMask || 1
      };
      
      // Change player's collision mask to exclude alien bullets (group 8)
      // Player normally has collisionMask = 1, which means it collides with group 1
      // Alien bullets are in group 8, so we need to remove 8 from the mask
      // Since player mask is 1, and we want to exclude 8, we keep it at 1 (no change needed)
      // Instead, we'll disable collisions entirely and rely on shield interception
      
      // Actually, a better approach: Set collision mask to 0 to disable all collisions
      // The shield will handle all bullet interception
      this.playerMesh.checkCollisions = false;
      
      // Also store a flag in metadata so AlienBullet can check
      if (!this.playerMesh.metadata.shieldProtected) {
        this.playerMesh.metadata.shieldProtected = true;
      }
    }
  }
  
  unprotectPlayer() {
    // Restore original player collision state
    if (this.playerMesh && this.playerMesh.metadata) {
      if (this.originalPlayerCollisions) {
        this.playerMesh.checkCollisions = this.originalPlayerCollisions.checkCollisions;
        if (this.playerMesh.collisionMask !== undefined) {
          this.playerMesh.collisionMask = this.originalPlayerCollisions.collisionMask;
        }
      }
      
      // Remove shield protection flag
      if (this.playerMesh.metadata.shieldProtected) {
        this.playerMesh.metadata.shieldProtected = false;
      }
    }
  }

  createInnerGlow() {
    // Create an inner ring for extra visual effect
    this.innerRing = MeshBuilder.CreateTorus("shieldInnerRing", {
      diameter: this.shieldRadius * 1.5,
      thickness: 0.15,
      tessellation: 24
    }, this.scene);

    const innerMaterial = new StandardMaterial("shieldInnerMaterial", this.scene);
    innerMaterial.emissiveColor = new Color3(0, 1, 1); // Bright cyan
    innerMaterial.alpha = 0.5;
    innerMaterial.backFaceCulling = false;
    this.innerRing.material = innerMaterial;
    this.innerRing.renderingGroupId = 1;
    this.innerRing.parent = this.shieldMesh;
  }

  updatePosition() {
    if (!this.playerMesh || !this.shieldMesh) return;
    
    // Position shield at player location
    this.shieldMesh.position.x = this.playerMesh.position.x;
    this.shieldMesh.position.y = this.playerMesh.position.y;
    this.shieldMesh.position.z = this.playerMesh.position.z;
  }

  startShieldLoop() {
    // Check collisions FIRST to intercept bullets before they hit player
    // Use a higher priority observer to run before bullet movement
    this.shieldObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.isActive || !this.shieldMesh) {
        return;
      }

      // IMPORTANT: Check for collisions FIRST, before updating position
      // This ensures we intercept bullets before they can hit the player
      this.checkCollisions();

      // Update position to follow player
      this.updatePosition();

      // Rotate shield around Z-axis (smooth rotation)
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000; // Convert to seconds
      this.rotationAngle += this.rotationSpeed * deltaTime * 60; // Scale for 60fps
      this.shieldMesh.rotation.z = this.rotationAngle;
      
      // Counter-rotate inner ring for visual effect
      if (this.innerRing) {
        this.innerRing.rotation.z = -this.rotationAngle * 0.7;
      }

      // Update shield opacity based on hits
      this.updateShieldVisuals();

      // Check if duration expired
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.duration) {
        this.deactivate();
      }
    });
  }

  updateShieldVisuals() {
    if (!this.shieldMaterial) return;

    // Calculate health percentage
    const healthPercent = 1 - (this.currentHits / this.maxHits);
    
    // Update opacity based on hits
    this.shieldMaterial.alpha = 0.7 * healthPercent;
    
    // Change color based on hits (green -> yellow -> red)
    if (this.currentHits === 0) {
      // Full health - bright cyan
      this.shieldMaterial.emissiveColor = new Color3(0, 0.8, 1);
    } else if (this.currentHits === 1) {
      // 2 hits left - yellow-cyan
      this.shieldMaterial.emissiveColor = new Color3(0.5, 0.8, 1);
    } else if (this.currentHits === 2) {
      // 1 hit left - orange-cyan
      this.shieldMaterial.emissiveColor = new Color3(0.8, 0.5, 0.3);
    }

    // Add pulsing effect when damaged
    if (this.currentHits > 0) {
      const pulse = Math.sin(Date.now() / 100) * 0.1 + 1;
      this.shieldMesh.scaling.x = pulse;
      this.shieldMesh.scaling.y = pulse;
    } else {
      this.shieldMesh.scaling.x = 1;
      this.shieldMesh.scaling.y = 1;
    }
  }

  checkCollisions() {
    if (!this.shieldMesh || !this.isActive || this.currentHits >= this.maxHits) {
      // If shield is destroyed or inactive, restore player collisions
      if (this.currentHits >= this.maxHits) {
        this.unprotectPlayer();
      }
      return;
    }

    // Aggressively check for bullets approaching the shield
    // Get all meshes that might be alien bullets
    const potentialBullets = this.scene.meshes.filter(mesh => {
      if (!mesh || mesh.isDisposed) return false;
      
      // Skip if already blocked
      if (mesh.metadata && mesh.metadata.blocked) return false;
      
      // Check if it's an alien bullet by metadata
      if (mesh.metadata && mesh.metadata.type === "alienbullet") {
        return true;
      }
      
      // Also check by collision group (alien bullets use group 8)
      if (mesh.collisionGroup === 8 && mesh.checkCollisions) {
        return true;
      }
      
      return false;
    });

    // Check each bullet and block it if it's in range
    for (const bullet of potentialBullets) {
      if (this.isBulletInShieldRange(bullet)) {
        // Block the bullet immediately
        if (this.blockBullet(bullet)) {
          // Destroy the bullet to prevent it from hitting player
          this.destroyBulletImmediately(bullet);
          break; // Only block one bullet per frame to avoid performance issues
        }
      }
    }
  }
  
  destroyBulletImmediately(bullet) {
    if (!bullet || bullet.isDisposed) return;
    
    // Mark as blocked first
    if (bullet.metadata) {
      bullet.metadata.blocked = true;
    }
    
    // Find and destroy the bullet's observer if it exists
    // We need to access the AlienBullet instance to properly destroy it
    // Since we can't access it directly, we'll just disable the bullet
    bullet.checkCollisions = false;
    bullet.isEnabled = false;
    
    // Hide the bullet immediately
    bullet.setEnabled(false);
    
    // Dispose after a small delay to allow explosion effect
    setTimeout(() => {
      if (bullet && !bullet.isDisposed) {
        try {
          bullet.dispose();
        } catch (e) {
          console.warn("Error disposing bullet:", e);
        }
      }
    }, 50);
  }

  isBulletInShieldRange(bullet) {
    if (!bullet || !this.shieldMesh || !bullet.position) return false;
    
    // Skip if bullet is already blocked or disposed
    if (bullet.metadata && bullet.metadata.blocked) return false;
    if (bullet.isDisposed) return false;

    const dx = bullet.position.x - this.shieldMesh.position.x;
    const dy = bullet.position.y - this.shieldMesh.position.y;
    const dz = (bullet.position.z || 0) - (this.shieldMesh.position.z || 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Use a larger detection radius to catch bullets before they reach the shield
    // This ensures we intercept them before they can hit the player
    const detectionRadius = this.shieldRadius * 1.5; // 50% larger detection radius
    return distance <= detectionRadius;
  }

  blockBullet(bullet) {
    if (!bullet || !this.isActive || this.currentHits >= this.maxHits) {
      return false;
    }

    // Prevent duplicate blocking of the same bullet
    if (bullet.metadata && bullet.metadata.blocked) {
      return false;
    }

    // Mark bullet as blocked to prevent multiple hits
    if (!bullet.metadata) {
      bullet.metadata = {};
    }
    bullet.metadata.blocked = true;
    bullet.metadata.shieldBlocked = true;

    // Increment hit count
    this.currentHits++;
    
    console.log(`Shield blocked bullet! Hits: ${this.currentHits}/${this.maxHits}`);
    
    // Create explosion effect at bullet position
    if (bullet.position) {
      try {
        new Explosion(bullet, 20, 1.2, this.scene);
      } catch (e) {
        console.warn("Error creating explosion:", e);
      }
    }
    
    // Play shield hit sound if available
    if (this.gameAssets && this.gameAssets.sounds) {
      try {
        if (this.gameAssets.sounds.alienExplosion) {
          this.gameAssets.sounds.alienExplosion.play(0, 0.2, 1);
        } else if (this.gameAssets.sounds.alienBullet) {
          this.gameAssets.sounds.alienBullet.play(0, 0.3, 1);
        }
      } catch (e) {
        console.warn("Error playing sound:", e);
      }
    }

    // Add crack effect
    this.addCrackEffect();

    // Update shield visuals immediately
    this.updateShieldVisuals();

    // Check if shield is destroyed
    if (this.currentHits >= this.maxHits) {
      // Restore player collisions when shield is destroyed
      this.unprotectPlayer();
      setTimeout(() => {
        this.destroyShield();
      }, 100);
    }

    return true;
  }

  addCrackEffect() {
    // Create visual crack effect on shield
    // Create radial cracks from impact point
    const crackCount = 4 + Math.floor(Math.random() * 3); // 4-6 cracks per hit
    
    for (let i = 0; i < crackCount; i++) {
      const angle = (Math.PI * 2 * i) / crackCount + (Math.random() - 0.5) * 0.8;
      const startRadius = this.shieldRadius * 0.3;
      const endRadius = this.shieldRadius * 0.85 + Math.random() * 0.3;
      const crackLength = endRadius - startRadius;
      
      // Create a crack line using a thin box
      const crack = MeshBuilder.CreateBox(`shieldCrack_${Date.now()}_${i}`, {
        width: 0.08 + Math.random() * 0.04,
        height: crackLength,
        depth: 0.08
      }, this.scene);

      const crackMaterial = new StandardMaterial(`crackMaterial_${Date.now()}_${i}`, this.scene);
      // Color varies based on hit count (green -> yellow -> red)
      if (this.currentHits === 1) {
        crackMaterial.emissiveColor = new Color3(1, 0.8, 0); // Yellow
      } else if (this.currentHits === 2) {
        crackMaterial.emissiveColor = new Color3(1, 0.4, 0); // Orange
      } else {
        crackMaterial.emissiveColor = new Color3(1, 0.2, 0); // Red
      }
      crackMaterial.alpha = 0.9;
      crackMaterial.backFaceCulling = false;
      crack.material = crackMaterial;
      
      // Position and rotate crack relative to shield center
      const centerX = Math.cos(angle) * (startRadius + endRadius) / 2;
      const centerY = Math.sin(angle) * (startRadius + endRadius) / 2;
      
      crack.position.x = centerX;
      crack.position.y = centerY;
      crack.position.z = 0;
      crack.rotation.z = angle + Math.PI / 2;
      crack.parent = this.shieldMesh;
      crack.renderingGroupId = 2; // Render above shield

      this.cracks.push({
        mesh: crack,
        startTime: Date.now(),
        duration: 800 + Math.random() * 400 // 800-1200ms
      });

      // Fade out crack after duration
      setTimeout(() => {
        const crackData = this.cracks.find(c => c.mesh === crack);
        if (crackData && crack.material) {
          const fadeInterval = setInterval(() => {
            if (crack.material && crack.material.alpha > 0) {
              crack.material.alpha -= 0.05;
            } else {
              clearInterval(fadeInterval);
              const index = this.cracks.findIndex(c => c.mesh === crack);
              if (index !== -1) {
                this.cracks.splice(index, 1);
              }
              if (crack && !crack.isDisposed()) {
                crack.dispose();
              }
            }
          }, 30);
        }
      }, 300); // Start fading after 300ms
    }
    
    // Add a brief flash effect
    if (this.shieldMaterial) {
      const originalEmissive = this.shieldMaterial.emissiveColor.clone();
      this.shieldMaterial.emissiveColor = new Color3(1, 1, 1); // White flash
      setTimeout(() => {
        if (this.shieldMaterial) {
          this.shieldMaterial.emissiveColor = originalEmissive;
        }
      }, 50);
    }
  }

  destroyShield() {
    console.log("Guardian Shield destroyed!");
    
    // Create final explosion
    if (this.shieldMesh) {
      new Explosion(this.shieldMesh, 40, 1.5, this.scene);
    }

    // Deactivate shield
    this.deactivate();
  }

  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;

    // Restore player collisions when shield deactivates
    this.unprotectPlayer();

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Remove observer
    if (this.shieldObserver) {
      this.scene.onBeforeRenderObservable.remove(this.shieldObserver);
      this.shieldObserver = null;
    }

    // Fade out shield
    if (this.shieldMesh && this.shieldMaterial) {
      const fadeInterval = setInterval(() => {
        if (this.shieldMaterial.alpha > 0) {
          this.shieldMaterial.alpha -= 0.05;
          if (this.innerRing && this.innerRing.material) {
            this.innerRing.material.alpha -= 0.05;
          }
        } else {
          clearInterval(fadeInterval);
          this.dispose();
        }
      }, 50);
    } else {
      this.dispose();
    }
  }

  dispose() {
    // Restore player collisions before disposing
    this.unprotectPlayer();

    // Remove observer
    if (this.shieldObserver) {
      this.scene.onBeforeRenderObservable.remove(this.shieldObserver);
      this.shieldObserver = null;
    }

    // Dispose collision sphere
    if (this.collisionSphere) {
      this.collisionSphere.dispose();
      this.collisionSphere = null;
    }

    // Dispose cracks
    for (const crackData of this.cracks) {
      const crack = crackData.mesh || crackData;
      if (crack && !crack.isDisposed()) {
        crack.dispose();
      }
    }
    this.cracks = [];

    // Dispose inner ring
    if (this.innerRing) {
      this.innerRing.dispose();
      this.innerRing = null;
    }

    // Dispose shield mesh
    if (this.shieldMesh) {
      this.shieldMesh.dispose();
      this.shieldMesh = null;
    }

    // Dispose materials
    if (this.shieldMaterial) {
      this.shieldMaterial.dispose();
      this.shieldMaterial = null;
    }

    this.isActive = false;
  }

  getRemainingHits() {
    return Math.max(0, this.maxHits - this.currentHits);
  }

  getRemainingTime() {
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.duration - elapsed);
  }
}

