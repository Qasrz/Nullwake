// Enemy Configuration Registry for easy scaling and clean initialization
const ENEMY_CONFIGS = {
  boss: {
    color: '#fbbf24',
    getSize: () => BOSS_SIZE,
    getSpeed: () => BOSS_SPEED,
    getFireInterval: () => BOSS_FIRE_INTERVAL_MS,
    getHealth: (enemyLevel) => getBossHealthForStage(currentLevel, enemyLevel)
  },
  shooter: {
    color: '#22c55e',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => SHOOTER_SPEED,
    getFireInterval: () => SHOOTER_FIRE_INTERVAL_MS,
    getHealth: (enemyLevel) => getScaledEnemyHealth('shooter', enemyLevel)
  },
  melee: {
    color: '#ef4444',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => MELEE_SPEED,
    getFireInterval: () => 0,
    getHealth: (enemyLevel) => getScaledEnemyHealth('melee', enemyLevel)
  },
  mage: {
    color: '#3b82f6',
    getSize: () => ENEMY_SIZE,
    getSpeed: () => MAGE_SPEED,
    getFireInterval: () => MAGE_FIRE_INTERVAL_MS,
    getHealth: (enemyLevel) => getScaledEnemyHealth('mage', enemyLevel)
  },
  lazer: {
    color: '#ec4899', // Cyberpunk pink/magenta
    getSize: () => ENEMY_SIZE,
    getSpeed: () => typeof LAZER_SPEED !== 'undefined' ? LAZER_SPEED : MAGE_SPEED,
    getFireInterval: () => LAZER_BEAM_DURATION_MS * 1.5,
    getHealth: (enemyLevel) => getScaledEnemyHealth('lazer', enemyLevel)
  }
};

const ELITE_DEFS = [
  { id: "overcharged", name: "Overcharged", color: "#67e8f9", health: 1.45, damage: 1.25, speed: 1.05 },
  { id: "vampiric", name: "Vampiric", color: "#fb7185", health: 1.25, damage: 1.35, speed: 1.0 },
  { id: "swift", name: "Swift", color: "#fde047", health: 1.1, damage: 1.1, speed: 1.35 }
];

function getEnemyLevelForStage(stage) {
  return 1 + (stage - 1) * ENEMY_LEVEL_STEP;
}

function getScaledEnemyHealth(type, enemyLevel) {
  const base = ENEMY_STATS[type].health;
  return Math.floor(base * (1 + (enemyLevel - 1) * ENEMY_HEALTH_PER_LEVEL));
}

function getScaledEnemyDamage(type, enemyLevel) {
  const base = ENEMY_STATS[type].damage;
  return Math.floor(base * (1 + (enemyLevel - 1) * ENEMY_DAMAGE_PER_LEVEL));
}

function getEnemyXpReward(enemy) {
  const bossMultiplier = enemy.type === 'boss' ? 10 : 1;
  const eliteMultiplier = enemy.elite ? 2 : 1;
  return enemy.level * ENEMY_XP_PER_LEVEL * bossMultiplier * eliteMultiplier;
}

function getEnemyGoldReward(enemy) {
  if (enemy.type === 'boss') return 120 + enemy.level * 10;
  return Math.floor((4 + enemy.level * 2) * (enemy.elite ? 2.25 : 1));
}

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
  const enemyLevel = getEnemyLevelForStage(currentLevel);
  
  const pos = forceBoss 
    ? { x: WIDTH / 2 - BOSS_SIZE / 2, y: 100 } 
    : randomSpawnPosition();
    
  const runDifficulty = getRunDifficultyMultiplier(timestamp);
  const modeDifficulty = getDifficultyDef();
  const health = Math.floor(config.getHealth(enemyLevel) * runDifficulty * modeDifficulty.health);
  const damage = Math.floor(getScaledEnemyDamage(type, enemyLevel) * Math.pow(runDifficulty, 0.85) * modeDifficulty.damage);
  const fireInterval = config.getFireInterval();

  // Determine the initial lastFire timestamp
  let initialLastFire = timestamp + Math.random() * 1000;
  
  // FIX: If it's a lazer enemy, reduce its initial spawn-in wait time
  if (type === 'lazer') {
    const initialDelay = 1000 + Math.random() * 1000; // Gives it a brief 400ms - 800ms window before firing
    initialLastFire = timestamp - fireInterval + initialDelay;
  }

  const enemy = {
    id: nextEnemyId++,
    x: pos.x,
    y: pos.y,
    size: config.getSize(),
    health: health,
    maxHealth: health,
    level: enemyLevel,
    damage: damage,
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
  };

  if (forceBoss) {
    initializeBossEnemy(enemy, timestamp);
  } else {
    maybeApplyElite(enemy);
  }

  enemies.push(enemy);
  
  enemiesSpawned++;
}

