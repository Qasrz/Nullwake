var PRISM_WARDEN_BOSS = {
  id: "prismWarden",
  name: "Prism Warden",
  subtitle: "Break mirror foci, dodge refraction walls",
  color: "#38bdf8",
  accent: "#f0abfc",
  healthMultiplier: 1.05,
  arenaColor: "rgba(56, 189, 248, 0.8)",
  fog: "rgba(8, 47, 73, 0.16)",
  phaseNames: ["Refraction", "Mirror Lock", "Whiteout"]
};

function spawnPrismFoci(enemy, timestamp) {
  const count = 3;
  const offset = timestamp * 0.001;
  for (let i = 0; i < count; i++) {
    const pos = getArenaOrbitPoint(i, count, 0.34, offset);
    spawnBossObjective(enemy, "prismFocus", pos.x, pos.y, {
      size: 30,
      health: Math.max(95, enemy.maxHealth * 0.052),
      color: "#f0abfc",
      accent: "#38bdf8"
    });
  }
}



function runPrismWardenPattern(enemy, center, timestamp) {
  const boss = getBossCenter(enemy);
  const playerAngle = Math.atan2(center.y - boss.y, center.x - boss.x);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    fireEnemyRadial(boss.x, boss.y, 18 + enemy.phase * 7, {
      speed: 2.15 + enemy.phase * 0.35,
      radius: 5,
      damage: enemy.damage,
      color: enemy.color,
      offset: timestamp * 0.002,
      gapAngle: playerAngle + Math.PI,
      gapSize: Math.PI / (4.1 - enemy.phase * 0.35)
    });
  } else if (pattern === 1) {
    const foci = getRemainingBossObjectives(enemy);
    const sources = foci.length > 0 ? foci : [enemy];
    sources.forEach((source, index) => {
      const sx = source.x + source.size / 2;
      const sy = source.y + source.size / 2;
      fireEnemyArc(sx, sy, Math.atan2(center.y - sy, center.x - sx), Math.PI * 0.65, 5 + enemy.phase, {
        speed: 2.6,
        radius: 4,
        damage: enemy.damage * 0.72,
        color: index % 2 ? enemy.accent : enemy.color
      });
    });
  } else if (pattern === 2) {
    for (let i = 0; i < 3; i++) {
      createBossBeamHazard(enemy, playerAngle + i * Math.PI * 2 / 3, timestamp, {
        sweep: enemy.phase >= 2 ? 0.75 : 0.45,
        duration: 1450 + enemy.phase * 260,
        width: 7 + enemy.phase * 2,
        color: i % 2 ? enemy.color : enemy.accent
      });
    }
  } else {
    const mines = 4 + enemy.phase * 2;
    for (let i = 0; i < mines; i++) {
      const pos = getArenaOrbitPoint(i, mines, 0.36, timestamp * 0.001);
      createBossImpactHazard(pos.x, pos.y, 42 + enemy.phase * 8, timestamp, enemy.damage, enemy.accent);
    }
  }
}


