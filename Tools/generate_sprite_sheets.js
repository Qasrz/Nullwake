const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "Assets", "Sprites");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rgba(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function transparent() {
  return [0, 0, 0, 0];
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
  }

  set(x, y, color) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const offset = (iy * this.width + ix) * 4;
    this.pixels[offset] = color[0];
    this.pixels[offset + 1] = color[1];
    this.pixels[offset + 2] = color[2];
    this.pixels[offset + 3] = color[3];
  }

  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color);
    }
  }

  outlineRect(x, y, w, h, color) {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  circle(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.set(x, y, color);
      }
    }
  }

  ring(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d <= r * r && d >= (r - 1) * (r - 1)) this.set(x, y, color);
      }
    }
  }

  diamond(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) <= r) this.set(x, y, color);
      }
    }
  }

  line(x0, y0, x1, y1, color, thickness = 1) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const sx = x < tx ? 1 : -1;
    const dy = -Math.abs(ty - y);
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;

    while (true) {
      const half = Math.floor(thickness / 2);
      this.rect(x - half, y - half, thickness, thickness, color);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  savePng(file) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, encodePng(this.width, this.height, this.pixels));
  }
}

function frameApi(canvas, ox, oy) {
  return {
    set: (x, y, color) => canvas.set(ox + x, oy + y, color),
    rect: (x, y, w, h, color) => canvas.rect(ox + x, oy + y, w, h, color),
    outlineRect: (x, y, w, h, color) => canvas.outlineRect(ox + x, oy + y, w, h, color),
    circle: (x, y, r, color) => canvas.circle(ox + x, oy + y, r, color),
    ring: (x, y, r, color) => canvas.ring(ox + x, oy + y, r, color),
    diamond: (x, y, r, color) => canvas.diamond(ox + x, oy + y, r, color),
    line: (x0, y0, x1, y1, color, thickness = 1) => canvas.line(ox + x0, oy + y0, ox + x1, oy + y1, color, thickness)
  };
}

function writeSheet(relativeFile, frameW, frameH, cols, rows, drawFrame) {
  const canvas = new PixelCanvas(frameW * cols, frameH * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawFrame(frameApi(canvas, col * frameW, row * frameH), col, row);
    }
  }
  const file = path.join(OUT, relativeFile);
  canvas.savePng(file);
  return file;
}

const C = {
  ink: rgba("#020617"),
  deep: rgba("#0f172a"),
  slate: rgba("#334155"),
  white: rgba("#f8fafc"),
  sky: rgba("#38bdf8"),
  sky2: rgba("#7dd3fc"),
  gold: rgba("#facc15"),
  amber: rgba("#f59e0b"),
  orange: rgba("#f97316"),
  green: rgba("#34d399"),
  lime: rgba("#bef264"),
  red: rgba("#ef4444"),
  rose: rgba("#fb7185"),
  violet: rgba("#a78bfa"),
  violet2: rgba("#c4b5fd"),
  cyan: rgba("#67e8f9"),
  magenta: rgba("#ec4899"),
  pink: rgba("#f0abfc")
};

function rowName(row) {
  return ["idle", "move", "attack", "ability"][row] || "idle";
}

function drawLegs(api, bob, color, altColor, frame, moving) {
  const swing = moving ? (frame % 2 === 0 ? -1 : 1) : 0;
  api.rect(10 + swing, 22 + bob, 5, 6, C.ink);
  api.rect(11 + swing, 22 + bob, 3, 5, altColor);
  api.rect(17 - swing, 22 + bob, 5, 6, C.ink);
  api.rect(18 - swing, 22 + bob, 3, 5, color);
}

function drawGunner(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [0, 1, 0, -1][frame] : [0, 0, 1, 0][frame];
  const recoil = anim === "attack" ? (frame % 2) * -2 : 0;
  drawLegs(api, bob, C.sky, C.slate, frame, anim === "move");
  api.rect(9, 9 + bob, 14, 15, C.ink);
  api.rect(11, 11 + bob, 10, 11, C.sky);
  api.rect(12, 5 + bob, 8, 7, C.ink);
  api.rect(13, 6 + bob, 6, 5, C.sky2);
  api.rect(15, 7 + bob, 5, 2, C.deep);
  api.rect(20 + recoil, 14 + bob, 9, 4, C.ink);
  api.rect(21 + recoil, 15 + bob, 8, 2, C.gold);
  api.rect(7, 14 + bob, 4, 5, C.ink);
  api.rect(8, 15 + bob, 2, 3, C.sky2);
  if (anim === "attack" && frame % 2 === 0) {
    api.rect(29 + recoil, 14 + bob, 2, 5, C.gold);
    api.rect(31 + recoil, 15 + bob, 1, 3, C.white);
  }
  if (anim === "ability") {
    api.ring(16, 16, 13 - (frame % 2), C.gold);
    api.rect(4, 21 - frame % 2, 5, 4, C.orange);
  }
}

