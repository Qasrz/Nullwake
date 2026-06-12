function isOnScreen(p) {
  const pad = p.radius * 2;
  return p.x > -pad && p.x < WIDTH + pad && p.y > -pad && p.y < HEIGHT + pad;
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  return Math.hypot(ax - bx, ay - by) < ar + br;
}

function rectsOverlap(ax, ay, as, bx, by, bs) {
  return ax < bx + bs && ax + as > bx && ay < by + bs && ay + as > by;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getDifficultyDef() {
  return DIFFICULTY_DEFS[selectedDifficultyId] || DIFFICULTY_DEFS.hard;
}

function getStageTheme(stage = currentLevel) {
  return STAGE_THEMES[(stage - 1) % STAGE_THEMES.length];
}

function getRunDifficultyMultiplier(timestamp = performance.now()) {
  if (!runStartTime) return 1;
  const minutes = Math.max(0, (timestamp - runStartTime) / 60000);
  const stageBonus = Math.max(0, currentLevel - 1) * RUN_DIFFICULTY_PER_STAGE;
  const pressure = getDifficultyDef().runPressure || 1;
  return 1 + (minutes * RUN_DIFFICULTY_PER_MINUTE + stageBonus) * pressure;
}

function getStageEnemyCount(stage = currentLevel) {
  const isBossLevel = stage % 5 === 0;
  if (isBossLevel) return 1;
  const baseCount = 5 + (stage * 2);
  return Math.max(1, Math.ceil(baseCount * getDifficultyDef().enemyCount));
}

function getStageSpawnInterval(stage = currentLevel) {
  const baseInterval = Math.max(500, 2000 - (stage * 100));
  return Math.max(260, baseInterval * getDifficultyDef().spawnInterval * getArtifactSpawnIntervalMultiplier());
}
