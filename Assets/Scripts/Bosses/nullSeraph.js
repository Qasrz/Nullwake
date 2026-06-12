var NULL_SERAPH_BOSS = {
  id: "nullSeraph",
  name: "Null Seraph",
  subtitle: "Destroy void anchors before the arena collapses",
  color: "#a78bfa",
  accent: "#22d3ee",
  healthMultiplier: 1.32,
  arenaColor: "rgba(167, 139, 250, 0.85)",
  fog: "rgba(76, 29, 149, 0.18)",
  phaseNames: ["Orbit", "Anchor Break", "Singularity"]
};

function spawnVoidAnchors(enemy, timestamp) {
  const count = 3 + (enemy.phase >= 3 ? 1 : 0);
  const offset = Math.PI / 5 + timestamp * 0.0008;
  for (let i = 0; i < count; i++) {
    const pos = getArenaOrbitPoint(i, count, 0.36, offset);
    spawnBossObjective(enemy, "voidAnchor", pos.x, pos.y, {
      size: 32,
      health: Math.max(105, enemy.maxHealth * 0.058),
      color: "#22d3ee",
      accent: "#a78bfa"
    });
  }
}



function runNullSeraphPattern(enemy, center, timestamp) {
  const boss = getBossCenter(enemy);
  const playerAngle = Math.atan2(center.y - boss.y, center.x - boss.x);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    fireEnemyRadial(boss.x, boss.y, 16 + enemy.phase * 8, {
      speed: 1.95 + enemy.phase * 0.25,
      radius: 5,
      damage: enemy.damage,
      color: enemy.color,
      offset: -timestamp * 0.002,
      homing: enemy.phase >= 2,
      turnRate: 0.018
    });
  } else if (pattern === 1) {
    createGravityWell(center.x, center.y, 120 + enemy.phase * 30, timestamp, enemy.damage * 0.45, enemy.accent);
    const anchors = getRemainingBossObjectives(enemy);
    anchors.forEach(anchor => {
      createGravityWell(anchor.x + anchor.size / 2, anchor.y + anchor.size / 2, 82, timestamp, enemy.damage * 0.22, enemy.color);
    });
    fireEnemyArc(boss.x, boss.y, playerAngle, Math.PI * 1.25, 17 + enemy.phase * 4, {
      speed: 2.55,
      radius: 4,
      damage: enemy.damage * 0.78,
      color: enemy.accent,
      homing: enemy.phase >= 3,
      turnRate: 0.012
    });
  } else if (pattern === 2) {
    createBossBeamHazard(enemy, playerAngle + Math.PI / 2, timestamp, {
      sweep: -1.25,
      duration: 1750,
      width: 8 + enemy.phase,
      color: enemy.color,
      anchored: false
    });
    createBossBeamHazard(enemy, playerAngle, timestamp, {
      sweep: 1.25,
      duration: 1750,
      width: 8 + enemy.phase,
      color: enemy.accent,
      anchored: false
    });
  } else {
    fireRotatingEdgeCurtain(enemy, timestamp, 7 + enemy.phase * 3, {
      speed: 2.3 + enemy.phase * 0.2,
      radius: 5,
      damage: enemy.damage * 0.85,
      color: enemy.phase % 2 ? enemy.color : enemy.accent,
      tangent: 0.18,
      homing: enemy.phase >= 3
    });
  }
}


