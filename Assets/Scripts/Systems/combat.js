function fireLaser(targetX, targetY, timestamp = performance.now()) {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  if (isPlayerFrozen(timestamp)) return;

  const character = getSelectedCharacterDef();
  const primaryCooldown = character.primary ? character.primary.cooldown : LASER_FIRE_INTERVAL_MS;
  const currentCooldown = primaryCooldown / getAttackSpeedMultiplier();
  if (timestamp - player.lastLaserFire < currentCooldown) return;

  player.lastLaserFire = timestamp;
  firePrimaryAttack(character.id, targetX, targetY, timestamp);
}

function firePrimaryAttack(characterId, targetX, targetY, timestamp = performance.now()) {
  if (characterId === "alchemist") {
    const center = getPlayerCenter();
    const distance = Math.min(390, Math.hypot(targetX - center.x, targetY - center.y));
    const damageRoll = rollDamage(LASER_DAMAGE, 1.05, true);
    firePlayerProjectile(targetX, targetY, {
      origin: center,
      kind: "flask",
      damage: damageRoll.damage * 0.25,
      radius: 7,
      speed: 5.7,
      maxDistance: Math.max(80, distance),
      explodeOnExpire: true,
      explodesOnHit: true,
      explosionDamage: damageRoll.damage,
      explosionRadius: 48,
      zoneOnDetonate: {
        radius: 42,
        damagePerTick: damageRoll.damage * 0.08,
        duration: 1700,
        tickRate: 520,
        color: "rgba(190, 242, 100, 0.22)"
      },
      color: "#bef264"
    });
    burstParticles(center.x, center.y, "#bef264", 2, 1.2);
  } else if (characterId === "stormcaller") {
    firePlayerProjectile(targetX, targetY, {
      kind: "spark",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 0.82,
      radius: 5,
      speed: LASER_SPEED * 0.95,
      basePierce: 1,
      chainLightning: true,
      color: "#67e8f9"
    });
  } else if (characterId === "voidblade") {
    firePlayerProjectile(targetX, targetY, {
      kind: "blade",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 1.1,
      radius: 8,
      speed: LASER_SPEED * 0.92,
      basePierce: 1,
      maxDistance: 430,
      color: "#c4b5fd"
    });
  } else if (characterId === "engineer") {
    firePlayerProjectile(targetX, targetY, {
      kind: "rivet",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 0.95,
      radius: 5,
      speed: LASER_SPEED * 1.05,
      color: "#fdba74"
    });
  } else {
    firePlayerProjectile(targetX, targetY, {
      kind: "basic",
      baseDamage: LASER_DAMAGE,
      radius: LASER_RADIUS,
      speed: LASER_SPEED,
      color: getSelectedCharacterDef().projectileColor
    });
  }
}

function firePlayerProjectile(targetX, targetY, options = {}) {
  const origin = options.origin || getPlayerCenter();
  const dx = targetX - origin.x;
  const dy = targetY - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;

  return firePlayerProjectileAtAngle(Math.atan2(dy, dx), {
    ...options,
    origin,
    targetDistance: options.targetDistance || length
  });
}

function firePlayerProjectileAtAngle(angle, options = {}) {
  const origin = options.origin || getPlayerCenter();
  const useItemModifiers = options.useItemModifiers !== false;
  const explosiveStacks = useItemModifiers ? getItemStack("explosive") : 0;
  const itemExplosion = explosiveStacks > 0;
  const damageRoll = options.damage !== undefined
    ? { damage: options.damage, isCrit: options.isCrit || false }
    : rollDamage(
        options.baseDamage || LASER_DAMAGE,
        options.damageMultiplier || 1,
        options.canCrit !== false,
        options.includePlayerScaling !== false
      );

  const itemBounces = useItemModifiers ? getItemStack("bounce") : 0;
  const itemPierce = useItemModifiers ? getItemStack("pierce") : 0;
  const bouncesRemaining = (options.baseBounces || 0) + itemBounces + (options.bonusBounces || 0);
  const pierceRemaining = (options.basePierce || 0) + itemPierce + (options.bonusPierce || 0);

  const projectile = {
    x: origin.x,
    y: origin.y,
    vx: Math.cos(angle) * (options.speed || LASER_SPEED),
    vy: Math.sin(angle) * (options.speed || LASER_SPEED),
    radius: options.radius || LASER_RADIUS,
    damage: damageRoll.damage,
    isCrit: damageRoll.isCrit,
    color: options.color || getSelectedCharacterDef().projectileColor,
    kind: options.kind || "basic",
    bouncesRemaining,
    pierceRemaining,
    maxPierce: pierceRemaining,
    explosive: options.explosive || itemExplosion,
    explodesOnHit: options.explodesOnHit || false,
    explodeOnExpire: options.explodeOnExpire || false,
    explosionRadius: options.explosionRadius || (itemExplosion ? 55 + (explosiveStacks - 1) * 15 : 0),
    explosionDamage: options.explosionDamage,
    explosionDamageRatio: options.explosionDamageRatio || (itemExplosion ? 0.5 + (explosiveStacks - 1) * 0.1 : 0),
    canCritExplosion: options.canCritExplosion !== false,
    splitOnHit: options.splitOnHit || false,
    scatterDepth: options.scatterDepth || 0,
    chainLightning: options.chainLightning || false,
    zoneOnDetonate: options.zoneOnDetonate || null,
    hitEnemyIds: [],
    distanceTraveled: 0,
    maxDistance: options.maxDistance || null,
    targetDistance: options.targetDistance || null,
    miniGrenade: options.miniGrenade || false,
    source: options.source || "weapon",
    expired: false
  };

  lasers.push(projectile);
  return projectile;
}

