const STAGE_ROUTE_DEFS = {
  onslaught: {
    id: "onslaught",
    name: "Crimson Hunt",
    shortName: "Hunt",
    mode: "wave",
    color: "#ef4444",
    rewardText: "Gold",
    bonusGold: 12,
    goldPerStage: 2,
    bonusXp: 0,
    shopChoices: 0,
    enemyCountMultiplier: 1.05,
    spawnIntervalMultiplier: 0.92,
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 1,
    enemyPool: ["melee", "shooter", "mage", "lazer", "splitter"]
  },
  barrage: {
    id: "barrage",
    name: "Azure Barrage",
    shortName: "Barrage",
    mode: "survive",
    color: "#06b6d4",
    rewardText: "XP + shop",
    bonusGold: 16,
    goldPerStage: 1,
    bonusXp: 32,
    xpPerStage: 7,
    shopChoices: 1,
    enemyCountMultiplier: 1.45,
    spawnIntervalMultiplier: 0.72,
    enemyHealthMultiplier: 0.88,
    enemyDamageMultiplier: 0.96,
    enemyPool: ["shooter", "mage", "lazer", "orbiter"]
  },
  cache: {
    id: "cache",
    name: "Verdant Cache",
    shortName: "Cache",
    mode: "cache",
    color: "#22c55e",
    rewardText: "Shop options",
    bonusGold: 8,
    goldPerStage: 1,
    bonusXp: 18,
    xpPerStage: 4,
    shopChoices: 2,
    enemyCountMultiplier: 0.66,
    spawnIntervalMultiplier: 1.04,
    enemyHealthMultiplier: 1.05,
    enemyDamageMultiplier: 0.96,
    enemyPool: ["melee", "splitter", "shooter", "orbiter"]
  },
  gauntlet: {
    id: "gauntlet",
    name: "Violet Gauntlet",
    shortName: "Gauntlet",
    mode: "gauntlet",
    color: "#8b5cf6",
    rewardText: "Gold + XP",
    bonusGold: 24,
    goldPerStage: 3,
    bonusXp: 24,
    xpPerStage: 6,
    shopChoices: 1,
    enemyCountMultiplier: 1.3,
    spawnIntervalMultiplier: 0.78,
    enemyHealthMultiplier: 1.08,
    enemyDamageMultiplier: 1.04,
    enemyPool: ["melee", "shooter", "mage", "lazer", "splitter", "orbiter"]
  },
  miniboss: {
    id: "miniboss",
    name: "Amber Duel",
    shortName: "Duel",
    mode: "miniboss",
    color: "#f59e0b",
    rewardText: "Big cache",
    bonusGold: 42,
    goldPerStage: 4,
    bonusXp: 45,
    xpPerStage: 8,
    shopChoices: 1,
    enemyCountMultiplier: 0.5,
    spawnIntervalMultiplier: 1.12,
    enemyHealthMultiplier: 1.12,
    enemyDamageMultiplier: 1.06,
    enemyPool: ["melee", "shooter", "splitter"]
  },
  boss: {
    id: "boss",
    name: "Boss Signal",
    shortName: "Boss",
    mode: "boss",
    color: "#facc15",
    rewardText: "Boss cache",
    bonusGold: 0,
    shopChoices: 0,
    enemyCountMultiplier: 1,
    spawnIntervalMultiplier: 1,
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 1,
    enemyPool: []
  }
};

const STAGE_EVENT_DEFS = [
  {
    id: "meteorRain",
    name: "Meteor Rain",
    shortName: "Meteors",
    color: "#fb923c",
    rewardGold: 10,
    rewardXp: 8,
    interval: 2300,
    spawnIntervalMultiplier: 1
  },
  {
    id: "needleRain",
    name: "Needle Rain",
    shortName: "Needles",
    color: "#f43f5e",
    rewardGold: 8,
    rewardXp: 10,
    interval: 1800,
    spawnIntervalMultiplier: 0.96
  },
  {
    id: "gravityTide",
    name: "Gravity Tide",
    shortName: "Gravity",
    color: "#a78bfa",
    rewardGold: 12,
    rewardXp: 8,
    interval: 4300,
    spawnIntervalMultiplier: 1.02
  },
  {
    id: "timeFracture",
    name: "Time Fracture",
    shortName: "Time",
    color: "#38bdf8",
    rewardGold: 9,
    rewardXp: 12,
    interval: 3600,
    spawnIntervalMultiplier: 1
  }
];

