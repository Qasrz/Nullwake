var CHRONARCH_BOSS = {
  id: "chronarch",
  name: "Chronarch",
  subtitle: "Obey the clock or be frozen outside time",
  color: "#f8fafc",
  accent: "#38bdf8",
  healthMultiplier: 1.42,
  arenaColor: "rgba(148, 163, 184, 0.85)",
  fog: "rgba(15, 23, 42, 0.22)",
  phaseNames: ["Seconds", "Stillness", "Midnight"]
};

function startClockRite(enemy, timestamp) {
  if (!activeArena) return;
  const center = getArenaCenter();
  const angle = ((enemy.phase + enemy.patternIndex) % 12) * (Math.PI * 2 / 12) - Math.PI / 2;
  activeArena.clockRite = {
    x: center.x,
    y: center.y,
    radius: Math.min(activeArena.w, activeArena.h) * 0.35,
    innerRadius: Math.min(activeArena.w, activeArena.h) * 0.16,
    angle,
    width: Math.PI / 8,
    progress: 0,
    required: 2400,
    createdAt: timestamp,
    color: "rgba(56, 189, 248, 0.42)"
  };
}



function updateClockRite(enemy, timestamp, delta) {
  const rite = activeArena ? activeArena.clockRite : null;
  if (!rite) return;
  const center = getPlayerCenter();
  const dx = center.x - rite.x;
  const dy = center.y - rite.y;
  const dist = Math.hypot(dx, dy);
  const playerAngle = normalizeBossAngle(Math.atan2(dy, dx));
  const targetAngle = normalizeBossAngle(rite.angle + Math.sin(timestamp * 0.0013) * 0.08);
  const inRing = dist >= rite.innerRadius && dist <= rite.radius;
  const aligned = inRing && bossAngleDistance(playerAngle, targetAngle) <= rite.width;

  rite.progress = clamp(rite.progress + (aligned ? delta : -delta * 0.3), 0, rite.required);
  enemy.mechanicProgress = rite.progress / rite.required;
  enemy.mechanicText = `Hold the glowing hour ${Math.floor(enemy.mechanicProgress * 100)}%`;

  if (rite.progress >= rite.required) {
    completeBossIntermission(enemy, timestamp, "The clock face fractures.");
  } else if (timestamp >= enemy.mechanicEndsAt) {
    freezePlayer(1500, timestamp);
    damagePlayer(enemy.damage * 0.35);
    enemy.mechanicEndsAt = timestamp + 5400;
    rite.progress = Math.max(0, rite.progress * 0.4);
    showToast("Paradox", "The wrong hour freezes you.", 1300);
  }
}



function startStillnessCheck(enemy, timestamp) {
  if (enemy.stopCheck && timestamp < enemy.stopCheck.endsAt) return;
  const center = getPlayerCenter();
  enemy.stopCheck = {
    createdAt: timestamp,
    checksAt: timestamp + 1050,
    endsAt: timestamp + 1850,
    checked: false,
    startX: center.x,
    startY: center.y
  };
  enemy.mechanicText = "CLOCK COMMAND: STOP";
  showToast("Stillness", "Stop moving and stop firing.", 1200);
}



function updateStillnessCheck(enemy, timestamp) {
  const check = enemy.stopCheck;
  if (!check) return;

  if (!check.checked && timestamp >= check.checksAt) {
    const center = getPlayerCenter();
    const moved = Math.hypot(center.x - check.startX, center.y - check.startY) > 9;
    const fired = player.lastLaserFire > check.createdAt;
    check.checked = true;

    if (moved || fired) {
      freezePlayer(1650, timestamp);
      damagePlayer(enemy.damage * 0.42);
      createTimeSnare(center.x, center.y, 72, timestamp, enemy.damage * 0.35, "#38bdf8");
      showToast("Time Locked", moved ? "You moved during Stillness." : "You fired during Stillness.", 1500);
    } else {
      showToast("Stillness Held", "The clock skips a beat.", 1100);
      createPlayerExplosion(center.x, center.y, 64, enemy.damage * 0.9, {
        color: "rgba(56, 189, 248, 0.32)",
        createFuseOil: false
      });
    }
  }

  if (timestamp > check.endsAt) {
    enemy.stopCheck = null;
    if (!enemy.invulnerable) enemy.mechanicText = "";
  }
}



function runChronarchPattern(enemy, center, timestamp) {
  const boss = getBossCenter(enemy);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    const hands = 2 + (enemy.phase >= 3 ? 1 : 0);
    for (let i = 0; i < hands; i++) {
      createBossBeamHazard(enemy, timestamp * 0.0012 + i * Math.PI * 2 / hands, timestamp, {
        sweep: (i % 2 ? -1 : 1) * (0.75 + enemy.phase * 0.16),
        duration: 1850,
        width: 6 + enemy.phase,
        color: i % 2 ? enemy.accent : "#f8fafc"
      });
    }
  } else if (pattern === 1) {
    fireHourMarkerVolley(enemy, timestamp, enemy.phase >= 2);
  } else if (pattern === 2) {
    if (!enemy.invulnerable) startStillnessCheck(enemy, timestamp);
    fireEnemyRadial(boss.x, boss.y, 12 + enemy.phase * 3, {
      speed: 1.35,
      radius: 4,
      damage: enemy.damage * 0.65,
      color: enemy.accent,
      wave: 0.075
    });
  } else {
    for (let i = 0; i < 4 + enemy.phase; i++) {
      const angle = timestamp * 0.001 + i * Math.PI * 2 / (4 + enemy.phase);
      createTimeSnare(
        center.x + Math.cos(angle) * (80 + enemy.phase * 22),
        center.y + Math.sin(angle) * (64 + enemy.phase * 18),
        44 + enemy.phase * 5,
        timestamp,
        enemy.damage * 0.72,
        enemy.accent
      );
    }
  }
}



function fireHourMarkerVolley(enemy, timestamp, alternating) {
  const center = getBossCenter(enemy);
  const arena = activeArena || { w: WIDTH, h: HEIGHT };
  const radius = Math.min(arena.w, arena.h) * 0.39;
  const count = 12;
  const skipped = alternating ? (Math.floor(timestamp / 1000) % count) : -1;
  for (let i = 0; i < count; i++) {
    if (i === skipped || i === (skipped + 6) % count) continue;
    const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    fireEnemyBullet(x, y, angle + Math.PI, {
      speed: 2.15 + enemy.phase * 0.22,
      radius: 5,
      damage: enemy.damage * 0.78,
      color: i % 3 === 0 ? "#f8fafc" : enemy.accent,
      wave: enemy.phase >= 3 ? 0.035 : 0
    });
  }
}

