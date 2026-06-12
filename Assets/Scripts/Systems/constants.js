const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const uiHealthFill = document.getElementById("health-fill");
const uiHealthText = document.getElementById("health-text");
const uiGoldCounter = document.getElementById("gold-counter");
const uiAlert = document.getElementById("game-alert");
const uiAlertText = document.getElementById("alert-text");
const uiXpFill = document.getElementById("xp-fill");
const uiLevelText = document.getElementById("level-text");
const uiStageText = document.getElementById("stage-text");
const uiStatsText = document.getElementById("stats-text");
const uiAbilityBar = document.getElementById("ability-bar");
const uiArtifactGrid = document.getElementById("artifact-grid");
const uiRunClock = document.getElementById("run-clock");
const uiDifficultyText = document.getElementById("difficulty-text");
const uiDifficultyDetail = document.getElementById("difficulty-detail");
const uiObjectiveText = document.getElementById("objective-text");
const uiBossFrame = document.getElementById("boss-frame");
const uiBossName = document.getElementById("boss-name");
const uiBossSubtitle = document.getElementById("boss-subtitle");
const uiBossHealthFill = document.getElementById("boss-health-fill");
const uiBossPhaseText = document.getElementById("boss-phase-text");
const uiToast = document.getElementById("toast");
const uiToastTitle = document.getElementById("toast-title");
const uiToastText = document.getElementById("toast-text");
const uiShopOverlay = document.getElementById("shop-overlay");
const uiShopItems = document.getElementById("shop-items");
const uiShopGold = document.getElementById("shop-gold");
const uiShopTitle = document.getElementById("shop-title");
const btnShopContinue = document.getElementById("btn-shop-continue");
const uiTouchControls = document.getElementById("touch-controls");
const uiTouchMove = document.getElementById("touch-move");
const uiTouchMoveKnob = document.getElementById("touch-move-knob");
const uiTouchAim = document.getElementById("touch-aim");
const uiTouchAimKnob = document.getElementById("touch-aim-knob");
const uiTouchAbilities = document.getElementById("touch-abilities");

const PLAYER_SIZE = 24;
const PLAYER_SPEED = 3.25;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;
const PLAYER_BASE_DAMAGE = 20;
const PLAYER_BASE_CRIT_CHANCE = 0;
const PLAYER_BASE_CRIT_DAMAGE = 2;
const PLAYER_DAMAGE_PER_LEVEL = 0.05;
const PLAYER_XP_GAIN_PER_LEVEL = 0.10;
const PLAYER_HEALTH_PER_LEVEL = 0.10;
const XP_BASE_NEEDED = 100;
const XP_LEVEL_REQUIREMENT_MULTIPLIER = 1.10;
const RUN_DIFFICULTY_PER_MINUTE = 0.045;
const RUN_DIFFICULTY_PER_STAGE = 0.06;

const DIFFICULTY_DEFS = {
  easy: {
    id: "easy",
    name: "Easy",
    desc: "A forgiving run with fewer enemies, slower events, and full heals after stages.",
    health: 0.52,
    damage: 0.45,
    spawnInterval: 1.75,
    enemyCount: 0.62,
    eliteChance: 0.30,
    runPressure: 0.55,
    routePressure: 0.58,
    routeEventChance: 0.18,
    regen: "stage"
  },
  medium: {
    id: "medium",
    name: "Medium",
    desc: "The old Easy curve. Beatable baseline with full heals after stages.",
    health: 0.70,
    damage: 0.65,
    spawnInterval: 1.35,
    enemyCount: 0.82,
    eliteChance: 0.55,
    runPressure: 0.75,
    routePressure: 0.78,
    routeEventChance: 0.35,
    regen: "stage"
  },
  hard: {
    id: "hard",
    name: "Hard",
    desc: "Sharper enemy stats and less healing, but no longer the old wall.",
    health: 0.88,
    damage: 0.86,
    spawnInterval: 1.12,
    enemyCount: 0.94,
    eliteChance: 0.82,
    runPressure: 0.90,
    routePressure: 0.94,
    routeEventChance: 0.50,
    regen: "boss"
  },
  expert: {
    id: "expert",
    name: "Expert",
    desc: "Close to the old Hard baseline with no free stage healing.",
    health: 1.05,
    damage: 1.06,
    spawnInterval: 0.98,
    enemyCount: 1.04,
    eliteChance: 1.05,
    runPressure: 1.03,
    routePressure: 1.08,
    routeEventChance: 0.68,
    regen: "none"
  }
};

