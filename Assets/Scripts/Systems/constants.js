const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const uiHealthFill = document.getElementById("health-fill");
const uiGoldCounter = document.getElementById("gold-counter");
const uiAlert = document.getElementById("game-alert");
const uiAlertText = document.getElementById("alert-text");
const uiXpFill = document.getElementById("xp-fill");
const uiLevelText = document.getElementById("level-text");

const PLAYER_SIZE = 24;
const PLAYER_SPEED = 4;
const PLAYER_MAX_HEALTH = 3;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;

// Risk of Rain 2 Style Items
const SHOP_ITEMS = [
  { id: "syringe", name: "Soldier's Syringe", desc: "+15% Attack Speed", baseCost: 15, color: "#eab308" },
  { id: "hoof", name: "Paul's Goat Hoof", desc: "+15% Move Speed", baseCost: 15, color: "#a3e635" },
  { id: "steak", name: "Bison Steak", desc: "+1 Max Health", baseCost: 25, color: "#ef4444" },
  { id: "glasses", name: "Lens-Maker's Glasses", desc: "+10% Crit Chance", baseCost: 20, color: "#dc2626" }
];

const ENEMY_SIZE = 22;
const ENEMY_HEALTH = 3;
const ENEMY_RETREAT_RANGE = 250;
const ENEMY_APPROACH_RANGE = 600;

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

const LASER_SPEED = 9;
const LASER_DAMAGE = 1;
const LASER_RADIUS = 4;
const LASER_FIRE_INTERVAL_MS = 280;

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
let goldDrops = [];
let playerGold = 0; 
let portal = null; 
let elapsed = 0;
let lastEnemySpawn = 0;
let enemiesSpawned = 0;
let currentLevel = 1;
let gameState = "menu"; 
let animationId;