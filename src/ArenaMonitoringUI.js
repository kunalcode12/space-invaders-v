export class ArenaMonitoringUI {
  constructor(arenaManager) {
    this.arenaManager = arenaManager;
    this.container = null;
    this.eventsList = null;
    this.statusDisplay = null;
    this.countdownDisplay = null;
    this.boostCycleDisplay = null;
    this.createUI();
    this.setupEventListeners();
    this.updateInterval = null;
  }

  createUI() {
    // Create main container
    this.container = document.createElement("div");
    this.container.id = "arena-monitoring-panel";
    this.container.className = "arena-monitoring-panel";

    // Header
    const header = document.createElement("div");
    header.className = "arena-monitoring-header";
    header.innerHTML = `
      <h2>ARENA MONITORING</h2>
      <button id="arena-monitoring-toggle" class="arena-toggle-btn">Hide</button>
      <button id="arena-disconnect-btn" class="arena-disconnect-btn">Disconnect</button>
    `;
    this.container.appendChild(header);

    // Status section
    const statusSection = document.createElement("div");
    statusSection.className = "arena-status-section";
    statusSection.innerHTML = `
      <div class="arena-status-item">
        <span class="arena-status-label">Status:</span>
        <span id="arena-status-display" class="arena-status-value status-pending">PENDING</span>
      </div>
      <div class="arena-status-item">
        <span class="arena-status-label">Countdown:</span>
        <span id="arena-countdown-display" class="arena-countdown-value">--</span>
      </div>
      <div class="arena-status-item">
        <span class="arena-status-label">Boost Cycle:</span>
        <span id="arena-boost-cycle-display" class="arena-boost-cycle-value">--</span>
      </div>
    `;
    this.container.appendChild(statusSection);

    // Latest boost display
    const boostSection = document.createElement("div");
    boostSection.className = "arena-latest-boost";
    boostSection.id = "arena-latest-boost";
    boostSection.innerHTML = `
      <div class="arena-boost-label">Latest Boost:</div>
      <div class="arena-boost-info" id="arena-boost-info">No boosts yet</div>
    `;
    this.container.appendChild(boostSection);

    // Events list
    const eventsContainer = document.createElement("div");
    eventsContainer.className = "arena-events-container";
    eventsContainer.innerHTML = `
      <div class="arena-events-header">Events Log</div>
      <div id="arena-events-list" class="arena-events-list"></div>
    `;
    this.container.appendChild(eventsContainer);

    // Append to body FIRST so getElementById works
    document.body.appendChild(this.container);
    
    // NOW get references to elements after they're in the DOM
    this.eventsList = document.getElementById("arena-events-list");
    this.statusDisplay = document.getElementById("arena-status-display");
    this.countdownDisplay = document.getElementById("arena-countdown-display");
    this.boostCycleDisplay = document.getElementById("arena-boost-cycle-display");
    
    // Initially hide the monitoring panel
    this.container.style.display = "none";

    // Setup button listeners
    document.getElementById("arena-monitoring-toggle").addEventListener("click", () => {
      this.toggleEventsList();
    });

    document.getElementById("arena-disconnect-btn").addEventListener("click", () => {
      this.disconnect();
    });
  }

  setupEventListeners() {
    // Status change
    this.arenaManager.onStatusChange = (status) => {
      this.updateStatus(status);
    };

    // Countdown update
    this.arenaManager.onCountdownUpdate = (countdown) => {
      this.updateCountdown(countdown);
    };

    // Arena begins
    this.arenaManager.onArenaBegins = (data) => {
      this.updateStatus("live");
      this.addEvent("arena_begins", data);
    };

    // Boost received
    this.arenaManager.onBoostReceived = (boost) => {
      this.updateLatestBoost(boost);
      this.addEvent("player_boost_activated", boost.data);
    };

    // Boost cycle update
    this.arenaManager.onBoostCycleUpdate = (data) => {
      this.updateBoostCycle(data);
      this.addEvent("boost_cycle_update", data);
    };

    // Boost cycle complete
    this.arenaManager.onBoostCycleComplete = (data) => {
      this.addEvent("boost_cycle_complete", data);
    };

    // Package drop
    this.arenaManager.onPackageDrop = (data) => {
      this.addEvent("package_drop", data);
    };

    // Item drop
    this.arenaManager.onItemDrop = (data) => {
      this.addEvent("immediate_item_drop", data);
    };

    // Event triggered
    this.arenaManager.onEventTriggered = (data) => {
      this.addEvent("event_triggered", data);
    };

    // Player joined
    this.arenaManager.onPlayerJoined = (data) => {
      this.addEvent("player_joined", data);
    };

    // Game completed
    this.arenaManager.onGameCompleted = (data) => {
      this.updateStatus("completed");
      this.addEvent("game_completed", data);
    };

    // Game stopped
    this.arenaManager.onGameStopped = (data) => {
      this.updateStatus("stopped");
      this.addEvent("game_stopped", data);
    };

    // Monitor event (catch all)
    this.arenaManager.onMonitorEvent = (type, data) => {
      // Events are already handled above, but we can use this for additional logging
    };

    // Don't start update interval immediately - wait until panel is shown
    // The interval will be started when show() is called
  }

  startUpdateInterval() {
    // Stop any existing interval first
    this.stopUpdateInterval();

    // Only start interval if panel is visible and elements exist
    if (!this.container || this.container.style.display === "none") {
      return;
    }

    if (!this.boostCycleDisplay || !this.countdownDisplay) {
      return;
    }

    // Start the interval
    this.updateInterval = setInterval(() => {
      // Safety check - if panel is hidden, stop the interval
      if (!this.container || this.container.style.display === "none") {
        this.stopUpdateInterval();
        return;
      }
      
      // Update display
      this.updateDisplay();
    }, 100); // Update every 100ms for smooth countdown
  }

  stopUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  updateDisplay() {
    // Check if elements exist and panel is visible before updating
    if (!this.boostCycleDisplay || !this.countdownDisplay || !this.container) {
      return;
    }

    // Don't update if panel is hidden
    if (this.container.style.display === "none") {
      return;
    }

    try {
      const status = this.arenaManager.getStatus();
      
      // Update countdown if it exists and display element exists
      if (this.countdownDisplay) {
        if (status.countdown !== null && status.countdown !== undefined) {
          // Only update if countdown actually changed to avoid unnecessary DOM updates
          const expectedText = `${status.countdown}s`;
          if (this.countdownDisplay.textContent !== expectedText) {
            this.updateCountdown(status.countdown);
          }
        } else if (this.countdownDisplay.textContent !== "--") {
          // Update to "--" if countdown is null/undefined
          this.updateCountdown(null);
        }
      }

      // Update boost cycle if element exists
      if (this.boostCycleDisplay) {
        const currentCycle = status.currentCycle;
        const expectedText = currentCycle !== null && currentCycle !== undefined 
          ? `Cycle ${currentCycle}` 
          : "--";
        
        // Only update if it actually changed
        if (this.boostCycleDisplay.textContent !== expectedText) {
          this.boostCycleDisplay.textContent = expectedText;
        }
      }
    } catch (error) {
      console.warn("Error in updateDisplay:", error);
      // Stop interval on error to prevent infinite loops
      this.stopUpdateInterval();
    }
  }

  updateStatus(status) {
    if (!this.statusDisplay) return;

    this.statusDisplay.className = `arena-status-value status-${status}`;
    
    const statusText = {
      pending: "PENDING",
      live: "LIVE",
      completed: "COMPLETED",
      stopped: "STOPPED",
    };

    this.statusDisplay.textContent = statusText[status] || status.toUpperCase();
  }

  updateCountdown(countdown) {
    if (!this.countdownDisplay) return;
    
    try {
      if (countdown !== null && countdown !== undefined) {
        this.countdownDisplay.textContent = `${countdown}s`;
        this.countdownDisplay.className = "arena-countdown-value countdown-active";
      } else {
        this.countdownDisplay.textContent = "--";
        this.countdownDisplay.className = "arena-countdown-value";
      }
    } catch (error) {
      console.warn("Error updating countdown display:", error);
    }
  }

  updateBoostCycle(data) {
    if (!this.boostCycleDisplay) return;
    
    try {
      const cycle = data?.currentCycle || data?.cycle || null;
      if (cycle !== null) {
        this.boostCycleDisplay.textContent = `Cycle ${cycle}`;
      } else {
        this.boostCycleDisplay.textContent = "--";
      }
    } catch (error) {
      console.warn("Error updating boost cycle display:", error);
    }
  }

  updateLatestBoost(boost) {
    const boostInfo = document.getElementById("arena-boost-info");
    if (!boostInfo) return;

    if (boost && boost.amount > 0) {
      boostInfo.innerHTML = `
        <span class="boost-amount">${boost.amount}</span>
        <span class="boost-name">from ${boost.name}</span>
      `;
      boostInfo.className = "arena-boost-info boost-active";
      
      // Clear after 5 seconds
      setTimeout(() => {
        if (boostInfo.className === "arena-boost-info boost-active") {
          boostInfo.textContent = "No boosts yet";
          boostInfo.className = "arena-boost-info";
        }
      }, 5000);
    }
  }

  addEvent(type, data) {
    if (!this.eventsList) return;

    const eventElement = document.createElement("div");
    eventElement.className = `arena-event-item event-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const eventName = type.replace(/_/g, " ").toUpperCase();
    
    let eventContent = `<div class="event-header">
      <span class="event-type">${eventName}</span>
      <span class="event-time">${timestamp}</span>
    </div>`;
    
    // Add data preview for certain events
    if (data) {
      if (type === "player_boost_activated") {
        const amount = data?.boostAmount || data?.currentCyclePoints || 0;
        const name = data?.boosterUsername || data?.playerName || "Unknown";
        eventContent += `<div class="event-data">Amount: ${amount} | From: ${name}</div>`;
      } else if (type === "package_drop") {
        const packageName = data?.packageName || "Unknown";
        const playerName = data?.playerName || "Unknown";
        eventContent += `<div class="event-data">Package: ${packageName} | Player: ${playerName}</div>`;
      } else if (type === "immediate_item_drop") {
        const itemName = data?.itemName || "Unknown";
        const purchaser = data?.purchaserUsername || "Unknown";
        eventContent += `<div class="event-data">Item: ${itemName} | Purchaser: ${purchaser}</div>`;
      } else if (type === "countdown_update") {
        const seconds = data?.secondsRemaining || 0;
        eventContent += `<div class="event-data">Seconds remaining: ${seconds}</div>`;
      } else if (type === "boost_cycle_update") {
        const cycle = data?.currentCycle || data?.cycle || "N/A";
        eventContent += `<div class="event-data">Cycle: ${cycle}</div>`;
      } else {
        eventContent += `<div class="event-data">${JSON.stringify(data).substring(0, 100)}</div>`;
      }
    }
    
    eventElement.innerHTML = eventContent;
    
    // Add to top of list
    this.eventsList.insertBefore(eventElement, this.eventsList.firstChild);
    
    // Keep only last 50 events visible
    while (this.eventsList.children.length > 50) {
      this.eventsList.removeChild(this.eventsList.lastChild);
    }
  }

  toggleEventsList() {
    const eventsContainer = this.container.querySelector(".arena-events-container");
    const toggleBtn = document.getElementById("arena-monitoring-toggle");
    
    if (eventsContainer.style.display === "none") {
      eventsContainer.style.display = "block";
      toggleBtn.textContent = "Hide";
    } else {
      eventsContainer.style.display = "none";
      toggleBtn.textContent = "Show";
    }
  }
  
  toggle() {
    if (this.container.style.display === "none") {
      this.show();
    } else {
      this.hide();
    }
  }

  disconnect() {
    if (confirm("Are you sure you want to disconnect from the arena?")) {
      this.arenaManager.disconnect();
      this.hide();
      
      // Trigger custom event for disconnect
      window.dispatchEvent(new CustomEvent("arena-disconnected"));
    }
  }

  show() {
    if (this.container) {
      this.container.style.display = "block";
      // Ensure events list is visible when showing the panel
      const eventsContainer = this.container.querySelector(".arena-events-container");
      if (eventsContainer) {
        eventsContainer.style.display = "block";
      }
      const toggleBtn = document.getElementById("arena-monitoring-toggle");
      if (toggleBtn) {
        toggleBtn.textContent = "Hide";
      }
      // Start update interval when panel is shown
      this.startUpdateInterval();
    }
  }

  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
    // Stop update interval when panel is hidden
    this.stopUpdateInterval();
  }

  dispose() {
    // Stop update interval
    this.stopUpdateInterval();
    
    // Remove event listeners if needed
    const toggleBtn = document.getElementById("arena-monitoring-toggle");
    const disconnectBtn = document.getElementById("arena-disconnect-btn");
    if (toggleBtn) {
      toggleBtn.replaceWith(toggleBtn.cloneNode(true)); // Remove event listeners
    }
    if (disconnectBtn) {
      disconnectBtn.replaceWith(disconnectBtn.cloneNode(true)); // Remove event listeners
    }
    
    // Remove container from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Clear references
    this.container = null;
    this.eventsList = null;
    this.statusDisplay = null;
    this.countdownDisplay = null;
    this.boostCycleDisplay = null;
  }
}

