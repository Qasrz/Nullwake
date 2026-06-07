function randomSpawnPosition() {
  const margin = 40;
  const center = getPlayerCenter();
  let x, y;

  do {
    x = margin + Math.random() * (WIDTH - margin * 2);
    y = margin + Math.random() * (HEIGHT - margin * 2);
  } while (Math.hypot(x - center.x, y - center.y) < 120);

  return { x, y };
}

function spawnEnemy(forceBoss = false) {
  // Boss spawns in the top middle, others spawn randomly
  const pos = forceBoss ? { x: WIDTH / 2 - BOSS_SIZE / 2, y: 100 } : randomSpawnPosition();
  const type = forceBoss ? 'boss' : ['shooter', 'melee', 'mage'][Math.floor(Math.random() * 3)];
  
  let color, speed, fireInt, size, health;
  
  if (type === 'boss') { 
    color = '#fbbf24'; 
    speed = BOSS_SPEED; 
    fireInt = BOSS_FIRE_INTERVAL_MS; 
    size = BOSS_SIZE; 
    health = 30 + (currentLevel * 10); // Boss health scales heavily
  } else if (type === 'shooter') { 
    color = '#a855f7'; speed = SHOOTER_SPEED; fireInt = SHOOTER_FIRE_INTERVAL_MS; size = ENEMY_SIZE; health = ENEMY_HEALTH + Math.floor(currentLevel/2); 
  } else if (type === 'melee') { 
    color = '#ef4444'; speed = MELEE_SPEED; fireInt = 0; size = ENEMY_SIZE; health = ENEMY_HEALTH + Math.floor(currentLevel/2); 
  } else if (type === 'mage') { 
    color = '#3b82f6'; speed = MAGE_SPEED; fireInt = MAGE_FIRE_INTERVAL_MS; size = ENEMY_SIZE; health = ENEMY_HEALTH + Math.floor(currentLevel/2); 
  }

  enemies.push({
    x: pos.x,
    y: pos.y,
    size: size,
    health: health,
    maxHealth: health,
    type: type,
    color: color,
    baseSpeed: speed,
    fireInterval: fireInt,
    lastFire: performance.now() + Math.random() * 1000,
    isDashing: false,
    dashEndsAt: 0,
    dashAvailableAt: 0,
    dashVx: 0,
    dashVy: 0
  });
  
  enemiesSpawned++;
}

function clampEnemyToCanvas(enemy) {
  enemy.x = Math.max(0, Math.min(WIDTH - enemy.size, enemy.x));
  enemy.y = Math.max(0, Math.min(HEIGHT - enemy.size, enemy.y));
}

function updateEnemies(timestamp, delta) {
  const center = getPlayerCenter();

  for (const enemy of enemies) {
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const dx = center.x - ex;
    const dy = center.y - ey;
    const dist = Math.hypot(dx, dy);
    const step = enemy.baseSpeed * (delta / 16);

    if (enemy.type === 'melee') {
      if (enemy.isDashing) {
        if (timestamp >= enemy.dashEndsAt) {
          enemy.isDashing = false;
          enemy.dashAvailableAt = timestamp + MELEE_DASH_COOLDOWN_MS;
        } else {
          enemy.x += enemy.dashVx * (delta / 16);
          enemy.y += enemy.dashVy * (delta / 16);
        }
      } else {
        if (dist < MELEE_DASH_RANGE && timestamp >= enemy.dashAvailableAt) {
          enemy.isDashing = true;
          enemy.dashEndsAt = timestamp + MELEE_DASH_DURATION_MS;
          enemy.dashVx = (dx / dist) * MELEE_DASH_SPEED;
          enemy.dashVy = (dy / dist) * MELEE_DASH_SPEED;
        } else if (dist > 0) {
          enemy.x += (dx / dist) * step;
          enemy.y += (dy / dist) * step;
        }
      }
    } else if (enemy.type === 'boss') {
      // Boss slowly approaches the player endlessly
      if (dist > 0) {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
      
      if (timestamp - enemy.lastFire >= enemy.fireInterval) {
        fireEnemyProjectile(enemy, false); // Shoot standard projectile
        if (Math.random() > 0.6) createLightning(center.x, center.y, timestamp); // 40% chance to also drop lightning
        enemy.lastFire = timestamp;
      }
    } else {
      if (dist > 0) {
        if (dist < ENEMY_RETREAT_RANGE) {
          enemy.x -= (dx / dist) * step;
          enemy.y -= (dy / dist) * step;
        } else if (dist > ENEMY_APPROACH_RANGE) {
          enemy.x += (dx / dist) * step;
          enemy.y += (dy / dist) * step;
        }
      }

      if (timestamp - enemy.lastFire >= enemy.fireInterval) {
        if (enemy.type === 'shooter') {
          fireEnemyProjectile(enemy, false);
        } else if (enemy.type === 'mage') {
          if (Math.random() > 0.5) fireEnemyProjectile(enemy, true);
          else createLightning(center.x, center.y, timestamp);
        }
        enemy.lastFire = timestamp;
      }
    }

    clampEnemyToCanvas(enemy);
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(enemy.x, enemy.y, enemy.size, enemy.size);

    const barWidth = enemy.size;
    const barHeight = 4;
    const healthRatio = enemy.health / enemy.maxHealth;
    const barX = enemy.x;
    const barY = enemy.y - 8;

    ctx.fillStyle = "#334155";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = healthRatio > 0.33 ? "#4ade80" : "#f87171";
    ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
  }
}