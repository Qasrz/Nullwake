function drawWorldBackground(timestamp) {
  const theme = getStageTheme(currentLevel);
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = theme.fog;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const gridSize = 64;
  const drift = (timestamp * 0.012) % gridSize;
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = -gridSize + drift; x < WIDTH + gridSize; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = -gridSize + drift; y < HEIGHT + gridSize; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(WIDTH * 0.5, HEIGHT * 0.52, Math.min(WIDTH, HEIGHT) * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, 0, WIDTH, 14);
  ctx.fillRect(0, HEIGHT - 14, WIDTH, 14);
  ctx.fillRect(0, 0, 14, HEIGHT);
  ctx.fillRect(WIDTH - 14, 0, 14, HEIGHT);
}

function addParticle(x, y, color, options = {}) {
  particles.push({
    x,
    y,
    vx: options.vx !== undefined ? options.vx : randRange(-1.8, 1.8),
    vy: options.vy !== undefined ? options.vy : randRange(-1.8, 1.8),
    radius: options.radius || randRange(2, 5),
    color,
    createdAt: performance.now(),
    endsAt: performance.now() + (options.duration || randRange(260, 620)),
    drag: options.drag || 0.94
  });
}

function burstParticles(x, y, color, count = 10, speed = 2.4) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = randRange(speed * 0.35, speed);
    addParticle(x, y, color, {
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      radius: randRange(2, 5),
      duration: randRange(280, 720)
    });
  }
}

function updateParticles(delta, timestamp) {
  const step = delta / 16;
  const remaining = [];

  for (const particle of particles) {
    if (timestamp > particle.endsAt) continue;
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
    remaining.push(particle);
  }

  particles = remaining;
}

