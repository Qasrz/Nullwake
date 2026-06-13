var ASHEN_CHOIR_BOSS = {
  id: "ashenChoir",
  name: "Ashen Choir",
  subtitle: "Follow the moving sanctuary through the ember storm",
  color: "#fb923c",
  accent: "#facc15",
  healthMultiplier: 1.18,
  arenaColor: "rgba(251, 146, 60, 0.82)",
  fog: "rgba(127, 29, 29, 0.16)",
  phaseNames: ["Kindling", "Traveling Sanctuary", "Crescendo"]
};

function ensureAshenSanctuary(enemy, timestamp, tight) {
  if (!activeArena) return;
  const targetWidth = Math.min(activeArena.w * (tight ? 0.42 : 0.5), tight ? 390 : 460);
  const targetHeight = Math.min(activeArena.h * (tight ? 0.38 : 0.46), tight ? 270 : 320);

  if (!activeArena.sanctuary) {
    const center = getArenaCenter();
    activeArena.sanctuary = {
      shape: "rect",
      x: center.x,
      y: center.y,
      width: targetWidth,
      height: targetHeight,
      targetWidth,
      targetHeight,
      radius: Math.min(targetWidth, targetHeight) * 0.48,
      color: "rgba(250, 204, 21, 0.26)",
      storm: "rgba(127, 29, 29, 0.46)",
      wallColor: "rgba(127, 29, 29, 0.62)",
      createdAt: timestamp
    };
  }
  activeArena.sanctuary.shape = "rect";
  activeArena.sanctuary.targetWidth = targetWidth;
  activeArena.sanctuary.targetHeight = targetHeight;
  activeArena.sanctuary.radius = Math.min(targetWidth, targetHeight) * 0.48;
}



function updateAshenSanctuary(enemy, timestamp) {
  if (!activeArena || !activeArena.sanctuary) return;
  const arena = activeArena;
  const safe = arena.sanctuary;
  const t = (timestamp - safe.createdAt) / 1000;
  const driftX = Math.cos(t * (0.22 + enemy.phase * 0.03)) * arena.w * 0.16;
  const driftY = Math.sin(t * (0.28 + enemy.phase * 0.025)) * arena.h * 0.13;
  const targetX = arena.x + arena.w * 0.5 + driftX;
  const targetY = arena.y + arena.h * 0.52 + driftY;

  safe.x += (targetX - safe.x) * 0.022;
  safe.y += (targetY - safe.y) * 0.022;
  safe.width += ((safe.targetWidth || safe.width) - safe.width) * 0.035;
  safe.height += ((safe.targetHeight || safe.height) - safe.height) * 0.035;
  safe.radius = Math.min(safe.width, safe.height) * 0.48;
}



function runAshenChoirPattern(enemy, center, timestamp) {
  const boss = getBossCenter(enemy);
  const playerAngle = Math.atan2(center.y - boss.y, center.x - boss.x);
  const pattern = enemy.patternIndex % 4;

  if (pattern === 0) {
    const impactCount = 3 + enemy.phase * 2;
    for (let i = 0; i < impactCount; i++) {
      const pos = getPointOnArenaPerimeter(timestamp * 0.00008 + i / impactCount);
      createBossImpactHazard(
        lerp(pos.x, center.x, 0.55),
        lerp(pos.y, center.y, 0.55),
        38 + enemy.phase * 6,
        timestamp,
        enemy.damage * 0.82,
        enemy.accent
      );
    }
  } else if (pattern === 1) {
    fireRotatingEdgeCurtain(enemy, timestamp, 7 + enemy.phase * 2, {
      speed: 1.76 + enemy.phase * 0.16,
      radius: 5,
      damage: enemy.damage * 0.64,
      color: enemy.color,
      tangent: 0.32
    });
  } else if (pattern === 2) {
    fireEnemyArc(boss.x, boss.y, playerAngle, Math.PI * 0.72, 5 + enemy.phase * 2, {
      speed: 2.55 + enemy.phase * 0.18,
      radius: 5,
      damage: enemy.damage * 0.78,
      color: enemy.accent
    });
  } else {
    const summons = enemy.phase >= 3 ? 2 : 1;
    for (let i = 0; i < summons; i++) {
      const pos = getPointOnArenaPerimeter(timestamp * 0.00012 + i / summons);
      spawnBossMinion("melee", pos.x, pos.y, enemy.level);
    }
    fireRotatingEdgeCurtain(enemy, timestamp + 700, 3 + enemy.phase * 2, {
      speed: 2.05,
      radius: 5,
      damage: enemy.damage * 0.58,
      color: enemy.accent,
      tangent: -0.22
    });
  }
}
