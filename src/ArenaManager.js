import { ArenaGameService } from "./lib/arenaGameService.js";

export class ArenaManager {
  constructor() {
    this.arenaService = new ArenaGameService();
    this.gameState = null;
    this.arenaActive = false;
    this.statusLabel = "pending"; // pending, live, completed, stopped
    this.countdown = null;
    this.currentCycle = null;
    this.lastBoost = null;
    this.lastBoostCycleUpdate = null;
    this.lastDrop = null;
    this.lastGameEvent = null;
    this.lastJoin = null;
    this.monitorEvents = [];
    
    // Event callbacks (to be set by UI)
    this.onStatusChange = null;
    this.onCountdownUpdate = null;
    this.onArenaBegins = null;
    this.onBoostReceived = null;
    this.onBoostCycleUpdate = null;
    this.onBoostCycleComplete = null;
    this.onPackageDrop = null;
    this.onItemDrop = null;
    this.onEventTriggered = null;
    this.onPlayerJoined = null;
    this.onGameCompleted = null;
    this.onGameStopped = null;
    this.onMonitorEvent = null;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const arena = this.arenaService;

    // Arena countdown started
    arena.onArenaCountdownStarted = (data) => {
      this.statusLabel = "pending";
      this.countdown = data.secondsRemaining || 60;
      this.addMonitorEvent("arena_countdown_started", data);
      this.onStatusChange?.("pending");
      this.onCountdownUpdate?.(this.countdown);
      this.onMonitorEvent?.("arena_countdown_started", data);
    };

    // Countdown update
    arena.onCountdownUpdate = (data) => {
      this.countdown = data.secondsRemaining;
      this.addMonitorEvent("countdown_update", data);
      this.onCountdownUpdate?.(this.countdown);
      this.onMonitorEvent?.("countdown_update", data);
    };

    // Arena begins
    arena.onArenaBegins = (data) => {
      this.statusLabel = "live";
      this.arenaActive = true;
      this.countdown = null;
      this.addMonitorEvent("arena_begins", data);
      this.onStatusChange?.("live");
      this.onArenaBegins?.(data);
      this.onMonitorEvent?.("arena_begins", data);
    };

    // Player boost activated
    arena.onPlayerBoostActivated = (data) => {
      this.lastBoost = data;
      const boostAmount = Number(data?.boostAmount) || Number(data?.currentCyclePoints) || 0;
      const boosterName = data?.boosterUsername || data?.playerName || "Viewer";
      this.addMonitorEvent("player_boost_activated", data);
      this.onBoostReceived?.({ amount: boostAmount, name: boosterName, data });
      this.onMonitorEvent?.("player_boost_activated", data);
    };

    // Boost cycle update
    arena.onBoostCycleUpdate = (data) => {
      this.currentCycle = data?.currentCycle || data?.cycle || null;
      this.lastBoostCycleUpdate = data;
      this.addMonitorEvent("boost_cycle_update", data);
      this.onBoostCycleUpdate?.(data);
      this.onMonitorEvent?.("boost_cycle_update", data);
    };

    // Boost cycle complete
    arena.onBoostCycleComplete = (data) => {
      this.addMonitorEvent("boost_cycle_complete", data);
      this.onBoostCycleComplete?.(data);
      this.onMonitorEvent?.("boost_cycle_complete", data);
    };

    // Package drop
    arena.onPackageDrop = (data) => {
      const playerPackageDrops = data?.playerPackageDrops || [];
      if (playerPackageDrops.length === 0) return;

      const playerWithPackage = playerPackageDrops.find(
        (p) => p.eligiblePackages && p.eligiblePackages.length > 0
      );

      if (!playerWithPackage) return;

      const packageData = playerWithPackage.eligiblePackages[0];
      const dropInfo = {
        packageName: packageData?.name || "Unknown Package",
        packageImage: packageData?.image,
        playerName: playerWithPackage?.playerName || "Unknown",
        playerPoints: playerWithPackage?.playerPoints || 0,
        cost: packageData?.cost || 0,
        stats: packageData?.stats || [],
        ...data,
      };

      this.lastDrop = dropInfo;
      this.addMonitorEvent("package_drop", dropInfo);
      this.onPackageDrop?.(dropInfo);
      this.onMonitorEvent?.("package_drop", dropInfo);
    };

    // Immediate item drop
    arena.onImmediateItemDrop = (data) => {
      console.log("Immediate item drop:", data);
      const itemData = data?.item || data;
      const packageData = data?.package || data;
      const dropInfo = {
        itemName: itemData?.name || packageData?.name || data?.itemName || "Unknown Item",
        itemImage: itemData?.image || packageData?.image || data?.item?.image,
        purchaserUsername: data?.purchaserUsername || "Unknown",
        targetPlayerName: data?.targetPlayerName || "Unknown",
        targetPlayer: data?.targetPlayer || null,
        cost: data?.cost || packageData?.cost || itemData?.cost || 0,
        stats: itemData?.stats || packageData?.stats || data?.item?.stats || [],
        effects: itemData?.effects || packageData?.effects || data?.effects || [],
        description: itemData?.description || packageData?.description || data?.description || "",
        category: itemData?.category || packageData?.category || data?.category || "",
        ...data,
      };

      this.lastDrop = dropInfo;
      this.addMonitorEvent("immediate_item_drop", dropInfo);
      this.onItemDrop?.(dropInfo);
      this.onMonitorEvent?.("immediate_item_drop", dropInfo);
    };

    // Event triggered
    arena.onEventTriggered = (data) => {
      this.lastGameEvent = data?.event;
      this.addMonitorEvent("event_triggered", data);
      this.onEventTriggered?.(data);
      this.onMonitorEvent?.("event_triggered", data);
    };

    // Player joined
    arena.onPlayerJoined = (data) => {
      this.lastJoin = data;
      this.addMonitorEvent("player_joined", data);
      this.onPlayerJoined?.(data);
      this.onMonitorEvent?.("player_joined", data);
    };

    // Game completed
    arena.onGameCompleted = (data) => {
      this.statusLabel = "completed";
      this.arenaActive = false;
      this.addMonitorEvent("game_completed", data);
      this.onStatusChange?.("completed");
      this.onGameCompleted?.(data);
      this.onMonitorEvent?.("game_completed", data);
    };

    // Game stopped
    arena.onGameStopped = (data) => {
      this.statusLabel = "stopped";
      this.arenaActive = false;
      this.addMonitorEvent("game_stopped", data);
      this.onStatusChange?.("stopped");
      this.onGameStopped?.(data);
      this.onMonitorEvent?.("game_stopped", data);
    };
  }

