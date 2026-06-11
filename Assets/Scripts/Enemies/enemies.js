// Enemy Configuration Registry for easy scaling and clean initialization
const ENEMY_CONFIGS = {
  boss: {
    color: '#fbbf24',
    getSize: () => BOSS_SIZE,
    getSpeed: () => BOSS_SPEED,
    getFireInterval: () => BOSS_FIRE_INTERVAL_MS,
    getHealth: (level) => 30 + (level * 10)
  },
  shooter: {
    color: '#a855f7',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => SHOOTER_SPEED,
    getFireInterval: () => SHOOTER_FIRE_INTERVAL_MS,
    getHealth: (level) => ENEMY_HEALTH + Math.floor(level / 2)
  },
  melee: {
    color: '#ef4444',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => MELEE_SPEED,
    getFireInterval: () => 0,
    getHealth: (level) => ENEMY_HEALTH + Math.floor(level / 2)
  },
  mage: {
    color: '#3b82f6',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => MAGE_SPEED,
    getFireInterval: () => MAGE_FIRE_INTERVAL_MS,
    getHealth: (level) => ENEMY_HEALTH + Math.floor(level / 2)
  },
  lazer: {
    color: '#ec4899', // Cyberpunk pink/magenta
    getSize: () => ENEMY_SIZE,
    getSpeed: () => typeof LAZER_SPEED !== 'undefined' ? LAZER_SPEED : MAGE_SPEED,
    getFireInterval: () => LAZER_BEAM_DURATION_MS * 1.5,
    getHealth: (level) => ENEMY_HEALTH + Math.floor(level / 2)
  }
};

function randomSpawnPosition() {
  const margin = 40;
  const center = getPlayerCenter();
  let x, y;

  do {
    x = margin + Math.random() * (WIDTH - margin * 2);
    y = margin + Math.random() * (HEIGHT - margin * 2);
  } while (Math.hypot(x - center.x, y - center.y) < 120);

  return { x, y };
}

function spawnEnemy(timestamp, forceBoss = false) {
  // Added 'lazer' to the random selection pool
  const type = forceBoss ? 'boss' : ['shooter', 'melee', 'mage', 'lazer'][Math.floor(Math.random() * 4)];
  const config = ENEMY_CONFIGS[type];
  
  const pos = forceBoss 
    ? { x: WIDTH / 2 - BOSS_SIZE / 2, y: 100 } 
    : randomSpawnPosition();
    
  const health = config.getHealth(currentLevel);
  const fireInterval = config.getFireInterval();

  // Determine the initial lastFire timestamp
  let initialLastFire = timestamp + Math.random() * 1000;
  
  // FIX: If it's a lazer enemy, reduce its initial spawn-in wait time
  if (type === 'lazer') {
    const initialDelay = 1000 + Math.random() * 1000; // Gives it a brief 400ms - 800ms window before firing
    initialLastFire = timestamp - fireInterval + initialDelay;
  }

  enemies.push({
    x: pos.x,
    y: pos.y,
    size: config.getSize(),
    health: health,
    maxHealth: health,
    type: type,
    color: config.color,
    baseSpeed: config.getSpeed(),
    fireInterval: config.getFireInterval(),
    lastFire: initialLastFire, 
    isDashing: false,
    dashEndsAt: 0,
    dashAvailableAt: 0,
    dashVx: 0,
    dashVy: 0
  });
  
  enemiesSpawned++;
}

function clampEnemyToCanvas(enemy) {
  enemy.x = Math.max(0, Math.min(WIDTH - enemy.size, enemy.x));
  enemy.y = Math.max(0, Math.min(HEIGHT - enemy.size, enemy.y));
}

function handleEnemyMovement(enemy, center, timestamp, delta) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const dx = center.x - ex;
  const dy = center.y - ey;
  const dist = Math.hypot(dx, dy);
  const step = enemy.baseSpeed * (delta / 16);

  if (enemy.type === 'melee') {
    if (enemy.isDashing) {
      if (timestamp >= enemy.dashEndsAt) {
        enemy.isDashing = false;
        enemy.dashAvailableAt = timestamp + MELEE_DASH_COOLDOWN_MS;
      } else {
        enemy.x += enemy.dashVx * (delta / 16);
        enemy.y += enemy.dashVy * (delta / 16);
      }
    } else {
      if (dist < MELEE_DASH_RANGE && timestamp >= enemy.dashAvailableAt) {
        enemy.isDashing = true;
        enemy.dashEndsAt = timestamp + MELEE_DASH_DURATION_MS;
        enemy.dashVx = (dx / dist) * MELEE_DASH_SPEED;
        enemy.dashVy = (dy / dist) * MELEE_DASH_SPEED;
      } else if (dist > 0) {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
    }
  } else if (enemy.type === 'boss') {
    if (dist > 0) {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }
  } else {
    // Ranged units: Shooter, Mage, & Lazer
    if (dist > 0) {
      if (dist < ENEMY_RETREAT_RANGE) {
        enemy.x -= (dx / dist) * step;
        enemy.y -= (dy / dist) * step;
      } else if (dist > ENEMY_APPROACH_RANGE) {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
    }
  }
}

function handleEnemyCombat(enemy, center, timestamp) {
  if (enemy.fireInterval === 0 || timestamp - enemy.lastFire < enemy.fireInterval) return;

  if (enemy.type === 'boss') {
    fireEnemyProjectile(enemy, false);
    if (Math.random() > 0.6) createLightning(center.x, center.y, timestamp);
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'shooter') {
    fireEnemyProjectile(enemy, false);
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'mage') {
    if (Math.random() > 0.5) fireEnemyProjectile(enemy, true);
    else createLightning(center.x, center.y, timestamp);
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'lazer') {
    createLazerBeamHazard(enemy, center, timestamp);
    enemy.lastFire = timestamp;
  }
}

function updateEnemies(timestamp, delta) {
  const center = getPlayerCenter();

  for (const enemy of enemies) {
    handleEnemyMovement(enemy, center, timestamp, delta);
    handleEnemyCombat(enemy, center, timestamp);
    clampEnemyToCanvas(enemy);
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
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