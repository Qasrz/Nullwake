// --- Screen Navigation Logic ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  updateContinueButton();
}

function hasContinuableRun() {
  return !!player && gameState !== "menu" && gameState !== "dead";
}

function updateContinueButton() {
  if (!btnContinue) return;
  btnContinue.classList.toggle("hidden", !hasContinuableRun());
}

function resetInputState() {
  Object.keys(keys).forEach(key => keys[key] = false);
  isPrimaryFireHeld = false;
  if (typeof resetTouchMoveStick === "function") resetTouchMoveStick();
  if (typeof resetTouchAimStick === "function") resetTouchAimStick();
}

function openPauseMenu() {
  if (!hasContinuableRun() || isPaused) return;
  isPaused = true;
  resetInputState();
  showScreen("game-hud");
  if (uiPauseOverlay) uiPauseOverlay.classList.remove("hidden");
}

function closePauseMenu() {
  if (!hasContinuableRun()) return;
  isPaused = false;
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  showScreen("game-hud");
}

function togglePauseMenu() {
  if (isPaused) closePauseMenu();
  else if (gameState === "playing" || gameState === "portalPhase") openPauseMenu();
}

function openSettingsScreen(returnTarget = "menu") {
  settingsReturnTarget = returnTarget;
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  renderSettingsPanel();
  showScreen("menu-settings");
}

function closeSettingsScreen() {
  pendingRebindAction = null;
  if (settingsReturnTarget === "pause" && hasContinuableRun()) {
    showScreen("game-hud");
    if (uiPauseOverlay) uiPauseOverlay.classList.remove("hidden");
  } else {
    showScreen("menu-main");
  }
  renderSettingsPanel();
}

function returnPausedRunToMenu() {
  if (!hasContinuableRun()) return;
  isPaused = true;
  resetInputState();
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  showScreen("menu-main");
}

function continueRun() {
  if (!hasContinuableRun()) return;
  isPaused = false;
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  if (uiAlert) uiAlert.classList.add("hidden");
  showScreen("game-hud");
}

function restartRun() {
  if (uiAlert) uiAlert.classList.add("hidden");
  isPaused = false;
  showScreen("game-hud");
  resetLevel(1);
}

function abandonDeadRunToMenu() {
  isPaused = false;
  gameState = "menu";
  resetInputState();
  if (uiAlert) uiAlert.classList.add("hidden");
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  showScreen("menu-main");
}

function initializeCharacterSelect() {
  document.querySelectorAll("[data-character]").forEach(card => {
    card.addEventListener("click", () => {
      selectedCharacterId = card.dataset.character;
      document.querySelectorAll("[data-character]").forEach(el => el.classList.remove("active-char"));
      card.classList.add("active-char");
    });
  });

  document.querySelectorAll("[data-difficulty]").forEach(card => {
    card.addEventListener("click", () => {
      selectedDifficultyId = card.dataset.difficulty;
      document.querySelectorAll("[data-difficulty]").forEach(el => el.classList.remove("active-difficulty"));
      card.classList.add("active-difficulty");
    });
  });

  decorateCharacterCards();
  renderArtifactGrid();
  renderSettingsPanel();
  updateContinueButton();
}

function decorateCharacterCards() {
  document.querySelectorAll("[data-character]").forEach(card => {
    const id = card.dataset.character;
    const icon = card.querySelector(".char-icon");
    if (!id || !icon) return;

    icon.style.backgroundImage = `url("Assets/Sprites/Characters/${id}.png")`;
  });
}

// Menu Button Event Listeners
document.getElementById('btn-play').addEventListener('click', () => showScreen('menu-char-select'));
document.getElementById('btn-settings').addEventListener('click', () => openSettingsScreen("menu"));
document.getElementById('btn-back-char').addEventListener('click', () => showScreen('menu-main'));
document.getElementById('btn-back-settings').addEventListener('click', closeSettingsScreen);
if (btnContinue) btnContinue.addEventListener("click", continueRun);
if (btnResume) btnResume.addEventListener("click", closePauseMenu);
if (btnPauseSettings) btnPauseSettings.addEventListener("click", () => openSettingsScreen("pause"));
if (btnPauseMenu) btnPauseMenu.addEventListener("click", returnPausedRunToMenu);
if (btnMobilePause) btnMobilePause.addEventListener("click", openPauseMenu);
if (btnDeathRetry) btnDeathRetry.addEventListener("click", restartRun);
if (btnDeathMenu) btnDeathMenu.addEventListener("click", abandonDeadRunToMenu);
if (btnResetSettings) btnResetSettings.addEventListener("click", resetGameplaySettings);

document.getElementById('btn-start').addEventListener('click', () => {
  showScreen('game-hud');
  resetLevel(1);
});

