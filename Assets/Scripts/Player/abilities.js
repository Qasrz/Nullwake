function createAbilityState(characterId) {
  const character = CHARACTER_DEFS[characterId] || CHARACTER_DEFS.gunner;
  const state = {};

  Object.keys(character.abilities).forEach(slot => {
    state[slot] = { lastUsed: -Infinity };
  });

  return state;
}

function getAbilityDef(slot) {
  const character = getSelectedCharacterDef();
  return character.abilities[slot];
}

function getAbilityCooldown(slot) {
  const ability = getAbilityDef(slot);
  if (!ability) return 0;
  return ability.cooldown * getAbilityCooldownMultiplier();
}

function getAbilityRemaining(slot, timestamp = performance.now()) {
  if (!player || !player.abilities || !player.abilities[slot]) return 0;
  const remaining = getAbilityCooldown(slot) - (timestamp - player.abilities[slot].lastUsed);
  return Math.max(0, remaining);
}

function isAbilityReady(slot, timestamp = performance.now()) {
  return getAbilityRemaining(slot, timestamp) <= 0;
}

function markAbilityUsed(slot, timestamp = performance.now()) {
  if (!player.abilities[slot]) player.abilities[slot] = { lastUsed: -Infinity };
  player.abilities[slot].lastUsed = timestamp;
}

function beginAbilityCharge(slot, timestamp = performance.now()) {
  const ability = getAbilityDef(slot);
  if (!ability || !ability.hold || !isAbilityReady(slot, timestamp) || player.charge) return;
  player.charge = { slot, startedAt: timestamp };
}

function releaseAbilityCharge(slot, timestamp = performance.now()) {
  if (!player || !player.charge || player.charge.slot !== slot) return;
  const heldMs = timestamp - player.charge.startedAt;
  player.charge = null;
  useAbility(slot, mouseX, mouseY, timestamp, heldMs);
}

function useAbility(slot, targetX = mouseX, targetY = mouseY, timestamp = performance.now(), heldMs = 0) {
  if (!player || gameState !== "playing") return;
  const ability = getAbilityDef(slot);
  if (!ability || !isAbilityReady(slot, timestamp)) return;

  if (ability.hold && heldMs === 0) {
    beginAbilityCharge(slot, timestamp);
    return;
  }

  const characterId = player.characterId || selectedCharacterId;
  if (characterId === "gunner") useGunnerAbility(slot, targetX, targetY, heldMs);
  else if (characterId === "stormcaller") useStormcallerAbility(slot, targetX, targetY, heldMs);
  else if (characterId === "voidblade") useVoidbladeAbility(slot, targetX, targetY, heldMs);
  else if (characterId === "alchemist") useAlchemistAbility(slot, targetX, targetY, heldMs);

  markAbilityUsed(slot, timestamp);
  updateAbilityHud(timestamp);
}

function getChargeRatio(heldMs, maxMs = 1400) {
  return Math.max(0.15, Math.min(1, heldMs / maxMs));
}

function getAimVector(targetX = mouseX, targetY = mouseY) {
  const center = getPlayerCenter();
  let dx = targetX - center.x;
  let dy = targetY - center.y;
  let length = Math.hypot(dx, dy);

  if (length === 0) {
    dx = 1;
    dy = 0;
    length = 1;
  }

  return { x: dx / length, y: dy / length, angle: Math.atan2(dy, dx), center };
}

function getDashVector(targetX = mouseX, targetY = mouseY) {
  let dx = 0;
  let dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    return { x: dx / length, y: dy / length };
  }

  const aim = getAimVector(targetX, targetY);
  return { x: aim.x, y: aim.y };
}

function dashPlayer(distance, targetX, targetY, invulnerableMs = 260) {
  const start = getPlayerCenter();
  const direction = getDashVector(targetX, targetY);

  player.x = Math.max(0, Math.min(WIDTH - player.size, player.x + direction.x * distance));
  player.y = Math.max(0, Math.min(HEIGHT - player.size, player.y + direction.y * distance));
  player.invulnerableUntil = Math.max(player.invulnerableUntil, performance.now() + invulnerableMs);

  const end = getPlayerCenter();
  visualEffects.push({
    type: "line",
    x: start.x,
    y: start.y,
    x2: end.x,
    y2: end.y,
    color: "rgba(255, 255, 255, 0.55)",
    createdAt: performance.now(),
    endsAt: performance.now() + 180
  });

  return { start, end };
}

