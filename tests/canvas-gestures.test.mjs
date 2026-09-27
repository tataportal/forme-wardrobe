import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/canvas-gestures.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { CanvasGestures } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const point = (id, x, y, time = 0, touch = true) => ({ id, x, y, time, touch });
const target = { id: "coat", geometry: { x: 50, y: 50, scale: .5, rotation: 0 }, frame: { left: 0, top: 0, width: 400, height: 600 } };
function setup() {
  const events = [], pending = new Map(); let clock = 0, timerId = 0;
  const gestures = new CanvasGestures(Object.fromEntries(["select", "checkpoint", "change", "replace", "lock"].map(action => [action, (...args) => events.push({ action, args })])), {
    start(fn, delay) { pending.set(++timerId, { fn, at: clock + delay }); return timerId; },
    clear(id) { pending.delete(id); },
  });
  return { gestures, events, actions: name => events.filter(e => e.action === name),
    advance(ms) { clock += ms; for (const [id, job] of pending) if (job.at <= clock) { pending.delete(id); job.fn(); } } };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);

test("one finger drags without scale, rotation or z changes; one checkpoint per gesture", () => {
  const { gestures: g, actions } = setup();
  g.down(point(1, 200, 300), { ...target, geometry: { ...target.geometry, z: 9, garmentId: "coat-image" } }); g.move(point(1, 204, 301, 50));
  assert.equal(actions("change").length, 0);
  g.move(point(1, 220, 330, 100)); g.move(point(1, 240, 360, 120)); g.up(point(1, 240, 360, 160));
  assert.deepEqual(actions("change").at(-1).args, ["coat", { x: 60, y: 60, scale: .5, rotation: 0 }]);
  assert.equal(actions("checkpoint").length, 1);
  assert.equal(actions("replace").length + actions("lock").length, 0);
  assert.deepEqual(target.geometry, { x: 50, y: 50, scale: .5, rotation: 0 });
});

test("two-finger pinch and rotation keep the first prenda, including second touch on another layer", () => {
  const { gestures: g, actions, advance } = setup();
  g.down(point(1, 150, 300), target);
  g.down(point(2, 250, 300, 100), { ...target, id: "pants" });
  advance(1000);
  assert.equal(actions("lock").length, 0);
  g.move(point(1, 200, 200, 120)); g.move(point(2, 200, 400, 130));
  const [id, geometry] = actions("change").at(-1).args;
  assert.equal(id, "coat"); near(geometry.scale, 1); near(geometry.rotation, 90);
  near(geometry.x, 50); near(geometry.y, 50);
  g.up(point(2, 200, 400, 140));
  const count = actions("change").length;
  g.move(point(1, 200, 200, 150));
  assert.equal(actions("change").length, count, "lifting one finger must not jump");
  g.move(point(1, 220, 230, 160));
  assert.deepEqual(actions("change").at(-1).args[1], { x: 55, y: 55, scale: 1, rotation: 90 });
  g.up(point(1, 220, 230, 170));
  assert.equal(actions("checkpoint").length, 1);
  assert.equal(actions("replace").length, 0);
});

test("pinch around an off-center contact keeps its anchor and clamps scale", () => {
  const { gestures: g, actions } = setup();
  g.down(point(1, 240, 300), target); g.down(point(2, 280, 300, 10));
  g.move(point(1, 220, 300, 20)); g.move(point(2, 300, 300, 30));
  const geometry = actions("change").at(-1).args[1];
  near(geometry.scale, 1); near(geometry.x, 35); near(geometry.y, 50);
  g.move(point(2, 1000, 300, 40));
  assert.equal(actions("change").at(-1).args[1].scale, 1.35);
});

test("a quick double tap replaces once; single taps and taps on different prendas do not", () => {
  const { gestures: g, actions } = setup();
  g.down(point(1, 200, 300), target); g.up(point(1, 200, 300, 80));
  assert.equal(actions("replace").length, 0);
  g.down(point(2, 201, 302, 160), target); g.up(point(2, 201, 302, 220));
  assert.deepEqual(actions("replace"), [{ action: "replace", args: ["coat"] }]);
  g.down(point(3, 200, 300, 400), target); g.up(point(3, 200, 300, 450));
  g.down(point(4, 200, 300, 500), { ...target, id: "hat" }); g.up(point(4, 200, 300, 550));
  assert.equal(actions("replace").length, 1);
  assert.equal(actions("checkpoint").length, 0);
});

test("hold toggles the mix lock once without drag or replacement on release", () => {
  const { gestures: g, actions, advance } = setup();
  g.down(point(1, 200, 300), target); advance(549);
  assert.equal(actions("lock").length, 0);
  g.move(point(1, 202, 303, 549)); advance(1); advance(1000);
  g.move(point(1, 240, 340, 1560)); g.up(point(1, 240, 340, 1570));
  assert.equal(actions("lock").length, 1);
  assert.equal(actions("change").length + actions("replace").length, 0);
  g.down(point(2, 200, 300, 2000), target); advance(550); g.up(point(2, 200, 300, 2600));
  assert.equal(actions("lock").length, 2, "a second hold unlocks via the same toggle");
});

test("drag, cancellation and navigation cancel hold and pending double tap", () => {
  for (const stop of [g => g.move(point(1, 230, 300, 100)), g => g.up(point(1, 200, 300, 100), true), g => g.cancel()]) {
    const { gestures: g, actions, advance } = setup();
    g.down(point(1, 200, 300), target); stop(g); advance(1000);
    assert.equal(actions("lock").length, 0);
    g.cancel();
    g.down(point(2, 200, 300, 200), target); g.up(point(2, 200, 300, 250));
    assert.equal(actions("replace").length, 0);
  }
});

test("mouse dragging keeps the desktop behavior and never fires touch shortcuts", () => {
  const { gestures: g, actions, advance } = setup();
  g.down(point(1, 200, 300, 0, false), target); advance(1000);
  g.move(point(1, 220, 330, 1000, false)); g.up(point(1, 220, 330, 1100, false));
  assert.equal(actions("change").length, 1);
  assert.equal(actions("lock").length + actions("replace").length, 0);
});

test("almost coincident fingers and cancelled captures produce finite geometry and no late actions", () => {
  const { gestures: g, actions, advance } = setup();
  g.down(point(1, 200, 300), target); g.down(point(2, 200, 300, 10));
  g.move(point(2, 200, 301, 20)); g.move(point(2, 200, 320, 30)); g.move(point(2, 220, 330, 40));
  assert.ok(actions("change").every(e => Object.values(e.args[1]).every(Number.isFinite)));
  g.up(point(2, 220, 330, 50), true); advance(1000);
  assert.equal(g.active, false);
  assert.equal(actions("lock").length + actions("replace").length, 0);
});
