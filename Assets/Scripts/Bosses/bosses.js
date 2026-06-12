const BOSS_DEFS = [
  {
    id: "prismWarden",
    name: "Prism Warden",
    subtitle: "Rotating refractions and beam walls",
    color: "#38bdf8",
    accent: "#f0abfc",
    healthMultiplier: 1.05,
    arenaColor: "rgba(56, 189, 248, 0.8)",
    fog: "rgba(8, 47, 73, 0.16)",
    phaseNames: ["Refraction", "Shatter", "Whiteout"]
  },
  {
    id: "ashenChoir",
    name: "Ashen Choir",
    subtitle: "Meteor rites and ember curtains",
    color: "#fb923c",
    accent: "#facc15",
    healthMultiplier: 1.18,
    arenaColor: "rgba(251, 146, 60, 0.82)",
    fog: "rgba(127, 29, 29, 0.16)",
    phaseNames: ["Kindling", "Anthem", "Crescendo"]
  },
  {
    id: "nullSeraph",
    name: "Null Seraph",
    subtitle: "Gravity wells and collapsing space",
    color: "#a78bfa",
    accent: "#22d3ee",
    healthMultiplier: 1.32,
    arenaColor: "rgba(167, 139, 250, 0.85)",
    fog: "rgba(76, 29, 149, 0.18)",
    phaseNames: ["Orbit", "Compression", "Singularity"]
  }
];

function getBossDefinitionForStage(stage) {
  const bossIndex = Math.max(0, Math.floor(stage / 5) - 1);
  return BOSS_DEFS[bossIndex % BOSS_DEFS.length];
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
  enemy.nextPatternAt = timestamp + 1100;
  enemy.nextMoveAt = timestamp;
  enemy.targetX = WIDTH / 2 - enemy.size / 2;
  enemy.targetY = Math.max(120, HEIGHT * 0.22);

  setBossArena(enemy, def, 1);
  addScreenShake(8, 420);
  showToast(def.name, def.subtitle, 3000);
}

function setBossArena(enemy, def, phase) {
  const margin = BOSS_ARENA_MARGIN + (enemy.bossId === "nullSeraph" ? (phase - 1) * 42 : (phase - 1) * 18);
  activeArena = {
    x: margin,
    y: margin,
    w: Math.max(300, WIDTH - margin * 2),
    h: Math.max(260, HEIGHT - margin * 2),
    color: def.arenaColor,
    fog: def.fog,
    damage: enemy.damage * (0.45 + phase * 0.08)
  };
}

function updateBossEnemy(enemy, center, timestamp, delta) {
  const def = getBossDefinitionForStage(currentLevel);
  const healthRatio = enemy.health / enemy.maxHealth;
  const nextPhase = healthRatio <= BOSS_PHASE_HEALTH[1] ? 3 : healthRatio <= BOSS_PHASE_HEALTH[0] ? 2 : 1;

  if (nextPhase !== enemy.phase) {
    enemy.phase = nextPhase;
    enemy.nextPatternAt = timestamp + 650;
    setBossArena(enemy, def, enemy.phase);
    addScreenShake(12 + enemy.phase * 3, 500);
    showToast(`${def.name}: Phase ${enemy.phase}`, def.phaseNames[enemy.phase - 1], 2000);
    createPlayerExplosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, 90 + enemy.phase * 35, 0, {
      color: def.arenaColor,
      createFuseOil: false
    });
  }

  moveBoss(enemy, center, timestamp, delta);

  if (timestamp >= enemy.nextPatternAt) {
    runBossPattern(enemy, center, timestamp);
    const interval = Math.max(650, 1750 - enemy.phase * 260 - currentLevel * 18);
    enemy.nextPatternAt = timestamp + interval;
  }
}

function moveBoss(enemy, center, timestamp, delta) {
  const elapsedSeconds = (timestamp - enemy.bossStartedAt) / 1000;
  const arena = activeArena || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  const orbitX = Math.cos(elapsedSeconds * (0.55 + enemy.phase * 0.08)) * arena.w * 0.23;
  const orbitY = Math.sin(elapsedSeconds * (0.72 + enemy.phase * 0.08)) * arena.h * 0.12;
  const idealX = arena.x + arena.w * 0.5 + orbitX - enemy.size / 2;
  const idealY = arena.y + arena.h * (enemy.bossId === "nullSeraph" ? 0.44 : 0.25) + orbitY - enemy.size / 2;
  const chase = enemy.phase === 3 ? 0.032 : 0.022;

  enemy.x += (idealX - enemy.x) * chase * (delta / 16);
  enemy.y += (idealY - enemy.y) * chase * (delta / 16);
}

function runBossPattern(enemy, center, timestamp) {
  enemy.patternIndex++;

  if (enemy.bossId === "prismWarden") {
    runPrismWardenPattern(enemy, center, timestamp);
  } else if (enemy.bossId === "ashenChoir") {
    runAshenChoirPattern(enemy, center, timestamp);
  } else {
    runNullSeraphPattern(enemy, center, timestamp);
  }
}

