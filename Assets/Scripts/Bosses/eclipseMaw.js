var ECLIPSE_MAW_BOSS = {
  id: "eclipseMaw",
  name: "Eclipse Maw",
  subtitle: "Attune to solar and lunar wells to strip the shield",
  color: "#facc15",
  accent: "#a78bfa",
  healthMultiplier: 1.55,
  arenaColor: "rgba(250, 204, 21, 0.75)",
  fog: "rgba(49, 46, 129, 0.18)",
  phaseNames: ["Dawn", "Twin Eclipse", "Totality"]
};

function startEclipseRite(enemy, timestamp) {
  if (!activeArena) return;
  const arena = activeArena;
  activeArena.eclipseRite = {
    solar: { x: arena.x + arena.w * 0.32, y: arena.y + arena.h * 0.58, radius: 72, color: "rgba(250, 204, 21, 0.42)" },
    lunar: { x: arena.x + arena.w * 0.68, y: arena.y + arena.h * 0.58, radius: 72, color: "rgba(167, 139, 250, 0.42)" },
    required: "solar",
    progress: 0,
    requiredProgress: 2800,
    swappedAt: timestamp,
    createdAt: timestamp
  };
}



function updateEclipseRite(enemy, timestamp, delta) {
  const rite = activeArena ? activeArena.eclipseRite : null;
  if (!rite) return;
  if (timestamp - rite.swappedAt > 1850) {
    rite.required = rite.required === "solar" ? "lunar" : "solar";
    rite.swappedAt = timestamp;
  }

  const center = getPlayerCenter();
  const requiredZone = rite[rite.required];
  const wrongZone = rite.required === "solar" ? rite.lunar : rite.solar;
  const inRequired = circlesOverlap(center.x, center.y, player.size / 2, requiredZone.x, requiredZone.y, requiredZone.radius);
  const inWrong = circlesOverlap(center.x, center.y, player.size / 2, wrongZone.x, wrongZone.y, wrongZone.radius);

  if (inRequired) {
    rite.progress += delta;
  } else {
    rite.progress -= delta * 0.28;
  }

  if (inWrong && timestamp - (rite.lastWrongAt || 0) > 650) {
    rite.lastWrongAt = timestamp;
    damagePlayer(enemy.damage * 0.22);
    fireEnemyRadial(center.x, center.y, 8, {
      speed: 2.35,
      radius: 4,
      damage: enemy.damage * 0.5,
      color: wrongZone.color.includes("250") ? "#facc15" : "#a78bfa"
    });
  }

  rite.progress = clamp(rite.progress, 0, rite.requiredProgress);
  enemy.mechanicProgress = rite.progress / rite.requiredProgress;
  enemy.mechanicText = `Stand in ${rite.required === "solar" ? "Solar" : "Lunar"} well ${Math.floor(enemy.mechanicProgress * 100)}%`;

  if (rite.progress >= rite.requiredProgress) {
    completeBossIntermission(enemy, timestamp, "The eclipse splits open.");
  } else if (timestamp >= enemy.mechanicEndsAt) {
    enemy.mechanicEndsAt = timestamp + 5600;
    rite.progress *= 0.5;
    createBossImpactHazard(center.x, center.y, 86, timestamp, enemy.damage * 0.85, enemy.accent);
    showToast("Misaligned", "The eclipse surges. Find the marked well.", 1400);
  }
}



function runEclipseMawPattern(enemy, center, timestamp) {
  const boss = getBossCenter(enemy);
  const playerAngle = Math.atan2(center.y - boss.y, center.x - boss.x);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    const count = 18 + enemy.phase * 6;
    for (let i = 0; i < count; i++) {
      fireEnemyBullet(boss.x, boss.y, timestamp * 0.0015 + i * Math.PI * 2 / count, {
        speed: 2.05 + enemy.phase * 0.25,
        radius: 5,
        damage: enemy.damage * 0.82,
        color: i % 2 ? "#facc15" : "#a78bfa",
        wave: i % 2 ? 0.04 : -0.04
      });
    }
  } else if (pattern === 1) {
    createBossBeamHazard(enemy, playerAngle, timestamp, {
      sweep: 0.92,
      duration: 1700,
      width: 9,
      color: "#facc15"
    });
    createBossBeamHazard(enemy, playerAngle + Math.PI, timestamp, {
      sweep: -0.92,
      duration: 1700,
      width: 9,
      color: "#a78bfa"
    });
  } else if (pattern === 2) {
    const count = 6 + enemy.phase * 2;
    for (let i = 0; i < count; i++) {
      const pos = getArenaOrbitPoint(i, count, 0.36, timestamp * 0.0012);
      createBossImpactHazard(pos.x, pos.y, 40 + enemy.phase * 8, timestamp, enemy.damage * 0.92, i % 2 ? "#facc15" : "#a78bfa");
    }
  } else {
    fireRotatingEdgeCurtain(enemy, timestamp, 12 + enemy.phase * 4, {
      speed: 2.55 + enemy.phase * 0.22,
      radius: 5,
      damage: enemy.damage * 0.8,
      color: enemy.patternIndex % 2 ? "#facc15" : "#a78bfa",
      tangent: enemy.patternIndex % 2 ? 0.36 : -0.36
    });
    if (enemy.phase >= 2) {
      const pos = getPointOnArenaPerimeter(timestamp * 0.00011);
      spawnBossMinion("mage", pos.x, pos.y, enemy.level);
    }
  }
}


