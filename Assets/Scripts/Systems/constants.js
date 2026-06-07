const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const PLAYER_SIZE = 24;
const PLAYER_SPEED = 4;
const PLAYER_MAX_HEALTH = 3;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;

// Base Enemy Stats
const ENEMY_SIZE = 22;
const ENEMY_HEALTH = 3;
const ENEMY_RETREAT_RANGE = 250;
const ENEMY_APPROACH_RANGE = 600;

// Shooter Stats
const SHOOTER_SPEED = 1.2;
const SHOOTER_FIRE_INTERVAL_MS = 1200;
const ENEMY_PROJECTILE_RADIUS = 6;
const ENEMY_PROJECTILE_SPEED = 2.5;

// Melee Stats
const MELEE_SPEED = 2.0;
const MELEE_DASH_SPEED = 8.0;
const MELEE_DASH_RANGE = 200;
const MELEE_DASH_COOLDOWN_MS = 1500;
const MELEE_DASH_DURATION_MS = 250;

// Mage Stats
const MAGE_SPEED = 0.8;
const MAGE_FIRE_INTERVAL_MS = 2500;
const LIGHTNING_DELAY_MS = 1000;
const LIGHTNING_ACTIVE_MS = 200;
const LIGHTNING_RADIUS = 40;
const LAVA_DURATION_MS = 4000;
const LAVA_RADIUS = 35;

// Boss Stats
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
const GOLD_MAGNET_SPEED = 2.0;
const PORTAL_RADIUS = 30;

const keys = { w: false, a: false, s: false, d: false };

let player;
let enemies;
let enemyProjectiles;
let lasers;
let hazards; 
let goldDrops; // NEW
let playerGold = 0; // NEW
let portal = null; // NEW
let elapsed;
let lastEnemySpawn;
let enemiesSpawned;
let currentLevel;
let gameState;
let animationId;