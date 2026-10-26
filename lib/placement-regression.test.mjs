import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, mapToWorld } from "./campus-layout.js";
import { createLandmark } from "./models/landmarks.js";
import { createFSKTM } from "./models/fsktm.js";
import { polygonBoundary, containsPoint } from "./navigation.js";
import { getPondOutline } from "./water-boundaries.js";

const models = new Map();

before(() => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    measureText: (text) => ({ width: text.length * 50 }), fillText() {}, clearRect() {}, fillRect() {},
  }) }) };
  try {
    const material = (color, options) => new THREE.MeshStandardMaterial({ color, ...options });
    for (const id of ["mosque", "swimming", "fsktm"]) {
      const root = id === "fsktm" ? createFSKTM({ material }) : createLandmark(id, { material }).root;
      const placement = CAMPUS_LANDMARKS[id];
      root.position.set(placement.position[0], 0, placement.position[1]);
      root.rotation.y = placement.yaw;
      root.scale.setScalar(placement.modelScale);
      root.updateMatrixWorld(true);
      models.set(id, root);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

after(() => {
  for (const root of models.values()) root.traverse((object) => {
    object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose();
  });
});

function minimumRectangle(points) {
  let result;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(angle), s = Math.sin(angle);
    const transformed = points.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
    const lo = [Math.min(...transformed.map((p) => p[0])), Math.min(...transformed.map((p) => p[1]))];
    const hi = [Math.max(...transformed.map((p) => p[0])), Math.max(...transformed.map((p) => p[1]))];
    const width = hi[0] - lo[0], depth = hi[1] - lo[1];
    if (!result || width * depth < result.area) result = {
      area: width * depth,
      majorYaw: -angle + (width > depth ? Math.PI / 2 : 0),
      center: [(lo[0] + hi[0]) / 2 * c - (lo[1] + hi[1]) / 2 * s,
        (lo[0] + hi[0]) / 2 * s + (lo[1] + hi[1]) / 2 * c],
    };
  }
  return result;
}

test("actual mosque, swimming-centre and FSKTM geometry stays outside foreign buildings and water", () => {
  for (const [id, root] of models) {
    const modelBounds = new THREE.Box3().setFromObject(root, true);
    const candidates = [
      ...BUILDING_FOOTPRINTS.filter((footprint) => footprint.excludeLandmark !== id).map((footprint) => ({
        id: footprint.id, boundary: polygonBoundary(footprint.pixels.map(mapToWorld), 0, footprint.holes.map((hole) => hole.map(mapToWorld))),
      })),
      ...CAMPUS_PONDS.map((pond) => ({ id: pond.id, boundary: polygonBoundary(getPondOutline(pond), 0) })),
    ].filter(({ boundary }) => boundary.minX < modelBounds.max.x && boundary.maxX > modelBounds.min.x
      && boundary.minZ < modelBounds.max.z && boundary.maxZ > modelBounds.min.z);
    let samples = 0;
    const overlaps = new Set(), point = new THREE.Vector3();
    root.traverse((object) => {
      if (!object.geometry) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 19) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        if (point.y <= 1) continue;
        samples++;
        for (const { id: obstacleId, boundary } of candidates)
          if (containsPoint(boundary, point.x, point.z)) overlaps.add(obstacleId);
      }
    });
    assert.ok(samples > 5_000, `${id} should be checked against its real detailed geometry`);
    assert.deepEqual([...overlaps], [], `${id} intersects ${[...overlaps].join(", ")}`);
  }
});

test("the modeled minaret remains aligned with the minaret mark on the source map", () => {
  const root = models.get("mosque");
  const highGeometry = new THREE.Box3(), point = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.geometry) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      // Above the central dome/crescent: only the actual tall minaret remains.
      if (positions.getY(i) <= 44) continue;
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      highGeometry.expandByPoint(point);
    }
  });
  assert.ok(!highGeometry.isEmpty());
  const center = highGeometry.getCenter(new THREE.Vector3());
  const sourceMark = BUILDING_FOOTPRINTS.find((footprint) => footprint.id === "map-058");
  const anchor = mapToWorld(sourceMark.center);
  assert.ok(Math.hypot(center.x - anchor[0], center.z - anchor[1]) < 1,
    "minaret mesh must align within one model unit of the schematic minaret marker");
  assert.ok(highGeometry.max.y > 20 && highGeometry.max.y < 30, "minaret scale must remain proportional to the mapped precinct");
});

test("swimming-centre roof axis and centre follow the independently traced source footprint", () => {
  const root = models.get("swimming");
  const source = minimumRectangle(BUILDING_FOOTPRINTS.find((footprint) => footprint.id === "map-110").pixels.map(mapToWorld));
  const points = [], point = new THREE.Vector3();
  root.traverse((object) => {
    if (object.material?.color?.getHexString() !== "a8b5b4") return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      points.push([point.x, point.z]);
    }
  });
  assert.ok(points.length > 30);
  const center = [points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length];
  const covariance = points.reduce((sum, [x, z]) => {
    const dx = x - center[0], dz = z - center[1];
    return [sum[0] + dx * dx, sum[1] + dx * dz, sum[2] + dz * dz];
  }, [0, 0, 0]);
  const theta = .5 * Math.atan2(2 * covariance[1], covariance[0] - covariance[2]);
  const majorYaw = Math.atan2(Math.cos(theta), Math.sin(theta));
  const difference = Math.abs(Math.atan2(Math.sin(2 * (majorYaw - source.majorYaw)), Math.cos(2 * (majorYaw - source.majorYaw)))) / 2;
  assert.ok(difference < Math.PI / 180, "actual roof major axis must align with the source footprint within one degree");
  assert.ok(Math.hypot(center[0] - source.center[0], center[1] - source.center[1]) < 1,
    "actual roof centre must remain over the source swimming-centre outline");
});
