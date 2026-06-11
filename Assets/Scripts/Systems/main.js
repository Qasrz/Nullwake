// --- Screen Navigation Logic ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
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
  const isBossLevel = level % 5 === 0;

  if (!player || level === 1) {
    player = {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT / 2 - PLAYER_SIZE / 2,
      size: PLAYER_SIZE,
      health: PLAYER_MAX_HEALTH,
      maxHealth: PLAYER_MAX_HEALTH,
      invulnerableUntil: 0,
      lastLaserFire: 0,
      vx: 0,
      vy: 0,
      level: 1,
      xp: 0, 
      xpNeeded: 10
    };
    playerGold = 0;
  } else {
    player.x = WIDTH / 2 - PLAYER_SIZE / 2;
    player.y = HEIGHT / 2 - PLAYER_SIZE / 2;
    player.vx = 0;
    player.vy = 0;
  }

  enemies = []; enemyProjectiles = []; lasers = []; hazards = []; 
  goldDrops = []; portal = null; elapsed = 0;
  lastEnemySpawn = 0; enemiesSpawned = 0;
  gameState = "playing";

  uiAlert.classList.add("hidden");
  updateDOMHud();
}

// Updates the HTML/CSS Health bar and Gold counter
function updateDOMHud() {
  if (!player) return;
  const healthPct = Math.max(0, (player.health / player.maxHealth) * 100);
  uiHealthFill.style.width = `${healthPct}%`;
  uiGoldCounter.innerText = playerGold;

  if (uiXpFill) {
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpNeeded) * 100));
    uiXpFill.style.width = `${xpPct}%`;
  }
  if (uiLevelText) {
    uiLevelText.innerText = `LVL ${player.level}`;
  }
}

function checkLevelComplete() {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = isBossLevel ? 1 : 5 + (currentLevel * 2);

  if (gameState === "playing" && enemiesSpawned >= enemyCount && enemies.length === 0) {
    gameState = "portalPhase";
    portal = { x: WIDTH / 2, y: HEIGHT / 2, radius: PORTAL_RADIUS };
    
    uiAlertText.innerText = "Level Cleared! Enter Portal.";
    uiAlert.classList.remove("hidden");
  }
}

function checkPortalEntry() {
  if (gameState !== "portalPhase" || !portal) return;
  const center = getPlayerCenter();
  if (circlesOverlap(center.x, center.y, player.size / 2, portal.x, portal.y, portal.radius)) {
    resetLevel(currentLevel + 1);
  }
}

function trySpawnEnemy(timestamp) {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = isBossLevel ? 1 : 5 + (currentLevel * 2);
  const spawnInterval = Math.max(500, 2000 - (currentLevel * 100));
  
  if (enemiesSpawned >= enemyCount) return;
  if (timestamp - lastEnemySpawn < spawnInterval) return;

  spawnEnemy(timestamp, isBossLevel);
  lastEnemySpawn = timestamp;
}

function drawPortal() {
  if (gameState !== "portalPhase" || !portal) return;
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#a855f7"; ctx.fill();
  ctx.strokeStyle = "#d8b4fe"; ctx.lineWidth = 4; ctx.stroke();
}

function checkPlayerDeath() {
  if (player.health <= 0 && gameState !== "dead") {
    gameState = "dead";
    uiAlertText.innerHTML = `You Died.<br>Level ${currentLevel}<br><span style="font-size: 1rem; color: #94a3b8;">Press R to Restart</span>`;
    uiAlert.classList.remove("hidden");
  }
}

function draw(timestamp) {
  const delta = timestamp - (draw.lastTime || timestamp);
  draw.lastTime = timestamp;

  ctx.clearRect(0, 0, WIDTH, HEIGHT); // Always clear the screen

  // Only run logic and draw entities if we are actually playing or in the portal phase
  if (gameState === "playing" || gameState === "portalPhase" || gameState === "dead") {
    
    if (gameState !== "dead") {
      elapsed += delta;

      const prevX = player.x;
      const prevY = player.y;

      updatePlayer();

      if (delta > 0) {
        player.vx = (player.x - prevX) / delta;
        player.vy = (player.y - prevY) / delta;
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      moveProjectiles(lasers, delta);
      moveProjectiles(enemyProjectiles, delta);
      moveHazards(hazards, timestamp);
      lasers = lasers.filter(isOnScreen);
      
      enemyProjectiles = enemyProjectiles.filter(p => {
        if (p.isFireball) {
          const distTraveled = Math.hypot(p.x - p.startX, p.y - p.startY);
          if (distTraveled >= p.maxDist) {
            createLava(p.x, p.y, timestamp);
            return false;
          }
        }
        return isOnScreen(p);
      });

      updateHazards(timestamp);
      checkPlayerHits(timestamp);
      checkGoldPickups(delta);
      updateDOMHud(); // Trigger the CSS bar and gold to update

      if (gameState === "playing") {
        trySpawnEnemy(timestamp);
        updateEnemies(timestamp, delta);
        checkLaserHits();
        checkLevelComplete();
        checkPlayerDeath(); // Check if health hit 0
      } else if (gameState === "portalPhase") {
        checkPortalEntry();
      }
    }

    // Draw everything
    drawHazards(timestamp); 
    drawPortal();
    drawGold();
    drawEnemies();
    drawEnemyProjectiles();
    drawLasers();
    drawPlayer();
  }

  animationId = requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => {
  // Only shoot if actually in-game
  if (gameState === "playing" || gameState === "portalPhase") {
    fireLaser(e.clientX, e.clientY, performance.now());
  }
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "r" && gameState === "dead") {
    showScreen('menu-main');
    gameState = "menu";
    uiAlert.classList.add("hidden");
    return;
  }
  if (key in keys) {
    keys[key] = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    e.preventDefault();
  }
});

// Kick off the initial loop
animationId = requestAnimationFrame(draw);