if (btnShopContinue) {
  btnShopContinue.addEventListener("click", closeShopAndOpenPortal);
}

initializeCharacterSelect();

// Window Resizing Magic
window.addEventListener('resize', () => {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  if (typeof resetTouchMoveStick === "function") resetTouchMoveStick();
  if (typeof resetTouchAimStick === "function") resetTouchAimStick();
});

// --- Game Logic ---
function resetLevel(level = 1, selectedRoute = null) {
  currentLevel = level;
  const now = performance.now();

  if (!player || level === 1) {
    player = createNewPlayer();
    syncPlayerMaxHealth(false);
    player.health = player.maxHealth;
    playerGold = isArtifactActive("goldRush") ? 60 : 0;
    nextEnemyId = 1;
    runStartTime = now;
    runStats = createRunStats();
  } else {
    player.x = WIDTH / 2 - PLAYER_SIZE / 2;
    player.y = HEIGHT / 2 - PLAYER_SIZE / 2;
    player.vx = 0;
    player.vy = 0;
    player.charge = null;
  }

  stageStartedAt = now;
  enemies = [];
  enemyProjectiles = [];
  lasers = [];
  hazards = [];
  playerZones = [];
  visualEffects = [];
  particles = [];
  floatingTexts = [];
  turrets = [];
  missiles = [];
  goldDrops = [];
  portal = null;
  portals = [];
  activeArena = null;
  elapsed = 0;
  lastEnemySpawn = 0;
  enemiesSpawned = 0;
  gameState = "playing";
  isPaused = false;
  initializeStageRoute(level, selectedRoute, now);
  resetAbilityCooldowns();
  resetInputState();

  if (uiShopOverlay) uiShopOverlay.classList.add("hidden");
  if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
  uiAlert.classList.add("hidden");
  showToast(getStageTheme(level).name, getStageIntroText(), 1800);
  updateDOMHud();
}

// Updates the HTML/CSS Health bar, XP, gold, and ability readouts.
function updateDOMHud() {
  if (!player) return;
  const healthPct = Math.max(0, (player.health / player.maxHealth) * 100);
  uiHealthFill.style.width = `${healthPct}%`;
  if (uiHealthText) uiHealthText.innerText = `${Math.ceil(player.health)} / ${player.maxHealth}`;
  uiGoldCounter.innerText = playerGold;

  if (uiXpFill) {
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpNeeded) * 100));
    uiXpFill.style.width = `${xpPct}%`;
  }
  if (uiLevelText) {
    uiLevelText.innerText = `LVL ${player.level}`;
  }
  if (uiStageText) {
    const routeLabel = typeof getStageRouteHudLabel === "function" ? getStageRouteHudLabel() : "";
    uiStageText.innerText = `${getStageTheme(currentLevel).name} | Stage ${currentLevel}${routeLabel ? ` | ${routeLabel}` : ""}`;
  }
  if (uiStatsText) {
    const damage = Math.round(PLAYER_BASE_DAMAGE * getPlayerDamageMultiplier());
    const crit = Math.round(getCritChance() * 100);
    const critDamage = Math.round(getCritDamageMultiplier() * 100);
    uiStatsText.innerText = `Damage ${damage} | Crit ${crit}% / ${critDamage}% | XP x${getXpGainMultiplier().toFixed(1)}`;
  }

  updateRunHud(performance.now());
  if (uiDifficultyDetail) uiDifficultyDetail.innerText = getDifficultyDef().name;
  updateBossHud(performance.now());
  updateAbilityHud(performance.now());
}

function collectRemainingGoldDrops() {
  for (const gold of goldDrops) {
    playerGold += gold.value;
    noteGoldCollected(gold.value);
  }
  goldDrops = [];
}

function createRoutePortalsForNextStage() {
  const routes = createStageRouteChoices(currentLevel + 1);
  const center = getPlayerCenter();

  if (routes.length === 1) {
    const candidates = [
      { x: WIDTH / 2, y: HEIGHT / 2 },
      { x: WIDTH * 0.74, y: HEIGHT * 0.5 },
      { x: WIDTH * 0.26, y: HEIGHT * 0.5 },
      { x: WIDTH * 0.5, y: HEIGHT * 0.74 },
      { x: WIDTH * 0.5, y: HEIGHT * 0.26 }
    ];
    const chosen = candidates
      .map(candidate => ({ ...candidate, dist: Math.hypot(candidate.x - center.x, candidate.y - center.y) }))
      .sort((a, b) => b.dist - a.dist)[0];

    return [{
      x: chosen.x,
      y: chosen.y,
      radius: PORTAL_RADIUS + 6,
      activeAt: performance.now() + 700,
      route: routes[0]
    }];
  }

  const y = clamp(HEIGHT * 0.54, 190, HEIGHT - 130);
  const positions = [
    { x: WIDTH * 0.34, y },
    { x: WIDTH * 0.66, y }
  ];

  return routes.map((route, index) => ({
    x: positions[index].x,
    y: positions[index].y,
    radius: PORTAL_RADIUS + 5,
    activeAt: performance.now() + 700,
    route
  }));
}

