var BOSS_DEFS = [
  PRISM_WARDEN_BOSS,
  ASHEN_CHOIR_BOSS,
  NULL_SERAPH_BOSS,
  CHRONARCH_BOSS,
  ECLIPSE_MAW_BOSS
];

function getBossDefinitionForStage(stage) {
  const bossIndex = Math.max(0, Math.floor(stage / 5) - 1);
  return BOSS_DEFS[bossIndex % BOSS_DEFS.length];
}



function getBossDefinitionById(id) {
  return BOSS_DEFS.find(def => def.id === id) || BOSS_DEFS[0];
}



function getBossHealthForStage(stage, enemyLevel) {
  const def = getBossDefinitionForStage(stage);
  const cycleBonus = 1 + Math.floor(Math.max(0, stage - 5) / (BOSS_DEFS.length * 5)) * 0.35;
  return Math.floor(getScaledEnemyHealth("boss", enemyLevel) * def.healthMultiplier * cycleBonus);
}



function initializeBossEnemy(enemy, timestamp) {
  const def = getBossDefinitionForStage(currentLevel);
  enemy.bossId = def.id;
  enemy.bossName = def.name;
  enemy.bossSubtitle = def.subtitle;
  enemy.color = def.color;
  enemy.accent = def.accent;
  enemy.phase = 1;
  enemy.patternIndex = 0;
  enemy.bossStartedAt = timestamp;
  enemy.phaseChangedAt = timestamp;
  enemy.lastPatternAt = -Infinity;
  enemy.nextPatternAt = timestamp + 1100;
  enemy.nextMoveAt = timestamp;
  enemy.targetX = WIDTH / 2 - enemy.size / 2;
  enemy.targetY = Math.max(120, HEIGHT * 0.22);
  enemy.invulnerable = false;
  enemy.mechanicId = null;
  enemy.mechanicText = "";
  enemy.mechanicProgress = 0;
  enemy.objectiveIds = [];
  enemy.stopCheck = null;

  setBossArena(enemy, def, 1);
  addScreenShake(8, 420);
  showToast(def.name, def.subtitle, 3000);
}



function setBossArena(enemy, def, phase) {
  const bossMarginBonus = enemy.bossId === "nullSeraph" ? (phase - 1) * 42 : (phase - 1) * 18;
  const margin = BOSS_ARENA_MARGIN + bossMarginBonus;
  activeArena = {
    bossId: enemy.bossId,
    x: margin,
    y: margin,
    w: Math.max(300, WIDTH - margin * 2),
    h: Math.max(260, HEIGHT - margin * 2),
    color: def.arenaColor,
    fog: def.fog,
    damage: enemy.damage * (0.45 + phase * 0.08),
    sanctuary: null,
    clockRite: null,
    eclipseRite: null
  };
}



function updateBossEnemy(enemy, center, timestamp, delta) {
  const def = getBossDefinitionById(enemy.bossId);
  const healthRatio = enemy.health / enemy.maxHealth;
  const nextPhase = healthRatio <= BOSS_PHASE_HEALTH[1] ? 3 : healthRatio <= BOSS_PHASE_HEALTH[0] ? 2 : 1;

  if (nextPhase !== enemy.phase) {
    transitionBossPhase(enemy, def, nextPhase, timestamp);
  }

  updateBossMechanics(enemy, center, timestamp, delta);
  moveBoss(enemy, center, timestamp, delta);

  if (timestamp >= enemy.nextPatternAt) {
    runBossPattern(enemy, center, timestamp);
    const baseInterval = Math.max(650, 1750 - enemy.phase * 260 - currentLevel * 18);
    enemy.nextPatternAt = timestamp + (enemy.invulnerable ? baseInterval * 1.15 : baseInterval);
  }
}



function transitionBossPhase(enemy, def, nextPhase, timestamp) {
  enemy.phase = nextPhase;
  enemy.phaseChangedAt = timestamp;
  enemy.nextPatternAt = timestamp + 650;
  setBossArena(enemy, def, enemy.phase);
  addScreenShake(12 + enemy.phase * 3, 500);
  showToast(`${def.name}: Phase ${enemy.phase}`, def.phaseNames[enemy.phase - 1], 2200);
  createPlayerExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, 90 + enemy.phase * 35, 0, {
    color: def.arenaColor,
    createFuseOil: false
  });
  startBossIntermission(enemy, timestamp);
}