function fireProjectileSpread(targetX, targetY, count, spreadRadians, options = {}) {
  const origin = options.origin || getPlayerCenter();
  const angle = Math.atan2(targetY - origin.y, targetX - origin.x);
  const middle = (count - 1) / 2;

  for (let i = 0; i < count; i++) {
    firePlayerProjectileAtAngle(angle + (i - middle) * spreadRadians, {
      ...options,
      origin
    });
  }
}

function updatePlayerProjectiles(delta, timestamp) {
  const step = delta / 16;

  for (const projectile of lasers) {
    const dx = projectile.vx * step;
    const dy = projectile.vy * step;
    projectile.x += dx;
    projectile.y += dy;
    projectile.distanceTraveled += Math.hypot(dx, dy);

    let bounced = false;
    if (projectile.x < projectile.radius || projectile.x > WIDTH - projectile.radius) {
      projectile.vx *= -1;
      projectile.x = Math.max(projectile.radius, Math.min(WIDTH - projectile.radius, projectile.x));
      bounced = true;
    }
    if (projectile.y < projectile.radius || projectile.y > HEIGHT - projectile.radius) {
      projectile.vy *= -1;
      projectile.y = Math.max(projectile.radius, Math.min(HEIGHT - projectile.radius, projectile.y));
      bounced = true;
    }

    if (bounced) {
      if (projectile.bouncesRemaining > 0) {
        projectile.bouncesRemaining--;
        const loopStacks = getItemStack("kineticLoop");
        if (loopStacks > 0) projectile.damage *= 1 + loopStacks * 0.25;
        visualEffects.push({
          type: "ring",
          x: projectile.x,
          y: projectile.y,
          radius: 20,
          color: "rgba(96, 165, 250, 0.45)",
          createdAt: timestamp,
          endsAt: timestamp + 260
        });
      } else {
        if (projectile.explodeOnExpire) detonateProjectile(projectile, projectile.x, projectile.y);
        projectile.expired = true;
      }
    }

    if (projectile.maxDistance && projectile.distanceTraveled >= projectile.maxDistance) {
      if (projectile.explodeOnExpire) detonateProjectile(projectile, projectile.x, projectile.y);
      projectile.expired = true;
    }
  }

  lasers = lasers.filter(projectile => !projectile.expired && isOnScreen(projectile));
}

function detonateProjectile(projectile, x, y) {
  const repeatableImpactExplosion = projectile.explosive && !projectile.explodesOnHit && !projectile.explodeOnExpire;
  if (projectile.hasDetonated && !repeatableImpactExplosion) return;
  if (!repeatableImpactExplosion) projectile.hasDetonated = true;

  const radius = projectile.explosionRadius || 60;
  const damage = projectile.explosionDamage !== undefined
    ? projectile.explosionDamage
    : projectile.damage * (projectile.explosionDamageRatio || 0.5);

  createPlayerExplosion(x, y, radius, damage, {
    canCrit: projectile.canCritExplosion,
    color: projectile.kind === "grenade" || projectile.kind === "flask" ? "rgba(251, 146, 60, 0.45)" : "rgba(250, 204, 21, 0.4)"
  });

  if (projectile.zoneOnDetonate) {
    createPlayerDamageZone(
      x,
      y,
      projectile.zoneOnDetonate.radius,
      projectile.zoneOnDetonate.damagePerTick,
      projectile.zoneOnDetonate.duration,
      projectile.zoneOnDetonate.tickRate || 500,
      projectile.zoneOnDetonate.color
    );
  }

  const clusterStacks = getItemStack("gunnerCluster");
  if (projectile.kind === "grenade" && !projectile.miniGrenade && clusterStacks > 0) {
    const count = 4 + Math.min(4, clusterStacks - 1);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      firePlayerProjectileAtAngle(angle, {
        origin: { x, y },
        kind: "grenade",
        damage: 0,
        radius: 5,
        speed: 4.2,
        maxDistance: 70 + clusterStacks * 12,
        explodeOnExpire: true,
        explosionDamage: damage * (0.32 + (clusterStacks - 1) * 0.08),
        explosionRadius: radius * 0.48,
        color: "#fb923c",
        useItemModifiers: false,
        miniGrenade: true
      });
    }
  }
}

