const SPRITE_SHEETS = {
  characters: {
    gunner: { src: "Assets/Sprites/Characters/gunner.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2, ability: 3 } },
    stormcaller: { src: "Assets/Sprites/Characters/stormcaller.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2, ability: 3 } },
    voidblade: { src: "Assets/Sprites/Characters/voidblade.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2, ability: 3 } },
    alchemist: { src: "Assets/Sprites/Characters/alchemist.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2, ability: 3 } },
    engineer: { src: "Assets/Sprites/Characters/engineer.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2, ability: 3 } }
  },
  enemies: {
    melee: { src: "Assets/Sprites/Enemies/melee.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2 } },
    shooter: { src: "Assets/Sprites/Enemies/shooter.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2 } },
    mage: { src: "Assets/Sprites/Enemies/mage.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2 } },
    lazer: { src: "Assets/Sprites/Enemies/lazer.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { idle: 0, move: 1, attack: 2 } },
    elites: { src: "Assets/Sprites/Enemies/elites.png", frameWidth: 32, frameHeight: 32, columns: 4, rows: { overcharged: 0, vampiric: 1, swift: 2 } }
  },
  bosses: {
    prismWarden: { src: "Assets/Sprites/Bosses/prism-warden.png", frameWidth: 96, frameHeight: 96, columns: 4, rows: { idle: 0, phase: 1, attack: 2 } },
    ashenChoir: { src: "Assets/Sprites/Bosses/ashen-choir.png", frameWidth: 96, frameHeight: 96, columns: 4, rows: { idle: 0, phase: 1, attack: 2 } },
    nullSeraph: { src: "Assets/Sprites/Bosses/null-seraph.png", frameWidth: 96, frameHeight: 96, columns: 4, rows: { idle: 0, phase: 1, attack: 2 } },
    chronarch: { src: "Assets/Sprites/Bosses/chronarch.png", frameWidth: 96, frameHeight: 96, columns: 4, rows: { idle: 0, phase: 1, attack: 2 } },
    eclipseMaw: { src: "Assets/Sprites/Bosses/eclipse-maw.png", frameWidth: 96, frameHeight: 96, columns: 4, rows: { idle: 0, phase: 1, attack: 2 } }
  },
  effects: {
    projectiles: { src: "Assets/Sprites/Effects/projectiles.png", frameWidth: 16, frameHeight: 16, columns: 4, rows: 4 },
    explosions: { src: "Assets/Sprites/Effects/explosions.png", frameWidth: 32, frameHeight: 32, columns: 6, rows: 1 }
  }
};

const PROJECTILE_SPRITE_FRAMES = {
  basic: [0, 0],
  scatter: [1, 0],
  "scatter-split": [1, 0],
  charged: [1, 0],
  grenade: [2, 0],
  flask: [3, 0],
  spark: [0, 1],
  blade: [1, 1],
  rivet: [2, 1],
  orb: [3, 1],
  spear: [0, 2],
  chakram: [1, 2],
  lance: [2, 2],
  missile: [3, 2],
  enemy: [0, 3],
  fireball: [1, 3],
  homing: [2, 3],
  turret: [3, 3]
};

const spriteImages = {};

function spriteImageKey(group, id) {
  return `${group}:${id}`;
}

function getSpriteDef(group, id) {
  return SPRITE_SHEETS[group] ? SPRITE_SHEETS[group][id] : null;
}

function preloadSpriteSheets() {
  Object.entries(SPRITE_SHEETS).forEach(([group, sheets]) => {
    Object.entries(sheets).forEach(([id, def]) => {
      const image = new Image();
      const key = spriteImageKey(group, id);
      image.onload = () => {
        def.loaded = true;
      };
      image.onerror = () => {
        def.failed = true;
      };
      image.src = def.src;
      spriteImages[key] = image;
    });
  });
}

function isSpriteReady(group, id) {
  const def = getSpriteDef(group, id);
  return Boolean(def && def.loaded && spriteImages[spriteImageKey(group, id)]);
}

function resolveSpriteRow(def, rowName) {
  if (typeof rowName === "number") return rowName;
  if (def && def.rows && typeof def.rows === "object" && rowName in def.rows) return def.rows[rowName];
  return 0;
}

function getSpriteAnimFrame(timestamp = performance.now(), fps = 8, columns = 4, seed = 0) {
  return Math.floor(timestamp / (1000 / fps) + seed) % columns;
}

function drawSpriteFrame(group, id, x, y, width, height, rowName = "idle", frame = 0, options = {}) {
  const def = getSpriteDef(group, id);
  const image = spriteImages[spriteImageKey(group, id)];
  if (!def || !def.loaded || !image) return false;

  const sx = frame * def.frameWidth;
  const sy = resolveSpriteRow(def, rowName) * def.frameHeight;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= options.alpha === undefined ? 1 : options.alpha;
  if (options.shadowColor) {
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur || 0;
  }
  if (options.filter) ctx.filter = options.filter;
  ctx.translate(centerX, centerY);
  if (options.angle) ctx.rotate(options.angle);
  if (options.flipX) ctx.scale(-1, 1);
  ctx.drawImage(image, sx, sy, def.frameWidth, def.frameHeight, -width / 2, -height / 2, width, height);
  ctx.restore();

  return true;
}

function drawSpriteCentered(group, id, cx, cy, size, rowName = "idle", options = {}) {
  const def = getSpriteDef(group, id);
  if (!def) return false;
  const frame = options.frame !== undefined
    ? options.frame
    : getSpriteAnimFrame(options.timestamp || performance.now(), options.fps || 8, def.columns, options.seed || 0);

  return drawSpriteFrame(group, id, cx - size / 2, cy - size / 2, size, size, rowName, frame, options);
}

function drawProjectileSprite(projectile, size, options = {}) {
  const kind = projectile.kind || (projectile.isFireball ? "fireball" : projectile.homing ? "homing" : "enemy");
  const frame = PROJECTILE_SPRITE_FRAMES[kind] || PROJECTILE_SPRITE_FRAMES.enemy;
  return drawSpriteFrame(
    "effects",
    "projectiles",
    projectile.x - size / 2,
    projectile.y - size / 2,
    size,
    size,
    frame[1],
    frame[0],
    {
      angle: options.angle,
      alpha: options.alpha,
      shadowColor: options.shadowColor,
      shadowBlur: options.shadowBlur
    }
  );
}

function drawExplosionSprite(x, y, radius, createdAt, endsAt, options = {}) {
  const def = getSpriteDef("effects", "explosions");
  if (!def) return false;
  const timestamp = options.timestamp || performance.now();
  const lifePct = clamp((timestamp - createdAt) / Math.max(1, endsAt - createdAt), 0, 1);
  const frame = Math.min(def.columns - 1, Math.floor(lifePct * def.columns));
  const size = radius * 2;
  return drawSpriteFrame("effects", "explosions", x - radius, y - radius, size, size, 0, frame, options);
}

preloadSpriteSheets();
