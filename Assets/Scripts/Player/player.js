function getPlayerCenter() {
  return {
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
  };
}

function updatePlayer() {
  // Allow movement during both playing AND portal phases!
  if (gameState !== "playing" && gameState !== "portalPhase") return;

  let dx = 0;
  let dy = 0;

  if (keys.w) dy -= PLAYER_SPEED;
  if (keys.s) dy += PLAYER_SPEED;
  if (keys.a) dx -= PLAYER_SPEED;
  if (keys.d) dx += PLAYER_SPEED;

  if (dx !== 0 && dy !== 0) {
    const factor = 1 / Math.SQRT2;
    dx *= factor;
    dy *= factor;
  }

  player.x = Math.max(0, Math.min(WIDTH - player.size, player.x + dx));
  player.y = Math.max(0, Math.min(HEIGHT - player.size, player.y + dy));
}

function damagePlayer() {
  if (gameState !== "playing") return;
  if (performance.now() < player.invulnerableUntil) return;

  player.health -= 1;
  player.invulnerableUntil = performance.now() + PLAYER_DAMAGE_COOLDOWN_MS;

  if (player.health <= 0) {
    die();
  }
}

function die() {
  gameState = "dead";
  statusEl.textContent = `You died on level ${currentLevel}. Press R to restart.`;
  statusEl.className = "status dead";
}

function drawPlayer() {
  const invulnerable = performance.now() < player.invulnerableUntil;
  ctx.fillStyle = gameState === "dead" ? "#64748b" : invulnerable ? "#7dd3fc" : "#38bdf8";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.size, player.size);
}