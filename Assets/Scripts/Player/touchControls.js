function isTouchGameplayActive() {
  return !isPaused && (gameState === "playing" || gameState === "portalPhase");
}

function setTouchKnob(knob, x, y) {
  if (!knob) return;
  knob.style.setProperty("--knob-x", `${x}px`);
  knob.style.setProperty("--knob-y", `${y}px`);
}

function getStickVector(event, element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDistance = Math.max(28, Math.min(rect.width, rect.height) * 0.38);
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const strength = clamp(distance / maxDistance, 0, 1);
  const x = distance > 0 ? (dx / distance) * strength : 0;
  const y = distance > 0 ? (dy / distance) * strength : 0;

  return {
    x: Math.abs(x) < 0.08 ? 0 : x,
    y: Math.abs(y) < 0.08 ? 0 : y,
    knobX: distance > 0 ? (dx / distance) * maxDistance * strength : 0,
    knobY: distance > 0 ? (dy / distance) * maxDistance * strength : 0,
    strength
  };
}

function updateMoveStick(event) {
  if (!uiTouchMove) return;
  const vector = getStickVector(event, uiTouchMove);
  touchInput.moveX = vector.x;
  touchInput.moveY = vector.y;
  touchInput.moveActive = vector.strength > 0.08;
  setTouchKnob(uiTouchMoveKnob, vector.knobX, vector.knobY);
}

function updateAimStick(event) {
  if (!uiTouchAim) return;
  const vector = getStickVector(event, uiTouchAim);
  touchInput.aimX = vector.x;
  touchInput.aimY = vector.y;
  touchInput.aimActive = true;
  touchInput.firing = true;

  if (vector.strength > 0.08) {
    touchInput.lastAimX = vector.x;
    touchInput.lastAimY = vector.y;
  }

  setTouchKnob(uiTouchAimKnob, vector.knobX, vector.knobY);
}

function resetTouchMoveStick() {
  touchInput.movePointerId = null;
  touchInput.moveActive = false;
  touchInput.moveX = 0;
  touchInput.moveY = 0;
  setTouchKnob(uiTouchMoveKnob, 0, 0);
}

function resetTouchAimStick() {
  touchInput.aimPointerId = null;
  touchInput.aimActive = false;
  touchInput.firing = false;
  touchInput.aimX = 0;
  touchInput.aimY = 0;
  setTouchKnob(uiTouchAimKnob, 0, 0);
}

function getNearestTouchTarget() {
  if (!player) return null;
  if (typeof gameSettings !== "undefined" && gameSettings.gameplay && !gameSettings.gameplay.mobileAutoAim) return null;

  const center = getPlayerCenter();
  let closest = null;
  let closestDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.dead || enemy.objective) continue;
    const ex = enemy.x + enemy.size / 2;
    const ey = enemy.y + enemy.size / 2;
    const distance = Math.hypot(ex - center.x, ey - center.y);
    if (distance < closestDist) {
      closest = { x: ex, y: ey };
      closestDist = distance;
    }
  }

  return closest;
}

function updateTouchControls(timestamp = performance.now()) {
  if (!player || !touchInput.firing || !isTouchGameplayActive()) return;

  const center = getPlayerCenter();
  const aimLength = Math.hypot(touchInput.aimX, touchInput.aimY);
  const target = aimLength > 0.08
    ? {
        x: center.x + (touchInput.aimX / aimLength) * 420,
        y: center.y + (touchInput.aimY / aimLength) * 420
      }
    : getNearestTouchTarget() || {
        x: center.x + touchInput.lastAimX * 420,
        y: center.y + touchInput.lastAimY * 420
      };

  mouseX = target.x;
  mouseY = target.y;
  fireLaser(mouseX, mouseY, timestamp);
}

function bindTouchStick(element, type) {
  if (!element) return;

  element.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!isTouchGameplayActive()) return;

    event.preventDefault();
    event.stopPropagation();
    if (element.setPointerCapture) element.setPointerCapture(event.pointerId);

    if (type === "move") {
      touchInput.movePointerId = event.pointerId;
      updateMoveStick(event);
    } else {
      touchInput.aimPointerId = event.pointerId;
      updateAimStick(event);
    }
  });

  element.addEventListener("pointermove", event => {
    if (type === "move" && touchInput.movePointerId === event.pointerId) {
      event.preventDefault();
      updateMoveStick(event);
    } else if (type === "aim" && touchInput.aimPointerId === event.pointerId) {
      event.preventDefault();
      updateAimStick(event);
    }
  });

  const endPointer = event => {
    if (type === "move" && touchInput.movePointerId === event.pointerId) resetTouchMoveStick();
    if (type === "aim" && touchInput.aimPointerId === event.pointerId) resetTouchAimStick();
  };

  element.addEventListener("pointerup", endPointer);
  element.addEventListener("pointercancel", endPointer);
  element.addEventListener("lostpointercapture", endPointer);
}

function useTouchAbility(slot, event) {
  if (!slot || !isTouchGameplayActive()) return;

  event.preventDefault();
  event.stopPropagation();

  const timestamp = performance.now();
  const ability = getAbilityDef(slot);
  touchInput.activeAbility = { slot, pointerId: event.pointerId };

  if (ability && ability.hold) {
    beginAbilityCharge(slot, timestamp);
  } else {
    useAbility(slot, mouseX, mouseY, timestamp);
  }
}

function releaseTouchAbility(event) {
  const active = touchInput.activeAbility;
  if (!active || active.pointerId !== event.pointerId) return;

  releaseAbilityCharge(active.slot, performance.now());
  touchInput.activeAbility = null;
}

function initializeTouchControls() {
  bindTouchStick(uiTouchMove, "move");
  bindTouchStick(uiTouchAim, "aim");

  if (uiTouchAbilities) {
    uiTouchAbilities.addEventListener("pointerdown", event => {
      const button = event.target.closest("[data-touch-ability]");
      if (!button) return;
      useTouchAbility(button.dataset.touchAbility, event);
    });
  }

  window.addEventListener("pointerup", releaseTouchAbility);
  window.addEventListener("pointercancel", releaseTouchAbility);
  window.addEventListener("blur", () => {
    resetTouchMoveStick();
    resetTouchAimStick();
    touchInput.activeAbility = null;
  });
}

initializeTouchControls();
