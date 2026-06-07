function resetLevel(level = 1) {
  currentLevel = level;
  const isBossLevel = level % 5 === 0;
  const enemyCount = isBossLevel ? 1 : 5 + (level * 2);

  // If player doesn't exist or we are hard restarting from death, create new player
  if (!player || level === 1) {
    player = {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT / 2 - PLAYER_SIZE / 2,
      size: PLAYER_SIZE,
      health: PLAYER_MAX_HEALTH,
      maxHealth: PLAYER_MAX_HEALTH,
      invulnerableUntil: 0,
      lastLaserFire: 0,
    };
    playerGold = 0;
  } else {
    // Player survived! Just center them in the new room
    player.x = WIDTH / 2 - PLAYER_SIZE / 2;
    player.y = HEIGHT / 2 - PLAYER_SIZE / 2;
  }

  enemies = [];
  enemyProjectiles = [];
  lasers = [];
  hazards = []; 
  goldDrops = [];
  portal = null;
  elapsed = 0;
  lastEnemySpawn = 0;
  enemiesSpawned = 0;
  gameState = "playing";

  statusEl.textContent = isBossLevel ? `Level ${level} — BOSS STAGE!` : `Level ${level} — Defeat ${enemyCount} enemies.`;
  statusEl.className = "status alive";
}

function checkLevelComplete() {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = isBossLevel ? 1 : 5 + (currentLevel * 2);

  if (gameState === "playing" && enemiesSpawned >= enemyCount && enemies.length === 0) {
    gameState = "portalPhase";
    portal = { x: WIDTH / 2, y: HEIGHT / 2, radius: PORTAL_RADIUS };
    statusEl.textContent = "Level Cleared! Enter the center portal.";
    statusEl.className = "status complete";
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
  const spawnInterval = Math.max(500, 2000 - (currentLevel * 100)); // Spawns get faster each level
  
  if (enemiesSpawned >= enemyCount) return;
  if (timestamp - lastEnemySpawn < spawnInterval) return;

  spawnEnemy(isBossLevel); // Pass true if it's a boss level
  lastEnemySpawn = timestamp;
}

function drawHud() {
  const isBossLevel = currentLevel % 5 === 0;
  const enemyCount = isBossLevel ? 1 : 5 + (currentLevel * 2);
  
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(`Level ${currentLevel}`, 12, 24);
  const killed = enemiesSpawned - enemies.length;
  ctx.fillText(`Enemies: ${enemies.length} alive (${killed}/${enemyCount} defeated)`, 12, 44);
  ctx.fillText(`HP: ${player.health} / ${player.maxHealth}`, 12, 64);
  ctx.fillText(`Time: ${(elapsed / 1000).toFixed(1)}s`, 12, 84);

  // Draw Gold Counter
  ctx.textAlign = "right";
  ctx.fillStyle = "#fde047";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillText(`Gold: ${playerGold}`, WIDTH - 12, 24);
  ctx.textAlign = "left"; 
}

function drawPortal() {
  if (gameState !== "portalPhase" || !portal) return;
  
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#a855f7"; 
  ctx.fill();
  ctx.strokeStyle = "#d8b4fe";
  ctx.lineWidth = 4;
  ctx.stroke();
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("ENTER", portal.x, portal.y - 45);
  ctx.textAlign = "left";
}

function draw(timestamp) {
  const delta = timestamp - (draw.lastTime || timestamp);
  draw.lastTime = timestamp;

  if (gameState === "playing" || gameState === "portalPhase") {
    elapsed += delta;
    updatePlayer();
    
    // Allow projectiles to finish out even when portal is open
    moveProjectiles(lasers, delta);
    moveProjectiles(enemyProjectiles, delta);
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
    checkPlayerHits();
    checkGoldPickups(delta);

    if (gameState === "playing") {
      trySpawnEnemy(timestamp);
      updateEnemies(timestamp, delta);
      checkLaserHits();
      checkLevelComplete();
    } else if (gameState === "portalPhase") {
      checkPortalEntry();
    }
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawHazards(); 
  drawPortal();
  drawGold();
  drawEnemies();
  drawEnemyProjectiles();
  drawLasers();
  drawPlayer();
  drawHud();

  animationId = requestAnimationFrame(draw);
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  fireLaser(x, y, performance.now());
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "r" && gameState === "dead") {
    resetLevel(1);
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

resetLevel(1);
animationId = requestAnimationFrame(draw);