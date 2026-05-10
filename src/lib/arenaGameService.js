import { io } from "socket.io-client";
import axios from "axios";

const ARENA_SERVER_URL = "wss://dev.reactive.thevorld.com";
const WEBSOCKET_URL = "https://dev.reactive.thevorld.com";
const GAME_API_URL = "https://dev.reactive.thevorld.com/api/v1";
const VORLD_APP_ID = "app_mgs5crer_51c332b3";
const ARENA_GAME_ID = "arcade_mhdq1qoy_4a126fd8";

export class ArenaGameService {
  constructor() {
    this.socket = null;
    this.gameState = null;
    this.userToken = "";

    // Event handlers (to be set by components)
    this.onArenaCountdownStarted = null;
    this.onCountdownUpdate = null;
    this.onArenaBegins = null;
    this.onPlayerBoostActivated = null;
    this.onBoostCycleUpdate = null;
    this.onBoostCycleComplete = null;
    this.onPackageDrop = null;
    this.onImmediateItemDrop = null;
    this.onEventTriggered = null;
    this.onPlayerJoined = null;
    this.onGameCompleted = null;
    this.onGameStopped = null;
  }

  authHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      "X-Arena-Arcade-Game-ID": ARENA_GAME_ID,
      "X-Vorld-App-ID": VORLD_APP_ID,
      "Content-Type": "application/json",
    };
  }

  createSession(data, token) {
    return axios.post(`${GAME_API_URL}/sessions`, data, {
      headers: this.authHeaders(token),
    });
  }

  getSession(id, token) {
    return axios.get(`${GAME_API_URL}/sessions/${id}`, {
      headers: this.authHeaders(token),
    });
  }

  updateSessionStatus(sessionId, status, token) {
    return axios.patch(
      `${GAME_API_URL}/sessions/${sessionId}/status`,
      { status },
      { headers: this.authHeaders(token) }
    );
  }

  normalizeBoostPayload(data) {
    return {
      ...data,
      boostAmount: data?.boostAmount ?? data?.amount ?? 0,
      playerName: data?.playerName ?? data?.actorName ?? "Viewer",
      playerId: data?.playerId ?? data?.actorId,
      boosterUsername: data?.boosterUsername ?? data?.username,
      playerTotalPoints: data?.playerTotalPoints ?? data?.totalPoints,
      currentCyclePoints:
        data?.currentCyclePoints ?? data?.boostAmount ?? data?.amount ?? 0,
    };
  }

  normalizeImmediateDropPayload(data) {
    return {
      ...data,
      targetPlayerName: data?.targetPlayerName ?? data?.targetActorName,
      targetPlayer: data?.targetPlayer ?? data?.targetActorId,
      item: {
        id: data?.itemId,
        name: data?.itemName,
      },
      package: {
        id: data?.itemId,
        name: data?.itemName,
        cost: data?.cost,
      },
    };
  }

  mapSessionToGameState(session) {
    return {
      gameId: session?.id,
      sessionId: session?.id,
      expiresAt: session?.expiresAt ?? "",
      status: session?.status ?? "pending",
      websocketUrl: WEBSOCKET_URL,
      evaGameDetails: session?.evaGameDetails ?? {},
      arenaActive: Boolean(session?.arenaActive),
      countdownStarted: Boolean(session?.countdownStartedAt),
      sessionTitle: session?.sessionTitle ?? null,
      streamerUsername: session?.streamerUsername ?? null,
      viewerCount: session?.viewerCount ?? 0,
      totalCoinsSpent: session?.totalCoinsSpent ?? 0,
    };
  }

  // Initialize game with stream URL
  async initializeGame(streamUrl, userToken) {
    try {
      this.userToken = String(userToken ?? "").trim();
      console.log("User Token:", this.userToken);
      console.log("Stream URL:", streamUrl);

      const response = await this.createSession(
        {
          gameConfigId: ARENA_GAME_ID,
          streamUrl,
        },
        this.userToken
      );
      console.log("response initializeGame", response);

      const session =
        response?.data?.session ??
        response?.data?.data?.session ??
        response?.data?.data ??
        response?.data;
      const sessionId = session?.id;
      let latestSession = session;

      if (sessionId) {
        try {
          const latestResponse = await this.getSession(sessionId, this.userToken);
          latestSession =
            latestResponse?.data?.session ??
            latestResponse?.data?.data?.session ??
            latestResponse?.data?.data ??
            latestResponse?.data ??
            session;
        } catch (detailError) {
          console.error("Failed to fetch latest session details:", detailError);
        }
      }

      this.gameState = this.mapSessionToGameState(latestSession);

      // Connect to WebSocket
      if (this.gameState?.websocketUrl) {
        await this.connectWebSocket();
      }

      return {
        success: true,
        data: this.gameState ?? undefined,
      };
    } catch (error) {
      console.error("Error initializing game:", error);
      return {
        success: false,
        error: error.response?.data?.message || "Failed to initialize game",
      };
    }
  }

  // Connect to WebSocket
  async connectWebSocket() {
    try {
      if (!this.gameState?.sessionId) {
        // fallback for older payload shapes
        this.gameState = {
          ...this.gameState,
          sessionId: this.gameState?.sessionId ?? this.gameState?.gameId,
        };
      }

      if (!this.gameState?.sessionId) {
        console.error("Session ID is not set");
        return false;
      }

      // Close existing connection if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(WEBSOCKET_URL, {
        transports: ["websocket"],
        auth: {
          token: this.userToken,
        },
      });

      this.setupEventListeners();

      return new Promise((resolve) => {
        const connectTimeout = setTimeout(() => {
          console.error("❌ WebSocket connection timeout");
          resolve(false);
        }, 30000);

        this.socket?.on("connect", () => {
          clearTimeout(connectTimeout);
          console.log("✅ WebSocket connected! Socket ID:", this.socket?.id);
          console.log("WebSocket connection successful:", true);
          resolve(true);
        });

        this.socket?.on("connect_error", (error) => {
          clearTimeout(connectTimeout);
          console.error("❌ WebSocket connection failed:", error?.message);
          console.error("Error details:", error);
          console.log("WebSocket connection successful:", false);
          resolve(false);
        });
      });
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      return false;
    }
  }

  // Set up WebSocket event listeners
  setupEventListeners() {
    if (!this.gameState?.sessionId) {
      console.error("Session ID is not set");
      return;
    }

    this.socket?.on("connect", () => {
      this.socket?.emit("join_session", { sessionId: this.gameState?.sessionId });
      // Keep older server versions compatible
      this.socket?.emit("join_game", this.gameState?.sessionId);
    });

    this.socket?.on("connect_error", (error) => {
      console.error("WebSocket connect error:", error?.message);
    });

    this.socket?.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
    });

    // Primary events
    this.socket?.on("session_started", (data) => {
      this.onArenaCountdownStarted?.(data);
      console.log("Session started:", data?.sessionId);
    });

    this.socket?.on("countdown", (data) => {
      this.onCountdownUpdate?.(data);
      console.log("Countdown:", data?.secondsRemaining, data?.phase);
    });

    this.socket?.on("arena_toggled", (data) => {
      if (data?.arenaActive) {
        this.onArenaBegins?.(data);
      }
      console.log("Arena:", data?.arenaActive);
    });

    this.socket?.on("boost_activated", (data) => {
      this.onPlayerBoostActivated?.(this.normalizeBoostPayload(data));
      console.log("Boost:", data?.actorName, "+", data?.amount, "points=", data?.totalPoints);
    });

    this.socket?.on("boost_cycle_update", (data) => {
      console.log("Boost cycle update:", data);
      this.onBoostCycleUpdate?.(data);
    });

    this.socket?.on("boost_cycle_complete", (data) => {
      console.log("Boost cycle complete:", data);
      this.onBoostCycleComplete?.(data);
    });

    this.socket?.on("immediate_item_drop", (data) => {
      console.log("Drop:", data?.itemName, "->", data?.targetActorName, "by", data?.purchaserUsername);
      this.onImmediateItemDrop?.(this.normalizeImmediateDropPayload(data));
    });

    this.socket?.on("event_triggered", (data) => {
      console.log("Event:", data?.name, "target=", data?.targetActorName ?? data?.targetActorId ?? "global");
      this.onEventTriggered?.(data);
    });

    this.socket?.on("session_ended", (data) => {
      console.log("Game over:", data?.reason, data?.winnerActorName, data?.finalScores);
      this.onGameCompleted?.(data);
      if (data?.reason === "manual_stop" || data?.reason === "cancelled") {
        this.onGameStopped?.(data);
      }
    });

    this.socket?.on("package_unlocked", (data) => {
      console.log("Unlocked:", data?.packageName, "for", data?.actorName, "@", data?.threshold);
      this.onPackageDrop?.({
        ...data,
        packageName: data?.packageName,
        playerName: data?.actorName,
        playerPackageDrops: [
          {
            playerName: data?.actorName,
            playerPoints: data?.unlockedAtPoints,
            eligiblePackages: [
              {
                name: data?.packageName,
                cost: data?.threshold,
              },
            ],
          },
        ],
      });
    });

    this.socket?.on("overlay_changed", (data) => {
      console.log("Overlay:", data?.variant?.name, "locked=", data?.isLocked);
    });

    // Legacy aliases
    this.socket?.on("game_start", (data) => {
      this.onArenaCountdownStarted?.(data);
      console.log("Session started (legacy):", data?.sessionId);
    });

    this.socket?.on("game_completed", (data) => {
      this.onGameCompleted?.(data);
      console.log("Game over (legacy):", data?.reason, data?.finalScores);
    });

    this.socket?.on("countdown_update", (data) => {
      this.onCountdownUpdate?.(data);
      console.log("Countdown (legacy):", data?.secondsRemaining, data?.phase);
    });

    this.socket?.on("player_boost_activated", (data) => {
      this.onPlayerBoostActivated?.(this.normalizeBoostPayload(data));
      console.log("Boost (legacy):", data?.actorName, "+", data?.amount);
    });

    this.socket?.on("package_drop", (data) => {
      this.onPackageDrop?.(data);
      console.log("Drop (legacy):", data?.itemName, "->", data?.targetActorName);
    });

    this.socket?.on("game_stopped", (data) => {
      this.onGameStopped?.(data);
    });

    this.socket?.on("player_joined", (data) => {
      this.onPlayerJoined?.(data);
    });
  }

  // Get game details
  async getGameDetails(gameId) {
    try {
      const response = await this.getSession(gameId, this.userToken);
      const session =
        response?.data?.session ??
        response?.data?.data?.session ??
        response?.data?.data ??
        response?.data;

      return {
        success: true,
        data: this.mapSessionToGameState(session),
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Failed to get game details",
      };
    }
  }

  // Boost a player
  async boostPlayer(gameId, playerId, amount, username) {
    try {
      // Validation before making the request
      if (!gameId || !playerId || !amount || !username) {
        console.error("Missing required parameters:", {
          gameId,
          playerId,
          amount,
          username,
        });
        return {
          success: false,
          error: "Missing required parameters",
        };
      }

      if (!this.userToken) {
        console.error("User token is missing");
        return {
          success: false,
          error: "Authentication token is missing",
        };
      }

      console.log("=== Boost Player Request ===");
      console.log("User Token:", this.userToken ? "Present" : "Missing");
      console.log("Arena Game ID:", ARENA_GAME_ID);
      console.log("Vorld App ID:", VORLD_APP_ID);
      console.log("Game API URL:", GAME_API_URL);
      console.log("Game ID:", gameId);
      console.log("Player ID:", playerId);
      console.log("Amount:", amount);
      console.log("Username:", username);
      console.log(
        "Full URL:",
        `${GAME_API_URL}/games/boost/player/${gameId}/${playerId}`
      );

      const response = await axios.post(
        `${GAME_API_URL}/games/boost/player/${gameId}/${playerId}`,
        {
          amount,
          username,
        },
        {
          headers: {
            Authorization: `Bearer ${this.userToken}`,
            "X-Arena-Arcade-Game-ID": ARENA_GAME_ID,
            "X-Vorld-App-ID": VORLD_APP_ID,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("✅ Boost response status:", response.status);
      console.log("✅ Boost response data:", response.data);

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      console.error("❌ Boost Player Error - Full details:");
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);

      if (axios.isAxiosError(error)) {
        console.error("Status:", error.response?.status);
        console.error("Response data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
        console.error("Request headers:", error.config?.headers);
        console.error("Request body:", error.config?.data);

        return {
          success: false,
          error:
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.message ||
            "Failed to boost player",
        };
      }

      console.error("Non-Axios error:", error);
      return {
        success: false,
        error: error.message || "Failed to boost player",
      };
    }
  }

  // Update stream URL
  async updateStreamUrl(gameId, streamUrl, oldStreamUrl) {
    try {
      const response = await axios.put(
        `${GAME_API_URL}/games/${gameId}/stream-url`,
        {
          streamUrl,
          oldStreamUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${this.userToken}`,
            "X-Arena-Arcade-Game-ID": ARENA_GAME_ID,
            "X-Vorld-App-ID": VORLD_APP_ID,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Failed to update stream URL",
      };
    }
  }

  // Get items catalog
  async getItemsCatalog() {
    try {
      const response = await axios.get(`${GAME_API_URL}/items/catalog`, {
        headers: {
          Authorization: `Bearer ${this.userToken}`,
          "X-Arena-Arcade-Game-ID": ARENA_GAME_ID,
          "X-Vorld-App-ID": VORLD_APP_ID,
        },
      });

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Failed to get items catalog",
      };
    }
  }

  // Drop immediate item
  async dropImmediateItem(gameId, itemId, targetPlayer) {
    try {
      const response = await axios.post(
        `${GAME_API_URL}/items/drop/${gameId}`,
        {
          itemId,
          targetPlayer,
        },
        {
          headers: {
            Authorization: `Bearer ${this.userToken}`,
            "X-Arena-Arcade-Game-ID": ARENA_GAME_ID,
            "X-Vorld-App-ID": VORLD_APP_ID,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Failed to drop item",
      };
    }
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.gameState?.sessionId && this.userToken) {
      this.updateSessionStatus(this.gameState.sessionId, "cancelled", this.userToken).catch(
        (error) => {
          console.error("Failed to update session status during disconnect:", error);
        }
      );
    }
    this.socket?.disconnect();
    this.socket = null;
    this.gameState = null;
  }

  // Get current game state
  getGameState() {
    return this.gameState;
  }
}
