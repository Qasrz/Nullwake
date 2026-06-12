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
  },
  splitter: {
    color: '#f97316',
    getSize: () => ENEMY_SIZE * 0.92,
    getSpeed: () => MELEE_SPEED * 0.82,
    getFireInterval: () => 1700,
    getHealth: (enemyLevel) => getScaledEnemyHealth('splitter', enemyLevel)
  },
  orbiter: {
    color: '#14b8a6',
    getSize: () => ENEMY_SIZE * 0.9,
    getSpeed: () => SHOOTER_SPEED * 1.04,
    getFireInterval: () => 1450,
    getHealth: (enemyLevel) => getScaledEnemyHealth('orbiter', enemyLevel)
  },
  miniboss: {
    color: '#f59e0b',
    getSize: () => ENEMY_SIZE * 2.05,
    getSpeed: () => MELEE_SPEED * 0.58,
    getFireInterval: () => 1050,
    getHealth: (enemyLevel) => getScaledEnemyHealth('miniboss', enemyLevel)
  }
};

const ELITE_DEFS = [
  { id: "overcharged", name: "Overcharged", color: "#67e8f9", health: 1.45, damage: 1.25, speed: 1.05 },
  { id: "vampiric", name: "Vampiric", color: "#fb7185", health: 1.25, damage: 1.35, speed: 1.0 },
  { id: "swift", name: "Swift", color: "#fde047", health: 1.1, damage: 1.1, speed: 1.35 }
];

const MINI_BOSS_DEFS = [
  { id: "bulwark", name: "Forge Bulwark", color: "#f97316", accent: "#fed7aa" },
  { id: "siren", name: "Null Siren", color: "#a78bfa", accent: "#ddd6fe" },
  { id: "clockwork", name: "Clockwork Knight", color: "#38bdf8", accent: "#cffafe" }
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
  const minibossMultiplier = enemy.type === 'miniboss' ? 4 : 1;
  const eliteMultiplier = enemy.elite ? 2 : 1;
  return enemy.level * ENEMY_XP_PER_LEVEL * bossMultiplier * minibossMultiplier * eliteMultiplier;
}

