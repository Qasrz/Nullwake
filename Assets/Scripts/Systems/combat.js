function fireLaser(targetX, targetY, timestamp = performance.now()) {
  if (gameState !== "playing") return;
  if (timestamp - player.lastLaserFire < LASER_FIRE_INTERVAL_MS) return;

  player.lastLaserFire = timestamp;

  const center = getPlayerCenter();
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  lasers.push({
    x: center.x,
    y: center.y,
    vx: (dx / length) * LASER_SPEED,
    vy: (dy / length) * LASER_SPEED,
    radius: LASER_RADIUS,
    damage: LASER_DAMAGE,
  });
}

function createLightning(x, y, timestamp) {
  hazards.push({ type: 'lightning', x: x, y: y, radius: LIGHTNING_RADIUS, strikesAt: timestamp + LIGHTNING_DELAY_MS, endsAt: timestamp + LIGHTNING_DELAY_MS + LIGHTNING_ACTIVE_MS, hasStruck: false });
}

function createLava(x, y, timestamp) {
  hazards.push({ type: 'lava', x: x, y: y, radius: LAVA_RADIUS, endsAt: timestamp + LAVA_DURATION_MS });
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
    isFireball: isFireball,
    maxDist: length 
  });
}

function moveProjectiles(list, delta) {
  for (const p of list) {
    p.x += p.vx * (delta / 16);
    p.y += p.vy * (delta / 16);
  }
}

function updateHazards(timestamp) {
  const remaining = [];
  for (const h of hazards) {
    if (timestamp > h.endsAt) continue; 
    if (h.type === 'lightning' && timestamp >= h.strikesAt && !h.hasStruck) h.hasStruck = true; 
    remaining.push(h);
  }
  hazards = remaining;
}

function checkLaserHits() {
  const remainingLasers = [];

  for (const laser of lasers) {
    let hit = false;
    for (const enemy of enemies) {
      if (hit) break;
      const ex = enemy.x + enemy.size / 2;
      const ey = enemy.y + enemy.size / 2;

      if (circlesOverlap(laser.x, laser.y, laser.radius, ex, ey, enemy.size / 2)) {
        enemy.health -= laser.damage;
        hit = true;
        
        // Drop Gold on Death
        if (enemy.health <= 0) {
          const dropCount = enemy.type === 'boss' ? 25 : 1; // Boss drops a massive pile of gold
          for(let i = 0; i < dropCount; i++) {
             goldDrops.push({
                x: ex + (Math.random() * 20 - 10),
                y: ey + (Math.random() * 20 - 10),
                radius: GOLD_RADIUS,
                value: 1
             });
          }
        }
      }
    }
    if (!hit) remainingLasers.push(laser);
  }

  lasers = remainingLasers;
  enemies = enemies.filter((e) => e.health > 0);
}

function checkPlayerHits() {
  if (gameState !== "playing" && gameState !== "portalPhase") return;

  const center = getPlayerCenter();
  const playerRadius = player.size / 2;
  const remainingProjectiles = [];

  for (const projectile of enemyProjectiles) {
    if (circlesOverlap(center.x, center.y, playerRadius, projectile.x, projectile.y, projectile.radius)) {
      damagePlayer();
    } else {
      remainingProjectiles.push(projectile);
    }
  }
  enemyProjectiles = remainingProjectiles;

  for (const enemy of enemies) {
    if (rectsOverlap(player.x, player.y, player.size, enemy.x, enemy.y, enemy.size)) {
      damagePlayer();
      break;
    }
  }

  for (const h of hazards) {
    if (h.type === 'lava' || (h.type === 'lightning' && h.hasStruck)) {
      if (circlesOverlap(center.x, center.y, playerRadius, h.x, h.y, h.radius)) damagePlayer();
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

    // If the player is close enough, magnetize the gold!
    if (dist < GOLD_MAGNET_RANGE && dist > 0) {
      const speed = GOLD_MAGNET_SPEED * (delta / 16);
      
      // Move the gold towards the player
      gold.x += (dx / dist) * Math.min(speed, dist);
      gold.y += (dy / dist) * Math.min(speed, dist);
      
      // Recalculate distance after the gold moves
      dx = center.x - gold.x;
      dy = center.y - gold.y;
      dist = Math.hypot(dx, dy);
    }

    // Check if picked up (using the much larger invisible radius)
    if (dist < playerRadius + GOLD_PICKUP_RADIUS) {
      playerGold += gold.value;
    } else {
      remainingGold.push(gold);
    }
  }
  goldDrops = remainingGold;
}

function drawLasers() {
  ctx.fillStyle = "#facc15";
  for (const laser of lasers) {
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemyProjectiles() {
  for (const p of enemyProjectiles) {
    ctx.fillStyle = p.isFireball ? "#f97316" : "#ef4444";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHazards() {
  for (const h of hazards) {
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