function createPlayerExplosion(x, y, radius, baseDamage, options = {}) {
  const now = performance.now();
  visualEffects.push({
    type: "ring",
    sprite: "explosion",
    x,
    y,
    radius,
    color: options.color || "rgba(250, 204, 21, 0.38)",
    createdAt: now,
    endsAt: now + 360
  });

  if (baseDamage > 0) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;
      const dist = Math.hypot(x - ex, y - ey);
      if (dist <= radius + enemy.size / 2) {
        const falloff = 1 - Math.min(0.35, (dist / radius) * 0.35);
        const damageRoll = rollDamage(baseDamage * falloff, 1, options.canCrit !== false, false);
        dealDamageToEnemy(enemy, damageRoll.damage, { source: "explosion", isCrit: damageRoll.isCrit });
      }
    }
  }

  const fuseStacks = getItemStack("fuseOil");
  if (fuseStacks > 0 && options.createFuseOil !== false && baseDamage > 0) {
    createPlayerDamageZone(
      x,
      y,
      radius * 0.62,
      baseDamage * (0.12 + fuseStacks * 0.04),
      2800 + fuseStacks * 450,
      520,
      "rgba(251, 113, 133, 0.24)"
    );
  }

  cleanupDeadEnemies();
}

function createPlayerDamageZone(x, y, radius, damagePerTick, duration, tickRate = 500, color = "rgba(52, 211, 153, 0.22)") {
  const now = performance.now();
  playerZones.push({
    x,
    y,
    radius,
    damagePerTick,
    tickRate,
    nextTick: now,
    color,
    createdAt: now,
    endsAt: now + duration
  });
}

function updatePlayerZones(timestamp) {
  const remaining = [];

  for (const zone of playerZones) {
    if (timestamp > zone.endsAt) continue;

    if (timestamp >= zone.nextTick) {
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const ex = enemy.x + enemy.size / 2;
        const ey = enemy.y + enemy.size / 2;
        if (circlesOverlap(zone.x, zone.y, zone.radius, ex, ey, enemy.size / 2)) {
          dealDamageToEnemy(enemy, zone.damagePerTick, { source: "zone" });
        }
      }
      zone.nextTick = timestamp + zone.tickRate;
    }

    remaining.push(zone);
  }

  playerZones = remaining;
  cleanupDeadEnemies();
}

function updateVisualEffects(timestamp) {
  visualEffects = visualEffects.filter(effect => timestamp < effect.endsAt);
}

function dealDamageToEnemy(enemy, amount, info = {}) {
  if (!enemy || enemy.dead) return;
  if (enemy.type === "boss" && enemy.invulnerable && amount > 0) {
    const now = performance.now();
    if (now - (enemy.lastImmuneTextAt || -Infinity) > 420) {
      enemy.lastImmuneTextAt = now;
      addFloatingText("IMMUNE", enemy.x + enemy.size / 2, enemy.y - enemy.size * 0.25, enemy.accent || "#f8fafc", 15);
    }
    return;
  }

  enemy.health -= amount;
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const color = info.isCrit ? "#fb7185" : "#f8fafc";
  addFloatingText(`${Math.ceil(amount)}`, ex + randRange(-8, 8), ey - enemy.size * 0.65, color, info.isCrit ? 18 : 13);

  if (info.isCrit) {
    burstParticles(ex, ey, "#fb7185", 3, 1.8);
  }

  if (enemy.health <= 0) {
    killEnemy(enemy, info);
  }
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  if (enemy.objective) {
    enemy.dead = true;
    enemy.health = 0;
    const ox = enemy.x + enemy.size / 2;
    const oy = enemy.y + enemy.size / 2;
    burstParticles(ox, oy, enemy.color || "#f8fafc", 18, 3.6);
    addScreenShake(4, 170);
    addFloatingText("BROKEN", ox, oy - enemy.size * 0.7, enemy.color || "#f8fafc", 14);
    return;
  }

  noteEnemyKilled(enemy);
  enemy.dead = true;
  enemy.health = 0;

  gainXp(getEnemyXpReward(enemy));
  dropGoldForEnemy(enemy);

  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  burstParticles(ex, ey, enemy.color || "#f8fafc", enemy.type === "boss" ? 42 : 12, enemy.type === "boss" ? 5.5 : 2.5);
  addScreenShake(enemy.type === "boss" ? 16 : 3, enemy.type === "boss" ? 650 : 160);

  if (enemy.type === "splitter" && !enemy.splitChild && typeof spawnSplitChildren === "function") {
    spawnSplitChildren(enemy);
  }

  if (enemy.type === "boss") {
    showToast(`${enemy.bossName || "Boss"} defeated`, "The rift stabilizes. Claim your spoils.", 2800);
    activeArena = null;
    clearBossObjectives(enemy);
  }
}

function dropGoldForEnemy(enemy) {
  const totalGold = getEnemyGoldReward(enemy);
  const coinCount = enemy.type === "boss" ? 18 : enemy.type === "miniboss" ? 12 : Math.max(2, Math.min(8, Math.ceil(totalGold / 3)));
  let remaining = totalGold;

  for (let i = 0; i < coinCount; i++) {
    const coinsLeft = coinCount - i;
    const value = Math.max(1, Math.ceil(remaining / coinsLeft));
    remaining -= value;
    goldDrops.push({
      x: enemy.x + enemy.size / 2 + (Math.random() * 28 - 14),
      y: enemy.y + enemy.size / 2 + (Math.random() * 28 - 14),
      radius: GOLD_RADIUS,
      value
    });
  }
}