function damageEnemiesAlongLine(start, end, width, damage) {
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    if (lineCircleOverlap(start.x, start.y, end.x, end.y, ex, ey, width + enemy.size / 2)) {
      dealDamageToEnemy(enemy, damage, { source: "dash" });
    }
  }
  cleanupDeadEnemies();
}

function pullEnemiesToward(x, y, radius, strength) {
  for (const enemy of enemies) {
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const dx = x - ex;
    const dy = y - ey;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < radius) {
      const pull = strength * (1 - dist / radius);
      enemy.x += (dx / dist) * pull;
      enemy.y += (dy / dist) * pull;
      clampEnemyToCanvas(enemy);
    }
  }
}

function throwGrenade(targetX, targetY, multiplier = 4.0, radius = 78) {
  const aim = getAimVector(targetX, targetY);
  const distance = Math.min(480, Math.hypot(targetX - aim.center.x, targetY - aim.center.y));
  const damageRoll = rollDamage(LASER_DAMAGE, multiplier, true);

  firePlayerProjectile(targetX, targetY, {
    origin: aim.center,
    kind: "grenade",
    damage: 0,
    radius: 8,
    speed: 6.2,
    maxDistance: Math.max(80, distance),
    explodeOnExpire: true,
    explodesOnHit: true,
    explosionDamage: damageRoll.damage,
    explosionRadius: radius,
    color: "#fb923c",
    useItemModifiers: false
  });
}

function useGunnerAbility(slot, targetX, targetY, heldMs) {
  if (slot === "right") {
    throwGrenade(targetX, targetY);
  } else if (slot === "shift") {
    dashPlayer(165, targetX, targetY, 300);
    player.lastLaserFire = -Infinity;
  } else if (slot === "q") {
    fireProjectileSpread(targetX, targetY, 3, Math.PI / 10, {
      kind: "scatter",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 0.82,
      radius: LASER_RADIUS,
      speed: LASER_SPEED * 1.02,
      color: "#facc15",
      splitOnHit: getItemStack("gunnerFractal") > 0,
      scatterDepth: getItemStack("gunnerFractal") > 0 ? 1 : 0
    });
  } else if (slot === "e") {
    const charge = getChargeRatio(heldMs);
    firePlayerProjectile(targetX, targetY, {
      kind: "charged",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 1.35 + charge * 3.1,
      radius: 7 + charge * 4,
      speed: LASER_SPEED * 1.12,
      basePierce: 1 + Math.floor(charge * 2),
      bonusBounces: getItemStack("gunnerChargedBounce") > 0 ? 3 : 0,
      color: "#fde047",
      source: "charged-shot"
    });
  }
}

function useStormcallerAbility(slot, targetX, targetY, heldMs) {
  if (slot === "right") {
    const damageRoll = rollDamage(LASER_DAMAGE, 2.15, true);
    firePlayerProjectile(targetX, targetY, {
      kind: "orb",
      damage: damageRoll.damage * 0.35,
      radius: 9,
      speed: 5.4,
      basePierce: 1,
      explodesOnHit: true,
      explosionDamage: damageRoll.damage,
      explosionRadius: 82,
      chainLightning: true,
      color: "#67e8f9"
    });
  } else if (slot === "shift") {
    dashPlayer(240, targetX, targetY, 420);
  } else if (slot === "q") {
    const damageRoll = rollDamage(LASER_DAMAGE, 2.45, true);
    createPlayerExplosion(targetX, targetY, 118, damageRoll.damage, {
      color: "rgba(103, 232, 249, 0.42)",
      createFuseOil: false
    });

    const closest = enemies
      .filter(enemy => !enemy.dead)
      .sort((a, b) => Math.hypot(a.x - targetX, a.y - targetY) - Math.hypot(b.x - targetX, b.y - targetY))[0];
    if (closest) chainLightningFrom(closest, damageRoll.damage * 0.45, 3, [closest.id]);
  } else if (slot === "e") {
    const charge = getChargeRatio(heldMs);
    firePlayerProjectile(targetX, targetY, {
      kind: "spear",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 1.45 + charge * 3.4,
      radius: 6 + charge * 3,
      speed: LASER_SPEED * 1.18,
      basePierce: 3 + Math.floor(charge * 3),
      chainLightning: true,
      color: "#67e8f9"
    });
  }
}