function moveBoss(enemy, center, timestamp, delta) {
  const elapsedSeconds = (timestamp - enemy.bossStartedAt) / 1000;
  const arena = activeArena || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  let idealX;
  let idealY;

  if (enemy.bossId === "chronarch") {
    idealX = arena.x + arena.w * 0.5 - enemy.size / 2;
    idealY = arena.y + arena.h * 0.44 - enemy.size / 2;
  } else if (enemy.bossId === "eclipseMaw") {
    idealX = arena.x + arena.w * (0.5 + Math.cos(elapsedSeconds * 0.38) * 0.16) - enemy.size / 2;
    idealY = arena.y + arena.h * (0.34 + Math.sin(elapsedSeconds * 0.52) * 0.1) - enemy.size / 2;
  } else {
    const orbitX = Math.cos(elapsedSeconds * (0.55 + enemy.phase * 0.08)) * arena.w * 0.23;
    const orbitY = Math.sin(elapsedSeconds * (0.72 + enemy.phase * 0.08)) * arena.h * 0.12;
    idealX = arena.x + arena.w * 0.5 + orbitX - enemy.size / 2;
    idealY = arena.y + arena.h * (enemy.bossId === "nullSeraph" ? 0.44 : 0.25) + orbitY - enemy.size / 2;
  }

  const chase = enemy.phase === 3 ? 0.032 : 0.022;
  enemy.x += (idealX - enemy.x) * chase * (delta / 16);
  enemy.y += (idealY - enemy.y) * chase * (delta / 16);
}



function startBossIntermission(enemy, timestamp) {
  clearBossObjectives(enemy);
  enemy.invulnerable = true;
  enemy.mechanicStartedAt = timestamp;
  enemy.mechanicProgress = 0;
  enemy.objectiveIds = [];
  enemy.lastImmuneTextAt = -Infinity;

  if (enemy.bossId === "prismWarden") {
    enemy.mechanicId = "prismFoci";
    enemy.mechanicText = "Break the Prism Foci";
    spawnPrismFoci(enemy, timestamp);
  } else if (enemy.bossId === "ashenChoir") {
    enemy.mechanicId = "ashenSanctuary";
    enemy.mechanicText = "Stay inside the moving sanctuary";
    enemy.mechanicEndsAt = timestamp + 7400;
    ensureAshenSanctuary(enemy, timestamp, true);
  } else if (enemy.bossId === "nullSeraph") {
    enemy.mechanicId = "voidAnchors";
    enemy.mechanicText = "Destroy the Void Anchors";
    spawnVoidAnchors(enemy, timestamp);
  } else if (enemy.bossId === "chronarch") {
    enemy.mechanicId = "clockRite";
    enemy.mechanicText = "Stand in the glowing hour";
    enemy.mechanicEndsAt = timestamp + 9000;
    startClockRite(enemy, timestamp);
  } else if (enemy.bossId === "eclipseMaw") {
    enemy.mechanicId = "eclipseAttunement";
    enemy.mechanicText = "Attune to the marked eclipse well";
    enemy.mechanicEndsAt = timestamp + 9500;
    startEclipseRite(enemy, timestamp);
  }
}



function completeBossIntermission(enemy, timestamp, message = "Damage window open") {
  if (!enemy.invulnerable) return;
  enemy.invulnerable = false;
  enemy.mechanicId = null;
  enemy.mechanicText = "";
  enemy.mechanicProgress = 0;
  enemy.nextPatternAt = timestamp + 700;

  if (activeArena) {
    if (enemy.bossId !== "ashenChoir" || enemy.phase < 3) activeArena.sanctuary = null;
    activeArena.clockRite = null;
    activeArena.eclipseRite = null;
  }

  addScreenShake(9, 300);
  showToast("Shield Broken", message, 1800);
  createPlayerExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, 76, 0, {
    color: enemy.accent,
    createFuseOil: false
  });
}



function updateBossMechanics(enemy, center, timestamp, delta) {
  if (enemy.bossId === "ashenChoir" && (enemy.invulnerable || enemy.phase >= 3)) {
    ensureAshenSanctuary(enemy, timestamp, enemy.invulnerable);
    updateAshenSanctuary(enemy, timestamp);
  }

  if (enemy.bossId === "chronarch") {
    updateStillnessCheck(enemy, timestamp);
  }

  if (!enemy.invulnerable) return;

  if (enemy.mechanicId === "prismFoci" || enemy.mechanicId === "voidAnchors") {
    if (getRemainingBossObjectives(enemy).length === 0) {
      completeBossIntermission(enemy, timestamp, enemy.mechanicId === "prismFoci" ? "The mirror lock collapses." : "The singularity loosens.");
    }
  } else if (enemy.mechanicId === "ashenSanctuary") {
    const remaining = Math.max(0, enemy.mechanicEndsAt - timestamp);
    enemy.mechanicText = `Ride the sanctuary ${(remaining / 1000).toFixed(1)}s`;
    if (timestamp >= enemy.mechanicEndsAt) {
      completeBossIntermission(enemy, timestamp, "The storm chant breaks.");
    }
  } else if (enemy.mechanicId === "clockRite") {
    updateClockRite(enemy, timestamp, delta);
  } else if (enemy.mechanicId === "eclipseAttunement") {
    updateEclipseRite(enemy, timestamp, delta);
  }
}