function cleanupDeadEnemies() {
  enemies = enemies.filter(enemy => !enemy.dead && enemy.health > 0);
}

function handleProjectileExtras(projectile, enemy) {
  if (projectile.splitOnHit && projectile.scatterDepth > 0) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const count = 3;
    const spread = Math.PI / 8;
    const middle = (count - 1) / 2;

    for (let i = 0; i < count; i++) {
      firePlayerProjectileAtAngle(angle + (i - middle) * spread, {
        origin: { x: projectile.x, y: projectile.y },
        kind: "scatter-split",
        damage: projectile.damage * 0.5,
        radius: Math.max(3, projectile.radius * 0.75),
        speed: LASER_SPEED * 0.95,
        basePierce: Math.max(0, Math.floor(projectile.maxPierce / 2)),
        baseBounces: Math.max(0, Math.floor(projectile.bouncesRemaining / 2)),
        color: "#7dd3fc",
        useItemModifiers: false,
        scatterDepth: projectile.scatterDepth - 1
      });
    }
  }

  const stormStacks = getItemStack("stormNeedle");
  const projectileCanArc = projectile.chainLightning || projectile.maxPierce > 0 || getItemStack("pierce") > 0;
  if (stormStacks > 0 && projectileCanArc) {
    chainLightningFrom(enemy, projectile.damage * (0.28 + stormStacks * 0.08), 1 + Math.floor(stormStacks / 2), [enemy.id]);
  }
}

function chainLightningFrom(sourceEnemy, baseDamage, jumps = 1, hitIds = []) {
  let current = sourceEnemy;

  for (let jump = 0; jump < jumps; jump++) {
    const sx = current.x + current.size / 2;
    const sy = current.y + current.size / 2;
    let nearest = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.dead || hitIds.includes(enemy.id)) continue;
      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;
      const dist = Math.hypot(ex - sx, ey - sy);
      if (dist < nearestDist && dist <= 280) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    if (!nearest) return;

    const ex = nearest.x + nearest.size / 2;
    const ey = nearest.y + nearest.size / 2;
    visualEffects.push({
      type: "line",
      x: sx,
      y: sy,
      x2: ex,
      y2: ey,
      color: "rgba(103, 232, 249, 0.8)",
      createdAt: performance.now(),
      endsAt: performance.now() + 180
    });

    const damageRoll = rollDamage(baseDamage * Math.pow(0.75, jump), 1, true, false);
    dealDamageToEnemy(nearest, damageRoll.damage, { source: "chain", isCrit: damageRoll.isCrit });
    hitIds.push(nearest.id);
    current = nearest;
  }
}

function createLightning(x, y, timestamp, damage = ENEMY_STATS.mage.damage) {
  hazards.push({
    type: 'lightning',
    x: x,
    y: y,
    radius: LIGHTNING_RADIUS,
    damage,
    strikesAt: timestamp + LIGHTNING_DELAY_MS,
    endsAt: timestamp + LIGHTNING_DELAY_MS + LIGHTNING_ACTIVE_MS,
    hasStruck: false
  });
}

function createLava(x, y, timestamp, damage = ENEMY_STATS.mage.damage) {
  hazards.push({ type: 'lava', x: x, y: y, radius: LAVA_RADIUS, damage, endsAt: timestamp + LAVA_DURATION_MS });
}

function createLazerBeamHazard(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  
  const leadTimeMS = 100;
  const predictedX = center.x + (player.vx || 0) * leadTimeMS;
  const predictedY = center.y + (player.vy || 0) * leadTimeMS;

  const dx = predictedX - ex;
  const dy = predictedY - ey;
  const playerAngle = Math.atan2(dy, dx);
  const duration = LAZER_BEAM_DURATION_MS;
  const beamThickness = typeof LAZER_BEAM_THICKNESS !== 'undefined' ? LAZER_BEAM_THICKNESS : 4;
  const sweepDir = Math.random() < 0.5 ? 1 : -1;
  const arc = Math.PI / 4;
  const initialAngle = playerAngle - (sweepDir * arc / 2);

  hazards.push({
    type: 'lazer_beam',
    enemy: enemy,
    playerAngle: playerAngle,
    createdAt: timestamp,
    endsAt: timestamp + duration,
    sweepDir: sweepDir,
    angle: initialAngle,
    radius: beamThickness,
    damage: enemy.damage
  });
}

function createTwinLazerBeamHazard(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const angle = Math.atan2(center.y - ey, center.x - ex);
  const duration = LAZER_BEAM_DURATION_MS * 0.72;
  const beamThickness = typeof LAZER_BEAM_THICKNESS !== 'undefined' ? LAZER_BEAM_THICKNESS : 4;
  const sweepDir = Math.random() < 0.5 ? 1 : -1;
  const arc = Math.PI / 4;

  for (const beamAngle of [angle, angle + Math.PI]) {
    hazards.push({
      type: 'lazer_beam',
      enemy: enemy,
      playerAngle: beamAngle,
      createdAt: timestamp,
      endsAt: timestamp + duration,
      sweepDir: sweepDir,
      angle: beamAngle - (sweepDir * arc / 2),
      radius: beamThickness + 1,
      damage: enemy.damage * 0.85,
      eliteTwin: true
    });
  }
}