function cloneStageRoute(routeId, level, elite = false) {
  const def = STAGE_ROUTE_DEFS[routeId] || STAGE_ROUTE_DEFS.onslaught;
  return {
    ...def,
    enemyPool: [...(def.enemyPool || [])],
    level,
    elite,
    rewardClaimed: false,
    name: elite ? `Elite ${def.name}` : def.name
  };
}

function createStageRouteChoices(nextLevel) {
  if (nextLevel % 5 === 0) {
    return [cloneStageRoute("boss", nextLevel, false)];
  }

  const routeIds = ["onslaught", "barrage", "cache", "gauntlet", "miniboss"];
  const available = routeIds.filter(routeId => routeId !== (currentStageRoute && currentStageRoute.id));
  const chosen = [];
  const eliteChance = clamp(0.1 + nextLevel * 0.004, 0.1, 0.18) * Math.sqrt(getArtifactEliteChanceMultiplier());

  while (chosen.length < 2 && available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    const routeId = available.splice(index, 1)[0];
    const elite = Math.random() < eliteChance;
    chosen.push(cloneStageRoute(routeId, nextLevel, elite));
  }

  while (chosen.length < 2) {
    chosen.push(cloneStageRoute("onslaught", nextLevel, false));
  }

  pendingStageRoutes = chosen;
  return chosen;
}

function initializeStageRoute(level, selectedRoute, timestamp = performance.now()) {
  const route = level % 5 === 0
    ? cloneStageRoute("boss", level, false)
    : selectedRoute
      ? { ...selectedRoute, enemyPool: [...(selectedRoute.enemyPool || [])], rewardClaimed: false }
      : cloneStageRoute("onslaught", level, false);

  currentStageRoute = route;
  currentStageEvent = chooseStageEvent(route);
  survivalEndsAt = route.mode === "survive" ? timestamp + getRouteSurvivalDuration(route) : 0;
  routeMinibossSpawned = false;
  routeCacheSpawned = false;
  stageCompleteHandled = false;
  lastRoutePatternAt = timestamp + 500;
  lastStageEventAt = timestamp + 1200;

  if (route.mode === "cache") {
    spawnRouteCacheObjectives(timestamp);
  }
}

function chooseStageEvent(route) {
  if (!route || route.mode === "boss") return null;

  const guaranteed = route.elite || route.mode === "gauntlet" || route.mode === "survive";
  if (!guaranteed && Math.random() > 0.42) return null;

  const event = STAGE_EVENT_DEFS[Math.floor(Math.random() * STAGE_EVENT_DEFS.length)];
  return { ...event };
}

function getRouteSurvivalDuration(route = currentStageRoute) {
  const baseDuration = 24000 + currentLevel * 1100;
  const eliteBonus = route && route.elite ? 5000 : 0;
  return Math.min(44000, baseDuration + eliteBonus);
}

function getCurrentStageEnemyTarget(stage = currentLevel) {
  const route = currentStageRoute;
  if (!route || stage % 5 === 0 || route.mode === "boss") return getStageEnemyCount(stage);

  const baseCount = getStageEnemyCount(stage);
  const eliteMultiplier = route.elite ? 1.22 : 1;

  if (route.mode === "survive") {
    return Math.max(9, Math.ceil(baseCount * route.enemyCountMultiplier * eliteMultiplier));
  }

  if (route.mode === "miniboss") {
    return 1 + Math.max(3, Math.ceil(baseCount * route.enemyCountMultiplier * eliteMultiplier));
  }

  return Math.max(1, Math.ceil(baseCount * (route.enemyCountMultiplier || 1) * eliteMultiplier));
}

function getCurrentStageSpawnInterval(stage = currentLevel) {
  const route = currentStageRoute;
  const eventMultiplier = currentStageEvent ? currentStageEvent.spawnIntervalMultiplier || 1 : 1;
  const routeMultiplier = route ? route.spawnIntervalMultiplier || 1 : 1;
  const eliteMultiplier = route && route.elite ? 0.84 : 1;
  return Math.max(230, getStageSpawnInterval(stage) * routeMultiplier * eventMultiplier * eliteMultiplier);
}