function maybeApplyElite(enemy) {
  const eliteChance = clamp((0.08 + currentLevel * 0.012) * getDifficultyDef().eliteChance, 0, 0.38);
  if (currentLevel < 3 || Math.random() > eliteChance) return;

  const elite = ELITE_DEFS[Math.floor(Math.random() * ELITE_DEFS.length)];
  enemy.elite = elite.id;
  enemy.eliteName = elite.name;
  enemy.color = elite.color;
  enemy.health = Math.floor(enemy.health * elite.health);
  enemy.maxHealth = enemy.health;
  enemy.damage = Math.floor(enemy.damage * elite.damage);
  enemy.baseSpeed *= elite.speed;
}

function spawnBossMinion(type, x, y, enemyLevel) {
  const config = ENEMY_CONFIGS[type] || ENEMY_CONFIGS.melee;
  const health = Math.floor(config.getHealth(enemyLevel) * 0.75);
  enemies.push({
    id: nextEnemyId++,
    x: clamp(x, 40, WIDTH - 40),
    y: clamp(y, 40, HEIGHT - 40),
    size: config.getSize(),
    health,
    maxHealth: health,
    level: enemyLevel,
    damage: Math.floor(getScaledEnemyDamage(type, enemyLevel) * 0.8),
    type,
    color: config.color,
    baseSpeed: config.getSpeed(),
    fireInterval: config.getFireInterval(),
    lastFire: performance.now() + 700,
    isDashing: false,
    dashEndsAt: 0,
    dashAvailableAt: 0,
    dashVx: 0,
    dashVy: 0,
    summoned: true
  });
}

function clampEnemyToCanvas(enemy) {
  enemy.x = Math.max(0, Math.min(WIDTH - enemy.size, enemy.x));
  enemy.y = Math.max(0, Math.min(HEIGHT - enemy.size, enemy.y));
}

function startMeleeDash(enemy, dx, dy, dist, timestamp) {
  if (dist <= 0) return;
  enemy.isDashing = true;
  enemy.dashEndsAt = timestamp + MELEE_DASH_DURATION_MS;
  enemy.dashVx = (dx / dist) * MELEE_DASH_SPEED * (enemy.elite ? 1.08 : 1);
  enemy.dashVy = (dy / dist) * MELEE_DASH_SPEED * (enemy.elite ? 1.08 : 1);
}

