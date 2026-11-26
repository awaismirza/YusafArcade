/** Checks for the board camera rig and the touch-gesture maths. Run with: npm test */
import assert from "node:assert/strict";
import * as THREE from "three";
import { OrbitRig } from "../src/games/shared/orbitRig";
import { isTap, pinchScale, tiltDelta, twistDelta, withTimeout } from "../src/ui/gestureMath";

let passed = 0;
const check = (name: string, fn: () => void | Promise<void>): Promise<void> | void => {
  const done = (): void => {
    passed++;
    console.log(`PASS  ${name}`);
  };
  const r = fn();
  if (r instanceof Promise) return r.then(done);
  done();
};

const DEG = Math.PI / 180;
const TARGET = new THREE.Vector3(0, 0.5, 0.35);

function makeRig(): { rig: OrbitRig; cam: THREE.PerspectiveCamera } {
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  const rig = new OrbitRig(cam, { target: TARGET.clone(), distance: 14.3, elevationDeg: 40.6 });
  return { rig, cam };
}
function settle(rig: OrbitRig, n = 300): void {
  for (let i = 0; i < n; i++) rig.update();
}
function elevationOf(cam: THREE.PerspectiveCamera): number {
  const d = cam.position.clone().sub(TARGET);
  return Math.asin(d.y / d.length());
}
const distanceOf = (cam: THREE.PerspectiveCamera): number => cam.position.distanceTo(TARGET);

async function main(): Promise<void> {
  check("pinchScale is the ratio of finger distances", () => {
    assert.equal(pinchScale(100, 150), 1.5);
    assert.equal(pinchScale(0, 50), 1, "no divide by zero");
  });

  check("twistDelta takes the short way round", () => {
    assert.ok(Math.abs(twistDelta(0.3, 0.5) - 0.2) < 1e-9);
    const wrap = twistDelta(3.0, -3.0);
    assert.ok(wrap > 0 && wrap < 0.5, `wrapped delta ${wrap}`);
  });

  check("dragging up raises the camera", () => {
    assert.ok(tiltDelta(-20) > 0);
    assert.ok(tiltDelta(20) < 0);
  });

  check("only a quick, still, single-finger touch is a tap", () => {
    assert.equal(isTap({ downMs: 0, upMs: 120, moved: 3, multi: false }), true);
    assert.equal(isTap({ downMs: 0, upMs: 120, moved: 3, multi: true }), false, "a second finger joined");
    assert.equal(isTap({ downMs: 0, upMs: 120, moved: 20, multi: false }), false, "moved too far");
    assert.equal(isTap({ downMs: 0, upMs: 500, moved: 3, multi: false }), false, "held too long");
  });

  await check("withTimeout passes a fast result and falls back on a slow one", async () => {
    assert.equal(await withTimeout(Promise.resolve("fast"), 200, "fallback"), "fast");
    assert.equal(await withTimeout(new Promise<string>((res) => setTimeout(() => res("slow"), 300)), 30, "fallback"), "fallback");
  });

  check("the rig settles on its default distance and elevation, looking at the target", () => {
    const { rig, cam } = makeRig();
    settle(rig);
    assert.ok(Math.abs(distanceOf(cam) - 14.3) < 0.01);
    assert.ok(Math.abs(elevationOf(cam) - 40.6 * DEG) < 0.002);
    assert.ok(cam.position.z > 0, "white's side by default");
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    const toTarget = TARGET.clone().sub(cam.position).normalize();
    assert.ok(forward.dot(toTarget) > 0.9999, "camera faces the target");
  });

  check("extreme gestures keep the camera inside its bounds", () => {
    const { rig, cam } = makeRig();
    for (const [fn, arg] of [["tilt", 10], ["tilt", -10], ["pinch", 100], ["pinch", 0.001], ["twist", 1000], ["twist", -1000]] as const) {
      rig[fn](arg);
      settle(rig);
      assert.ok(Number.isFinite(cam.position.x + cam.position.y + cam.position.z), `${fn}(${arg}) is finite`);
      assert.ok(cam.position.y > 0.5, `${fn}(${arg}) stays above the board`);
      assert.ok(rig.elevation >= 20 * DEG - 1e-9 && rig.elevation <= 85 * DEG + 1e-9, "elevation bounds");
      assert.ok(rig.distance >= 0.6 * 14.3 - 1e-9 && rig.distance <= 1.5 * 14.3 + 1e-9, "zoom bounds");
      assert.ok(Math.abs(rig.yawOffset) <= Math.PI + 1e-9, "twist bound");
    }
  });

  check("pinching out zooms in, and tilting up raises the camera", () => {
    const { rig } = makeRig();
    const d0 = rig.distance;
    rig.pinch(1.5);
    assert.ok(rig.distance < d0);
    const e0 = rig.elevation;
    rig.tilt(0.1);
    assert.ok(rig.elevation > e0);
  });

  check("presets move the camera to their angles", () => {
    const { rig, cam } = makeRig();
    rig.applyPreset("top");
    settle(rig);
    assert.ok(Math.abs(elevationOf(cam) - 80 * DEG) < 0.003, "top down is 80 degrees");
    rig.applyPreset("side");
    settle(rig);
    assert.ok(Math.abs(elevationOf(cam) - 30 * DEG) < 0.003, "my side is 30 degrees");
    assert.ok(Math.abs(distanceOf(cam) - 14.3 * 0.85) < 0.02, "my side is closer");
    rig.applyPreset("left");
    settle(rig);
    assert.ok(cam.position.x < -1, "left corner is on the left");
    rig.applyPreset("right");
    settle(rig);
    assert.ok(cam.position.x > 1, "right corner is on the right");
    rig.applyPreset("reset");
    settle(rig);
    assert.ok(Math.abs(cam.position.x) < 0.01 && Math.abs(distanceOf(cam) - 14.3) < 0.01, "reset returns to the default");
  });

  check("pass-and-play turns the camera round and keeps the player's own angle", () => {
    const { rig, cam } = makeRig();
    rig.applyPreset("right");
    const offset = rig.yawOffset;
    rig.setBaseYaw(Math.PI);
    assert.equal(rig.yawOffset, offset, "the chosen angle is kept");
    settle(rig);
    assert.ok(cam.position.z < 0, "now on black's side");
  });

  console.log(`\n${passed} orbit rig checks passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
