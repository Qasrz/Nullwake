function getPlayerCenter() {
  return {
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
  };
}

function updatePlayer() {
  if (gameState !== "playing" && gameState !== "portalPhase") return;

  let dx = 0;
  let dy = 0;

  // DEFENSIVE CHECK: If player.items exists, use the hoof count. Otherwise, assume 0.
  const hoofStacks = player.items ? player.items.hoof : 0;
  const currentSpeed = PLAYER_SPEED * (1 + (hoofStacks * 0.15));

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

function damagePlayer() {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  if (performance.now() < player.invulnerableUntil) return;

  player.health -= 1;
  player.invulnerableUntil = performance.now() + PLAYER_DAMAGE_COOLDOWN_MS;
  
  // NOTE: We no longer call die() here! 
  // checkPlayerDeath() in main.js will now safely catch when health hits 0 and show the UI.
}

function drawPlayer() {
  const invulnerable = performance.now() < player.invulnerableUntil;
  ctx.fillStyle = gameState === "dead" ? "#64748b" : invulnerable ? "#7dd3fc" : "#38bdf8";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.size, player.size);
}