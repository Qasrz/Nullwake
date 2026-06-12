// --- Screen Navigation Logic ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
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
document.getElementById('btn-settings').addEventListener('click', () => showScreen('menu-settings'));
document.getElementById('btn-back-char').addEventListener('click', () => showScreen('menu-main'));
document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('menu-main'));

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
});

// --- Game Logic ---
function resetLevel(level = 1) {
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
  activeArena = null;
  elapsed = 0;
  lastEnemySpawn = 0;
  enemiesSpawned = 0;
  gameState = "playing";

  if (uiShopOverlay) uiShopOverlay.classList.add("hidden");
  uiAlert.classList.add("hidden");
  showToast(getStageTheme(level).name, level % 5 === 0 ? "Boss signal converging" : "The zone shifts around you", 1800);
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
    uiStageText.innerText = `${getStageTheme(currentLevel).name} | Stage ${currentLevel}`;
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

function createPortalAwayFromPlayer() {
  const center = getPlayerCenter();
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

  return {
    x: chosen.x,
    y: chosen.y,
    radius: PORTAL_RADIUS,
    activeAt: performance.now() + 700
  };
}

function checkLevelComplete() {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = getStageEnemyCount(currentLevel);

  if (gameState === "playing" && enemiesSpawned >= enemyCount && enemies.length === 0) {
    noteStageCleared();
    applyDifficultyRegen(isBossLevel);
    collectRemainingGoldDrops();
    enemyProjectiles = [];
    hazards = [];
    lasers = [];
    openShop();
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
  if (gameState !== "portalPhase" || !portal) return;
  if (performance.now() < (portal.activeAt || 0)) return;
  const center = getPlayerCenter();
  if (circlesOverlap(center.x, center.y, player.size / 2, portal.x, portal.y, portal.radius)) {
    resetLevel(currentLevel + 1);
  }
}

function trySpawnEnemy(timestamp) {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = getStageEnemyCount(currentLevel);
  const spawnInterval = getStageSpawnInterval(currentLevel);
  
  if (enemiesSpawned >= enemyCount) return;
  if (timestamp - lastEnemySpawn < spawnInterval) return;

  spawnEnemy(timestamp, isBossLevel);
  lastEnemySpawn = timestamp;
}

function drawPortal() {
  if (gameState !== "portalPhase" || !portal) return;
  const active = performance.now() >= (portal.activeAt || 0);
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
  ctx.fillStyle = active ? "#a855f7" : "rgba(168, 85, 247, 0.38)";
  ctx.fill();
  ctx.strokeStyle = active ? "#d8b4fe" : "rgba(216, 180, 254, 0.58)";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function checkPlayerDeath() {
  if (player.health <= 0 && gameState !== "dead") {
    gameState = "dead";
    if (uiShopOverlay) uiShopOverlay.classList.add("hidden");
    uiAlertText.innerHTML = `You Died.<br>Stage ${currentLevel}<br><span style="font-size: 1rem; color: #94a3b8;">Press R to Restart</span>`;
    uiAlert.classList.remove("hidden");
  }
}

function draw(timestamp) {
  const delta = timestamp - (draw.lastTime || timestamp);
  draw.lastTime = timestamp;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawWorldBackground(timestamp);

  const gameVisible = gameState === "playing" || gameState === "portalPhase" || gameState === "shop" || gameState === "dead";

  if (gameVisible) {
    if (gameState !== "dead" && gameState !== "shop") {
      elapsed += delta;

      const prevX = player.x;
      const prevY = player.y;

      updatePlayer();
      if (isPrimaryFireHeld && isArtifactActive("fullAuto")) {
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
        trySpawnEnemy(timestamp);
        updateEnemies(timestamp, delta);
        checkLaserHits();
        cleanupDeadEnemies();
        checkLevelComplete();
        checkPlayerDeath();
      } else if (gameState === "portalPhase") {
        checkPortalEntry();
      }
    } else if (gameState === "shop") {
      updateVisualEffects(timestamp);
      updateParticles(delta, timestamp);
      updateFloatingTexts(delta, timestamp);
      updateToast(timestamp);
      updateDOMHud();
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

  if (gameState === "playing" || gameState === "portalPhase") {
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
  const key = event.key.toLowerCase();

  if (key === "r" && gameState === "dead") {
    showScreen('menu-main');
    gameState = "menu";
    uiAlert.classList.add("hidden");
    return;
  }

  if (key in keys) {
    keys[key] = true;
    event.preventDefault();
  }

  if (gameState === "playing" && !event.repeat) {
    if (key === "shift") {
      const ability = getAbilityDef("shift");
      if (ability && ability.hold) beginAbilityCharge("shift", performance.now());
      else useAbility("shift", mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (key === "q") {
      useAbility("q", mouseX, mouseY, performance.now());
      event.preventDefault();
    } else if (key === "e") {
      beginAbilityCharge("e", performance.now());
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    event.preventDefault();
  }

  if (key === "e") {
    releaseAbilityCharge("e", performance.now());
    event.preventDefault();
  } else if (key === "shift") {
    releaseAbilityCharge("shift", performance.now());
    event.preventDefault();
  }
});

// Kick off the initial loop
animationId = requestAnimationFrame(draw);
