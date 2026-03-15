// game.js — Game engine for Kouraks

// ── Game State ──────────────────────────────────────────────────────────────

const gameState = {
  kouraks: 500,
  totalEarned: 0,
  hardwareLevel: 1,
  ownedServices: [],  // Runtime service instances with uid, configId, status, etc.
  eventLog: [],       // Array of {time, message} for the log panel
  nextUid: 1,
  milestonesReached: [],
  tickInterval: null,
  saveInterval: null,
};

// ── Utility Helpers ─────────────────────────────────────────────────────────

function getHardwareMultiplier() {
  const hw = GAME_CONFIG.hardware.find(h => h.level === gameState.hardwareLevel);
  return hw ? hw.multiplier : 1.0;
}

function getHardwareConfig() {
  return GAME_CONFIG.hardware.find(h => h.level === gameState.hardwareLevel);
}

function getNextHardware() {
  return GAME_CONFIG.hardware.find(h => h.level === gameState.hardwareLevel + 1) || null;
}

function getServiceConfig(configId) {
  return GAME_CONFIG.services.find(s => s.id === configId);
}

function getLeafConfig(leafId) {
  return GAME_CONFIG.leaves.find(l => l.id === leafId);
}

function formatKouraks(value) {
  const rounded = Math.floor(value);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Yield Calculation ───────────────────────────────────────────────────────

function computeLeafYield(leaf) {
  const assigned = gameState.ownedServices.filter(s => s.assignedTo === leaf.id);
  const allTypesSatisfied = leaf.requires.every(type =>
    assigned.some(s => s.serviceType === type && s.status !== 'crashed')
  );
  if (!allTypesSatisfied) return 0;
  const minMult = Math.min(...assigned.map(s => s.yieldMultiplier));
  return leaf.baseYield * getHardwareMultiplier() * minMult;
}

function computeTotalRate() {
  let total = 0;
  for (const leaf of GAME_CONFIG.leaves) {
    if (gameState.totalEarned >= leaf.unlockAt) {
      total += computeLeafYield(leaf);
    }
  }
  return total;
}

// ── Service Management ──────────────────────────────────────────────────────

function buyService(configId) {
  const config = getServiceConfig(configId);
  if (!config) return false;
  if (gameState.kouraks < config.buyCost) return false;
  if (gameState.totalEarned < config.unlockAt) return false;

  gameState.kouraks -= config.buyCost;
  const instance = {
    uid: gameState.nextUid++,
    configId: config.id,
    name: config.name,
    serviceType: config.serviceType,
    crashRate: config.crashRate,
    restartDuration: config.restartDuration,
    autoRestart: config.autoRestart,
    status: 'green',
    assignedTo: null,
    yieldMultiplier: 1.0,
    restartTimer: 0,
  };
  gameState.ownedServices.push(instance);
  addLogMessage(`${config.name} acheté et déployé.`);
  return true;
}

function assignService(uid, leafId) {
  const service = gameState.ownedServices.find(s => s.uid === uid);
  if (!service) return false;
  if (leafId === null) {
    service.assignedTo = null;
    return true;
  }
  const leaf = getLeafConfig(leafId);
  if (!leaf) return false;
  service.assignedTo = leafId;
  return true;
}

function restartService(uid) {
  const service = gameState.ownedServices.find(s => s.uid === uid);
  if (!service || service.status !== 'crashed') return false;

  service.status = 'degraded';
  service.yieldMultiplier = 0.5;
  service.restartTimer = service.restartDuration;

  const msg = randomPick(GAME_CONFIG.restartMessages).replace('{name}', service.name);
  addLogMessage(msg);
  return true;
}

// ── Hardware ────────────────────────────────────────────────────────────────

function upgradeHardware() {
  const next = getNextHardware();
  if (!next) return false;
  if (gameState.kouraks < next.cost) return false;

  gameState.kouraks -= next.cost;
  gameState.hardwareLevel = next.level;
  addLogMessage(`Hardware amélioré : ${next.name} (×${next.multiplier})`);
  return true;
}

// ── Event Log ───────────────────────────────────────────────────────────────

function addLogMessage(message) {
  const entry = { time: getTimestamp(), message };
  gameState.eventLog.unshift(entry);
  // Keep log manageable
  if (gameState.eventLog.length > 100) {
    gameState.eventLog.length = 100;
  }
}

// ── Crash Logic ─────────────────────────────────────────────────────────────

function processCrashes() {
  for (const service of gameState.ownedServices) {
    if (service.status === 'green') {
      if (Math.random() < service.crashRate) {
        service.status = 'crashed';
        service.yieldMultiplier = 0.0;
        const msg = randomPick(GAME_CONFIG.crashMessages).replace('{name}', service.name);
        addLogMessage(msg);

        // Auto-restart if enabled
        if (service.autoRestart) {
          service.status = 'degraded';
          service.yieldMultiplier = 0.5;
          service.restartTimer = service.restartDuration;
          const restartMsg = randomPick(GAME_CONFIG.restartMessages).replace('{name}', service.name);
          addLogMessage(restartMsg);
        }
      }
    } else if (service.status === 'degraded') {
      service.restartTimer--;
      if (service.restartTimer <= 0) {
        service.status = 'green';
        service.yieldMultiplier = 1.0;
        service.restartTimer = 0;
      }
    }
  }
}

// ── Milestones ──────────────────────────────────────────────────────────────

function checkMilestones() {
  for (const milestone of GAME_CONFIG.milestones) {
    if (
      gameState.totalEarned >= milestone.threshold &&
      !gameState.milestonesReached.includes(milestone.threshold)
    ) {
      gameState.milestonesReached.push(milestone.threshold);
      showMilestoneNotification(milestone.message);
      addLogMessage(`🏆 ${milestone.message}`);
    }
  }
}

function showMilestoneNotification(message) {
  if (typeof renderMilestonePopup === 'function') {
    renderMilestonePopup(message);
  }
}

// ── Game Tick ───────────────────────────────────────────────────────────────

function gameTick() {
  // 1. Process crashes
  processCrashes();

  // 2. Compute yield and add Kouraks
  const rate = computeTotalRate();
  gameState.kouraks += rate;
  gameState.totalEarned += rate;

  // 3. Check milestones
  checkMilestones();

  // 4. Update UI
  if (typeof renderUI === 'function') {
    renderUI();
  }
}

// ── Save / Load ─────────────────────────────────────────────────────────────

function saveGame() {
  const saveData = {
    kouraks: gameState.kouraks,
    totalEarned: gameState.totalEarned,
    hardwareLevel: gameState.hardwareLevel,
    ownedServices: gameState.ownedServices,
    nextUid: gameState.nextUid,
    milestonesReached: gameState.milestonesReached,
    eventLog: gameState.eventLog.slice(0, 50), // Save last 50 log entries
  };
  try {
    localStorage.setItem('kouraks-save', JSON.stringify(saveData));
  } catch (e) {
    // Silently fail if localStorage is unavailable
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('kouraks-save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    gameState.kouraks = data.kouraks || 0;
    gameState.totalEarned = data.totalEarned || 0;
    gameState.hardwareLevel = data.hardwareLevel || 1;
    gameState.ownedServices = data.ownedServices || [];
    gameState.nextUid = data.nextUid || 1;
    gameState.milestonesReached = data.milestonesReached || [];
    gameState.eventLog = data.eventLog || [];
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem('kouraks-save');
  gameState.kouraks = 0;
  gameState.totalEarned = 0;
  gameState.hardwareLevel = 1;
  gameState.ownedServices = [];
  gameState.eventLog = [];
  gameState.nextUid = 1;
  gameState.milestonesReached = [];
  addLogMessage('Système réinitialisé. Bonne chance.');
}

// ── Init ────────────────────────────────────────────────────────────────────

function startGame() {
  const loaded = loadGame();
  if (loaded) {
    addLogMessage('Sauvegarde chargée. Reprise en cours.');
  } else {
    addLogMessage('Bienvenue. Le système est opérationnel. Pour l\'instant.');
  }

  // Game tick every 1 second
  gameState.tickInterval = setInterval(gameTick, 1000);

  // Auto-save every 30 seconds
  gameState.saveInterval = setInterval(saveGame, 30000);

  // Initial render
  if (typeof renderUI === 'function') {
    renderUI();
  }
}
