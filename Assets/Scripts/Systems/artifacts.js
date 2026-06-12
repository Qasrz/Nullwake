const ARTIFACT_STORAGE_KEY = "rogueblock.unlockedArtifacts.v1";

function safeReadStorage(key, fallback) {
  try {
    const raw = window.localStorage ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeWriteStorage(key, value) {
  try {
    if (window.localStorage) window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Local storage can be unavailable in strict/private contexts.
  }
}

function loadArtifactUnlocks() {
  unlockedArtifactIds = safeReadStorage(ARTIFACT_STORAGE_KEY, []);
}

function saveArtifactUnlocks() {
  safeWriteStorage(ARTIFACT_STORAGE_KEY, unlockedArtifactIds);
}

function isArtifactUnlocked(artifactId) {
  return unlockedArtifactIds.includes(artifactId);
}

function isArtifactActive(artifactId) {
  return selectedArtifactIds.includes(artifactId);
}

function toggleArtifact(artifactId) {
  if (!isArtifactUnlocked(artifactId)) return;
  if (isArtifactActive(artifactId)) {
    selectedArtifactIds = selectedArtifactIds.filter(id => id !== artifactId);
  } else {
    selectedArtifactIds.push(artifactId);
  }
  renderArtifactGrid();
}

function unlockArtifact(artifactId) {
  if (isArtifactUnlocked(artifactId)) return false;
  unlockedArtifactIds.push(artifactId);
  saveArtifactUnlocks();
  const artifact = ARTIFACT_DEFS.find(entry => entry.id === artifactId);
  if (artifact) showToast("Artifact Unlocked", artifact.name, 3600);
  renderArtifactGrid();
  return true;
}

function renderArtifactGrid() {
  if (!uiArtifactGrid) return;

  uiArtifactGrid.innerHTML = ARTIFACT_DEFS.map(artifact => {
    const unlocked = isArtifactUnlocked(artifact.id);
    const active = isArtifactActive(artifact.id);
    return `
      <div class="artifact-card ${unlocked ? "unlocked" : "locked"} ${active ? "active-artifact" : ""}" data-artifact="${artifact.id}" style="--artifact-color: ${artifact.color};">
        <div class="artifact-icon">${unlocked ? "" : "?"}</div>
        <h3>${unlocked ? artifact.name : "Unknown Artifact"}</h3>
        <p>${unlocked ? artifact.desc : "Challenge hidden until discovered."}</p>
        <span>${unlocked ? (active ? "Enabled" : "Click to enable") : "Locked"}</span>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-artifact]").forEach(card => {
    card.addEventListener("click", () => toggleArtifact(card.dataset.artifact));
  });
}

function createRunStats() {
  return {
    kills: 0,
    eliteKills: 0,
    bossKills: 0,
    damageTaken: 0,
    stagesCleared: 0,
    noHitStagesCleared: 0,
    goldCollected: 0,
    abilitiesUsed: 0,
    expertFirstBossKilled: false,
    highestStage: 1
  };
}

function noteDamageTaken(amount) {
  if (!runStats) return;
  runStats.damageTaken += amount;
}

function noteGoldCollected(amount) {
  if (!runStats) return;
  runStats.goldCollected += amount;
  checkArtifactChallenges();
}

function noteAbilityUsed() {
  if (!runStats) return;
  runStats.abilitiesUsed++;
  checkArtifactChallenges();
}

function noteEnemyKilled(enemy) {
  if (!runStats) return;
  runStats.kills++;
  if (enemy.elite) runStats.eliteKills++;
  if (enemy.type === "boss") {
    runStats.bossKills++;
    if (currentLevel === 5 && selectedDifficultyId === "expert") {
      runStats.expertFirstBossKilled = true;
    }
  }
  checkArtifactChallenges();
}

function noteStageCleared() {
  if (!runStats) return;
  runStats.stagesCleared++;
  runStats.highestStage = Math.max(runStats.highestStage, currentLevel);
  if (runStats.damageTaken === 0) runStats.noHitStagesCleared++;
  checkArtifactChallenges();
}

function checkArtifactChallenges() {
  if (!runStats) return;

  if (runStats.expertFirstBossKilled) unlockArtifact("fullAuto");
  if (runStats.noHitStagesCleared >= 5) unlockArtifact("glassHeart");
  if (runStats.abilitiesUsed >= 30) unlockArtifact("overclock");
  if (runStats.goldCollected >= 300) unlockArtifact("goldRush");
  if (runStats.eliteKills >= 15) unlockArtifact("elitePact");
}

function getArtifactSpawnIntervalMultiplier() {
  return isArtifactActive("overclock") ? 0.85 : 1;
}

function getArtifactAbilityCooldownMultiplier() {
  return isArtifactActive("overclock") ? 0.75 : 1;
}

function getArtifactShopCostMultiplier() {
  return isArtifactActive("goldRush") ? 1.2 : 1;
}

function getArtifactDamageMultiplier() {
  return isArtifactActive("glassHeart") ? 2 : 1;
}

function getArtifactHealthMultiplier() {
  return isArtifactActive("glassHeart") ? 0.5 : 1;
}

function getArtifactEliteChanceMultiplier() {
  return isArtifactActive("elitePact") ? 1.75 : 1;
}

function getArtifactGoldRewardMultiplier(enemy) {
  return isArtifactActive("elitePact") && enemy && enemy.elite ? 2 : 1;
}

loadArtifactUnlocks();