function getLazerBeamAngle(h, timestamp) {
  const totalDuration = h.endsAt - h.createdAt;
  const halfDuration = totalDuration / 2;
  const elapsed = timestamp - h.createdAt;
  const arc = Math.PI / 4;
  const startAngle = h.playerAngle - (h.sweepDir * arc / 2); 

  if (elapsed < halfDuration) {
    const progress = elapsed / halfDuration;
    return startAngle + progress * (h.sweepDir * arc);
  } else {
    const progress = (elapsed - halfDuration) / halfDuration;
    return (startAngle + h.sweepDir * arc) - progress * (h.sweepDir * arc);
  }
}

function lineCircleOverlap(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(cx - x1, cy - y1) <= r;
  
  let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  
  return Math.hypot(cx - closestX, cy - closestY) <= r;
}

function fireEnemyProjectile(enemy, isFireball = false) {
  const center = getPlayerCenter();
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const dx = center.x - ex;
  const dy = center.y - ey;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  enemyProjectiles.push({
    x: ex, y: ey, startX: ex, startY: ey,
    vx: (dx / length) * ENEMY_PROJECTILE_SPEED,
    vy: (dy / length) * ENEMY_PROJECTILE_SPEED,
    radius: isFireball ? ENEMY_PROJECTILE_RADIUS * 1.5 : ENEMY_PROJECTILE_RADIUS,
    damage: enemy.damage,
    isFireball: isFireball,
    maxDist: length 
  });
}

function moveProjectiles(list, delta) {
  for (const p of list) {
    if (p.homing) {
      const center = getPlayerCenter();
      const targetAngle = Math.atan2(center.y - p.y, center.x - p.x);
      const currentAngle = Math.atan2(p.vy, p.vx);
      let angleDiff = targetAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const nextAngle = currentAngle + clamp(angleDiff, -(p.turnRate || 0.015), p.turnRate || 0.015);
      const speed = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(nextAngle) * speed;
      p.vy = Math.sin(nextAngle) * speed;
    }

    if (p.wave) {
      const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
      p.x += Math.cos(angle) * Math.sin(performance.now() * 0.01 + (p.waveOffset || 0)) * p.wave;
      p.y += Math.sin(angle) * Math.sin(performance.now() * 0.01 + (p.waveOffset || 0)) * p.wave;
    }

    p.x += p.vx * (delta / 16);
    p.y += p.vy * (delta / 16);
  }
}

function moveHazards(list, timestamp) {
  for (const h of list) {
    if (h.type === 'lazer_beam') {
      h.angle = getLazerBeamAngle(h, timestamp);
    } else if (h.type === 'boss_beam') {
      const progress = clamp((timestamp - h.createdAt) / Math.max(1, h.endsAt - h.createdAt), 0, 1);
      h.angle = h.startAngle + h.sweep * progress;
      if (h.anchored && h.enemy && !h.enemy.dead) {
        h.x = h.enemy.x + h.enemy.size / 2;
        h.y = h.enemy.y + h.enemy.size / 2;
      }
    } else if (h.type === 'gravity_well') {
      const center = getPlayerCenter();
      const dx = h.x - center.x;
      const dy = h.y - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < h.radius) {
        const pull = h.pull * (1 - dist / h.radius);
        player.x += (dx / dist) * pull;
        player.y += (dy / dist) * pull;
        player.x = clamp(player.x, 0, WIDTH - player.size);
        player.y = clamp(player.y, 0, HEIGHT - player.size);
      }
    }
  }
}

function updateHazards(timestamp) {
  const remaining = [];
  for (const h of hazards) {
    if (timestamp > h.endsAt) continue; 
    if (h.type === 'lightning' && timestamp >= h.strikesAt && !h.hasStruck) h.hasStruck = true; 
    if (h.type === 'boss_impact' && timestamp >= h.strikesAt && !h.hasStruck) {
      h.hasStruck = true;
      burstParticles(h.x, h.y, h.color || "#f97316", 18, 4);
      addScreenShake(5, 180);
    }
    if (h.type === 'time_snare' && timestamp >= h.strikesAt && !h.hasStruck) {
      h.hasStruck = true;
      burstParticles(h.x, h.y, h.color || "#38bdf8", 16, 3.4);
      addScreenShake(4, 150);
    }
    if (h.type === 'lazer_beam' && (h.enemy.dead || h.enemy.health <= 0)) continue;
    if (h.type === 'boss_beam' && h.enemy && (h.enemy.dead || h.enemy.health <= 0)) continue;
    remaining.push(h);
  }
  hazards = remaining;
}

function fireEnemyBullet(x, y, angle, options = {}) {
  const speed = options.speed || ENEMY_PROJECTILE_SPEED;
  enemyProjectiles.push({
    x,
    y,
    startX: x,
    startY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: options.radius || ENEMY_PROJECTILE_RADIUS,
    damage: options.damage || 1,
    color: options.color || "#ef4444",
    isFireball: options.isFireball || false,
    maxDist: options.maxDist || null,
    homing: options.homing || false,
    turnRate: options.turnRate || 0.015,
    wave: options.wave || 0,
    waveOffset: Math.random() * Math.PI * 2
  });
}

