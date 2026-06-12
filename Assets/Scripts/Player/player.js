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

  let dx = 0;
  let dy = 0;

  const currentSpeed = PLAYER_SPEED * getMoveSpeedMultiplier();

  if (keys.w) dy -= currentSpeed;
  if (keys.s) dy += currentSpeed;
  if (keys.a) dx -= currentSpeed;
  if (keys.d) dx += currentSpeed;

  if (dx !== 0 && dy !== 0) {
    const factor = 1 / Math.SQRT2;
    dx *= factor;
    dy *= factor;
  }

  player.x = Math.max(0, Math.min(WIDTH - player.size, player.x + dx));
  player.y = Math.max(0, Math.min(HEIGHT - player.size, player.y + dy));
}

function healPlayer(amount) {
  if (!player) return;
  player.health = Math.min(player.maxHealth, player.health + amount);
}

function damagePlayer(amount = 1) {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  if (performance.now() < player.invulnerableUntil) return;

  player.health -= amount;
  player.invulnerableUntil = performance.now() + PLAYER_DAMAGE_COOLDOWN_MS;
  addScreenShake(Math.min(10, 3 + amount * 0.08), 180);
  burstParticles(player.x + player.size / 2, player.y + player.size / 2, "#ef4444", 6, 2.4);
  
  if (player.health < 0) player.health = 0;
}

function drawPlayer() {
  const invulnerable = performance.now() < player.invulnerableUntil;
  const character = getSelectedCharacterDef();
  ctx.fillStyle = gameState === "dead" ? "#64748b" : invulnerable ? "#ffffff" : character.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = invulnerable ? character.color : "#0f172a";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.size, player.size);

  if (player.charge) {
    const chargePct = Math.min(1, (performance.now() - player.charge.startedAt) / 1400);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size * (0.75 + chargePct * 0.4), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargePct);
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
