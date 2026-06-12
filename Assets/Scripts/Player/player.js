function getPlayerCenter() {
  return {
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
  };
}

function createNewPlayer() {
  const character = getSelectedCharacterDef();

  return {
    x: WIDTH / 2 - PLAYER_SIZE / 2,
    y: HEIGHT / 2 - PLAYER_SIZE / 2,
    size: PLAYER_SIZE,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    invulnerableUntil: 0,
    frozenUntil: 0,
    lastLaserFire: -Infinity,
    vx: 0,
    vy: 0,
    level: 1,
    xp: 0,
    xpNeeded: getXpNeededForLevel(1),
    characterId: character.id,
    items: {},
    buffs: {},
    abilities: createAbilityState(character.id),
    charge: null
  };
}

function updatePlayer() {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  if (isPlayerFrozen()) return;

  let inputX = 0;
  let inputY = 0;

  const currentSpeed = PLAYER_SPEED * getMoveSpeedMultiplier();

  if (keys.w) inputY -= 1;
  if (keys.s) inputY += 1;
  if (keys.a) inputX -= 1;
  if (keys.d) inputX += 1;

  if (touchInput.moveActive) {
    inputX += touchInput.moveX;
    inputY += touchInput.moveY;
  }

  const inputLength = Math.hypot(inputX, inputY);
  if (inputLength > 1) {
    inputX /= inputLength;
    inputY /= inputLength;
  }

  player.x = Math.max(0, Math.min(WIDTH - player.size, player.x + inputX * currentSpeed));
  player.y = Math.max(0, Math.min(HEIGHT - player.size, player.y + inputY * currentSpeed));
}

function healPlayer(amount) {
  if (!player) return;
  player.health = Math.min(player.maxHealth, player.health + amount);
}

function isPlayerFrozen(timestamp = performance.now()) {
  return player && timestamp < (player.frozenUntil || 0);
}

function freezePlayer(duration = 1200, timestamp = performance.now()) {
  if (!player) return;
  player.frozenUntil = Math.max(player.frozenUntil || 0, timestamp + duration);
  player.vx = 0;
  player.vy = 0;
  visualEffects.push({
    type: "ring",
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
    radius: player.size * 1.4,
    color: "rgba(56, 189, 248, 0.68)",
    createdAt: timestamp,
    endsAt: timestamp + duration
  });
}

function damagePlayer(amount = 1) {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  if (performance.now() < player.invulnerableUntil) return;

  player.health -= amount;
  noteDamageTaken(amount);
  player.invulnerableUntil = performance.now() + PLAYER_DAMAGE_COOLDOWN_MS;
  addScreenShake(Math.min(10, 3 + amount * 0.08), 180);
  burstParticles(player.x + player.size / 2, player.y + player.size / 2, "#ef4444", 6, 2.4);
  
  if (player.health < 0) player.health = 0;
}

function drawPlayer() {
  const now = performance.now();
  const invulnerable = now < player.invulnerableUntil;
  const character = getSelectedCharacterDef();
  const cx = player.x + player.size / 2;
  const cy = player.y + player.size / 2;
  const color = gameState === "dead" ? "#64748b" : invulnerable ? "#ffffff" : character.color;
  const t = now * 0.006;
  const moving = Math.abs(player.vx || 0) + Math.abs(player.vy || 0) > 0.01;
  const recentlyAttacked = now - player.lastLaserFire < 180;
  const spriteRow = player.charge ? "ability" : recentlyAttacked ? "attack" : moving ? "move" : "idle";
  const frozen = isPlayerFrozen(now);
  const drewSprite = drawSpriteCentered("characters", character.id, cx, cy, player.size * 1.9, spriteRow, {
    timestamp: now,
    fps: moving ? 10 : 7,
    filter: frozen ? "brightness(1.45) saturate(0.65)" : invulnerable ? "brightness(1.9)" : gameState === "dead" ? "grayscale(1)" : undefined,
    shadowColor: frozen ? "#67e8f9" : invulnerable ? "#ffffff" : character.color,
    shadowBlur: frozen ? 18 : invulnerable ? 18 : 6
  });

  if (!drewSprite) {
    ctx.fillStyle = color;
    ctx.strokeStyle = invulnerable ? character.color : "#0f172a";
    ctx.lineWidth = 2;

    if (character.id === "stormcaller") {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = t + (Math.PI * 2 * i) / 4;
        const r = player.size * 0.62;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#67e8f9";
      ctx.beginPath();
      ctx.arc(cx, cy, player.size * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    } else if (character.id === "voidblade") {
      ctx.beginPath();
      ctx.moveTo(cx, player.y - 2);
      ctx.lineTo(player.x + player.size + 3, cy);
      ctx.lineTo(cx, player.y + player.size + 2);
      ctx.lineTo(player.x - 3, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#c4b5fd";
      ctx.beginPath();
      ctx.moveTo(player.x + 4, player.y + player.size - 4);
      ctx.lineTo(player.x + player.size - 4, player.y + 4);
      ctx.stroke();
    } else if (character.id === "alchemist") {
      ctx.beginPath();
      ctx.arc(cx, cy, player.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#bef264";
      ctx.fillRect(cx - 5, player.y - 5, 10, 10);
      ctx.strokeRect(cx - 5, player.y - 5, 10, 10);
    } else if (character.id === "engineer") {
      ctx.fillRect(player.x, player.y + 4, player.size, player.size - 4);
      ctx.strokeRect(player.x, player.y + 4, player.size, player.size - 4);
      ctx.fillStyle = "#fdba74";
      ctx.fillRect(player.x + 6, player.y - 2, player.size - 12, 8);
      ctx.strokeRect(player.x + 6, player.y - 2, player.size - 12, 8);
    } else {
      ctx.fillRect(player.x, player.y, player.size, player.size);
      ctx.strokeRect(player.x, player.y, player.size, player.size);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(player.x + player.size - 4, cy - 3, 10, 6);
    }
  }

  if (player.charge) {
    const chargePct = Math.min(1, (now - player.charge.startedAt) / 1400);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size * (0.75 + chargePct * 0.4), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargePct);
    ctx.stroke();
  }

  if (frozen) {
    ctx.strokeStyle = "rgba(103, 232, 249, 0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, player.size * 0.96, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function gainXp(amount) {
  if (!player) return;
  
  player.xp += Math.ceil(amount * getXpGainMultiplier());
  
  while (player.xp >= player.xpNeeded) {
    player.xp -= player.xpNeeded;
    player.level++;
    player.xpNeeded = getXpNeededForLevel(player.level);
    syncPlayerMaxHealth(true);
    visualEffects.push({
      type: "ring",
      x: player.x + player.size / 2,
      y: player.y + player.size / 2,
      radius: 28,
      color: "rgba(34, 197, 94, 0.55)",
      createdAt: performance.now(),
      endsAt: performance.now() + 500
    });
  }
}
