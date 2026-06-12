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
  noteAbilityUsed();
}

function resetAbilityCooldowns() {
  if (!player) return;

  const character = getSelectedCharacterDef();
  player.abilities = player.abilities || {};

  Object.keys(character.abilities).forEach(slot => {
    player.abilities[slot] = { lastUsed: -Infinity };
  });

  player.charge = null;
}

function beginAbilityCharge(slot, timestamp = performance.now()) {
  if (isPlayerFrozen(timestamp)) return;
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
  if (!player || (gameState !== "playing" && gameState !== "portalPhase")) return;
  if (isPlayerFrozen(timestamp)) return;
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
  else if (characterId === "engineer") useEngineerAbility(slot, targetX, targetY, heldMs);

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

function findNearestEnemy(x, y, range = Infinity, excludeIds = []) {
  let nearest = null;
  let nearestDist = range;

  for (const enemy of enemies) {
    if (enemy.dead || excludeIds.includes(enemy.id)) continue;
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const dist = Math.hypot(ex - x, ey - y);
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }

  return nearest;
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
    const damageRoll = rollDamage(LASER_DAMAGE, 1.7, true);
    createPlayerExplosion(targetX, targetY, 54, damageRoll.damage * 0.45, {
      color: "rgba(190, 242, 100, 0.35)",
      createFuseOil: false
    });
    createPlayerDamageZone(targetX, targetY, 92, damageRoll.damage * 0.22, 4300, 480, "rgba(190, 242, 100, 0.27)");
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

function deployTurret(targetX, targetY) {
  const center = getPlayerCenter();
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  const dist = Math.hypot(dx, dy) || 1;
  const placeDistance = Math.min(180, dist);
  const x = clamp(center.x + (dx / dist) * placeDistance, 30, WIDTH - 30);
  const y = clamp(center.y + (dy / dist) * placeDistance, 30, HEIGHT - 30);

  turrets.push({
    x,
    y,
    radius: 14,
    range: 360,
    fireInterval: 520,
    nextFireAt: performance.now() + 250,
    endsAt: performance.now() + 22000,
    color: "#f97316"
  });

  if (turrets.length > 2) turrets.shift();
  burstParticles(x, y, "#fdba74", 14, 2.8);
}

function launchEngineerMissiles(targetX, targetY, heldMs) {
  const center = getPlayerCenter();
  const count = clamp(2 + Math.floor(heldMs / 360), 2, 8);
  const usedTargets = [];

  for (let i = 0; i < count; i++) {
    const target = findNearestEnemy(targetX, targetY, 620, usedTargets);
    if (target) usedTargets.push(target.id);
    const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.16;
    const damageRoll = rollDamage(LASER_DAMAGE, 1.15, true);

    missiles.push({
      x: center.x,
      y: center.y,
      vx: Math.cos(angle) * 3.8,
      vy: Math.sin(angle) * 3.8,
      radius: 6,
      targetId: target ? target.id : null,
      damage: damageRoll.damage,
      color: damageRoll.isCrit ? "#fb7185" : "#fdba74",
      createdAt: performance.now(),
      endsAt: performance.now() + 3600,
      turnRate: 0.075
    });
  }

  addScreenShake(4, 180);
}

function useEngineerAbility(slot, targetX, targetY, heldMs) {
  if (slot === "right") {
    deployTurret(targetX, targetY);
  } else if (slot === "shift") {
    launchEngineerMissiles(targetX, targetY, heldMs);
  } else if (slot === "q") {
    const damageRoll = rollDamage(LASER_DAMAGE, 1.2, true);
    createPlayerDamageZone(targetX, targetY, 92, damageRoll.damage * 0.45, 4600, 650, "rgba(251, 146, 60, 0.24)");
    visualEffects.push({
      type: "ring",
      x: targetX,
      y: targetY,
      radius: 92,
      color: "rgba(253, 186, 116, 0.52)",
      createdAt: performance.now(),
      endsAt: performance.now() + 4600
    });
  } else if (slot === "e") {
    player.invulnerableUntil = Math.max(player.invulnerableUntil, performance.now() + 1200);
    healPlayer(12);
    const center = getPlayerCenter();
    createPlayerExplosion(center.x, center.y, 92, LASER_DAMAGE * getPlayerDamageMultiplier(), {
      color: "rgba(253, 186, 116, 0.36)",
      createFuseOil: false
    });
  }
}

function updateTurretsAndMissiles(delta, timestamp) {
  const remainingTurrets = [];

  for (const turret of turrets) {
    if (timestamp > turret.endsAt) continue;
    if (timestamp >= turret.nextFireAt) {
      const target = findNearestEnemy(turret.x, turret.y, turret.range);
      if (target) {
        firePlayerProjectile(target.x + target.size / 2, target.y + target.size / 2, {
          origin: { x: turret.x, y: turret.y },
          kind: "rivet",
          baseDamage: LASER_DAMAGE,
          damageMultiplier: 0.55,
          radius: 4,
          speed: LASER_SPEED * 1.08,
          color: "#fdba74"
        });
        turret.nextFireAt = timestamp + turret.fireInterval;
      } else {
        turret.nextFireAt = timestamp + 180;
      }
    }
    remainingTurrets.push(turret);
  }

  turrets = remainingTurrets;

  const step = delta / 16;
  const remainingMissiles = [];
  for (const missile of missiles) {
    if (timestamp > missile.endsAt) continue;
    let target = enemies.find(enemy => enemy.id === missile.targetId && !enemy.dead);
    if (!target) target = findNearestEnemy(missile.x, missile.y, 620);
    if (target) missile.targetId = target.id;

    if (target) {
      const tx = target.x + target.size / 2;
      const ty = target.y + target.size / 2;
      const targetAngle = Math.atan2(ty - missile.y, tx - missile.x);
      const currentAngle = Math.atan2(missile.vy, missile.vx);
      let diff = targetAngle - currentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const nextAngle = currentAngle + clamp(diff, -missile.turnRate, missile.turnRate);
      const speed = Math.min(9.5, Math.hypot(missile.vx, missile.vy) + 0.18);
      missile.vx = Math.cos(nextAngle) * speed;
      missile.vy = Math.sin(nextAngle) * speed;
    }

    missile.x += missile.vx * step;
    missile.y += missile.vy * step;

    let hit = false;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;
      if (circlesOverlap(missile.x, missile.y, missile.radius, ex, ey, enemy.size / 2)) {
        createPlayerExplosion(missile.x, missile.y, 42, missile.damage, {
          color: "rgba(253, 186, 116, 0.38)",
          createFuseOil: false
        });
        hit = true;
        break;
      }
    }

    if (!hit) remainingMissiles.push(missile);
  }

  missiles = remainingMissiles;
}

function drawTurretsAndMissiles(timestamp) {
  for (const turret of turrets) {
    const pulse = 0.75 + Math.sin(timestamp * 0.008) * 0.12;
    const drewTurret = drawProjectileSprite({ x: turret.x, y: turret.y, kind: "turret" }, 34, {
      shadowColor: turret.color,
      shadowBlur: 10
    });
    if (!drewTurret) {
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(turret.x - 13, turret.y - 10, 26, 20);
      ctx.fillStyle = turret.color;
      ctx.fillRect(turret.x - 7, turret.y - 16, 14, 12);
    }
    ctx.strokeStyle = `rgba(253, 186, 116, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, turret.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const missile of missiles) {
    const angle = Math.atan2(missile.vy, missile.vx);
    if (drawProjectileSprite({ ...missile, kind: "missile" }, Math.max(20, missile.radius * 4), {
      angle,
      shadowColor: missile.color,
      shadowBlur: 8
    })) {
      continue;
    }

    ctx.save();
    ctx.translate(missile.x, missile.y);
    ctx.rotate(angle);
    ctx.fillStyle = missile.color;
    ctx.beginPath();
    ctx.moveTo(missile.radius * 1.9, 0);
    ctx.lineTo(-missile.radius, -missile.radius * 0.8);
    ctx.lineTo(-missile.radius * 0.5, 0);
    ctx.lineTo(-missile.radius, missile.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function updateAbilityHud(timestamp = performance.now()) {
  if (!uiAbilityBar || !player) return;
  const character = getSelectedCharacterDef();

  const abilities = Object.entries(character.abilities).map(([slot, ability]) => {
    const remaining = getAbilityRemaining(slot, timestamp);
    const isCharging = player.charge && player.charge.slot === slot;
    const stateText = isCharging ? "CHARGING" : remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : ability.name;
    const readyClass = remaining <= 0 ? "ready" : "cooling";
    const chargeClass = isCharging ? "charging" : "";
    const inputLabel = typeof getAbilityInputLabel === "function" ? getAbilityInputLabel(slot, ability.label) : ability.label;

    return { slot, ability, stateText, readyClass, chargeClass, inputLabel };
  });

  uiAbilityBar.innerHTML = abilities.map(({ inputLabel, stateText, readyClass, chargeClass }) => `
      <div class="ability ${readyClass} ${chargeClass}">
        <span class="ability-key">${inputLabel}</span>
        <span class="ability-name">${stateText}</span>
      </div>
    `).join("");

  if (uiTouchAbilities) {
    uiTouchAbilities.innerHTML = abilities.map(({ slot, inputLabel, stateText, readyClass, chargeClass }) => `
      <button class="touch-ability ${readyClass} ${chargeClass}" data-touch-ability="${slot}">
        <span>${inputLabel}</span>
        <strong>${stateText}</strong>
      </button>
    `).join("");
  }
}