function completeStage(timestamp = performance.now()) {
  if (stageCompleteHandled) return;
  stageCompleteHandled = true;
  const isBossLevel = currentLevel % 5 === 0;

  noteStageCleared();
  applyDifficultyRegen(isBossLevel);
  collectRemainingGoldDrops();
  applyStageRouteRewards();
  enemies = [];
  enemyProjectiles = [];
  hazards = [];
  lasers = [];
  activeArena = null;
  openShop();
}

function checkLevelComplete(timestamp = performance.now()) {
  if (gameState === "playing" && isCurrentStageComplete(timestamp)) {
    completeStage(timestamp);
  }
}

function applyDifficultyRegen(isBossLevel) {
  const difficulty = getDifficultyDef();
  const shouldRegen = difficulty.regen === "stage" || (difficulty.regen === "boss" && isBossLevel);
  if (!shouldRegen || !player || player.health >= player.maxHealth) return;

  player.health = player.maxHealth;
  showToast("Vitals Restored", difficulty.regen === "boss" ? "Boss cache recovery complete." : "Stage recovery protocol complete.", 1600);
}

function checkPortalEntry() {
  if (gameState !== "portalPhase" || !portals || portals.length === 0) return;
  const now = performance.now();
  const center = getPlayerCenter();

  for (const routePortal of portals) {
    if (now < (routePortal.activeAt || 0)) continue;
    if (circlesOverlap(center.x, center.y, player.size / 2, routePortal.x, routePortal.y, routePortal.radius)) {
      resetLevel(currentLevel + 1, routePortal.route);
      return;
    }
  }
}

function trySpawnEnemy(timestamp) {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = getCurrentStageEnemyTarget(currentLevel);
  const spawnInterval = getCurrentStageSpawnInterval(currentLevel);
  
  if (enemiesSpawned >= enemyCount) return;
  if (timestamp - lastEnemySpawn < spawnInterval) return;

  spawnEnemy(timestamp, isBossLevel);
  lastEnemySpawn = timestamp;
}