function useVoidbladeAbility(slot, targetX, targetY, heldMs) {
  if (slot === "right") {
    firePlayerProjectile(targetX, targetY, {
      kind: "chakram",
      baseDamage: LASER_DAMAGE,
      damageMultiplier: 1.35,
      radius: 8,
      speed: 7.4,
      basePierce: 2,
      baseBounces: 2,
      maxDistance: 760,
      color: "#c4b5fd"
    });
  } else if (slot === "shift") {
    const damageRoll = rollDamage(LASER_DAMAGE, 1.55, true);
    const path = dashPlayer(220, targetX, targetY, 460);
    damageEnemiesAlongLine(path.start, path.end, 20, damageRoll.damage);
  } else if (slot === "q") {
    const center = getPlayerCenter();
    for (let i = 0; i < 8; i++) {
      firePlayerProjectileAtAngle((Math.PI * 2 * i) / 8, {
        origin: center,
        kind: "lance",
        baseDamage: LASER_DAMAGE,
        damageMultiplier: 0.78,
        radius: 5,
        speed: LASER_SPEED * 1.08,
        color: "#c4b5fd"
      });
    }
  } else if (slot === "e") {
    const charge = getChargeRatio(heldMs);
    const radius = 88 + charge * 76;
    const damageRoll = rollDamage(LASER_DAMAGE, 1.9 + charge * 3.4, true);
    pullEnemiesToward(targetX, targetY, radius * 1.35, 80 + charge * 80);
    createPlayerExplosion(targetX, targetY, radius, damageRoll.damage, {
      color: "rgba(167, 139, 250, 0.42)"
    });
  }
}

function useAlchemistAbility(slot, targetX, targetY, heldMs) {
  if (slot === "right") {
    const damageRoll = rollDamage(LASER_DAMAGE, 2.35, true);
    const center = getPlayerCenter();
    const distance = Math.min(430, Math.hypot(targetX - center.x, targetY - center.y));
    firePlayerProjectile(targetX, targetY, {
      origin: center,
      kind: "flask",
      damage: 0,
      radius: 7,
      speed: 5.8,
      maxDistance: Math.max(70, distance),
      explodeOnExpire: true,
      explodesOnHit: true,
      explosionDamage: damageRoll.damage,
      explosionRadius: 68,
      zoneOnDetonate: {
        radius: 74,
        damagePerTick: damageRoll.damage * 0.16,
        duration: 3600,
        color: "rgba(52, 211, 153, 0.24)"
      },
      color: "#bef264",
      useItemModifiers: false
    });
  } else if (slot === "shift") {
    healPlayer(22);
    player.buffs.speedMultiplier = 1.45;
    player.buffs.speedUntil = performance.now() + 2400;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, performance.now() + 220);
  } else if (slot === "q") {
    const damageRoll = rollDamage(LASER_DAMAGE, 0.9, true);
    createPlayerDamageZone(targetX, targetY, 105, damageRoll.damage, 5200, 430, "rgba(52, 211, 153, 0.28)");
  } else if (slot === "e") {
    const charge = getChargeRatio(heldMs);
    const damageRoll = rollDamage(LASER_DAMAGE, 2.2 + charge * 3.5, true);
    throwGrenade(targetX, targetY, 2.2 + charge * 3.5, 88 + charge * 70);
    const lastProjectile = lasers[lasers.length - 1];
    if (lastProjectile) {
      lastProjectile.kind = "flask";
      lastProjectile.color = "#bef264";
      lastProjectile.zoneOnDetonate = {
        radius: 95 + charge * 70,
        damagePerTick: damageRoll.damage * 0.18,
        duration: 4200 + charge * 1600,
        color: "rgba(190, 242, 100, 0.24)"
      };
      lastProjectile.explosionDamage = damageRoll.damage;
    }
  }
}

function updateAbilityHud(timestamp = performance.now()) {
  if (!uiAbilityBar || !player) return;
  const character = getSelectedCharacterDef();

  uiAbilityBar.innerHTML = Object.entries(character.abilities).map(([slot, ability]) => {
    const remaining = getAbilityRemaining(slot, timestamp);
    const isCharging = player.charge && player.charge.slot === slot;
    const stateText = isCharging ? "CHARGING" : remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : ability.name;
    const readyClass = remaining <= 0 ? "ready" : "cooling";
    const chargeClass = isCharging ? "charging" : "";

    return `
      <div class="ability ${readyClass} ${chargeClass}">
        <span class="ability-key">${ability.label}</span>
        <span class="ability-name">${stateText}</span>
      </div>
    `;
  }).join("");
}