function drawStormcaller(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [1, 0, -1, 0][frame] : 0;
  api.line(16, 5 + bob, 22, 14 + bob, C.ink, 2);
  api.line(22, 14 + bob, 18, 14 + bob, C.cyan, 2);
  api.diamond(16, 15 + bob, 9, C.ink);
  api.diamond(16, 15 + bob, 7, C.amber);
  api.rect(12, 7 + bob, 8, 5, C.ink);
  api.rect(13, 8 + bob, 6, 3, C.gold);
  api.rect(13, 12 + bob, 6, 12, C.orange);
  api.line(7, 15 + bob, 12, 18 + bob, C.ink, 2);
  api.line(20, 18 + bob, 25, 12 + bob, C.cyan, 1);
  if (anim === "move") {
    api.rect(12 + (frame % 2), 24, 3, 4, C.ink);
    api.rect(18 - (frame % 2), 24, 3, 4, C.ink);
  }
  const arcs = anim === "attack" || anim === "ability" ? 4 : 2;
  for (let i = 0; i < arcs; i++) {
    const x = 5 + ((frame * 3 + i * 7) % 22);
    const y = 5 + ((frame * 5 + i * 9) % 21);
    api.line(x, y, x + 3, y + 2, C.cyan, 1);
    api.line(x + 3, y + 2, x + 1, y + 5, C.white, 1);
  }
}

function drawVoidblade(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [0, -1, 0, 1][frame] : 0;
  api.diamond(16, 16 + bob, 11, C.ink);
  api.diamond(16, 16 + bob, 9, C.violet);
  api.rect(12, 7 + bob, 8, 5, C.ink);
  api.rect(13, 8 + bob, 6, 3, C.violet2);
  api.rect(13, 13 + bob, 6, 11, C.deep);
  api.line(8, 22 + bob, 24, 6 + bob, C.ink, 3);
  api.line(9, 22 + bob, 25, 6 + bob, C.violet2, 1);
  if (anim === "attack") {
    api.line(5, 25 - frame, 27, 5 + frame, C.pink, 2);
    api.set(26, 4 + frame, C.white);
  }
  if (anim === "ability") {
    api.ring(16, 16, 12, C.violet2);
    api.diamond(16, 16, 4 + (frame % 2), C.deep);
  }
}

function drawAlchemist(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [1, 0, -1, 0][frame] : 0;
  api.circle(16, 15 + bob, 10, C.ink);
  api.circle(16, 15 + bob, 8, C.green);
  api.rect(12, 6 + bob, 8, 6, C.ink);
  api.rect(13, 7 + bob, 6, 4, C.lime);
  api.rect(12, 15 + bob, 8, 9, C.deep);
  api.rect(7, 15 + bob, 5, 4, C.ink);
  api.rect(8, 16 + bob, 3, 2, C.lime);
  api.rect(21, 13 + bob, 5, 7, C.ink);
  api.rect(22, 14 + bob, 3, 5, anim === "attack" ? C.orange : C.lime);
  api.set(23, 13 + bob, C.white);
  if (anim === "attack") {
    api.rect(24 + frame, 9 - frame % 2, 3, 4, C.ink);
    api.rect(25 + frame, 10 - frame % 2, 1, 2, C.lime);
  }
  if (anim === "ability") {
    api.ring(16, 17, 12, C.lime);
    api.circle(7 + frame * 5, 25 - frame, 2, C.green);
  }
}

function drawEngineer(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [0, 1, 0, -1][frame] : 0;
  drawLegs(api, bob, C.orange, C.slate, frame, anim === "move");
  api.rect(9, 10 + bob, 14, 14, C.ink);
  api.rect(11, 12 + bob, 10, 10, C.orange);
  api.rect(11, 5 + bob, 10, 7, C.ink);
  api.rect(12, 6 + bob, 8, 5, C.gold);
  api.rect(13, 8 + bob, 6, 2, C.deep);
  api.rect(5, 13 + bob, 5, 10, C.ink);
  api.rect(6, 14 + bob, 3, 8, C.slate);
  api.rect(21, 14 + bob, 9, 3, C.ink);
  api.rect(22, 15 + bob, 7, 1, C.gold);
  if (anim === "attack") {
    api.rect(28, 13 + bob, 3, 5, C.cyan);
  }
  if (anim === "ability") {
    api.rect(5, 23 - frame % 2, 8, 5, C.ink);
    api.rect(6, 24 - frame % 2, 6, 3, C.orange);
    api.ring(16, 16, 13, C.gold);
  }
}

