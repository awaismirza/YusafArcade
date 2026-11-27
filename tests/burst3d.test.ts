/** Shared 3D board effects clean up after themselves. Run with: npm test */
import assert from "node:assert/strict";
import * as THREE from "three";
import { burst3d, confettiRain3d, Fx, ringPulse3d } from "../src/games/shared/burst3d";

let passed = 0;
const check = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
};
type Action = { dur: number; update: (p: number) => void; done?: () => void };
function fakeFx(): Fx & { actions: Action[] } {
  const actions: Action[] = [];
  return { actions, add: (_now: number, a: Action) => void actions.push(a) };
}
/** Runs every queued action to its end, as AnimQueue would. */
function finish(fx: { actions: Action[] }): void {
  for (const a of fx.actions) {
    a.update(1);
    a.done?.();
  }
}

check("burst3d adds its pieces, moves them, and removes them at the end", () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Object3D());
  const start = scene.children.length;
  const fx = fakeFx();
  burst3d(scene, fx, 0, new THREE.Vector3(1, 0, 2), { count: 10 });
  assert.equal(scene.children.length, start + 10);
  const before = scene.children[start].position.clone();
  fx.actions[0].update(0.5);
  assert.ok(!scene.children[start].position.equals(before), "pieces moved");
  finish(fx);
  assert.equal(scene.children.length, start);
  assert.doesNotThrow(() => fx.actions[0].done?.(), "done twice is safe");
});

check("ringPulse3d shows one ring and removes it; repeat queues more pulses", () => {
  const scene = new THREE.Scene();
  const fx = fakeFx();
  ringPulse3d(scene, fx, 0, new THREE.Vector3(), 0xdc2626, { radius: 0.6 });
  assert.equal(scene.children.length, 1);
  finish(fx);
  assert.equal(scene.children.length, 0);
  const fx3 = fakeFx();
  ringPulse3d(scene, fx3, 0, new THREE.Vector3(), 0xdc2626, { repeat: 3 });
  assert.equal(fx3.actions.length, 3, "three pulses");
  finish(fx3);
  assert.equal(scene.children.length, 0);
});

check("confettiRain3d drops 80 pieces from above and clears them", () => {
  const scene = new THREE.Scene();
  const fx = fakeFx();
  confettiRain3d(scene, fx, 0, new THREE.Vector3(0, 0, 0), [0xfacc15, 0x60a5fa]);
  assert.equal(scene.children.length, 80);
  assert.ok(scene.children.every((c) => c.position.y >= 5), "starts high above the board");
  fx.actions[0].update(0.6);
  assert.ok(scene.children.some((c) => c.position.y < 5), "falls");
  finish(fx);
  assert.equal(scene.children.length, 0);
  assert.doesNotThrow(() => fx.actions[0].done?.());
});

console.log(`${passed} 3D effect checks passed.`);
