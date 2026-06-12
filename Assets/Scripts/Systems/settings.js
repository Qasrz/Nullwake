const SETTINGS_STORAGE_KEY = "nullwake.settings.v1";

const CONTROL_ACTIONS = [
  { id: "moveUp", label: "Move Up", defaultKey: "w" },
  { id: "moveLeft", label: "Move Left", defaultKey: "a" },
  { id: "moveDown", label: "Move Down", defaultKey: "s" },
  { id: "moveRight", label: "Move Right", defaultKey: "d" },
  { id: "fire", label: "Shoot", defaultKey: "space" },
  { id: "abilityRight", label: "Ability 1", defaultKey: "f" },
  { id: "abilityShift", label: "Ability 2", defaultKey: "shift" },
  { id: "abilityQ", label: "Ability 3", defaultKey: "q" },
  { id: "abilityE", label: "Ability 4", defaultKey: "e" },
  { id: "pause", label: "Pause", defaultKey: "escape" },
  { id: "restart", label: "Retry", defaultKey: "r" }
];

const DEFAULT_KEY_BINDINGS = CONTROL_ACTIONS.reduce((bindings, action) => {
  bindings[action.id] = action.defaultKey;
  return bindings;
}, {});

const DEFAULT_GAME_SETTINGS = {
  volume: {
    master: 80,
    music: 70,
    effects: 80
  },
  gameplay: {
    screenShake: true,
    damageNumbers: true,
    mobileAutoAim: true
  },
  keyBindings: { ...DEFAULT_KEY_BINDINGS }
};

let gameSettings = loadGameSettings();

function loadGameSettings() {
  const loaded = safeReadStorage(SETTINGS_STORAGE_KEY, {});
  return {
    volume: { ...DEFAULT_GAME_SETTINGS.volume, ...(loaded.volume || {}) },
    gameplay: { ...DEFAULT_GAME_SETTINGS.gameplay, ...(loaded.gameplay || {}) },
    keyBindings: { ...DEFAULT_GAME_SETTINGS.keyBindings, ...(loaded.keyBindings || {}) }
  };
}

function saveGameSettings() {
  safeWriteStorage(SETTINGS_STORAGE_KEY, gameSettings);
}

function normalizeInputKey(key) {
  const lower = String(key || "").toLowerCase();
  if (lower === " ") return "space";
  if (lower === "esc") return "escape";
  if (lower === "control") return "ctrl";
  if (lower === "arrowup") return "arrowup";
  if (lower === "arrowdown") return "arrowdown";
  if (lower === "arrowleft") return "arrowleft";
  if (lower === "arrowright") return "arrowright";
  return lower;
}

function formatInputKey(key) {
  if (!key) return "Unbound";

  const labels = {
    " ": "Space",
    space: "Space",
    escape: "Esc",
    shift: "Shift",
    ctrl: "Ctrl",
    alt: "Alt",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right"
  };
  return labels[key] || String(key || "").toUpperCase();
}

function getActionForEvent(event) {
  const key = normalizeInputKey(event.key);
  return Object.keys(gameSettings.keyBindings).find(action => gameSettings.keyBindings[action] === key) || null;
}

function getAbilityInputLabel(slot, fallback) {
  const actionBySlot = {
    right: "abilityRight",
    shift: "abilityShift",
    q: "abilityQ",
    e: "abilityE"
  };
  const action = actionBySlot[slot];
  return action ? formatInputKey(gameSettings.keyBindings[action]) : fallback;
}

function bindActionToKey(actionId, key) {
  const normalized = normalizeInputKey(key);
  if (!actionId || !normalized) return;

  Object.keys(gameSettings.keyBindings).forEach(action => {
    if (action !== actionId && gameSettings.keyBindings[action] === normalized) {
      gameSettings.keyBindings[action] = "";
    }
  });

  gameSettings.keyBindings[actionId] = normalized;
  pendingRebindAction = null;
  saveGameSettings();
  renderSettingsPanel();
}

function setMovementActionState(action, pressed) {
  if (action === "moveUp") keys.w = pressed;
  else if (action === "moveDown") keys.s = pressed;
  else if (action === "moveLeft") keys.a = pressed;
  else if (action === "moveRight") keys.d = pressed;
}

function isMovementAction(action) {
  return action === "moveUp" || action === "moveDown" || action === "moveLeft" || action === "moveRight";
}

function resetGameplaySettings() {
  gameSettings = {
    volume: { ...DEFAULT_GAME_SETTINGS.volume },
    gameplay: { ...DEFAULT_GAME_SETTINGS.gameplay },
    keyBindings: { ...DEFAULT_GAME_SETTINGS.keyBindings }
  };
  pendingRebindAction = null;
  saveGameSettings();
  renderSettingsPanel();
}

function renderSettingsPanel() {
  if (!uiSettingsPanel) return;

  const volumeRows = [
    { id: "master", label: "Main Volume" },
    { id: "music", label: "Music Volume" },
    { id: "effects", label: "FX Volume" }
  ].map(row => `
    <label class="settings-row">
      <span>${row.label}</span>
      <input type="range" min="0" max="100" value="${gameSettings.volume[row.id]}" data-volume-setting="${row.id}">
      <strong>${gameSettings.volume[row.id]}%</strong>
    </label>
  `).join("");

  const controlRows = CONTROL_ACTIONS.map(action => {
    const waiting = pendingRebindAction === action.id;
    const key = gameSettings.keyBindings[action.id];
    return `
      <div class="settings-row">
        <span>${action.label}</span>
        <button class="rebind-button ${waiting ? "listening" : ""}" data-rebind-action="${action.id}">
          ${waiting ? "Press a key" : formatInputKey(key)}
        </button>
      </div>
    `;
  }).join("");

  const toggleRows = [
    { id: "screenShake", label: "Screen Shake" },
    { id: "damageNumbers", label: "Damage Numbers" },
    { id: "mobileAutoAim", label: "Mobile Auto-Aim" }
  ].map(row => `
    <label class="settings-row toggle-row">
      <span>${row.label}</span>
      <input type="checkbox" ${gameSettings.gameplay[row.id] ? "checked" : ""} data-gameplay-setting="${row.id}">
    </label>
  `).join("");

  uiSettingsPanel.innerHTML = `
    <section class="settings-section">
      <h3>Audio</h3>
      ${volumeRows}
    </section>
    <section class="settings-section">
      <h3>Controls</h3>
      <p class="settings-note">Mouse and touch controls always stay enabled.</p>
      ${controlRows}
    </section>
    <section class="settings-section">
      <h3>Gameplay</h3>
      ${toggleRows}
    </section>
  `;

  uiSettingsPanel.querySelectorAll("[data-volume-setting]").forEach(input => {
    input.addEventListener("input", () => {
      gameSettings.volume[input.dataset.volumeSetting] = Number(input.value);
      saveGameSettings();
      const valueLabel = input.nextElementSibling;
      if (valueLabel) valueLabel.innerText = `${input.value}%`;
    });
  });

  uiSettingsPanel.querySelectorAll("[data-gameplay-setting]").forEach(input => {
    input.addEventListener("change", () => {
      gameSettings.gameplay[input.dataset.gameplaySetting] = input.checked;
      saveGameSettings();
    });
  });

  uiSettingsPanel.querySelectorAll("[data-rebind-action]").forEach(button => {
    button.addEventListener("click", () => {
      pendingRebindAction = button.dataset.rebindAction;
      renderSettingsPanel();
    });
  });
}