function getCurrentRouteEnemyStatMultiplier() {
  const route = currentStageRoute;
  const eliteMultiplier = route && route.elite ? 1.18 : 1;
  return {
    health: (route ? route.enemyHealthMultiplier || 1 : 1) * eliteMultiplier,
    damage: (route ? route.enemyDamageMultiplier || 1 : 1) * (route && route.elite ? 1.12 : 1)
  };
}

function getEnemyPoolForCurrentRoute() {
  const route = currentStageRoute;
  let pool = route && route.enemyPool && route.enemyPool.length > 0
    ? [...route.enemyPool]
    : ["shooter", "melee", "mage", "lazer"];

  if (currentLevel >= 2 && !pool.includes("splitter")) pool.push("splitter");
  if (currentLevel >= 4 && !pool.includes("orbiter")) pool.push("orbiter");

  pool = pool.filter(type => ENEMY_STATS[type] && (type !== "orbiter" || currentLevel >= 3));
  return pool.length > 0 ? pool : ["shooter", "melee", "mage", "lazer"];
}

function getStageRouteHudLabel() {
  if (!currentStageRoute) return "";
  const eventText = currentStageEvent ? ` + ${currentStageEvent.shortName}` : "";
  return `${currentStageRoute.shortName}${currentStageRoute.elite ? " Elite" : ""}${eventText}`;
}

function getStageIntroText() {
  if (!currentStageRoute) return "The zone shifts around you";
  if (currentStageRoute.mode === "boss") return "Boss signal converging";

  const eventText = currentStageEvent ? ` Event: ${currentStageEvent.name}.` : "";
  return `${currentStageRoute.rewardText} route.${eventText}`;
}

function getStageObjectiveText(timestamp = performance.now()) {
  const boss = enemies.some(enemy => enemy.type === "boss" && !enemy.dead);
  if (boss) return "Defeat the boss";
  if (gameState === "shop") return "Spend gold before choosing a route";
  if (gameState === "portalPhase") return "Choose your next route";

  const route = currentStageRoute;
  if (!route) return "Clear the wave";

  if (route.mode === "survive") {
    const seconds = Math.max(0, Math.ceil((survivalEndsAt - timestamp) / 1000));
    return `Survive ${route.shortName}: ${seconds}s`;
  }

  const target = getCurrentStageEnemyTarget(currentLevel);
  const activeEnemies = enemies.filter(enemy => !enemy.dead && !enemy.objective).length;
  const remainingSpawns = Math.max(0, target - enemiesSpawned);
  const remainingHostiles = activeEnemies + remainingSpawns;

  if (route.mode === "cache") {
    const caches = enemies.filter(enemy => enemy.routeObjective && !enemy.dead).length;
    return `Break ${caches} cache relays | ${remainingHostiles} hostiles`;
  }

  if (route.mode === "miniboss") {
    const minibossAlive = enemies.some(enemy => enemy.type === "miniboss" && !enemy.dead);
    return minibossAlive ? `Defeat the miniboss | ${remainingHostiles} threats` : `${remainingHostiles} threats remain`;
  }

  return `Clear ${route.shortName}: ${remainingHostiles} threats`;
}

function getStageShopChoiceBonus() {
  if (!currentStageRoute || currentStageRoute.mode === "boss") return 0;
  const routeBonus = currentStageRoute.shopChoices || 0;
  const eventBonus = currentStageEvent && currentStageEvent.id === "gravityTide" ? 1 : 0;
  return routeBonus + eventBonus + (currentStageRoute.elite ? 1 : 0);
}

function getStageRewardGold() {
  if (!currentStageRoute || currentStageRoute.mode === "boss") return 0;
  const routeGold = (currentStageRoute.bonusGold || 0) + currentLevel * (currentStageRoute.goldPerStage || 0);
  const eventGold = currentStageEvent ? currentStageEvent.rewardGold || 0 : 0;
  return Math.floor((routeGold + eventGold) * (currentStageRoute.elite ? 1.75 : 1));
}

function getStageRewardXp() {
  if (!currentStageRoute || currentStageRoute.mode === "boss") return 0;
  const routeXp = (currentStageRoute.bonusXp || 0) + currentLevel * (currentStageRoute.xpPerStage || 0);
  const eventXp = currentStageEvent ? currentStageEvent.rewardXp || 0 : 0;
  return Math.floor((routeXp + eventXp) * (currentStageRoute.elite ? 1.45 : 1));
}