const CHARACTER_DEFS = {
  gunner: {
    id: "gunner",
    name: "Gunner",
    color: "#38bdf8",
    projectileColor: "#facc15",
    desc: "Reliable shots, explosives, and charged precision.",
    speedMultiplier: 1,
    damageMultiplier: 1,
    primary: { name: "Ballistic Rifle", cooldown: 560 },
    abilities: {
      right: { label: "RMB", name: "Grenade", cooldown: 5200 },
      shift: { label: "Shift", name: "Combat Slide", cooldown: 4300 },
      q: { label: "Q", name: "Scatter Shot", cooldown: 3600 },
      e: { label: "E", name: "Charged Shot", cooldown: 6200, hold: true }
    }
  },
  stormcaller: {
    id: "stormcaller",
    name: "Stormcaller",
    color: "#f59e0b",
    projectileColor: "#67e8f9",
    desc: "Chains lightning through packs and blinks through danger.",
    speedMultiplier: 1.03,
    damageMultiplier: 0.92,
    primary: { name: "Static Bolt", cooldown: 720 },
    abilities: {
      right: { label: "RMB", name: "Arc Orb", cooldown: 4700 },
      shift: { label: "Shift", name: "Blink", cooldown: 5600 },
      q: { label: "Q", name: "Storm Rod", cooldown: 7000 },
      e: { label: "E", name: "Tempest Spear", cooldown: 7600, hold: true }
    }
  },
  voidblade: {
    id: "voidblade",
    name: "Voidblade",
    color: "#a78bfa",
    projectileColor: "#c4b5fd",
    desc: "Fast dashes, blade fans, and gravity cuts.",
    speedMultiplier: 1.06,
    damageMultiplier: 0.86,
    primary: { name: "Void Slash", cooldown: 660 },
    abilities: {
      right: { label: "RMB", name: "Rift Hook", cooldown: 4200 },
      shift: { label: "Shift", name: "Phase Step", cooldown: 5200 },
      q: { label: "Q", name: "Blade Bloom", cooldown: 6100 },
      e: { label: "E", name: "Singularity Cut", cooldown: 8200, hold: true }
    }
  },
  alchemist: {
    id: "alchemist",
    name: "Alchemist",
    color: "#34d399",
    projectileColor: "#bef264",
    desc: "Area denial, healing tonics, and volatile flasks.",
    speedMultiplier: 0.96,
    damageMultiplier: 1.02,
    primary: { name: "Volatile Flask", cooldown: 1040 },
    abilities: {
      right: { label: "RMB", name: "Transmute Pool", cooldown: 5000 },
      shift: { label: "Shift", name: "Tonic Rush", cooldown: 7800 },
      q: { label: "Q", name: "Catalyst Cloud", cooldown: 6500 },
      e: { label: "E", name: "Pressure Cask", cooldown: 8600, hold: true }
    }
  },
  engineer: {
    id: "engineer",
    name: "Engineer",
    color: "#f97316",
    projectileColor: "#fdba74",
    desc: "Builds turrets, paints targets, and launches smart ordnance.",
    speedMultiplier: 0.94,
    damageMultiplier: 1.04,
    primary: { name: "Rivet Driver", cooldown: 640 },
    abilities: {
      right: { label: "RMB", name: "Deploy Turret", cooldown: 9000 },
      shift: { label: "Shift", name: "Missile Lock", cooldown: 6800, hold: true },
      q: { label: "Q", name: "Shock Pylon", cooldown: 7200 },
      e: { label: "E", name: "Scrap Bulwark", cooldown: 9600 }
    }
  }
};

