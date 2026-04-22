import { io } from "socket.io-client";
import axios from "axios";

const ARENA_SERVER_URL = "wss://dev.reactive.thevorld.com";
const GAME_API_URL = "https://dev.reactive.thevorld.com/api";
const VORLD_APP_ID = "app_mgs5crer_51c332b3";
const ARENA_GAME_ID = "arcade_mhyvtb3f_0d978769";

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

  // Initialize game with stream URL
  async initializeGame(streamUrl, userToken) {
    try {
      this.userToken = userToken.trim();
      console.log("User Token:", typeof this.userToken, this.userToken);
      console.log("Stream URL:", streamUrl);

      const response = await axios.post(
        `${GAME_API_URL}/games/init`,
        {
          streamUrl,
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
      console.log("Response:", response.data);

      this.gameState = response.data.data;

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
      if (!this.gameState?.websocketUrl) {
        console.error("No WebSocket URL provided");
        return false;
      }

      // Close existing connection if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Determine WebSocket (Socket.IO) base origin URL
      const providedUrl = this.gameState.websocketUrl;
      let wsUrl = "https://dev.reactive.thevorld.com"; // fallback URL

      if (providedUrl && providedUrl.trim().length > 0) {
        try {
          const parsed = new URL(providedUrl);
          // Convert ws/wss scheme to http/https respectively for Socket.IO client
          if (parsed.protocol === "wss:") {
            parsed.protocol = "https:";
          } else if (parsed.protocol === "ws:") {
            parsed.protocol = "http:";
          }
          // Strip any custom path like /ws/<gameId>; Socket.IO connects to namespace based on path
          wsUrl = `${parsed.protocol}//${parsed.host}`;
        } catch (e) {
          console.error("Failed to parse WebSocket URL, using fallback:", e);
          // Fallback to default if parsing fails
          wsUrl = "https://dev.reactive.thevorld.com";
        }
      }

      console.log("WebSocket URL (converted):", wsUrl);
      console.log("User Token:", this.userToken);

      this.socket = io(wsUrl, {
        transports: ["websocket", "polling"],
        timeout: 30000,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        auth: {
          token: this.userToken,
          appId: VORLD_APP_ID,
        },
      });

      this.setupEventListeners();

      return new Promise((resolve) => {
        this.socket?.on("connect", () => {
          console.log("✅ WebSocket connected! Socket ID:", this.socket?.id);
          resolve(true);
        });

        this.socket?.on("connect_error", (error) => {
          console.error("❌ WebSocket connection failed:", error);
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
    if (!this.gameState?.gameId) {
      console.error("Game ID is not set");
      return;
    }

    this.socket?.emit("join_game", this.gameState?.gameId);

    // Arena Events
    this.socket?.on("arena_countdown_started", (data) => {
      this.onArenaCountdownStarted?.(data);
      console.log("Arena countdown started:", data);
    });

    this.socket?.on("countdown_update", (data) => {
      this.onCountdownUpdate?.(data);
      console.log("Countdown update:", data);
    });

    this.socket?.on("arena_begins", (data) => {
      this.onArenaBegins?.(data);
      console.log("Arena begins:", data);
    });

    // Boost Events
    this.socket?.on("player_boost_activated", (data) => {
      this.onPlayerBoostActivated?.(data);
      console.log("Player boost activated:", data);
    });

    this.socket?.on("boost_cycle_update", (data) => {
      console.log("Boost cycle update:", data);
      this.onBoostCycleUpdate?.(data);
    });

    this.socket?.on("boost_cycle_complete", (data) => {
      console.log("Boost cycle complete:", data);
      this.onBoostCycleComplete?.(data);
    });

    // Package Events
    this.socket?.on("package_drop", (data) => {
      console.log("Package drop:", data);
      this.onPackageDrop?.(data);
    });

    this.socket?.on("immediate_item_drop", (data) => {
      this.onImmediateItemDrop?.(data);
    });

    // Game Events
    this.socket?.on("event_triggered", (data) => {
      this.onEventTriggered?.(data);
    });

    this.socket?.on("player_joined", (data) => {
      this.onPlayerJoined?.(data);
    });

    this.socket?.on("game_completed", (data) => {
      this.onGameCompleted?.(data);
    });

    this.socket?.on("game_stopped", (data) => {
      this.onGameStopped?.(data);
    });
  }

  // Get game details
  async getGameDetails(gameId) {
    try {
      const response = await axios.get(`${GAME_API_URL}/games/${gameId}`, {
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
    this.socket?.disconnect();
    this.socket = null;
    this.gameState = null;
  }

  // Get current game state
  getGameState() {
    return this.gameState;
  }
}
