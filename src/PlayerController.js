import {Scalar, Vector3} from "@babylonjs/core";
import {PlayerBullet} from "./PlayerBullet";
import {InputController} from "./InputController";
import {Explosion} from "./Explosion";
import {MobileInputs} from "./MobileInputs";
import {GuardianShield} from "./GuardianShield";
import {ThunderBullet} from "./ThunderBullet";

import State from "./State";

export class PlayerController {

  constructor(environment, gameAssets) {
    this.environment = environment;
    this.scene = environment.scene;
    this.gameAssets = gameAssets;
    this.movementEnabled = false;
    this.inputController = new InputController(this.scene);
    this.mobileInputs = new MobileInputs(this.scene);
    this.bullets = [];
    this.maxBullets = 50;
    this.momentum = 0;
    this.isInvincible = false;
    
    // Overclock effect properties
    this.overclockActive = false;
    this.overclockDuration = 0;
    this.overclockStartTime = 0;
    this.overclockFireRate = 1; // Multiplier for fire rate
    this.overclockTripleShot = false;
    this.lastFireTime = 0;
    this.fireCooldown = 0; // Cooldown between shots (ms)
    this.normalFireCooldown = 200; // Normal cooldown (ms)
    
    // Guardian Shield properties
    this.guardianShield = null;
    this.shieldActive = false;
    
    // Thunder Strike properties
    this.thunderStrikeActive = false;
    this.thunderStrikeDuration = 0;
    this.thunderStrikeStartTime = 0;
  }

  initPlayer() {
    this.playerMesh = this.gameAssets.clone("Player_1");
    this.playerMesh.position = new Vector3(0, 0, 0);
    this.playerMesh.metadata = {
      type: "player"
    }
    this.playerMesh.onDispose = (mesh) => {
      if (State.state === "GAMELOOP" || State.state === "ALIENSWIN") {
        this.playerHit(mesh);
        this.scene.onBeforeRenderObservable.remove(this.playerObserver);
      }
    };
    this.playerMesh.checkCollisions = false;
    this.playerMesh.collisionGroup = 1
    this.playerMesh.collisionMask = 1;
    this.setInvicibility(true, 3000);
    this.enableMovement();
    this.playerObserver = this.scene.onBeforeRenderObservable.add(()=>{
      this.playerMove();
    });
  }

  actionCam(x = -1) {
    if (x === -1) x = this.playerMesh.position.x;
    this.environment.actionCam(x);
  }

