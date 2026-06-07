const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const PLAYER_SIZE = 24;
const PLAYER_SPEED = 4;
const PLAYER_MAX_HEALTH = 3;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;
const ENEMY_SIZE = 22;
const ENEMY_HEALTH = 3;
const ENEMY_SPEED = 1.2;
const ENEMY_FIRE_INTERVAL_MS = 800;
const ENEMY_RETREAT_RANGE = 250;
const ENEMY_APPROACH_RANGE = 600;
const ENEMY_PROJECTILE_RADIUS = 6;
const ENEMY_PROJECTILE_SPEED = 2.5;
const LASER_SPEED = 9;
const LASER_DAMAGE = 1;
const LASER_RADIUS = 4;
const LASER_FIRE_INTERVAL_MS = 280;

const LEVELS = {
  1: {
    enemyCount: 15,
    spawnIntervalMs: 2000,
  },
};

const keys = { w: false, a: false, s: false, d: false };

let player;
let enemies;
let enemyProjectiles;
let lasers;
let elapsed;
let lastEnemySpawn;
let enemiesSpawned;
let currentLevel;
let gameState;
let animationId;

function getPlayerCenter() {
  return {
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
  };
}

function randomSpawnPosition() {
  const margin = 40;
  const center = getPlayerCenter();
  let x;
  let y;

  do {
    x = margin + Math.random() * (WIDTH - margin * 2);
    y = margin + Math.random() * (HEIGHT - margin * 2);
  } while (Math.hypot(x - center.x, y - center.y) < 120);

  return { x, y };
}

function resetLevel(level = 1) {
  currentLevel = level;
  const config = LEVELS[level];

  player = {
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT / 2 - PLAYER_SIZE / 2,
    size: PLAYER_SIZE,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    invulnerableUntil: 0,
    lastLaserFire: 0,
  };

  enemies = [];
  enemyProjectiles = [];
  lasers = [];
  elapsed = 0;
  lastEnemySpawn = 0;
  enemiesSpawned = 0;
  gameState = "playing";

  statusEl.textContent = `Level ${level} — defeat all ${config.enemyCount} enemies. Click to fire.`;
  statusEl.className = "status alive";
}

function spawnEnemy() {
  const pos = randomSpawnPosition();
  enemies.push({
    x: pos.x,
    y: pos.y,
    size: ENEMY_SIZE,
    health: ENEMY_HEALTH,
    maxHealth: ENEMY_HEALTH,
    lastFire: performance.now() + Math.random() * 1000,
  });
  enemiesSpawned++;
}

function fireLaser(targetX, targetY, timestamp = performance.now()) {
  if (gameState !== "playing") return;
  if (timestamp - player.lastLaserFire < LASER_FIRE_INTERVAL_MS) return;

  player.lastLaserFire = timestamp;

  const center = getPlayerCenter();
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  lasers.push({
    x: center.x,
    y: center.y,
    vx: (dx / length) * LASER_SPEED,
    vy: (dy / length) * LASER_SPEED,
    radius: LASER_RADIUS,
    damage: LASER_DAMAGE,
  });
}

function fireEnemyProjectile(enemy) {
  const center = getPlayerCenter();
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const dx = center.x - ex;
  const dy = center.y - ey;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  enemyProjectiles.push({
    x: ex,
    y: ey,
    vx: (dx / length) * ENEMY_PROJECTILE_SPEED,
    vy: (dy / length) * ENEMY_PROJECTILE_SPEED,
    radius: ENEMY_PROJECTILE_RADIUS,
  });
}

function updatePlayer() {
  if (gameState !== "playing") return;

  let dx = 0;
  let dy = 0;

  if (keys.w) dy -= PLAYER_SPEED;
  if (keys.s) dy += PLAYER_SPEED;
  if (keys.a) dx -= PLAYER_SPEED;
  if (keys.d) dx += PLAYER_SPEED;

  if (dx !== 0 && dy !== 0) {
    const factor = 1 / Math.SQRT2;
    dx *= factor;
    dy *= factor;
  }

  player.x = Math.max(0, Math.min(WIDTH - player.size, player.x + dx));
  player.y = Math.max(0, Math.min(HEIGHT - player.size, player.y + dy));
}

function clampEnemyToCanvas(enemy) {
  enemy.x = Math.max(0, Math.min(WIDTH - enemy.size, enemy.x));
  enemy.y = Math.max(0, Math.min(HEIGHT - enemy.size, enemy.y));
}

