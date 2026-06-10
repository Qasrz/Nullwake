function fireLaser(targetX, targetY, timestamp = performance.now()) {
  if (gameState !== "playing" && gameState !== "portalPhase") return;
  
  const syringeStacks = player.items ? player.items.syringe : 0;
  const glassesStacks = player.items ? player.items.glasses : 0;

  const currentCooldown = LASER_FIRE_INTERVAL_MS / (1 + (syringeStacks * 0.15));
  if (timestamp - player.lastLaserFire < currentCooldown) return;

  player.lastLaserFire = timestamp;

  const center = getPlayerCenter();
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  let baseDamage = LASER_DAMAGE * (1 + (player.level - 1) * 0.5);
  let damage = baseDamage;
  let isCrit = false;
  if (Math.random() < glassesStacks * 0.10) {
    damage *= 2;
    isCrit = true;
  }

  lasers.push({
    x: center.x,
    y: center.y,
    vx: (dx / length) * LASER_SPEED,
    vy: (dy / length) * LASER_SPEED,
    radius: isCrit ? LASER_RADIUS * 1.5 : LASER_RADIUS, 
    damage: damage,
    isCrit: isCrit
  });
}

function createLightning(x, y, timestamp) {
  hazards.push({ type: 'lightning', x: x, y: y, radius: LIGHTNING_RADIUS, strikesAt: timestamp + LIGHTNING_DELAY_MS, endsAt: timestamp + LIGHTNING_DELAY_MS + LIGHTNING_ACTIVE_MS, hasStruck: false });
}

function createLava(x, y, timestamp) {
  hazards.push({ type: 'lava', x: x, y: y, radius: LAVA_RADIUS, endsAt: timestamp + LAVA_DURATION_MS });
}

function createLazerBeamHazard(enemy, center, timestamp) {
  const ex = enemy.x + enemy.size / 2;
  const ey = enemy.y + enemy.size / 2;
  
  // Predict where the player will be in 0.5 seconds (500 milliseconds)
  const leadTimeMS = 100;
  const predictedX = center.x + (player.vx || 0) * leadTimeMS;
  const predictedY = center.y + (player.vy || 0) * leadTimeMS;

  const dx = predictedX - ex;
  const dy = predictedY - ey;
  
  // Base angle points straight at the predicted intercept target location
  const playerAngle = Math.atan2(dy, dx);
  const duration = LAZER_BEAM_DURATION_MS;
  const beamThickness = typeof LAZER_BEAM_THICKNESS !== 'undefined' ? LAZER_BEAM_THICKNESS : 4;

  // Randomize initial rotational direction: 1 = Clockwise start, -1 = Counter-Clockwise start
  const sweepDir = Math.random() < 0.5 ? 1 : -1;
  const arc = Math.PI / 4; // Exactly 45 degrees total sweep window
  
  // Initialize to the exact mathematical edge angle to fix the 1-frame spawn jitter bug
  const initialAngle = playerAngle - (sweepDir * arc / 2);

  hazards.push({
    type: 'lazer_beam',
    enemy: enemy,            
    playerAngle: playerAngle, 
    createdAt: timestamp,
    endsAt: timestamp + duration,
    sweepDir: sweepDir,
    angle: initialAngle,
    radius: beamThickness     
  });
}

// Math helper to get current angle of the beam based on time interpolation
function getLazerBeamAngle(h, timestamp) {
  const totalDuration = h.endsAt - h.createdAt;
  const halfDuration = totalDuration / 2;
  const elapsed = timestamp - h.createdAt;
  const arc = Math.PI / 4; // 45 degrees total sweep field
  const startAngle = h.playerAngle - (h.sweepDir * arc / 2); 

  if (elapsed < halfDuration) {
    // Phase 1: Sweep Out (0 to 45 degrees)
    const progress = elapsed / halfDuration;
    return startAngle + progress * (h.sweepDir * arc);
  } else {
    // Phase 2: Sweep Back (45 back down to 0 degrees)
    const progress = (elapsed - halfDuration) / halfDuration;
    return (startAngle + h.sweepDir * arc) - progress * (h.sweepDir * arc);
  }
}

// Capsule/Line-Circle Intersection collision algorithm helper
function lineCircleOverlap(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(cx - x1, cy - y1) <= r;
  
  let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t)); // Clamp to structural segment limits
  
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  
  return Math.hypot(cx - closestX, cy - closestY) <= r;
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

function moveHazards(list, timestamp) {
  for (const h of list) {
    if (h.type === 'lazer_beam') {
      h.angle = getLazerBeamAngle(h, timestamp);
    }
  }
}

function updateHazards(timestamp) {
  const remaining = [];
  for (const h of hazards) {
    if (timestamp > h.endsAt) continue; 
    if (h.type === 'lightning' && timestamp >= h.strikesAt && !h.hasStruck) h.hasStruck = true; 
    if (h.type === 'lazer_beam' && h.enemy.health <= 0) continue;
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
        
        if (enemy.health <= 0) {

          let xpReward = 1; 
          if (enemy.type === 'boss') xpReward = 100;
          else if (enemy.type === 'mage') xpReward = 3;
          else if (enemy.type === 'lazer') xpReward = 2;
  
          gainXp(xpReward);

          const dropCount = enemy.type === 'boss' ? 25 : 1;
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

// Added timestamp dependency parameter to accurately check moving ray hitboxes
function checkPlayerHits(timestamp) {
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
    } else if (h.type === 'lazer_beam') {
      // Linear vector mapping for sweeping laser hit calculations
      const ex = h.enemy.x + h.enemy.size / 2;
      const ey = h.enemy.y + h.enemy.size / 2;
      const angle = h.angle;
      
      const beamLength = 3000; // Large arbitrary scale factor to extend off-canvas
      const bx = ex + Math.cos(angle) * beamLength;
      const by = ey + Math.sin(angle) * beamLength;

      if (lineCircleOverlap(ex, ey, bx, by, center.x, center.y, playerRadius + h.radius)) {
        damagePlayer();
      }
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

    if (dist < GOLD_MAGNET_RANGE && dist > 0) {
      const speed = GOLD_MAGNET_SPEED * (delta / 16);
      gold.x += (dx / dist) * Math.min(speed, dist);
      gold.y += (dy / dist) * Math.min(speed, dist);
      
      dx = center.x - gold.x;
      dy = center.y - gold.y;
      dist = Math.hypot(dx, dy);
    }

    if (dist < playerRadius + GOLD_PICKUP_RADIUS) {
      playerGold += gold.value;
    } else {
      remainingGold.push(gold);
    }
  }
  goldDrops = remainingGold;
}

function drawLasers() {
  for (const laser of lasers) {
    ctx.fillStyle = laser.isCrit ? "#ef4444" : "#facc15";
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

// Added timestamp dependency parameter to accurately render moving ray beams
function drawHazards(timestamp) {
  for (const h of hazards) {
    if (h.type === 'lava' || h.type === 'lightning') {
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
    } else if (h.type === 'lazer_beam') {
      
      const ex = h.enemy.x + h.enemy.size / 2;
      const ey = h.enemy.y + h.enemy.size / 2;
      const angle = h.angle;
      
      const beamLength = 3000;
      const bx = ex + Math.cos(angle) * beamLength;
      const by = ey + Math.sin(angle) * beamLength;

      ctx.strokeStyle = h.enemy.color; // Matches the pink neon color configuration
      ctx.lineWidth = h.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(bx, by);
      ctx.stroke();
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