const characterDrawers = {
  gunner: drawGunner,
  stormcaller: drawStormcaller,
  voidblade: drawVoidblade,
  alchemist: drawAlchemist,
  engineer: drawEngineer
};

function drawMelee(api, frame, row) {
  const anim = rowName(row);
  const lean = anim === "move" ? [-1, 0, 1, 0][frame] : anim === "attack" ? 2 : 0;
  api.diamond(16 + lean, 15, 10, C.ink);
  api.diamond(16 + lean, 15, 8, C.red);
  api.rect(12 + lean, 9, 8, 5, C.rose);
  api.line(7 + lean, 20, 2 + lean, 25, C.ink, 2);
  api.line(25 + lean, 20, 30 + lean, 25, C.ink, 2);
  api.line(11 + lean, 23, 6 + lean, 29, C.red, 2);
  api.line(21 + lean, 23, 26 + lean, 29, C.red, 2);
  if (anim === "attack") {
    api.line(3, 9 + frame, 14, 16, C.rose, 1);
    api.line(29, 9 + frame, 18, 16, C.rose, 1);
  }
}

function drawShooter(api, frame, row) {
  const anim = rowName(row);
  api.circle(15, 16, 10, C.ink);
  api.circle(15, 16, 8, C.green);
  api.circle(15, 16, 3, C.deep);
  api.rect(20, 14, 10, 5, C.ink);
  api.rect(21, 15, 8, 3, C.lime);
  api.rect(8, 24, 5, 4, C.ink);
  api.rect(18, 24, 5, 4, C.ink);
  if (anim === "move") {
    api.rect(7 + frame % 2, 25, 5, 2, C.lime);
    api.rect(19 - frame % 2, 25, 5, 2, C.lime);
  }
  if (anim === "attack") {
    api.rect(29, 13, 3, 7, C.gold);
    api.rect(27, 15, 5, 3, C.white);
  }
}

function drawMage(api, frame, row) {
  const anim = rowName(row);
  const bob = anim === "move" ? [0, -1, 0, 1][frame] : 0;
  api.diamond(16, 16 + bob, 10, C.ink);
  api.diamond(16, 16 + bob, 8, C.sky);
  api.rect(12, 8 + bob, 8, 5, C.ink);
  api.rect(13, 9 + bob, 6, 3, C.cyan);
  api.line(23, 7 + bob, 23, 25 + bob, C.ink, 2);
  api.circle(23, 7 + bob, 3, anim === "attack" ? C.white : C.cyan);
  if (anim === "attack") {
    api.ring(16, 17, 12, C.cyan);
    api.line(6 + frame, 24, 11 + frame, 18, C.white, 1);
  }
}

function drawLazer(api, frame, row) {
  const anim = rowName(row);
  api.rect(6, 11, 20, 10, C.ink);
  api.rect(8, 13, 16, 6, C.magenta);
  api.rect(11, 9, 10, 4, C.ink);
  api.rect(12, 10, 8, 2, C.pink);
  api.rect(2, 14, 5, 4, C.ink);
  api.rect(25, 14, 5, 4, C.ink);
  api.circle(16, 16, 3, C.deep);
  api.set(16, 16, C.white);
  if (anim === "move") {
    api.rect(5, 22 + frame % 2, 22, 2, C.rose);
  }
  if (anim === "attack") {
    api.line(1, 16, 31, 16, C.pink, 2);
    api.line(16, 2, 16, 30, C.magenta, 1);
  }
}

const enemyDrawers = {
  melee: drawMelee,
  shooter: drawShooter,
  mage: drawMage,
  lazer: drawLazer
};

function drawEliteAura(api, frame, row) {
  const colors = [C.cyan, C.rose, C.gold];
  const color = colors[row % colors.length];
  api.ring(16, 16, 11 + (frame % 2), color);
  api.diamond(16, 16, 7, C.ink);
  api.diamond(16, 16, 5, color);
  api.rect(8, 14, 16, 4, C.deep);
}