function angleDistance(a, b) {
  let diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

function fireEnemyRadial(x, y, count, options = {}) {
  const offset = options.offset || 0;
  for (let i = 0; i < count; i++) {
    const angle = offset + (Math.PI * 2 * i) / count;
    if (options.gapAngle !== undefined && angleDistance(angle, options.gapAngle) < (options.gapSize || 0)) continue;
    fireEnemyBullet(x, y, angle, options);
  }
}

function fireEnemyArc(x, y, centerAngle, arc, count, options = {}) {
  const start = centerAngle - arc / 2;
  const step = count <= 1 ? 0 : arc / (count - 1);
  for (let i = 0; i < count; i++) {
    fireEnemyBullet(x, y, start + step * i, options);
  }
}

function createBossBeamHazard(enemy, angle, timestamp, options = {}) {
  hazards.push({
    type: "boss_beam",
    enemy,
    x: enemy.x + enemy.size / 2,
    y: enemy.y + enemy.size / 2,
    startAngle: angle,
    angle,
    sweep: options.sweep || 0,
    createdAt: timestamp,
    warnsUntil: timestamp + (options.warning || 520),
    endsAt: timestamp + (options.duration || 1450),
    radius: options.width || 8,
    damage: enemy.damage * 1.1,
    color: options.color || enemy.color,
    anchored: options.anchored !== false
  });
}

function createBossImpactHazard(x, y, radius, timestamp, damage, color = "#f97316") {
  hazards.push({
    type: "boss_impact",
    x: clamp(x, 50, WIDTH - 50),
    y: clamp(y, 50, HEIGHT - 50),
    radius,
    damage,
    color,
    strikesAt: timestamp + 850,
    endsAt: timestamp + 1150,
    hasStruck: false
  });
}

function createGravityWell(x, y, radius, timestamp, damage, color = "#a78bfa") {
  hazards.push({
    type: "gravity_well",
    x: clamp(x, 60, WIDTH - 60),
    y: clamp(y, 60, HEIGHT - 60),
    radius,
    damage,
    color,
    pull: 2.4,
    nextTick: timestamp + 450,
    tickRate: 650,
    createdAt: timestamp,
    endsAt: timestamp + 3200
  });
}

function createTimeSnare(x, y, radius, timestamp, damage, color = "#38bdf8") {
  hazards.push({
    type: "time_snare",
    x: clamp(x, 60, WIDTH - 60),
    y: clamp(y, 60, HEIGHT - 60),
    radius,
    damage,
    color,
    strikesAt: timestamp + 900,
    endsAt: timestamp + 1550,
    hasStruck: false,
    hasFrozen: false
  });
}

function checkLaserHits() {
  const remainingLasers = [];

  for (const laser of lasers) {
    if (laser.expired) continue;

    let removeProjectile = false;
    for (const enemy of enemies) {
      if (removeProjectile || enemy.dead || laser.hitEnemyIds.includes(enemy.id)) continue;

      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;

      if (circlesOverlap(laser.x, laser.y, laser.radius, ex, ey, enemy.size / 2)) {
        laser.hitEnemyIds.push(enemy.id);
        if (laser.damage > 0) dealDamageToEnemy(enemy, laser.damage, { source: laser.kind, isCrit: laser.isCrit });

        handleProjectileExtras(laser, enemy);

        if (laser.explosive || laser.explodesOnHit) {
          detonateProjectile(laser, laser.x, laser.y);
        }

        if (laser.pierceRemaining > 0) {
          laser.pierceRemaining--;
        } else {
          removeProjectile = true;
        }
      }
    }

    if (!removeProjectile && !laser.expired) remainingLasers.push(laser);
  }

  lasers = remainingLasers;
  cleanupDeadEnemies();
}

function checkPlayerHits(timestamp) {
  if (gameState !== "playing" && gameState !== "portalPhase") return;

  const center = getPlayerCenter();
  const playerRadius = player.size / 2;
  const remainingProjectiles = [];

  for (const projectile of enemyProjectiles) {
    if (circlesOverlap(center.x, center.y, playerRadius, projectile.x, projectile.y, projectile.radius)) {
      damagePlayer(projectile.damage || 1);
    } else {
      remainingProjectiles.push(projectile);
    }
  }
  enemyProjectiles = remainingProjectiles;

  for (const enemy of enemies) {
    if (enemy.objective) continue;
    if (rectsOverlap(player.x, player.y, player.size, enemy.x, enemy.y, enemy.size)) {
      damagePlayer(enemy.damage || 1);
      break;
    }
  }

  for (const h of hazards) {
    if (h.type === 'lava' || (h.type === 'lightning' && h.hasStruck)) {
      if (circlesOverlap(center.x, center.y, playerRadius, h.x, h.y, h.radius)) damagePlayer(h.damage || 1);
    } else if (h.type === 'boss_impact') {
      if (h.hasStruck && circlesOverlap(center.x, center.y, playerRadius, h.x, h.y, h.radius)) damagePlayer(h.damage || 1);
    } else if (h.type === 'time_snare') {
      if (h.hasStruck && !h.hasFrozen && circlesOverlap(center.x, center.y, playerRadius, h.x, h.y, h.radius)) {
        h.hasFrozen = true;
        freezePlayer(1250, timestamp);
        damagePlayer(h.damage || 1);
      }
    } else if (h.type === 'gravity_well') {
      if (circlesOverlap(center.x, center.y, playerRadius, h.x, h.y, h.radius * 0.35) && timestamp >= h.nextTick) {
        damagePlayer(h.damage || 1);
        h.nextTick = timestamp + h.tickRate;
      }
    } else if (h.type === 'lazer_beam') {
      const ex = h.enemy.x + h.enemy.size / 2;
      const ey = h.enemy.y + h.enemy.size / 2;
      const angle = h.angle;
      
      const beamLength = 3000;
      const bx = ex + Math.cos(angle) * beamLength;
      const by = ey + Math.sin(angle) * beamLength;

      if (lineCircleOverlap(ex, ey, bx, by, center.x, center.y, playerRadius + h.radius)) {
        damagePlayer(h.damage || 1);
      }
    } else if (h.type === 'boss_beam') {
      if (timestamp < h.warnsUntil) continue;
      const beamLength = 3000;
      const bx = h.x + Math.cos(h.angle) * beamLength;
      const by = h.y + Math.sin(h.angle) * beamLength;

      if (lineCircleOverlap(h.x, h.y, bx, by, center.x, center.y, playerRadius + h.radius)) {
        damagePlayer(h.damage || 1);
      }
    }
  }

  if (activeArena) {
    const outsideArena = center.x < activeArena.x ||
      center.x > activeArena.x + activeArena.w ||
      center.y < activeArena.y ||
      center.y > activeArena.y + activeArena.h;

    if (outsideArena) damagePlayer(activeArena.damage || 1);

    if (activeArena.sanctuary) {
      const safe = activeArena.sanctuary;
      const insideSanctuary = safe.shape === "rect"
        ? center.x + playerRadius > safe.x - safe.width / 2 &&
          center.x - playerRadius < safe.x + safe.width / 2 &&
          center.y + playerRadius > safe.y - safe.height / 2 &&
          center.y - playerRadius < safe.y + safe.height / 2
        : circlesOverlap(center.x, center.y, playerRadius, safe.x, safe.y, safe.radius);

      if (!insideSanctuary) {
        damagePlayer((activeArena.damage || 1) * 0.82);
      }
    }
  }
}

function checkGoldPickups(delta) {
  const center = getPlayerCenter();
  const playerRadius = player.size / 2;
  const remainingGold = [];
  
  for (const gold of goldDrops) {
    let dx = center.x - gold.x;
    let dy = center.y - gold.y;
    let dist = Math.hypot(dx, dy);

    const magnetRange = GOLD_MAGNET_RANGE + getItemStack("hoof") * 18;
    if (dist < magnetRange && dist > 0) {
      const speed = GOLD_MAGNET_SPEED * (delta / 16);
      gold.x += (dx / dist) * Math.min(speed, dist);
      gold.y += (dy / dist) * Math.min(speed, dist);
      
      dx = center.x - gold.x;
      dy = center.y - gold.y;
      dist = Math.hypot(dx, dy);
    }

    if (dist < playerRadius + GOLD_PICKUP_RADIUS) {
      playerGold += gold.value;
      noteGoldCollected(gold.value);
    } else {
      remainingGold.push(gold);
    }
  }
  goldDrops = remainingGold;
}

function drawLasers() {
  for (const laser of lasers) {
    const angle = Math.atan2(laser.vy, laser.vx);
    const spriteSize = Math.max(18, laser.radius * 4.6);
    if (drawProjectileSprite(laser, spriteSize, {
      angle,
      shadowColor: laser.isCrit ? "#fb7185" : laser.color,
      shadowBlur: laser.isCrit ? 12 : 7
    })) {
      continue;
    }

    ctx.fillStyle = laser.isCrit ? "#ef4444" : laser.color || "#facc15";

    if (laser.kind === "charged" || laser.kind === "spear" || laser.kind === "chakram" || laser.kind === "lance" || laser.kind === "blade" || laser.kind === "rivet") {
      ctx.save();
      ctx.translate(laser.x, laser.y);
      ctx.rotate(angle);
      ctx.beginPath();
      if (laser.kind === "blade") {
        ctx.arc(0, 0, laser.radius * 1.4, -Math.PI * 0.62, Math.PI * 0.62);
        ctx.lineTo(-laser.radius * 1.1, 0);
      } else if (laser.kind === "rivet") {
        ctx.rect(-laser.radius * 1.6, -laser.radius * 0.65, laser.radius * 3.2, laser.radius * 1.3);
      } else {
        ctx.moveTo(laser.radius * 2.4, 0);
        ctx.lineTo(-laser.radius * 1.5, -laser.radius);
        ctx.lineTo(-laser.radius * 0.7, 0);
        ctx.lineTo(-laser.radius * 1.5, laser.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (laser.kind === "flask") {
      ctx.save();
      ctx.translate(laser.x, laser.y);
      ctx.rotate(performance.now() * 0.012);
      ctx.fillRect(-laser.radius * 0.7, -laser.radius, laser.radius * 1.4, laser.radius * 2);
      ctx.strokeStyle = "#ecfccb";
      ctx.lineWidth = 2;
      ctx.strokeRect(-laser.radius * 0.7, -laser.radius, laser.radius * 1.4, laser.radius * 2);
      ctx.restore();
    } else if (laser.kind === "spark") {
      ctx.strokeStyle = laser.color || "#67e8f9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(laser.x - laser.radius * 1.6, laser.y);
      ctx.lineTo(laser.x, laser.y - laser.radius * 1.2);
      ctx.lineTo(laser.x + laser.radius * 1.6, laser.y);
      ctx.lineTo(laser.x, laser.y + laser.radius * 1.2);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEnemyProjectiles() {
  for (const p of enemyProjectiles) {
    const kind = p.isFireball ? "fireball" : p.homing ? "homing" : "enemy";
    const angle = Math.atan2(p.vy, p.vx);
    if (drawProjectileSprite({ ...p, kind }, Math.max(18, p.radius * 3.8), {
      angle,
      shadowColor: p.color || (p.isFireball ? "#f97316" : "#ef4444"),
      shadowBlur: 7
    })) {
      continue;
    }

    ctx.fillStyle = p.color || (p.isFireball ? "#f97316" : "#ef4444");
    ctx.beginPath();
    if (p.homing) {
      ctx.moveTo(p.x, p.y - p.radius * 1.35);
      ctx.lineTo(p.x + p.radius * 1.2, p.y);
      ctx.lineTo(p.x, p.y + p.radius * 1.35);
      ctx.lineTo(p.x - p.radius * 1.2, p.y);
      ctx.closePath();
    } else {
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

function drawHazards(timestamp) {
  for (const h of hazards) {
    if (h.type === 'lava' || h.type === 'lightning') {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      if (h.type === 'lava') {
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.fill();
      } else if (h.type === 'lightning') {
        if (h.hasStruck) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    } else if (h.type === 'boss_impact') {
      const warningPct = h.hasStruck ? 1 : clamp((timestamp - (h.strikesAt - 850)) / 850, 0, 1);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      if (h.hasStruck) {
        ctx.fillStyle = h.color || "rgba(251, 146, 60, 0.65)";
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = h.color || "#f97316";
        ctx.lineWidth = 2 + warningPct * 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * warningPct, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (h.type === 'time_snare') {
      const warningPct = h.hasStruck ? 1 : clamp((timestamp - (h.strikesAt - 900)) / 900, 0, 1);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      if (h.hasStruck) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.34)";
        ctx.fill();
        ctx.strokeStyle = h.color || "#38bdf8";
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.strokeStyle = h.color || "#38bdf8";
        ctx.lineWidth = 2 + warningPct * 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * warningPct, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (h.type === 'gravity_well') {
      const pulse = 0.5 + Math.sin(timestamp * 0.012) * 0.18;
      ctx.strokeStyle = h.color || "#a78bfa";
      ctx.lineWidth = 3;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = h.color || "#a78bfa";
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (h.type === 'lazer_beam') {
      const ex = h.enemy.x + h.enemy.size / 2;
      const ey = h.enemy.y + h.enemy.size / 2;
      const angle = h.angle;
      
      const beamLength = 3000;
      const bx = ex + Math.cos(angle) * beamLength;
      const by = ey + Math.sin(angle) * beamLength;

      ctx.strokeStyle = h.enemy.color;
      ctx.lineWidth = h.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(bx, by);
      ctx.stroke();
    } else if (h.type === 'boss_beam') {
      const beamLength = 3000;
      const bx = h.x + Math.cos(h.angle) * beamLength;
      const by = h.y + Math.sin(h.angle) * beamLength;
      const warning = timestamp < h.warnsUntil;

      ctx.strokeStyle = warning ? "rgba(255, 255, 255, 0.35)" : h.color;
      ctx.lineWidth = warning ? 2 : h.radius * 2;
      ctx.lineCap = "round";
      ctx.globalAlpha = warning ? 0.9 : 0.82;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlayerZones(timestamp) {
  for (const zone of playerZones) {
    const lifePct = Math.max(0, Math.min(1, (zone.endsAt - timestamp) / (zone.endsAt - zone.createdAt)));
    ctx.fillStyle = zone.color;
    ctx.globalAlpha = 0.35 + lifePct * 0.25;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawVisualEffects(timestamp) {
  for (const effect of visualEffects) {
    const lifePct = Math.max(0, Math.min(1, (effect.endsAt - timestamp) / (effect.endsAt - effect.createdAt)));
    ctx.globalAlpha = lifePct;

    if (effect.type === "line") {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
    } else if (effect.sprite === "explosion" && drawExplosionSprite(effect.x, effect.y, effect.radius, effect.createdAt, effect.endsAt, {
      timestamp,
      alpha: Math.min(1, lifePct + 0.18),
      shadowColor: effect.color,
      shadowBlur: 14
    })) {
      // Sprite handled above.
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * (1.1 - lifePct * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

function drawGold() {
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 2;
  for (const gold of goldDrops) {
    ctx.beginPath();
    ctx.arc(gold.x, gold.y, gold.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