function getBossCenter(enemy) {
  return {
    x: enemy.x + enemy.size / 2,
    y: enemy.y + enemy.size / 2
  };
}



function getArenaCenter() {
  const arena = activeArena || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  return {
    x: arena.x + arena.w / 2,
    y: arena.y + arena.h / 2
  };
}



function bossAngleDistance(a, b) {
  let diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}



function normalizeBossAngle(angle) {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}



function getPointOnArenaPerimeter(progress) {
  const arena = activeArena || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  const p = ((progress % 1) + 1) % 1;
  const side = Math.floor(p * 4);
  const t = p * 4 - side;

  if (side === 0) return { x: arena.x + arena.w * t, y: arena.y };
  if (side === 1) return { x: arena.x + arena.w, y: arena.y + arena.h * t };
  if (side === 2) return { x: arena.x + arena.w * (1 - t), y: arena.y + arena.h };
  return { x: arena.x, y: arena.y + arena.h * (1 - t) };
}



function getArenaOrbitPoint(index, count, radiusScale = 0.34, offset = 0) {
  const arena = activeArena || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  const angle = offset + (Math.PI * 2 * index) / count;
  return {
    x: arena.x + arena.w * 0.5 + Math.cos(angle) * arena.w * radiusScale,
    y: arena.y + arena.h * 0.5 + Math.sin(angle) * arena.h * radiusScale
  };
}



function spawnBossObjective(enemy, objectiveType, x, y, options = {}) {
  const health = Math.floor(options.health || Math.max(90, enemy.maxHealth * 0.055));
  const objective = {
    id: nextEnemyId++,
    x: clamp(x - (options.size || 30) / 2, 40, WIDTH - 40),
    y: clamp(y - (options.size || 30) / 2, 40, HEIGHT - 40),
    size: options.size || 30,
    health,
    maxHealth: health,
    level: enemy.level,
    damage: 0,
    type: "boss_objective",
    objective: true,
    objectiveType,
    bossOwnerId: enemy.id,
    color: options.color || enemy.accent,
    accent: options.accent || enemy.color,
    baseSpeed: 0,
    fireInterval: 0,
    lastFire: Infinity,
    isDashing: false,
    dashEndsAt: 0,
    dashAvailableAt: 0,
    dashVx: 0,
    dashVy: 0
  };

  enemies.push(objective);
  enemy.objectiveIds.push(objective.id);
  return objective;
}

function getRemainingBossObjectives(enemy) {
  return enemies.filter(entry => entry.objective && entry.bossOwnerId === enemy.id && !entry.dead && entry.health > 0);
}



function clearBossObjectives(enemy) {
  enemies.forEach(entry => {
    if (entry.objective && entry.bossOwnerId === enemy.id) entry.dead = true;
  });
  enemies = enemies.filter(entry => !entry.dead);
}



function runBossPattern(enemy, center, timestamp) {
  enemy.patternIndex++;
  enemy.lastPatternAt = timestamp;

  if (enemy.bossId === "prismWarden") {
    runPrismWardenPattern(enemy, center, timestamp);
  } else if (enemy.bossId === "ashenChoir") {
    runAshenChoirPattern(enemy, center, timestamp);
  } else if (enemy.bossId === "nullSeraph") {
    runNullSeraphPattern(enemy, center, timestamp);
  } else if (enemy.bossId === "chronarch") {
    runChronarchPattern(enemy, center, timestamp);
  } else {
    runEclipseMawPattern(enemy, center, timestamp);
  }
}



function fireRotatingEdgeCurtain(enemy, timestamp, count, options = {}) {
  const arenaCenter = getArenaCenter();
  const base = timestamp * 0.00008 + enemy.patternIndex * 0.037;
  for (let i = 0; i < count; i++) {
    const point = getPointOnArenaPerimeter(base + i / count);
    let angle = Math.atan2(arenaCenter.y - point.y, arenaCenter.x - point.x);
    angle += Math.sin(timestamp * 0.002 + i) * (options.tangent || 0);
    fireEnemyBullet(point.x, point.y, angle, {
      speed: options.speed || 2.6,
      radius: options.radius || 5,
      damage: options.damage || enemy.damage * 0.75,
      color: options.color || enemy.color,
      homing: options.homing || false,
      turnRate: options.turnRate || 0.008
    });
  }
}
