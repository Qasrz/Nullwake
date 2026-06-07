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