function drawPrismWarden(api, frame, row) {
  const phaseColor = row === 2 ? C.pink : row === 1 ? C.white : C.cyan;
  const drift = frame % 2;
  api.ring(48, 48, 36 - drift, C.sky);
  api.ring(48, 48, 24 + drift, C.pink);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + frame * 0.18;
    const x = Math.round(48 + Math.cos(a) * (28 + row * 3));
    const y = Math.round(48 + Math.sin(a) * (28 + row * 3));
    api.diamond(x, y, 6, C.ink);
    api.diamond(x, y, 4, i % 2 ? C.pink : C.sky2);
  }
  api.diamond(48, 48, 18, C.ink);
  api.diamond(48, 48, 14, phaseColor);
  api.diamond(48, 48, 7, C.deep);
  if (row === 2) api.line(18, 48, 78, 48, C.white, 3);
}

function drawAshenChoir(api, frame, row) {
  const pulse = frame % 2;
  api.ring(48, 48, 38, C.orange);
  api.ring(48, 48, 29 + pulse, C.gold);
  api.rect(32, 24, 32, 43, C.ink);
  api.rect(35, 27, 26, 37, C.orange);
  api.rect(38, 34, 7, 7, C.deep);
  api.rect(51, 34, 7, 7, C.deep);
  api.rect(41, 52, 14, 4, C.gold);
  for (let i = 0; i < 8 + row * 2; i++) {
    const x = 14 + ((frame * 7 + i * 11) % 68);
    const y = 10 + ((frame * 13 + i * 9) % 75);
    api.rect(x, y, 3, 3, i % 2 ? C.gold : C.red);
  }
  if (row === 2) {
    api.line(17, 72, 79, 72, C.gold, 3);
    api.line(22, 78, 74, 78, C.red, 2);
  }
}

function drawNullSeraph(api, frame, row) {
  const wing = 3 + frame % 2 + row;
  api.ring(48, 48, 34, C.violet2);
  api.line(47, 48, 18, 26 - wing, C.ink, 5);
  api.line(49, 48, 78, 26 - wing, C.ink, 5);
  api.line(47, 51, 18, 70 + wing, C.ink, 5);
  api.line(49, 51, 78, 70 + wing, C.ink, 5);
  api.line(47, 48, 18, 26 - wing, C.violet, 2);
  api.line(49, 48, 78, 26 - wing, C.violet, 2);
  api.line(47, 51, 18, 70 + wing, C.violet2, 2);
  api.line(49, 51, 78, 70 + wing, C.violet2, 2);
  api.circle(48, 48, 18, C.ink);
  api.circle(48, 48, 14, C.violet);
  api.circle(48, 48, 7 + row, C.deep);
  api.set(48, 48, C.white);
  if (row === 2) {
    api.ring(48, 48, 43, C.cyan);
    api.line(27, 48, 69, 48, C.cyan, 2);
  }
}

const bossDrawers = {
  "prism-warden": drawPrismWarden,
  "ashen-choir": drawAshenChoir,
  "null-seraph": drawNullSeraph
};

function drawProjectileCell(api, col, row) {
  const index = row * 4 + col;
  if (index === 0) {
    api.circle(8, 8, 3, C.gold);
    api.set(9, 7, C.white);
  } else if (index === 1) {
    api.line(3, 8, 13, 8, C.gold, 2);
    api.set(13, 8, C.white);
  } else if (index === 2) {
    api.circle(8, 8, 5, C.orange);
    api.rect(6, 4, 4, 2, C.ink);
  } else if (index === 3) {
    api.rect(5, 3, 6, 10, C.ink);
    api.rect(6, 4, 4, 8, C.lime);
    api.set(8, 3, C.white);
  } else if (index === 4) {
    api.line(2, 8, 7, 4, C.cyan, 1);
    api.line(7, 4, 14, 8, C.white, 1);
    api.line(14, 8, 8, 12, C.cyan, 1);
  } else if (index === 5) {
    api.line(3, 12, 12, 3, C.violet2, 2);
    api.set(12, 3, C.white);
  } else if (index === 6) {
    api.rect(3, 6, 10, 4, C.ink);
    api.rect(4, 7, 8, 2, C.orange);
  } else if (index === 7) {
    api.circle(8, 8, 5, C.cyan);
    api.circle(8, 8, 2, C.deep);
  } else if (index === 8) {
    api.line(2, 8, 14, 8, C.cyan, 3);
    api.set(14, 8, C.white);
  } else if (index === 9) {
    api.ring(8, 8, 5, C.violet2);
    api.line(3, 8, 13, 8, C.violet, 1);
  } else if (index === 10) {
    api.line(3, 12, 13, 4, C.pink, 2);
  } else if (index === 11) {
    api.line(2, 8, 13, 8, C.orange, 3);
    api.line(4, 5, 2, 8, C.red, 1);
    api.line(4, 11, 2, 8, C.red, 1);
  } else if (index === 12) {
    api.circle(8, 8, 4, C.red);
  } else if (index === 13) {
    api.circle(8, 8, 5, C.orange);
    api.set(8, 8, C.white);
  } else if (index === 14) {
    api.diamond(8, 8, 5, C.violet);
    api.set(8, 8, C.white);
  } else {
    api.rect(4, 5, 8, 6, C.ink);
    api.rect(5, 6, 6, 4, C.orange);
  }
}