  enableMovement() {
    this.momentum = 0;
    this.movementEnabled = true;
    this.inputObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.playerActions();
      this.cleanupBullets();
    });
    //this.mobileInputs.enable();
  }

  disableMovement() {
    //this.mobileInputs.disable();
    this.movementEnabled = false;
    this.disableCollisions();
    this.scene.onBeforeRenderObservable.remove(this.inputObserver);
  }

  disableCollisions() {
    this.playerMesh.checkCollisions = false;
  }

  enableCollisions() {
    this.playerMesh.checkCollisions = true;
  }

  playerHit(mesh) {
    this.disableMovement();
    this.gameAssets.sounds.playerExplosion.play();
    new Explosion(mesh, 60, 1.1, this.scene);
    this.disableBulletCollisions();
    State.lives--;
    if (State.lives > -1) {
      setTimeout(() => {
        this.initPlayer();
      }, 2000)
    } else {
      State.state = "GAMEOVER";
    }
  }

  disableBulletCollisions() {
    for (let bullet of this.bullets) {
      bullet.bullet.checkCollisions = false;
      bullet.bullet.collisionMask = 0;
    }
  }

  setInvicibility(invincible = true, howLongFor = 3000) {
    this.isInvincible = invincible;
    this.disableCollisions();

    // Become vulnerable again after howLongFor
    setTimeout(() => {
      this.isInvincible = false;
      this.enableCollisions();
      this.playerMesh.visibility = 1;
    }, howLongFor);
  }

  cleanupBullets() {
    let i = 0;
    for (let bullet of this.bullets) {
      if (bullet.disposed) {
        this.bullets.splice(i, 1);
      }
      i++;
    }
  }

  hidePlayer() {
    this.playerMesh.visibility = 0;
  }

  moveOffScreen() {
    let playerY = this.playerMesh.position.y;
    if (playerY > -100) {
      this.playerMesh.position.y = Scalar.Lerp(playerY, -150, 0.003);
      return true;
    }
    return false;
  }

  destroyPlayer() {
    this.playerMesh.dispose();
  }

  playerActions() {
    //Flash if invincible
    if (this.isInvincible) {
      if (Date.now() % 200 > 100) {
        this.playerMesh.visibility = 0;
      } else {
        this.playerMesh.visibility = 1;
      }
    }
    let input = this.inputController.inputMap;
    if (this.movementEnabled) {
      if (input.arrowleft || input.a || this.mobileInputs.left) {
        this.playerMoveLeft(State.delta);
      }
      if (input.arrowright || input.d || this.mobileInputs.right) {
        this.playerMoveRight(State.delta);
      }
    }
    const isFiring = input.shift || input.enter || input.space || this.mobileInputs.fire;
    
    if (isFiring) {
      const currentTime = Date.now();
      const timeSinceLastFire = currentTime - this.lastFireTime;
      
      if (this.overclockActive) {
        // Overclock mode: continuous firing with 2x faster rate
        const effectiveCooldown = this.normalFireCooldown / 2; // 2x faster (half cooldown = 100ms)
        
        if (timeSinceLastFire >= effectiveCooldown && this.bullets.length < this.maxBullets && this.movementEnabled) {
          this.fireBullet();
          this.lastFireTime = currentTime;
        }
      } else {
        // Normal mode: one shot per key press (original behavior)
        if (!this.fireKeyDown && this.bullets.length < this.maxBullets && this.movementEnabled) {
          this.fireBullet();
          this.lastFireTime = currentTime;
          this.fireKeyDown = true;
        }
      }
    } else {
      // Key released - reset fireKeyDown for normal mode
      this.fireKeyDown = false;
    }
    
    // Update Overclock status
    this.updateOverclockStatus();
    
    // Update Thunder Strike status
    this.updateThunderStrikeStatus();
    
    this.playerMove();
  }

  playerMoveLeft() {
    this.momentum -= .2 * State.delta;
  }

  playerMoveRight() {
    this.momentum += .2 * State.delta;
  }

  // @todo: Player movement is faster at lower framerates!!!
  //  Approx 30% fast at 24FPS than at 60.
  //  Need to work on delta calculations.
  playerMove() {
    this.playerMesh.position.x += this.momentum * (State.delta);
    this.momentum /= Math.pow(1.4, State.delta);
    this.playerMesh.rotation = new Vector3(0, this.momentum, this.momentum / 4);
  }

  fireBullet() {
    // Check if Thunder Strike is active - use thunder bullets
    if (this.thunderStrikeActive) {
      if (this.bullets.length < this.maxBullets) {
        // Get alien formation from game controller
        const gameController = window.gameController || this.gameController;
        const alienFormation = gameController?.alienFormation;
        
        if (alienFormation) {
          const thunderBullet = new ThunderBullet(
            this.gameAssets,
            this.scene,
            this.playerMesh,
            alienFormation,
            0
          );
          thunderBullet.gameController = gameController;
          this.bullets.push(thunderBullet);
          
          // Play thunder sound (louder and more dramatic)
          if (this.gameAssets.sounds.lazer) {
            this.gameAssets.sounds.lazer.play(0, 0.8, 1);
          }
        } else {
          // Fallback to normal bullet if formation not available
          this.bullets.push(new PlayerBullet(this.gameAssets, this.scene, this.playerMesh, 0, false));
          this.gameAssets.sounds.lazer.play();
        }
      }
      return;
    }
    
    // Check if Overclock is active and should use triple-shot
    if (this.overclockActive && this.overclockTripleShot) {
      // Fire triple-shot: center, left, right
      const offsets = [0, -0.5, 0.5]; // X offsets for triple-shot
      
      offsets.forEach((offset, index) => {
        if (this.bullets.length < this.maxBullets) {
          const bullet = new PlayerBullet(this.gameAssets, this.scene, this.playerMesh, offset, true);
          this.bullets.push(bullet);
        }
      });
      
      // Play sound (might want to use a different sound for Overclock)
      this.gameAssets.sounds.lazer.play();
    } else {
      // Normal single shot
      this.bullets.push(new PlayerBullet(this.gameAssets, this.scene, this.playerMesh, 0, false));
      this.gameAssets.sounds.lazer.play();
    }
  }

  // Update Overclock status (called from ItemEffects)
  updateOverclockStatus() {
    if (this.overclockActive) {
      const elapsed = Date.now() - this.overclockStartTime;
      if (elapsed >= this.overclockDuration) {
        // Overclock expired
        this.overclockActive = false;
        this.overclockFireRate = 1;
        this.overclockTripleShot = false;
      }
    }
  }

  // Activate Guardian Shield
  activateGuardianShield(duration = 4000, maxHits = 3) {
    // Deactivate existing shield if any
    if (this.guardianShield) {
      this.guardianShield.deactivate();
      this.guardianShield = null;
    }

    if (!this.playerMesh) {
      console.warn("Cannot activate shield: Player mesh not available");
      return;
    }

    // Create new Guardian Shield
    this.guardianShield = new GuardianShield(
      this.scene,
      this.playerMesh,
      this.gameAssets,
      duration,
      maxHits
    );
    this.shieldActive = true;
    console.log(`Guardian Shield activated for ${duration}ms with ${maxHits} hits`);
  }

  // Deactivate Guardian Shield
  deactivateGuardianShield() {
    if (this.guardianShield) {
      this.guardianShield.deactivate();
      this.guardianShield = null;
      this.shieldActive = false;
    }
  }

  // Get shield status
  getShieldStatus() {
    if (!this.guardianShield || !this.shieldActive) {
      return null;
    }
    return {
      active: this.guardianShield.isActive,
      remainingHits: this.guardianShield.getRemainingHits(),
      maxHits: this.guardianShield.maxHits,
      remainingTime: this.guardianShield.getRemainingTime(),
    };
  }

  // Activate Thunder Strike mode
  activateThunderStrike(duration = 3000) {
    this.thunderStrikeActive = true;
    this.thunderStrikeDuration = duration;
    this.thunderStrikeStartTime = Date.now();
    console.log(`Thunder Strike mode activated for ${duration}ms`);
  }

  // Deactivate Thunder Strike mode
  deactivateThunderStrike() {
    this.thunderStrikeActive = false;
    this.thunderStrikeDuration = 0;
    this.thunderStrikeStartTime = 0;
    console.log("Thunder Strike mode deactivated");
  }

  // Update Thunder Strike status
  updateThunderStrikeStatus() {
    if (this.thunderStrikeActive) {
      const elapsed = Date.now() - this.thunderStrikeStartTime;
      if (elapsed >= this.thunderStrikeDuration) {
        this.deactivateThunderStrike();
      }
    }
  }
}