const ARTIFACT_DEFS = [
  {
    id: "fullAuto",
    name: "Artifact of Triggerflow",
    desc: "Holding left click continuously fires your primary at full speed.",
    hint: "Defeat the first boss on Expert.",
    color: "#38bdf8"
  },
  {
    id: "glassHeart",
    name: "Artifact of Glass Hearts",
    desc: "Max health is halved, but all damage is doubled.",
    hint: "Clear five stages in one run without taking damage.",
    color: "#fb7185"
  },
  {
    id: "overclock",
    name: "Artifact of Overclocking",
    desc: "Abilities recharge 25% faster, but enemies spawn 15% faster.",
    hint: "Use 30 abilities in one run.",
    color: "#facc15"
  },
  {
    id: "goldRush",
    name: "Artifact of the Golden Engine",
    desc: "Start with 60 gold, but shop prices are 20% higher.",
    hint: "Collect 300 gold in one run.",
    color: "#fde047"
  },
  {
    id: "elitePact",
    name: "Artifact of Crowned Foes",
    desc: "Elites appear much more often and drop extra gold.",
    hint: "Kill 15 elites in one run.",
    color: "#a78bfa"
  }
];

// Risk-of-Rain-style stackable items plus a few build-around synergies.
const SHOP_ITEMS = [
  { id: "vitality", name: "Heart Injector", desc: "+25 max health and heal 25.", baseCost: 18, color: "#ef4444" },
  { id: "damage", name: "Caliber Core", desc: "+6% damage.", baseCost: 22, color: "#fb923c" },
  { id: "critChance", name: "Glass Prism", desc: "+4% critical chance.", baseCost: 20, color: "#f43f5e" },
  { id: "critDamage", name: "Redline Scope", desc: "+15% critical damage.", baseCost: 24, color: "#f97316", requires: ["critChance"] },
  { id: "bounce", name: "Ricochet Plate", desc: "Shots bounce off +1 wall.", baseCost: 25, color: "#60a5fa" },
  { id: "pierce", name: "Needle Rail", desc: "Shots pierce +1 enemy.", baseCost: 25, color: "#22c55e" },
  { id: "explosive", name: "Blast Seed", desc: "Shots explode for half damage. Stacks add radius and blast damage.", baseCost: 32, color: "#facc15" },
  { id: "cooldown", name: "Chrono Spool", desc: "Ability cooldowns are 10% shorter, multiplicative.", baseCost: 28, color: "#14b8a6" },
  { id: "trigger", name: "Reflex Trigger", desc: "+6% primary fire rate.", baseCost: 18, color: "#eab308" },
  { id: "hoof", name: "Phase Hoof", desc: "+5% move speed.", baseCost: 18, color: "#a3e635" },
  { id: "kineticLoop", name: "Kinetic Loop", desc: "Bounced shots gain +25% damage per stack.", baseCost: 30, color: "#38bdf8", requires: ["bounce"] },
  { id: "stormNeedle", name: "Storm Needle", desc: "Piercing hits arc lightning to a nearby enemy.", baseCost: 34, color: "#67e8f9", requires: ["pierce"] },
  { id: "fuseOil", name: "Fuse Oil", desc: "Explosions leave burning pools that scale with blast damage.", baseCost: 34, color: "#fb7185", requires: ["explosive"] },
  { id: "goldEngine", name: "Interest Engine", desc: "+0.3% damage per 10 gold held, capped per stack.", baseCost: 26, color: "#fde047" },
  { id: "gunnerCluster", name: "Cluster Grenade", desc: "Gunner grenades burst into smaller grenades.", baseCost: 42, color: "#fb923c", character: "gunner" },
  { id: "gunnerFractal", name: "Fractal Scatter", desc: "Gunner Scatter Shot splits again on hit for half damage.", baseCost: 42, color: "#38bdf8", character: "gunner" },
  { id: "gunnerChargedBounce", name: "Mag-Rail Fletching", desc: "Gunner Charged Shot gains +3 wall bounces.", baseCost: 42, color: "#facc15", character: "gunner" }
];

const STAGE_THEMES = [
  { name: "Glasswild Expanse", floor: "#0d1620", grid: "rgba(56, 189, 248, 0.16)", accent: "#38bdf8", fog: "rgba(8, 47, 73, 0.18)" },
  { name: "Cinder Archive", floor: "#1b1110", grid: "rgba(251, 146, 60, 0.14)", accent: "#fb923c", fog: "rgba(127, 29, 29, 0.18)" },
  { name: "Verdant Relay", floor: "#0f1b13", grid: "rgba(52, 211, 153, 0.13)", accent: "#34d399", fog: "rgba(20, 83, 45, 0.18)" },
  { name: "Null Observatory", floor: "#151123", grid: "rgba(167, 139, 250, 0.15)", accent: "#a78bfa", fog: "rgba(76, 29, 149, 0.18)" }
];