function applyStageRouteRewards() {
  if (!currentStageRoute || currentStageRoute.rewardClaimed) return;
  currentStageRoute.rewardClaimed = true;

  const gold = getStageRewardGold();
  const xp = getStageRewardXp();
  const shopChoices = getStageShopChoiceBonus();
  const rewardParts = [];

  if (gold > 0) {
    playerGold += gold;
    noteGoldCollected(gold);
    rewardParts.push(`+${gold}g`);
  }

  if (xp > 0) {
    gainXp(xp);
    rewardParts.push(`+${xp} XP`);
  }

  if (shopChoices > 0) rewardParts.push(`+${shopChoices} shop option${shopChoices === 1 ? "" : "s"}`);

  if (rewardParts.length > 0) {
    showToast(`${currentStageRoute.shortName} cleared`, rewardParts.join(" | "), 2200);
  }
}

function isCurrentStageComplete(timestamp = performance.now()) {
  const route = currentStageRoute;
  if (!route) return enemiesSpawned >= getStageEnemyCount(currentLevel) && enemies.length === 0;

  if (route.mode === "survive") {
    return timestamp >= survivalEndsAt;
  }

  return enemiesSpawned >= getCurrentStageEnemyTarget(currentLevel) && enemies.length === 0;
}

function spawnRouteCacheObjectives(timestamp) {
  if (routeCacheSpawned || !currentStageRoute || currentStageRoute.mode !== "cache") return;
  routeCacheSpawned = true;

  const count = currentStageRoute.elite ? 4 : 3;
  const radius = Math.min(WIDTH, HEIGHT) * 0.27;
  const level = typeof getEnemyLevelForStage === "function" ? getEnemyLevelForStage(currentLevel) : 1;
  const runDifficulty = getRunDifficultyMultiplier(timestamp);
  const health = Math.floor((82 + currentLevel * 18) * runDifficulty * getDifficultyDef().health * (currentStageRoute.elite ? 1.3 : 1));

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / count;
    const x = WIDTH / 2 + Math.cos(angle) * radius - 17;
    const y = HEIGHT / 2 + Math.sin(angle) * radius - 17;
    enemies.push({
      id: nextEnemyId++,
      x: clamp(x, 50, WIDTH - 84),
      y: clamp(y, 80, HEIGHT - 84),
      size: 34,
      health,
      maxHealth: health,
      level,
      damage: 0,
      type: "cacheNode",
      color: currentStageRoute.color,
      accent: "#ecfccb",
      objective: true,
      objectiveType: "cacheNode",
      routeObjective: true
    });
  }
}

function updateStageRoute(timestamp, delta) {
  if (!currentStageRoute || currentStageRoute.mode === "boss") return;

  if (currentStageRoute.mode === "survive" || currentStageRoute.mode === "gauntlet") {
    const interval = currentStageRoute.mode === "survive" ? 850 : 1500;
    const eliteMultiplier = currentStageRoute.elite ? 0.78 : 1;
    if (timestamp - lastRoutePatternAt >= interval * eliteMultiplier) {
      spawnRouteBulletPattern(timestamp);
      lastRoutePatternAt = timestamp;
    }
  }

  updateStageEvent(timestamp);
}

function getRouteHazardDamage(multiplier = 1) {
  const enemyLevel = typeof getEnemyLevelForStage === "function" ? getEnemyLevelForStage(currentLevel) : 1;
  const base = typeof getScaledEnemyDamage === "function"
    ? getScaledEnemyDamage("shooter", enemyLevel)
    : ENEMY_STATS.shooter.damage;
  const routeScale = getCurrentRouteEnemyStatMultiplier();
  return Math.floor(base * 0.72 * getRunDifficultyMultiplier() * getDifficultyDef().damage * routeScale.damage * multiplier);
}