function drawPortal() {
  if (gameState !== "portalPhase" || !portals || portals.length === 0) return;

  const now = performance.now();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const routePortal of portals) {
    const route = routePortal.route || STAGE_ROUTE_DEFS.onslaught;
    const active = now >= (routePortal.activeAt || 0);
    const pulse = 1 + Math.sin(now * 0.006 + routePortal.x) * 0.08;
    const radius = routePortal.radius * pulse;

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.52;
    ctx.shadowColor = route.color;
    ctx.shadowBlur = active ? 24 : 10;
    ctx.beginPath();
    ctx.arc(routePortal.x, routePortal.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = route.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = route.elite ? "#facc15" : "#f8fafc";
    ctx.lineWidth = route.elite ? 7 : 4;
    ctx.stroke();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(routePortal.x, routePortal.y, radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(route.shortName || route.name, routePortal.x, routePortal.y + routePortal.radius + 24);
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillStyle = route.elite ? "#fde68a" : "#cbd5e1";
    ctx.fillText(route.elite ? `Elite ${route.rewardText}` : route.rewardText, routePortal.x, routePortal.y + routePortal.radius + 40);
    ctx.restore();
  }
}

function checkPlayerDeath() {
  if (player.health <= 0 && gameState !== "dead") {
    gameState = "dead";
    isPaused = false;
    resetInputState();
    if (uiShopOverlay) uiShopOverlay.classList.add("hidden");
    if (uiPauseOverlay) uiPauseOverlay.classList.add("hidden");
    uiAlertText.innerHTML = `You Died.<br>Stage ${currentLevel}<br><span style="font-size: 1rem; color: #94a3b8;">Retry or return to the menu.</span>`;
    uiAlert.classList.remove("hidden");
    updateContinueButton();
  }
}

function draw(timestamp) {
  const delta = timestamp - (draw.lastTime || timestamp);
  draw.lastTime = timestamp;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawWorldBackground(timestamp);

  const gameVisible = gameState === "playing" || gameState === "portalPhase" || gameState === "shop" || gameState === "dead";

  if (gameVisible) {
    if (!isPaused && gameState !== "dead" && gameState !== "shop") {
      elapsed += delta;

      const prevX = player.x;
      const prevY = player.y;

      updatePlayer();
      if (typeof updateTouchControls === "function") updateTouchControls(timestamp);
      if (!touchInput.firing && isPrimaryFireHeld && isArtifactActive("fullAuto")) {
        fireLaser(mouseX, mouseY, timestamp);
      }

      if (delta > 0) {
        player.vx = (player.x - prevX) / delta;
        player.vy = (player.y - prevY) / delta;
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      updatePlayerProjectiles(delta, timestamp);
      updateTurretsAndMissiles(delta, timestamp);
      moveProjectiles(enemyProjectiles, delta);
      moveHazards(hazards, timestamp);
      
      enemyProjectiles = enemyProjectiles.filter(p => {
        if (p.isFireball) {
          const distTraveled = Math.hypot(p.x - p.startX, p.y - p.startY);
          if (distTraveled >= p.maxDist) {
            createLava(p.x, p.y, timestamp, p.damage);
            return false;
          }
        }
        return isOnScreen(p);
      });

      updateHazards(timestamp);
      updatePlayerZones(timestamp);
      updateVisualEffects(timestamp);
      updateParticles(delta, timestamp);
      updateFloatingTexts(delta, timestamp);
      updateToast(timestamp);
      checkPlayerHits(timestamp);
      checkGoldPickups(delta);
      updateDOMHud();

      if (gameState === "playing") {
        updateStageRoute(timestamp, delta);
        trySpawnEnemy(timestamp);
        updateEnemies(timestamp, delta);
        checkLaserHits();
        cleanupDeadEnemies();
        checkLevelComplete(timestamp);
        checkPlayerDeath();
      } else if (gameState === "portalPhase") {
        checkPortalEntry();
      }
    } else if (!isPaused && gameState === "shop") {
      updateVisualEffects(timestamp);
      updateParticles(delta, timestamp);
      updateFloatingTexts(delta, timestamp);
      updateToast(timestamp);
      updateDOMHud();
    } else if (isPaused) {
      updateToast(timestamp);
    }

    const shake = getCameraShakeOffset(timestamp);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawArenaBounds(timestamp);
    drawPlayerZones(timestamp);
    drawHazards(timestamp); 
    drawPortal();
    drawGold();
    drawParticles(timestamp);
    drawTurretsAndMissiles(timestamp);
    drawEnemies();
    drawEnemyProjectiles();
    drawLasers();
    drawVisualEffects(timestamp);
    drawPlayer();
    drawFloatingTexts(timestamp);
    ctx.restore();
  }

  animationId = requestAnimationFrame(draw);
}

canvas.addEventListener("mousemove", (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("mousedown", (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;

  if (!isPaused && (gameState === "playing" || gameState === "portalPhase")) {
    if (event.button === 0) {
      isPrimaryFireHeld = true;
      fireLaser(event.clientX, event.clientY, performance.now());
    }
    if (event.button === 2) useAbility("right", event.clientX, event.clientY, performance.now());
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) isPrimaryFireHeld = false;
});

window.addEventListener("keydown", (event) => {
  if (pendingRebindAction) {
    bindActionToKey(pendingRebindAction, event.key);
    event.preventDefault();
    return;
  }

  const action = getActionForEvent(event);
  if (!action) return;

  if (action === "pause" && !event.repeat) {
    togglePauseMenu();
    event.preventDefault();
    return;
  }

  if (action === "restart" && gameState === "dead" && !event.repeat) {
    restartRun();
    event.preventDefault();
    return;
  }

  if (isPaused) {
    event.preventDefault();
    return;
  }

  if (isMovementAction(action)) {
    setMovementActionState(action, true);
    event.preventDefault();
  }

  if ((gameState === "playing" || gameState === "portalPhase") && !event.repeat) {
    if (action === "fire") {
      isPrimaryFireHeld = true;
      fireLaser(mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (action === "abilityRight") {
      useAbility("right", mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (action === "abilityShift") {
      const ability = getAbilityDef("shift");
      if (ability && ability.hold) beginAbilityCharge("shift", performance.now());
      else useAbility("shift", mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (action === "abilityQ") {
      useAbility("q", mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (action === "abilityE") {
      beginAbilityCharge("e", performance.now());
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  const action = getActionForEvent(event);
  if (!action) return;

  if (isMovementAction(action)) {
    setMovementActionState(action, false);
    event.preventDefault();
  }

  if (action === "fire") {
    isPrimaryFireHeld = false;
    event.preventDefault();
  } else if (action === "abilityE") {
    releaseAbilityCharge("e", performance.now());
    event.preventDefault();
  } else if (action === "abilityShift") {
    releaseAbilityCharge("shift", performance.now());
    event.preventDefault();
  }
});

// Kick off the initial loop
animationId = requestAnimationFrame(draw);