function getEnemyGoldReward(enemy) {
  if (enemy.type === 'boss') return 120 + enemy.level * 10;
  if (enemy.type === 'miniboss') return Math.floor((70 + enemy.level * 6) * (enemy.elite ? 1.8 : 1));
  return Math.floor((4 + enemy.level * 2) * (enemy.elite ? 2.25 : 1) * getArtifactGoldRewardMultiplier(enemy));
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

function chooseEnemyTypeForCurrentRoute(forceBoss = false) {
  if (forceBoss) return "boss";

  if (currentStageRoute && currentStageRoute.mode === "miniboss" && !routeMinibossSpawned) {
    routeMinibossSpawned = true;
    return "miniboss";
  }

  const pool = typeof getEnemyPoolForCurrentRoute === "function"
    ? getEnemyPoolForCurrentRoute()
    : ["shooter", "melee", "mage", "lazer"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function chooseMiniBossDef() {
  return MINI_BOSS_DEFS[Math.floor(Math.random() * MINI_BOSS_DEFS.length)];
}

function spawnEnemy(timestamp, forceBoss = false) {
  const type = chooseEnemyTypeForCurrentRoute(forceBoss);
  const config = ENEMY_CONFIGS[type];
  const enemyLevel = getEnemyLevelForStage(currentLevel);
  
  const pos = forceBoss 
    ? { x: WIDTH / 2 - BOSS_SIZE / 2, y: 100 } 
    : randomSpawnPosition();
    
  const runDifficulty = getRunDifficultyMultiplier(timestamp);
  const modeDifficulty = getDifficultyDef();
  const routeScale = forceBoss || typeof getCurrentRouteEnemyStatMultiplier !== "function"
    ? { health: 1, damage: 1 }
    : getCurrentRouteEnemyStatMultiplier();
  const health = Math.floor(config.getHealth(enemyLevel) * runDifficulty * modeDifficulty.health * routeScale.health);
  const damage = Math.floor(getScaledEnemyDamage(type, enemyLevel) * Math.pow(runDifficulty, 0.85) * modeDifficulty.damage * routeScale.damage);
  const fireInterval = config.getFireInterval();

  // Determine the initial lastFire timestamp
  let initialLastFire = timestamp + Math.random() * 1000;
  
  // FIX: If it's a lazer enemy, reduce its initial spawn-in wait time
  if (type === 'lazer') {
    const initialDelay = 1000 + Math.random() * 1000; // Gives it a brief 400ms - 800ms window before firing
    initialLastFire = timestamp - fireInterval + initialDelay;
  } else if (type === "miniboss") {
    initialLastFire = timestamp + 900;
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
    dashVy: 0,
    orbitDir: Math.random() < 0.5 ? -1 : 1,
    orbitAngle: Math.random() * Math.PI * 2
  };

  if (forceBoss) {
    initializeBossEnemy(enemy, timestamp);
  } else if (type === "miniboss") {
    const miniBoss = chooseMiniBossDef();
    enemy.miniBossId = miniBoss.id;
    enemy.miniBossName = miniBoss.name;
    enemy.color = miniBoss.color;
    enemy.accent = miniBoss.accent;
    enemy.maxHealth = Math.floor(enemy.maxHealth * (currentStageRoute && currentStageRoute.elite ? 1.35 : 1));
    enemy.health = enemy.maxHealth;
    enemy.damage = Math.floor(enemy.damage * (currentStageRoute && currentStageRoute.elite ? 1.18 : 1));
    enemy.baseSpeed *= currentStageRoute && currentStageRoute.elite ? 1.08 : 1;
    enemy.dashAvailableAt = timestamp + 1100;
  } else {
    maybeApplyElite(enemy);
  }

  enemies.push(enemy);
  
  enemiesSpawned++;
}

function maybeApplyElite(enemy) {
  const routeEliteBonus = currentStageRoute && currentStageRoute.elite ? 0.24 : 0;
  const eliteChance = clamp(((0.08 + currentLevel * 0.012) * getDifficultyDef().eliteChance * getArtifactEliteChanceMultiplier()) + routeEliteBonus, 0, 0.68);
  if ((!currentStageRoute || !currentStageRoute.elite) && currentLevel < 3) return;
  if (Math.random() > eliteChance) return;

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

function spawnSplitChildren(parent) {
  const config = ENEMY_CONFIGS.splitter;
  const childCount = parent.elite ? 3 : 2;

  for (let i = 0; i < childCount; i++) {
    const angle = (Math.PI * 2 * i) / childCount + Math.random() * 0.35;
    const health = Math.max(12, Math.floor(parent.maxHealth * 0.28));
    enemies.push({
      id: nextEnemyId++,
      x: clamp(parent.x + Math.cos(angle) * 18, 30, WIDTH - 30),
      y: clamp(parent.y + Math.sin(angle) * 18, 30, HEIGHT - 30),
      size: parent.size * 0.72,
      health,
      maxHealth: health,
      level: parent.level,
      damage: Math.max(6, Math.floor(parent.damage * 0.48)),
      type: "splitter",
      color: parent.color || config.color,
      baseSpeed: config.getSpeed() * 1.35,
      fireInterval: 0,
      lastFire: performance.now() + 1200,
      isDashing: false,
      dashEndsAt: 0,
      dashAvailableAt: performance.now() + 260,
      dashVx: 0,
      dashVy: 0,
      splitChild: true,
      summoned: true,
      orbitDir: Math.random() < 0.5 ? -1 : 1,
      orbitAngle: Math.random() * Math.PI * 2
    });
  }
}

function clampEnemyToCanvas(enemy) {
  enemy.x = Math.max(0, Math.min(WIDTH - enemy.size, enemy.x));
  enemy.y = Math.max(0, Math.min(HEIGHT - enemy.size, enemy.y));
}

function startMeleeDash(enemy, dx, dy, dist, timestamp) {
  if (dist <= 0) return;
  enemy.isDashing = true;
  enemy.lastAttackAt = timestamp;
  enemy.dashEndsAt = timestamp + MELEE_DASH_DURATION_MS;
  enemy.dashVx = (dx / dist) * MELEE_DASH_SPEED * (enemy.elite ? 1.08 : 1);
  enemy.dashVy = (dy / dist) * MELEE_DASH_SPEED * (enemy.elite ? 1.08 : 1);
}

function handleOrbiterMovement(enemy, center, dist, timestamp, delta) {
  enemy.orbitAngle += enemy.orbitDir * 0.026 * (delta / 16);
  const orbitRadius = 230 + Math.sin(timestamp * 0.001 + enemy.id) * 34;
  const targetX = center.x + Math.cos(enemy.orbitAngle) * orbitRadius - enemy.size / 2;
  const targetY = center.y + Math.sin(enemy.orbitAngle) * orbitRadius - enemy.size / 2;
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const targetDist = Math.hypot(dx, dy);
  const step = enemy.baseSpeed * 1.3 * (delta / 16);

  if (targetDist > 0) {
    enemy.x += (dx / targetDist) * Math.min(step, targetDist);
    enemy.y += (dy / targetDist) * Math.min(step, targetDist);
  } else if (dist > 0) {
    enemy.x += Math.cos(enemy.orbitAngle) * step;
    enemy.y += Math.sin(enemy.orbitAngle) * step;
  }
}

function handleMiniBossMovement(enemy, center, dx, dy, dist, timestamp, delta) {
  const step = enemy.baseSpeed * (delta / 16);

  if (enemy.isDashing) {
    if (timestamp >= enemy.dashEndsAt) {
      enemy.isDashing = false;
      enemy.dashAvailableAt = timestamp + (enemy.miniBossId === "bulwark" ? 1800 : 2400);
    } else {
      enemy.x += enemy.dashVx * (delta / 16);
      enemy.y += enemy.dashVy * (delta / 16);
    }
    return;
  }

  if (enemy.miniBossId === "bulwark") {
    if (dist < 430 && timestamp >= enemy.dashAvailableAt) {
      startMeleeDash(enemy, dx, dy, dist, timestamp);
      enemy.dashEndsAt = timestamp + 360;
      enemy.dashVx *= 0.82;
      enemy.dashVy *= 0.82;
    } else if (dist > 145 && dist > 0) {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }
  } else if (enemy.miniBossId === "siren") {
    if (dist > 360 && dist > 0) {
      enemy.x += (dx / dist) * step * 0.9;
      enemy.y += (dy / dist) * step * 0.9;
    } else if (dist < 250 && dist > 0) {
      enemy.x -= (dx / dist) * step * 1.2;
      enemy.y -= (dy / dist) * step * 1.2;
    } else {
      enemy.x += (-dy / Math.max(1, dist)) * step * 0.8 * enemy.orbitDir;
      enemy.y += (dx / Math.max(1, dist)) * step * 0.8 * enemy.orbitDir;
    }
  } else {
    enemy.orbitAngle += enemy.orbitDir * 0.018 * (delta / 16);
    const targetX = center.x + Math.cos(enemy.orbitAngle) * 210 - enemy.size / 2;
    const targetY = center.y + Math.sin(enemy.orbitAngle) * 210 - enemy.size / 2;
    const tx = targetX - enemy.x;
    const ty = targetY - enemy.y;
    const targetDist = Math.hypot(tx, ty);
    if (targetDist > 0) {
      enemy.x += (tx / targetDist) * Math.min(step, targetDist);
      enemy.y += (ty / targetDist) * Math.min(step, targetDist);
    }
  }
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

  if (enemy.type === "orbiter") {
    handleOrbiterMovement(enemy, center, dist, timestamp, delta);
  } else if (enemy.type === "miniboss") {
    handleMiniBossMovement(enemy, center, dx, dy, dist, timestamp, delta);
  } else if (enemy.type === 'melee' || enemy.type === "splitter") {
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
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'mage') {
    if (enemy.elite) {
      fireEliteMageBurst(enemy, center, timestamp);
    } else if (Math.random() > 0.5) fireEnemyProjectile(enemy, true);
    else createLightning(center.x, center.y, timestamp, enemy.damage);
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  } else if (enemy.type === 'lazer') {
    if (enemy.elite) createTwinLazerBeamHazard(enemy, center, timestamp);
    else createLazerBeamHazard(enemy, center, timestamp);
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  } else if (enemy.type === "splitter") {
    fireEnemyRadial(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.elite ? 8 : 5, {
      speed: ENEMY_PROJECTILE_SPEED * 0.82,
      radius: ENEMY_PROJECTILE_RADIUS * 0.78,
      damage: enemy.damage * 0.62,
      color: enemy.color,
      offset: timestamp * 0.001
    });
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  } else if (enemy.type === "orbiter") {
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const angle = Math.atan2(center.y - ey, center.x - ex);
    fireEnemyArc(ex, ey, angle, Math.PI / 2.7, enemy.elite ? 5 : 3, {
      speed: ENEMY_PROJECTILE_SPEED * 1.08,
      radius: ENEMY_PROJECTILE_RADIUS * 0.88,
      damage: enemy.damage * 0.78,
      color: enemy.color,
      wave: 0.2
    });
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  } else if (enemy.type === "miniboss") {
    fireMiniBossPattern(enemy, center, timestamp);
    enemy.lastAttackAt = timestamp;
    enemy.lastFire = timestamp;
  }
}

function fireMiniBossPattern(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const angle = Math.atan2(center.y - ey, center.x - ex);

  if (enemy.miniBossId === "bulwark") {
    fireEnemyArc(ex, ey, angle, Math.PI / 2.2, 7, {
      speed: ENEMY_PROJECTILE_SPEED * 0.95,
      radius: ENEMY_PROJECTILE_RADIUS,
      damage: enemy.damage * 0.74,
      color: enemy.color
    });
    if (Math.random() < 0.35) createBossImpactHazard(center.x, center.y, 38, timestamp, enemy.damage * 0.65, enemy.color);
  } else if (enemy.miniBossId === "siren") {
    fireEnemyRadial(ex, ey, 12, {
      speed: ENEMY_PROJECTILE_SPEED * 0.86,
      radius: ENEMY_PROJECTILE_RADIUS * 0.9,
      damage: enemy.damage * 0.62,
      color: enemy.color,
      gapAngle: angle,
      gapSize: 0.18,
      offset: timestamp * 0.001
    });
    fireEnemyBullet(ex, ey, angle, {
      speed: ENEMY_PROJECTILE_SPEED * 0.9,
      radius: ENEMY_PROJECTILE_RADIUS,
      damage: enemy.damage * 0.72,
      color: enemy.accent,
      homing: true,
      turnRate: 0.01
    });
  } else {
    createTimeSnare(center.x + randRange(-90, 90), center.y + randRange(-90, 90), 54, timestamp, enemy.damage * 0.55, enemy.color);
    fireEnemyRadial(ex, ey, 8, {
      speed: ENEMY_PROJECTILE_SPEED * 1.04,
      radius: ENEMY_PROJECTILE_RADIUS * 0.82,
      damage: enemy.damage * 0.58,
      color: enemy.accent,
      offset: timestamp * 0.002
    });
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
    if (enemy.objective) {
      clampEnemyToCanvas(enemy);
    } else if (enemy.type === "boss") {
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
  if (enemy.objective) {
    drawBossObjective(enemy);
    return;
  }

  const cx = enemy.x + enemy.size / 2;
  const cy = enemy.y + enemy.size / 2;
  const now = performance.now();
  const attackFrame = enemy.isDashing || now - (enemy.lastAttackAt || -Infinity) < 420;
  const spriteRow = attackFrame ? "attack" : "move";

  if (enemy.elite) {
    drawSpriteCentered("enemies", "elites", cx, cy, enemy.size * 2.15, enemy.elite, {
      timestamp: now,
      fps: 6,
      seed: enemy.id,
      alpha: 0.75,
      shadowColor: enemy.color,
      shadowBlur: 12
    });
    ctx.strokeStyle = enemy.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, enemy.size * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const drewSprite = drawSpriteCentered("enemies", enemy.type, cx, cy, enemy.size * 1.85, spriteRow, {
    timestamp: now,
    fps: attackFrame ? 12 : 7,
    seed: enemy.id,
    shadowColor: enemy.elite ? enemy.color : "rgba(0, 0, 0, 0.7)",
    shadowBlur: enemy.elite ? 10 : 4
  });

  if (!drewSprite) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    if (enemy.type === "melee") {
      ctx.moveTo(cx, enemy.y);
      ctx.lineTo(enemy.x + enemy.size, enemy.y + enemy.size);
      ctx.lineTo(enemy.x, enemy.y + enemy.size);
      ctx.closePath();
    } else if (enemy.type === "splitter") {
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
        const x = cx + Math.cos(angle) * enemy.size * 0.52;
        const y = cy + Math.sin(angle) * enemy.size * 0.52;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (enemy.type === "orbiter") {
      ctx.arc(cx, cy, enemy.size / 2, 0, Math.PI * 2);
      ctx.moveTo(cx + enemy.size * 0.78, cy);
      ctx.arc(cx, cy, enemy.size * 0.78, 0, Math.PI * 2);
    } else if (enemy.type === "miniboss") {
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI / 8 + (Math.PI * 2 * i) / 8;
        const r = i % 2 === 0 ? enemy.size * 0.55 : enemy.size * 0.38;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
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
  }

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

function drawBossObjective(enemy) {
  const cx = enemy.x + enemy.size / 2;
  const cy = enemy.y + enemy.size / 2;
  const t = performance.now() * 0.004 + enemy.id;
  const pulse = 0.8 + Math.sin(t * 2) * 0.12;
  const color = enemy.color || "#f8fafc";
  const accent = enemy.accent || "#0f172a";

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.45);
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.size * 0.72 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#020617";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (enemy.objectiveType === "prismFocus") {
    ctx.moveTo(0, -enemy.size * 0.55);
    ctx.lineTo(enemy.size * 0.55, 0);
    ctx.lineTo(0, enemy.size * 0.55);
    ctx.lineTo(-enemy.size * 0.55, 0);
  } else if (enemy.objectiveType === "voidAnchor") {
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI * 2 * i / 6;
      const r = i % 2 ? enemy.size * 0.42 : enemy.size * 0.62;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    ctx.rect(-enemy.size * 0.42, -enemy.size * 0.42, enemy.size * 0.84, enemy.size * 0.84);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const healthRatio = enemy.health / enemy.maxHealth;
  ctx.fillStyle = "#334155";
  ctx.fillRect(enemy.x, enemy.y - 9, enemy.size, 4);
  ctx.fillStyle = color;
  ctx.fillRect(enemy.x, enemy.y - 9, enemy.size * healthRatio, 4);
}

function drawBossEnemy(enemy) {
  const cx = enemy.x + enemy.size / 2;
  const cy = enemy.y + enemy.size / 2;
  const now = performance.now();
  const t = now * 0.002;

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

  if (enemy.invulnerable) {
    const shieldPulse = 0.62 + Math.sin(now * 0.008) * 0.18;
    ctx.strokeStyle = enemy.accent || "#f8fafc";
    ctx.globalAlpha = shieldPulse;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, enemy.size * 1.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const spriteRow = now - (enemy.lastPatternAt || -Infinity) < 620
    ? "attack"
    : now - (enemy.phaseChangedAt || -Infinity) < 900 || enemy.phase >= 3
      ? "phase"
      : "idle";
  const drewSprite = drawSpriteCentered("bosses", enemy.bossId, cx, cy, enemy.size * 2.45, spriteRow, {
    timestamp: now,
    fps: spriteRow === "attack" ? 7 : 4,
    seed: enemy.phase || 1,
    shadowColor: enemy.accent || enemy.color,
    shadowBlur: 18
  });

  if (drewSprite) return;

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