function handleEnemyMovement(enemy, center, timestamp, delta) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const dx = center.x - ex;
  const dy = center.y - ey;
  const dist = Math.hypot(dx, dy);
  const step = enemy.baseSpeed * (delta / 16);

  if (enemy.type === 'boss') {
    return;
  }

  if (enemy.type === 'melee') {
    if (enemy.isDashing) {
      if (timestamp >= enemy.dashEndsAt) {
        if (enemy.elite && enemy.comboDashesRemaining > 0) {
          enemy.comboDashesRemaining--;
          const nextEx = enemy.x + enemy.size / 2;
          const nextEy = enemy.y + enemy.size / 2;
          const nextDx = center.x - nextEx;
          const nextDy = center.y - nextEy;
          const nextDist = Math.hypot(nextDx, nextDy);
          startMeleeDash(enemy, nextDx, nextDy, nextDist, timestamp + 80);
        } else {
          enemy.isDashing = false;
          enemy.comboDashesRemaining = 0;
          enemy.dashAvailableAt = timestamp + MELEE_DASH_COOLDOWN_MS * (enemy.elite ? 1.2 : 1);
        }
      } else {
        enemy.x += enemy.dashVx * (delta / 16);
        enemy.y += enemy.dashVy * (delta / 16);
      }
    } else {
      if (dist < MELEE_DASH_RANGE && timestamp >= enemy.dashAvailableAt) {
        enemy.comboDashesRemaining = enemy.elite ? 2 : 0;
        startMeleeDash(enemy, dx, dy, dist, timestamp);
      } else if (dist > 0) {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
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
  if (enemy.type === 'boss') {
    updateBossEnemy(enemy, center, timestamp, 16);
    return;
  }

  if (enemy.fireInterval === 0 || timestamp - enemy.lastFire < enemy.fireInterval) return;

  if (enemy.type === 'shooter') {
    if (enemy.elite) fireEliteShooterPlus(enemy);
    else fireEnemyProjectile(enemy, false);
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'mage') {
    if (enemy.elite) {
      fireEliteMageBurst(enemy, center, timestamp);
    } else if (Math.random() > 0.5) fireEnemyProjectile(enemy, true);
    else createLightning(center.x, center.y, timestamp, enemy.damage);
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'lazer') {
    if (enemy.elite) createTwinLazerBeamHazard(enemy, center, timestamp);
    else createLazerBeamHazard(enemy, center, timestamp);
    enemy.lastFire = timestamp;
  }
}

function fireEliteShooterPlus(enemy) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const speed = ENEMY_PROJECTILE_SPEED * 1.12;

  for (let i = 0; i < 4; i++) {
    fireEnemyBullet(ex, ey, i * Math.PI / 2, {
      speed,
      radius: ENEMY_PROJECTILE_RADIUS,
      damage: enemy.damage * 0.85,
      color: enemy.color
    });
  }
}

function fireEliteMageBurst(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const angle = Math.atan2(center.y - ey, center.x - ex);

  fireEnemyArc(ex, ey, angle, Math.PI / 3, 5, {
    speed: ENEMY_PROJECTILE_SPEED * 1.04,
    radius: ENEMY_PROJECTILE_RADIUS,
    damage: enemy.damage * 0.78,
    color: enemy.color
  });

  createLightning(center.x, center.y, timestamp, enemy.damage * 0.9);
  createLightning(center.x + randRange(-80, 80), center.y + randRange(-80, 80), timestamp, enemy.damage * 0.75);
}

function updateEnemies(timestamp, delta) {
  const center = getPlayerCenter();

  for (const enemy of enemies) {
    if (enemy.type === "boss") {
      updateBossEnemy(enemy, center, timestamp, delta);
    } else {
      handleEnemyMovement(enemy, center, timestamp, delta);
      handleEnemyCombat(enemy, center, timestamp);
    }
    clampEnemyToCanvas(enemy);
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (enemy.type === "boss") {
      drawBossEnemy(enemy);
      continue;
    }

    drawStandardEnemy(enemy);
  }
}

function drawStandardEnemy(enemy) {
  const cx = enemy.x + enemy.size / 2;
  const cy = enemy.y + enemy.size / 2;

  if (enemy.elite) {
    ctx.strokeStyle = enemy.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, enemy.size * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  if (enemy.type === "melee") {
    ctx.moveTo(cx, enemy.y);
    ctx.lineTo(enemy.x + enemy.size, enemy.y + enemy.size);
    ctx.lineTo(enemy.x, enemy.y + enemy.size);
    ctx.closePath();
  } else if (enemy.type === "lazer") {
    ctx.rect(enemy.x, enemy.y + enemy.size * 0.18, enemy.size, enemy.size * 0.64);
  } else {
    ctx.arc(cx, cy, enemy.size / 2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();

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

function drawBossEnemy(enemy) {
  const cx = enemy.x + enemy.size / 2;
  const cy = enemy.y + enemy.size / 2;
  const t = performance.now() * 0.002;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t);
  ctx.strokeStyle = enemy.accent || "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    const r = enemy.size * (i % 2 ? 0.58 : 0.82);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(cx, cy, enemy.size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = enemy.accent || "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, enemy.size * (0.54 + Math.sin(t * 2) * 0.04), 0, Math.PI * 2);
  ctx.stroke();
}