const ENEMY_SIZE = 22;
const ENEMY_HEALTH = 50;
const ENEMY_RETREAT_RANGE = 250;
const ENEMY_APPROACH_RANGE = 600;
const ENEMY_LEVEL_STEP = 2;
const ENEMY_HEALTH_PER_LEVEL = 0.12;
const ENEMY_DAMAGE_PER_LEVEL = 0.08;
const ENEMY_XP_PER_LEVEL = 10;
const ENEMY_STATS = {
  melee: { health: 100, damage: 40 },
  shooter: { health: 50, damage: 30 },
  mage: { health: 50, damage: 30 },
  lazer: { health: 50, damage: 30 },
  splitter: { health: 70, damage: 28 },
  orbiter: { health: 65, damage: 26 },
  miniboss: { health: 360, damage: 42 },
  boss: { health: 650, damage: 50 }
};

const SHOOTER_SPEED = 1.2;
const SHOOTER_FIRE_INTERVAL_MS = 1200;
const ENEMY_PROJECTILE_RADIUS = 6;
const ENEMY_PROJECTILE_SPEED = 2.5;

const MELEE_SPEED = 2.0;
const MELEE_DASH_SPEED = 8.0;
const MELEE_DASH_RANGE = 200;
const MELEE_DASH_COOLDOWN_MS = 1500;
const MELEE_DASH_DURATION_MS = 250;

const MAGE_SPEED = 0.8;
const MAGE_FIRE_INTERVAL_MS = 2500;
const LIGHTNING_DELAY_MS = 1000;
const LIGHTNING_ACTIVE_MS = 200;
const LIGHTNING_RADIUS = 40;
const LAVA_DURATION_MS = 4000;
const LAVA_RADIUS = 35;

const BOSS_SIZE = 60;
const BOSS_SPEED = 0.6;
const BOSS_FIRE_INTERVAL_MS = 800;
const BOSS_PHASE_HEALTH = [0.66, 0.33];
const BOSS_ARENA_MARGIN = 70;

const LASER_SPEED = 9;
const LASER_DAMAGE = PLAYER_BASE_DAMAGE;
const LASER_RADIUS = 4;
const LASER_FIRE_INTERVAL_MS = 560;

const GOLD_RADIUS = 5; 
const GOLD_PICKUP_RADIUS = 25; 
const GOLD_MAGNET_RANGE = 150; 
const GOLD_MAGNET_SPEED = 8.0; 
const PORTAL_RADIUS = 30;

const LAZER_BEAM_DURATION_MS = 5500;

const keys = { w: false, a: false, s: false, d: false };

let player;
let enemies = [];
let enemyProjectiles = [];
let lasers = [];
let hazards = []; 
let playerZones = [];
let visualEffects = [];
let particles = [];
let floatingTexts = [];
let goldDrops = [];
let playerGold = 0; 
let portal = null; 
let portals = [];
let currentStageRoute = null;
let pendingStageRoutes = [];
let currentStageEvent = null;
let survivalEndsAt = 0;
let routeMinibossSpawned = false;
let routeCacheSpawned = false;
let stageCompleteHandled = false;
let lastRoutePatternAt = 0;
let lastStageEventAt = 0;
let activeArena = null;
let activeToast = null;
let screenShake = { amount: 0, endsAt: 0 };
let elapsed = 0;
let runStartTime = 0;
let stageStartedAt = 0;
let lastEnemySpawn = 0;
let enemiesSpawned = 0;
let currentLevel = 1;
let gameState = "menu"; 
let animationId;
let selectedCharacterId = "gunner";
let selectedDifficultyId = "medium";
let unlockedArtifactIds = [];
let selectedArtifactIds = [];
let currentShopChoices = [];
let mouseX = WIDTH / 2;
let mouseY = HEIGHT / 2;
let isPrimaryFireHeld = false;
const touchInput = {
  movePointerId: null,
  aimPointerId: null,
  moveActive: false,
  aimActive: false,
  firing: false,
  moveX: 0,
  moveY: 0,
  aimX: 1,
  aimY: 0,
  lastAimX: 1,
  lastAimY: 0,
  activeAbility: null
};
let nextEnemyId = 1;
let turrets = [];
let missiles = [];
let runStats = null;
