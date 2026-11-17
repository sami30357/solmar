// Solmar — keyboard + mouse input with one-shot action flags.
// Holds current key state; pressed() fires once per physical press.

export function createInput(canvas) {
  const input = {
    keys: {},
    justPressed: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    anyGesture: false,
  };

  function markGesture() {
    input.anyGesture = true;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    input.keys[e.code] = true;
    input.justPressed[e.code] = true;
    markGesture();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener("blur", () => {
    input.keys = {};
  });

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    // CSS pixels relative to the canvas; main.js converts to logical view coords.
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
      markGesture();
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.mouseDown = false;
  });

  input.down = function (code) {
    return !!input.keys[code];
  };
  input.pressed = function (code) {
    return !!input.justPressed[code];
  };
  input.clearPressed = function () {
    input.justPressed = {};
    input.mouseClicked = false;
  };
  // Convenience axes, so the player code reads like the spec.
  input.moveX = function () {
    return (input.down("KeyD") || input.down("ArrowRight") ? 1 : 0) -
      (input.down("KeyA") || input.down("ArrowLeft") ? 1 : 0);
  };
  input.moveY = function () {
    return (input.down("KeyS") || input.down("ArrowDown") ? 1 : 0) -
      (input.down("KeyW") || input.down("ArrowUp") ? 1 : 0);
  };
  return input;
}