function drawParticles(timestamp) {
  for (const particle of particles) {
    const lifePct = clamp((particle.endsAt - timestamp) / (particle.endsAt - particle.createdAt), 0, 1);
    ctx.globalAlpha = lifePct;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.55 + lifePct * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function addFloatingText(text, x, y, color = "#f8fafc", size = 14) {
  if (typeof gameSettings !== "undefined" && gameSettings.gameplay && !gameSettings.gameplay.damageNumbers) return;

  floatingTexts.push({
    text,
    x,
    y,
    vy: -0.45,
    color,
    size,
    createdAt: performance.now(),
    endsAt: performance.now() + 700
  });
}

function updateFloatingTexts(delta, timestamp) {
  const step = delta / 16;
  floatingTexts = floatingTexts.filter(text => {
    text.y += text.vy * step;
    return timestamp < text.endsAt;
  });
}

function drawFloatingTexts(timestamp) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const text of floatingTexts) {
    const lifePct = clamp((text.endsAt - timestamp) / (text.endsAt - text.createdAt), 0, 1);
    ctx.globalAlpha = lifePct;
    ctx.font = `800 ${text.size}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillText(text.text, text.x + 1, text.y + 1);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function addScreenShake(amount = 6, duration = 220) {
  if (typeof gameSettings !== "undefined" && gameSettings.gameplay && !gameSettings.gameplay.screenShake) return;

  screenShake.amount = Math.max(screenShake.amount, amount);
  screenShake.endsAt = Math.max(screenShake.endsAt, performance.now() + duration);
}

function getCameraShakeOffset(timestamp) {
  if (timestamp > screenShake.endsAt) {
    screenShake.amount = 0;
    return { x: 0, y: 0 };
  }

  const remaining = clamp((screenShake.endsAt - timestamp) / 260, 0, 1);
  const amount = screenShake.amount * remaining;
  return {
    x: randRange(-amount, amount),
    y: randRange(-amount, amount)
  };
}

function showToast(title, text = "", duration = 2400) {
  activeToast = {
    title,
    text,
    endsAt: performance.now() + duration
  };

  if (!uiToast) return;
  if (uiToastTitle) uiToastTitle.innerText = title;
  if (uiToastText) uiToastText.innerText = text;
  uiToast.classList.remove("hidden");
}

function updateToast(timestamp) {
  if (!activeToast || timestamp < activeToast.endsAt) return;
  activeToast = null;
  if (uiToast) uiToast.classList.add("hidden");
}

function drawArenaBounds(timestamp) {
  if (!activeArena) return;

  const pulse = 0.55 + Math.sin(timestamp * 0.008) * 0.2;
  ctx.strokeStyle = activeArena.color || "rgba(167, 139, 250, 0.8)";
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 4;
  ctx.strokeRect(activeArena.x, activeArena.y, activeArena.w, activeArena.h);
  ctx.globalAlpha = 1;

  ctx.fillStyle = activeArena.fog || "rgba(76, 29, 149, 0.12)";
  ctx.fillRect(0, 0, WIDTH, activeArena.y);
  ctx.fillRect(0, activeArena.y + activeArena.h, WIDTH, HEIGHT - activeArena.y - activeArena.h);
  ctx.fillRect(0, activeArena.y, activeArena.x, activeArena.h);
  ctx.fillRect(activeArena.x + activeArena.w, activeArena.y, WIDTH - activeArena.x - activeArena.w, activeArena.h);

  if (activeArena.sanctuary) {
    const safe = activeArena.sanctuary;
    if (safe.shape === "rect") {
      const left = safe.x - safe.width / 2;
      const top = safe.y - safe.height / 2;
      const right = safe.x + safe.width / 2;
      const bottom = safe.y + safe.height / 2;

      ctx.fillStyle = safe.wallColor || "rgba(127, 29, 29, 0.58)";
      ctx.fillRect(activeArena.x, activeArena.y, activeArena.w, Math.max(0, top - activeArena.y));
      ctx.fillRect(activeArena.x, bottom, activeArena.w, Math.max(0, activeArena.y + activeArena.h - bottom));
      ctx.fillRect(activeArena.x, top, Math.max(0, left - activeArena.x), safe.height);
      ctx.fillRect(right, top, Math.max(0, activeArena.x + activeArena.w - right), safe.height);

      ctx.fillStyle = safe.color || "rgba(250, 204, 21, 0.26)";
      ctx.fillRect(left, top, safe.width, safe.height);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 6;
      ctx.strokeRect(left, top, safe.width, safe.height);
      ctx.strokeStyle = "rgba(248, 250, 252, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 8, top + 8, safe.width - 16, safe.height - 16);
    } else {
      ctx.fillStyle = safe.storm || "rgba(127, 29, 29, 0.24)";
      ctx.fillRect(activeArena.x, activeArena.y, activeArena.w, activeArena.h);
      ctx.fillStyle = safe.color || "rgba(250, 204, 21, 0.32)";
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(safe.x, safe.y, safe.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (activeArena.clockRite) {
    const rite = activeArena.clockRite;
    const targetAngle = rite.angle + Math.sin(timestamp * 0.0013) * 0.08;
    ctx.strokeStyle = "rgba(248, 250, 252, 0.36)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rite.x, rite.y, rite.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rite.x, rite.y, rite.innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rite.color || "rgba(56, 189, 248, 0.36)";
    ctx.beginPath();
    ctx.moveTo(rite.x, rite.y);
    ctx.arc(rite.x, rite.y, rite.radius, targetAngle - rite.width, targetAngle + rite.width);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(rite.x, rite.y, rite.radius + 3, targetAngle - rite.width, targetAngle + rite.width);
    ctx.stroke();
  }

  if (activeArena.eclipseRite) {
    const rite = activeArena.eclipseRite;
    ["solar", "lunar"].forEach(key => {
      const zone = rite[key];
      const required = rite.required === key;
      ctx.fillStyle = zone.color;
      ctx.strokeStyle = required ? "#f8fafc" : key === "solar" ? "#facc15" : "#a78bfa";
      ctx.lineWidth = required ? 5 : 3;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}

function updateBossHud(timestamp) {
  const boss = enemies.find(enemy => enemy.type === "boss" && !enemy.dead);
  if (!boss) {
    if (uiBossFrame) uiBossFrame.classList.add("hidden");
    return;
  }

  if (uiBossFrame) uiBossFrame.classList.remove("hidden");
  if (uiBossName) uiBossName.innerText = boss.bossName || "Boss";
  if (uiBossSubtitle) uiBossSubtitle.innerText = boss.mechanicText || boss.bossSubtitle || "";
  if (uiBossHealthFill) uiBossHealthFill.style.width = `${clamp((boss.health / boss.maxHealth) * 100, 0, 100)}%`;
  if (uiBossPhaseText) uiBossPhaseText.innerText = boss.invulnerable
    ? `IMMUNE ${Math.floor((boss.mechanicProgress || 0) * 100)}%`
    : `Phase ${boss.phase || 1}`;

  if (uiObjectiveText) {
    uiObjectiveText.innerText = boss.invulnerable
      ? boss.mechanicText || "Resolve the boss mechanic"
      : `Defeat ${boss.bossName || "the boss"}`;
  }
}

function updateRunHud(timestamp) {
  if (uiRunClock) uiRunClock.innerText = formatTime(timestamp - runStartTime);

  if (uiDifficultyText) {
    const diff = getRunDifficultyMultiplier(timestamp);
    let label = "Warming";
    if (diff >= 1.35) label = "Threatening";
    if (diff >= 1.75) label = "Savage";
    if (diff >= 2.2) label = "Cataclysmic";
    uiDifficultyText.innerText = `${label} x${diff.toFixed(2)}`;
  }

  if (uiDifficultyDetail) {
    uiDifficultyDetail.innerText = getDifficultyDef().name;
  }

  if (uiObjectiveText && !enemies.some(enemy => enemy.type === "boss" && !enemy.dead)) {
    uiObjectiveText.innerText = typeof getStageObjectiveText === "function"
      ? getStageObjectiveText(timestamp)
      : currentLevel % 5 === 0 ? "Boss signal detected" : "Clear the wave";
  }
}