function runPrismWardenPattern(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const playerAngle = Math.atan2(center.y - ey, center.x - ex);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    fireEnemyRadial(ex, ey, 18 + enemy.phase * 6, {
      speed: 2.1 + enemy.phase * 0.35,
      radius: 5,
      damage: enemy.damage,
      color: enemy.color,
      offset: timestamp * 0.002,
      gapAngle: playerAngle + Math.PI,
      gapSize: Math.PI / (4.2 - enemy.phase * 0.35)
    });
  } else if (pattern === 1) {
    for (let i = 0; i < 18 + enemy.phase * 5; i++) {
      fireEnemyBullet(ex, ey, timestamp * 0.003 + i * 0.42, {
        speed: 2.4 + i * 0.018,
        radius: 4,
        damage: enemy.damage * 0.8,
        color: i % 2 === 0 ? enemy.color : enemy.accent,
        wave: 0.05 + enemy.phase * 0.012
      });
    }
  } else if (pattern === 2) {
    createBossBeamHazard(enemy, playerAngle, timestamp, {
      sweep: enemy.phase >= 2 ? 0.95 : 0.55,
      duration: 1500 + enemy.phase * 240,
      width: 7 + enemy.phase * 2,
      color: enemy.accent
    });
  } else {
    const mines = 3 + enemy.phase * 2;
    for (let i = 0; i < mines; i++) {
      createBossImpactHazard(
        center.x + randRange(-180, 180),
        center.y + randRange(-130, 130),
        42 + enemy.phase * 8,
        timestamp,
        enemy.damage,
        enemy.accent
      );
    }
  }
}

function runAshenChoirPattern(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const playerAngle = Math.atan2(center.y - ey, center.x - ex);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    for (let i = 0; i < 5 + enemy.phase * 3; i++) {
      createBossImpactHazard(
        clamp(center.x + randRange(-260, 260), 80, WIDTH - 80),
        clamp(center.y + randRange(-190, 190), 80, HEIGHT - 80),
        46 + enemy.phase * 8,
        timestamp,
        enemy.damage * 0.95,
        enemy.accent
      );
    }
  } else if (pattern === 1) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = -4 - enemy.phase; i <= 4 + enemy.phase; i++) {
        fireEnemyBullet(side < 0 ? 25 : WIDTH - 25, HEIGHT * 0.32 + i * 36, side < 0 ? 0 : Math.PI, {
          speed: 2.9 + enemy.phase * 0.3,
          radius: 5,
          damage: enemy.damage * 0.75,
          color: enemy.color
        });
      }
    }
  } else if (pattern === 2) {
    fireEnemyArc(ex, ey, playerAngle, Math.PI * 0.8, 13 + enemy.phase * 4, {
      speed: 3 + enemy.phase * 0.28,
      radius: 5,
      damage: enemy.damage,
      color: enemy.accent
    });
  } else {
    const summons = enemy.phase >= 2 ? 2 : 1;
    for (let i = 0; i < summons; i++) {
      spawnBossMinion(i % 2 === 0 ? "melee" : "shooter", ex + randRange(-90, 90), ey + randRange(80, 140), enemy.level);
    }
    fireEnemyRadial(ex, ey, 12 + enemy.phase * 5, {
      speed: 2.5,
      radius: 5,
      damage: enemy.damage * 0.75,
      color: enemy.color,
      offset: playerAngle
    });
  }
}

function runNullSeraphPattern(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  const playerAngle = Math.atan2(center.y - ey, center.x - ex);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    fireEnemyRadial(ex, ey, 16 + enemy.phase * 8, {
      speed: 1.95 + enemy.phase * 0.25,
      radius: 5,
      damage: enemy.damage,
      color: enemy.color,
      offset: -timestamp * 0.002,
      homing: enemy.phase >= 2,
      turnRate: 0.018
    });
  } else if (pattern === 1) {
    createGravityWell(center.x, center.y, 120 + enemy.phase * 28, timestamp, enemy.damage * 0.45, enemy.accent);
    fireEnemyArc(ex, ey, playerAngle, Math.PI * 1.25, 17 + enemy.phase * 4, {
      speed: 2.55,
      radius: 4,
      damage: enemy.damage * 0.78,
      color: enemy.accent,
      homing: enemy.phase >= 3,
      turnRate: 0.012
    });
  } else if (pattern === 2) {
    createBossBeamHazard(enemy, playerAngle + Math.PI / 2, timestamp, {
      sweep: -1.2,
      duration: 1700,
      width: 8 + enemy.phase,
      color: enemy.color,
      anchored: false
    });
    createBossBeamHazard(enemy, playerAngle, timestamp, {
      sweep: 1.2,
      duration: 1700,
      width: 8 + enemy.phase,
      color: enemy.accent,
      anchored: false
    });
  } else {
    const edgeCount = 5 + enemy.phase * 2;
    for (let i = 0; i < edgeCount; i++) {
      const x = activeArena.x + activeArena.w * (i / Math.max(1, edgeCount - 1));
      fireEnemyBullet(x, activeArena.y + 8, Math.PI / 2 + Math.sin(timestamp * 0.004 + i) * 0.35, {
        speed: 2.4 + enemy.phase * 0.28,
        radius: 5,
        damage: enemy.damage * 0.85,
        color: i % 2 ? enemy.color : enemy.accent
      });
    }
  }
}