function updateEnemies(timestamp, delta) {
  const center = getPlayerCenter();

  for (const enemy of enemies) {
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const dx = center.x - ex;
    const dy = center.y - ey;
    const dist = Math.hypot(dx, dy);
    const step = ENEMY_SPEED * (delta / 16);

    if (dist > 0) {
      if (dist < ENEMY_RETREAT_RANGE) {
        enemy.x -= (dx / dist) * step;
        enemy.y -= (dy / dist) * step;
      } else if (dist > ENEMY_APPROACH_RANGE) {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
    }

    clampEnemyToCanvas(enemy);

    if (timestamp - enemy.lastFire >= ENEMY_FIRE_INTERVAL_MS) {
      fireEnemyProjectile(enemy);
      enemy.lastFire = timestamp;
    }
  }
}

function moveProjectiles(list, delta) {
  for (const p of list) {
    p.x += p.vx * (delta / 16);
    p.y += p.vy * (delta / 16);
  }
}

function isOnScreen(p) {
  const pad = p.radius * 2;
  return p.x > -pad && p.x < WIDTH + pad && p.y > -pad && p.y < HEIGHT + pad;
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  return Math.hypot(ax - bx, ay - by) < ar + br;
}

function rectsOverlap(ax, ay, as, bx, by, bs) {
  return ax < bx + bs && ax + as > bx && ay < by + bs && ay + as > by;
}

function checkLaserHits() {
  const remainingLasers = [];

  for (const laser of lasers) {
    let hit = false;

    for (const enemy of enemies) {
      if (hit) break;

      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;

      if (circlesOverlap(laser.x, laser.y, laser.radius, ex, ey, enemy.size / 2)) {
        enemy.health -= laser.damage;
        hit = true;
      }
    }

    if (!hit) {
      remainingLasers.push(laser);
    }
  }

  lasers = remainingLasers;
  enemies = enemies.filter((e) => e.health > 0);
}

function damagePlayer() {
  if (gameState !== "playing") return;
  if (performance.now() < player.invulnerableUntil) return;

  player.health -= 1;
  player.invulnerableUntil = performance.now() + PLAYER_DAMAGE_COOLDOWN_MS;

  if (player.health <= 0) {
    die();
  }
}

function checkPlayerHits() {
  if (gameState !== "playing") return;

  const center = getPlayerCenter();
  const playerRadius = player.size / 2;
  const remainingProjectiles = [];

  for (const projectile of enemyProjectiles) {
    if (
      circlesOverlap(
        center.x,
        center.y,
        playerRadius,
        projectile.x,
        projectile.y,
        projectile.radius
      )
    ) {
      damagePlayer();
    } else {
      remainingProjectiles.push(projectile);
    }
  }

  enemyProjectiles = remainingProjectiles;

  for (const enemy of enemies) {
    if (rectsOverlap(player.x, player.y, player.size, enemy.x, enemy.y, enemy.size)) {
      damagePlayer();
      break;
    }
  }
}

function die() {
  gameState = "dead";
  statusEl.textContent = `You died on level ${currentLevel}. Press R to restart.`;
  statusEl.className = "status dead";
}

function checkLevelComplete() {
  const config = LEVELS[currentLevel];
  if (
    gameState === "playing" &&
    enemiesSpawned >= config.enemyCount &&
    enemies.length === 0
  ) {
    gameState = "levelComplete";
    statusEl.textContent = "Level complete!";
    statusEl.className = "status complete";
  }
}

function trySpawnEnemy(timestamp) {
  const config = LEVELS[currentLevel];
  if (enemiesSpawned >= config.enemyCount) return;
  if (timestamp - lastEnemySpawn < config.spawnIntervalMs) return;

  spawnEnemy();
  lastEnemySpawn = timestamp;
}

function drawPlayer() {
  const invulnerable = performance.now() < player.invulnerableUntil;
  ctx.fillStyle = gameState === "dead" ? "#64748b" : invulnerable ? "#7dd3fc" : "#38bdf8";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.size, player.size);
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    ctx.strokeStyle = "#7e22ce";
    ctx.lineWidth = 2;
    ctx.strokeRect(enemy.x, enemy.y, enemy.size, enemy.size);

    const barWidth = enemy.size;
    const barHeight = 4;
    const healthRatio = enemy.health / enemy.maxHealth;
    const barX = enemy.x;
    const barY = enemy.y - 8;

    ctx.fillStyle = "#334155";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = healthRatio > 0.33 ? "#4ade80" : "#f87171";
    ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
  }
}

function drawLasers() {
  ctx.fillStyle = "#facc15";
  for (const laser of lasers) {
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemyProjectiles() {
  ctx.fillStyle = "#ef4444";
  for (const p of enemyProjectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud() {
  const config = LEVELS[currentLevel];
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(`Level ${currentLevel}`, 12, 24);
  const killed = enemiesSpawned - enemies.length;
  ctx.fillText(`Enemies: ${enemies.length} alive (${killed}/${config.enemyCount} defeated)`, 12, 44);
  ctx.fillText(`HP: ${player.health} / ${player.maxHealth}`, 12, 64);
  ctx.fillText(`Time: ${(elapsed / 1000).toFixed(1)}s`, 12, 84);
}

function drawOverlay() {
  if (gameState !== "levelComplete") return;

  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Level Complete!", WIDTH / 2, HEIGHT / 2);
  ctx.textAlign = "left";
}

function draw(timestamp) {
  const delta = timestamp - (draw.lastTime || timestamp);
  draw.lastTime = timestamp;

  if (gameState === "playing") {
    elapsed += delta;
    trySpawnEnemy(timestamp);
    updatePlayer();
    updateEnemies(timestamp, delta);

    moveProjectiles(lasers, delta);
    moveProjectiles(enemyProjectiles, delta);

    lasers = lasers.filter(isOnScreen);
    enemyProjectiles = enemyProjectiles.filter(isOnScreen);

    checkLaserHits();
    checkPlayerHits();
    checkLevelComplete();
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawEnemies();
  drawEnemyProjectiles();
  drawLasers();
  drawPlayer();
  drawHud();
  drawOverlay();

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

  if (key === "r" && (gameState === "dead" || gameState === "levelComplete")) {
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
