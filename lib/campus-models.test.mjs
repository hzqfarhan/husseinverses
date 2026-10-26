import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createLandmark } from "./models/landmarks.js";
import { CAMPUS_LANDMARKS, mapToWorld } from "./campus-layout.js";
import { containsPoint, rectangleBoundary, transformBoundary } from "./navigation.js";

// Signs use canvas only to produce textures; geometry and collision checks run
// without a WebGL context or a browser.
globalThis.document ??= {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({ clearRect() {}, fillText() {} }),
  }),
};

const landmarkIds = ["library", "hall", "mosque", "swimming", "stadium"];
const models = new Map();
const material = (color, extra) => new THREE.MeshStandardMaterial({ color, ...extra });

function model(id) {
  if (!models.has(id)) models.set(id, createLandmark(id, { material }));
  return models.get(id);
}

function matrixFor({ position: [x, z], yaw, modelScale }) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(modelScale, modelScale, modelScale),
  );
}

function placedPoint([x, z], placement) {
  const p = new THREE.Vector3(x, 0, z).applyMatrix4(matrixFor(placement));
  return [p.x, p.z];
}

test("all landmark models have finite detailed geometry with bounded draw calls", () => {
  for (const id of landmarkIds) {
    const { root, boundaries } = model(id);
    let triangles = 0;
    let meshes = 0;
    root.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      const positions = object.geometry.getAttribute("position");
      for (const component of positions.array)
        assert.ok(Number.isFinite(component), `${id} has a non-finite vertex`);
      triangles += (object.geometry.index?.count ?? positions.count) / 3;
    });
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(!bounds.isEmpty(), `${id} must render visible geometry`);
    assert.ok(triangles > 20_000, `${id} lost its detailed modeled architecture`);
    assert.ok(triangles < 500_000, `${id} exceeds the per-landmark geometry budget`);
    assert.ok(meshes < 40, `${id} must batch repeated details`);
    assert.ok(boundaries.length > 0, `${id} needs walking boundaries`);
    for (const value of [...bounds.min, ...bounds.max]) assert.ok(Number.isFinite(value));
  }
});

test("library courtyard remains open in both geometry and placed walking boundaries", () => {
  const { root, boundaries } = model("library");
  const placement = CAMPUS_LANDMARKS.library;
  const worldBoundaries = boundaries.map((boundary) => transformBoundary(boundary, placement));
  const court = placedPoint([0, 0], placement);
  const building = placedPoint([18, 0], placement);
  assert.equal(worldBoundaries.some((boundary) => containsPoint(boundary, ...court)), false);
  assert.equal(worldBoundaries.some((boundary) => containsPoint(boundary, ...building)), true);

  root.updateMatrixWorld(true);
  const down = new THREE.Vector3(0, -1, 0);
  const courtRay = new THREE.Raycaster(new THREE.Vector3(.5, 50, .5), down);
  const ringRay = new THREE.Raycaster(new THREE.Vector3(18, 50, 0), down);
  const courtHits = courtRay.intersectObject(root, true);
  const buildingHits = ringRay.intersectObject(root, true);
  assert.ok(courtHits.length > 0, "the courtyard contains its ground-level landscaping");
  assert.ok(courtHits[0].point.y < 8, "the library roof must not cover its courtyard");
  assert.ok(buildingHits[0].point.y > 27, "the surrounding library ring retains its roof");
});

test("landmark arrivals remain outside every detailed building boundary", () => {
  const arrivals = { hall: [805, 991], swimming: [1058, 1300], stadium: [1120, 1496] };
  const boundaries = landmarkIds.flatMap((id) => model(id).boundaries.map(
    (boundary) => transformBoundary(boundary, CAMPUS_LANDMARKS[id]),
  ));
  for (const id of landmarkIds) {
    const entry = mapToWorld(arrivals[id] ?? CAMPUS_LANDMARKS[id].frontPixel);
    assert.equal(boundaries.some((boundary) => containsPoint(boundary, ...entry)), false,
      `${id} arrival is inside a detailed building`);
  }
});

test("rotated and scaled rectangular boundaries keep a nondefault clearance margin", () => {
  const local = rectangleBoundary(7, -3, 10, 4, Math.PI / 5, .37);
  const placement = { position: [80, -40], yaw: -.72, modelScale: .63 };
  const world = transformBoundary(local, placement);
  // Use the model's matrix to move points across a side and a corner, including
  // the added walking clearance, so collision and rendered placements agree.
  const localMatrix = matrixFor({ position: [7, -3], yaw: Math.PI / 5, modelScale: 1 });
  for (const [x, z, expected] of [
    [0, 0, true], [5.2, 0, true], [5.5, 0, false],
    [0, 2.2, true], [0, 2.5, false], [5.2, 2.2, true], [5.5, 2.5, false],
  ]) {
    const point = new THREE.Vector3(x, 0, z).applyMatrix4(localMatrix);
    const placed = placedPoint([point.x, point.z], placement);
    assert.equal(containsPoint(world, ...placed), expected,
      `incorrect collision after placing local sample ${x}, ${z}`);
  }
});

test.after(() => {
  for (const { root } of models.values()) root.traverse((object) => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });
});