function spawnRouteBulletPattern(timestamp) {
  const pattern = Math.floor(Math.random() * 4);
  const damage = getRouteHazardDamage(0.72);
  const color = currentStageRoute.color;
  const center = getPlayerCenter();

  if (pattern === 0) {
    const fromLeft = Math.random() < 0.5;
    const count = 6 + Math.min(6, Math.floor(currentLevel / 2));
    for (let i = 0; i < count; i++) {
      const y = 60 + (HEIGHT - 120) * (i + 0.5) / count;
      const x = fromLeft ? -12 : WIDTH + 12;
      const angle = fromLeft ? 0 : Math.PI;
      fireEnemyBullet(x, y, angle + randRange(-0.08, 0.08), {
        speed: ENEMY_PROJECTILE_SPEED * 1.04,
        radius: ENEMY_PROJECTILE_RADIUS,
        damage,
        color,
        wave: 0.35
      });
    }
  } else if (pattern === 1) {
    const sourceX = randRange(WIDTH * 0.25, WIDTH * 0.75);
    const sourceY = randRange(HEIGHT * 0.22, HEIGHT * 0.78);
    const gapAngle = Math.atan2(center.y - sourceY, center.x - sourceX);
    fireEnemyRadial(sourceX, sourceY, 14 + Math.min(8, currentLevel), {
      speed: ENEMY_PROJECTILE_SPEED * 0.92,
      radius: ENEMY_PROJECTILE_RADIUS * 0.9,
      damage,
      color,
      gapAngle,
      gapSize: 0.22
    });
  } else if (pattern === 2) {
    createBossImpactHazard(center.x + randRange(-150, 150), center.y + randRange(-120, 120), 42, timestamp, damage * 1.15, color);
    createBossImpactHazard(randRange(80, WIDTH - 80), randRange(90, HEIGHT - 80), 34, timestamp, damage, color);
  } else {
    const points = [
      { x: WIDTH * 0.15, y: -12 },
      { x: WIDTH * 0.85, y: HEIGHT + 12 },
      { x: -12, y: HEIGHT * 0.3 },
      { x: WIDTH + 12, y: HEIGHT * 0.7 }
    ];
    for (const point of points) {
      const angle = Math.atan2(center.y - point.y, center.x - point.x) + randRange(-0.18, 0.18);
      fireEnemyBullet(point.x, point.y, angle, {
        speed: ENEMY_PROJECTILE_SPEED * 1.08,
        radius: ENEMY_PROJECTILE_RADIUS,
        damage,
        color,
        homing: Math.random() < 0.25,
        turnRate: 0.006
      });
    }
  }
}

function updateStageEvent(timestamp) {
  if (!currentStageEvent) return;

  const interval = (currentStageEvent.interval || 2600) * (currentStageRoute && currentStageRoute.elite ? 0.82 : 1);
  if (timestamp < lastStageEventAt) return;
  lastStageEventAt = timestamp + interval;

  const center = getPlayerCenter();
  const damage = getRouteHazardDamage(0.86);
  const color = currentStageEvent.color;

  if (currentStageEvent.id === "meteorRain") {
    createBossImpactHazard(center.x + randRange(-110, 110), center.y + randRange(-90, 90), 46, timestamp, damage * 1.2, color);
    createBossImpactHazard(randRange(70, WIDTH - 70), randRange(90, HEIGHT - 70), 36, timestamp, damage, color);
  } else if (currentStageEvent.id === "needleRain") {
    const vertical = Math.random() < 0.5;
    const count = 7 + Math.min(5, currentLevel);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = vertical ? WIDTH * t : Math.random() < 0.5 ? -10 : WIDTH + 10;
      const y = vertical ? Math.random() < 0.5 ? -10 : HEIGHT + 10 : HEIGHT * t;
      const angle = vertical ? (y < 0 ? Math.PI / 2 : -Math.PI / 2) : (x < 0 ? 0 : Math.PI);
      fireEnemyBullet(x, y, angle, {
        speed: ENEMY_PROJECTILE_SPEED * 1.18,
        radius: ENEMY_PROJECTILE_RADIUS * 0.82,
        damage,
        color
      });
    }
  } else if (currentStageEvent.id === "gravityTide") {
    createGravityWell(center.x + randRange(-170, 170), center.y + randRange(-130, 130), 100, timestamp, damage * 0.55, color);
  } else if (currentStageEvent.id === "timeFracture") {
    createTimeSnare(center.x + randRange(-130, 130), center.y + randRange(-110, 110), 58, timestamp, damage * 0.65, color);
  }
}
