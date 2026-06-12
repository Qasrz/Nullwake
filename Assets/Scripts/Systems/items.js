function getSelectedCharacterDef() {
  return CHARACTER_DEFS[selectedCharacterId] || CHARACTER_DEFS.gunner;
}

function getItemDefinition(itemId) {
  return SHOP_ITEMS.find(item => item.id === itemId);
}

function getItemStack(itemId) {
  if (!player || !player.items) return 0;
  return player.items[itemId] || 0;
}

function hasItemPrerequisites(item) {
  if (!item.requires || item.requires.length === 0) return true;
  return item.requires.every(requiredItemId => getItemStack(requiredItemId) > 0);
}

function getItemCost(item) {
  const stack = getItemStack(item.id);
  return Math.floor(item.baseCost * Math.pow(1.35, stack) * getArtifactShopCostMultiplier());
}

function getPlayerDamageMultiplier() {
  if (!player) return 1;
  const character = getSelectedCharacterDef();
  const levelBonus = 1 + ((player.level || 1) - 1) * PLAYER_DAMAGE_PER_LEVEL;
  const itemBonus = 1 + getItemStack("damage") * 0.06;
  const goldStacks = getItemStack("goldEngine");
  const goldBonus = goldStacks > 0
    ? 1 + Math.min(0.12 * goldStacks, Math.floor(playerGold / 10) * 0.003 * goldStacks)
    : 1;

  return levelBonus * itemBonus * goldBonus * (character.damageMultiplier || 1) * getArtifactDamageMultiplier();
}

function getXpGainMultiplier() {
  if (!player) return 1;
  return 1 + ((player.level || 1) - 1) * PLAYER_XP_GAIN_PER_LEVEL;
}

function getCritChance() {
  return Math.min(0.75, PLAYER_BASE_CRIT_CHANCE + getItemStack("critChance") * 0.04);
}

function getCritDamageMultiplier() {
  return PLAYER_BASE_CRIT_DAMAGE + getItemStack("critDamage") * 0.15;
}

function getAbilityCooldownMultiplier() {
  return Math.pow(0.9, getItemStack("cooldown")) * getArtifactAbilityCooldownMultiplier();
}

function getAttackSpeedMultiplier() {
  return 1 + getItemStack("trigger") * 0.06;
}

function getMoveSpeedMultiplier() {
  if (!player) return 1;
  const character = getSelectedCharacterDef();
  const itemSpeed = 1 + getItemStack("hoof") * 0.05;
  const buffSpeed = player.buffs && performance.now() < (player.buffs.speedUntil || 0)
    ? player.buffs.speedMultiplier || 1
    : 1;

  return (character.speedMultiplier || 1) * itemSpeed * buffSpeed;
}

function rollDamage(baseDamage, multiplier = 1, canCrit = true, includePlayerScaling = true) {
  let damage = baseDamage * multiplier;
  if (includePlayerScaling) damage *= getPlayerDamageMultiplier();

  const isCrit = canCrit && Math.random() < getCritChance();
  if (isCrit) damage *= getCritDamageMultiplier();

  return { damage, isCrit };
}

function getXpNeededForLevel(level) {
  return Math.floor(XP_BASE_NEEDED * Math.pow(XP_LEVEL_REQUIREMENT_MULTIPLIER, level - 1));
}

function getPlayerMaxHealthForLevel(level = player ? player.level : 1) {
  const levelHealth = Math.floor(PLAYER_MAX_HEALTH * (1 + (level - 1) * PLAYER_HEALTH_PER_LEVEL));
  return Math.max(1, Math.floor((levelHealth + getItemStack("vitality") * 25) * getArtifactHealthMultiplier()));
}

function syncPlayerMaxHealth(healByIncrease = false) {
  if (!player) return;

  const previousMaxHealth = player.maxHealth || PLAYER_MAX_HEALTH;
  player.maxHealth = getPlayerMaxHealthForLevel(player.level);

  if (healByIncrease && player.maxHealth > previousMaxHealth) {
    player.health += player.maxHealth - previousMaxHealth;
  }

  player.health = Math.min(player.maxHealth, player.health);
}

function chooseShopItems(count = 4) {
  const pool = SHOP_ITEMS.filter(item => {
    const characterMatches = !item.character || item.character === selectedCharacterId;
    return characterMatches && hasItemPrerequisites(item);
  });
  const remaining = [...pool];
  const chosen = [];

  while (remaining.length > 0 && chosen.length < count) {
    const index = Math.floor(Math.random() * remaining.length);
    chosen.push(remaining.splice(index, 1)[0].id);
  }

  return chosen;
}

function openShop() {
  gameState = "shop";
  const routeBonusChoices = typeof getStageShopChoiceBonus === "function" ? getStageShopChoiceBonus() : 0;
  currentShopChoices = chooseShopItems((currentLevel % 5 === 0 ? 5 : 4) + routeBonusChoices);
  Object.keys(keys).forEach(key => keys[key] = false);

  if (uiAlert) uiAlert.classList.add("hidden");
  if (uiShopOverlay) uiShopOverlay.classList.remove("hidden");
  renderShop();
  updateDOMHud();
}

function closeShopAndOpenPortal() {
  if (uiShopOverlay) uiShopOverlay.classList.add("hidden");
  gameState = "portalPhase";
  portals = createRoutePortalsForNextStage();
  portal = portals[0] || null;

  uiAlertText.innerText = portals.length > 1 ? "Choose a route. Gold outline means elite danger." : "Boss portal stabilized.";
  uiAlert.classList.remove("hidden");
}

function renderShop() {
  if (!uiShopItems || !uiShopGold) return;

  uiShopGold.innerText = playerGold;
  if (uiShopTitle) {
    const routeName = currentStageRoute && currentStageRoute.mode !== "boss" ? ` - ${currentStageRoute.shortName}` : "";
    uiShopTitle.innerText = currentLevel % 5 === 0 ? `Boss Cache: Stage ${currentLevel}` : `Stage ${currentLevel}${routeName} Cleared`;
  }

  uiShopItems.innerHTML = currentShopChoices.map(itemId => {
    const item = getItemDefinition(itemId);
    const stack = getItemStack(item.id);
    const cost = getItemCost(item);
    const affordable = playerGold >= cost;

    return `
      <div class="shop-card" style="--item-color: ${item.color};">
        <div class="shop-card-top">
          <div class="shop-icon"></div>
          <span class="shop-stack">x${stack}</span>
        </div>
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <button class="shop-buy" data-buy-item="${item.id}" ${affordable ? "" : "disabled"}>
          Buy ${cost}g
        </button>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-buy-item]").forEach(button => {
    button.addEventListener("click", () => buyShopItem(button.dataset.buyItem));
  });
}

function buyShopItem(itemId) {
  const item = getItemDefinition(itemId);
  if (!item || !player) return;

  const cost = getItemCost(item);
  if (playerGold < cost) return;

  playerGold -= cost;
  player.items[item.id] = (player.items[item.id] || 0) + 1;

  if (item.id === "vitality") {
    syncPlayerMaxHealth(false);
    healPlayer(25);
  }

  renderShop();
  updateDOMHud();
}