  addMonitorEvent(type, data) {
    const event = {
      type,
      data,
      timestamp: new Date(),
    };
    this.monitorEvents.push(event);
    // Keep only last 100 events to prevent memory issues
    if (this.monitorEvents.length > 100) {
      this.monitorEvents.shift();
    }
  }

  async initializeArena(streamUrl, userToken) {
    try {
      const result = await this.arenaService.initializeGame(streamUrl, userToken);
      
      if (result.success && result.data) {
        this.gameState = result.data;
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to initialize arena",
        };
      }
    } catch (error) {
      console.error("Error initializing arena:", error);
      return {
        success: false,
        error: error.message || "Failed to initialize arena",
      };
    }
  }

  disconnect() {
    this.arenaService.disconnect();
    this.gameState = null;
    this.arenaActive = false;
    this.statusLabel = "pending";
    this.countdown = null;
    this.currentCycle = null;
    this.lastBoost = null;
    this.lastBoostCycleUpdate = null;
    this.lastDrop = null;
    this.lastGameEvent = null;
    this.lastJoin = null;
    this.monitorEvents = [];
  }

  getStatus() {
    return {
      status: this.statusLabel,
      arenaActive: this.arenaActive,
      countdown: this.countdown,
      currentCycle: this.currentCycle,
      lastBoost: this.lastBoost,
      lastDrop: this.lastDrop,
      gameState: this.gameState,
    };
  }

  getMonitorEvents() {
    return this.monitorEvents;
  }

  canStartGame() {
    return this.arenaActive && this.statusLabel === "live";
  }
}