function drawExplosionCell(api, frame) {
  const radius = 3 + frame * 3;
  const colors = [C.white, C.gold, C.orange, C.red, C.rose, rgba("#7f1d1d", 190)];
  api.circle(16, 16, Math.min(15, radius), colors[Math.min(colors.length - 1, frame)]);
  if (frame > 1) api.ring(16, 16, Math.min(15, radius), C.gold);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const len = radius + 2 + (frame % 2);
    api.line(16, 16, 16 + Math.cos(a) * len, 16 + Math.sin(a) * len, colors[Math.min(4, frame)], 1);
  }
}

function generate() {
  ensureDir(OUT);
  const generated = [];

  for (const [id, draw] of Object.entries(characterDrawers)) {
    generated.push(writeSheet(path.join("Characters", `${id}.png`), 32, 32, 4, 4, draw));
  }

  for (const [id, draw] of Object.entries(enemyDrawers)) {
    generated.push(writeSheet(path.join("Enemies", `${id}.png`), 32, 32, 4, 3, draw));
  }

  generated.push(writeSheet(path.join("Enemies", "elites.png"), 32, 32, 4, 3, drawEliteAura));

  for (const [id, draw] of Object.entries(bossDrawers)) {
    generated.push(writeSheet(path.join("Bosses", `${id}.png`), 96, 96, 4, 3, draw));
  }

  generated.push(writeSheet(path.join("Effects", "projectiles.png"), 16, 16, 4, 4, drawProjectileCell));
  generated.push(writeSheet(path.join("Effects", "explosions.png"), 32, 32, 6, 1, (api, col) => drawExplosionCell(api, col)));

  const manifest = {
    version: 1,
    generatedBy: "Tools/generate_sprite_sheets.js",
    sheets: {
      characters: {
        frameWidth: 32,
        frameHeight: 32,
        columns: 4,
        rows: { idle: 0, move: 1, attack: 2, ability: 3 },
        files: Object.keys(characterDrawers).reduce((acc, id) => {
          acc[id] = `Assets/Sprites/Characters/${id}.png`;
          return acc;
        }, {})
      },
      enemies: {
        frameWidth: 32,
        frameHeight: 32,
        columns: 4,
        rows: { idle: 0, move: 1, attack: 2 },
        files: Object.keys(enemyDrawers).reduce((acc, id) => {
          acc[id] = `Assets/Sprites/Enemies/${id}.png`;
          return acc;
        }, { elites: "Assets/Sprites/Enemies/elites.png" })
      },
      bosses: {
        frameWidth: 96,
        frameHeight: 96,
        columns: 4,
        rows: { idle: 0, phase: 1, attack: 2 },
        files: {
          prismWarden: "Assets/Sprites/Bosses/prism-warden.png",
          ashenChoir: "Assets/Sprites/Bosses/ashen-choir.png",
          nullSeraph: "Assets/Sprites/Bosses/null-seraph.png"
        }
      },
      effects: {
        projectiles: {
          frameWidth: 16,
          frameHeight: 16,
          columns: 4,
          rows: 4,
          file: "Assets/Sprites/Effects/projectiles.png"
        },
        explosions: {
          frameWidth: 32,
          frameHeight: 32,
          columns: 6,
          rows: 1,
          file: "Assets/Sprites/Effects/explosions.png"
        }
      }
    }
  };

  const manifestPath = path.join(OUT, "sprite_manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  generated.push(manifestPath);

  for (const file of generated) {
    console.log(path.relative(ROOT, file));
  }
}

generate();
