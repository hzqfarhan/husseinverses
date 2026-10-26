import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BUS_STOPS, BUS_ROUTES, OFF_CAMPUS_KATSANA_STOPS } from "./bus-stops.js";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, MAP_BOUNDS, mapToWorld } from "./campus-layout.js";
import { createLandmark } from "./models/landmarks.js";
import { FSKTM } from "./models/fsktm.js";
import { containsPoint, polygonBoundary, rectangleBoundary, transformBoundary } from "./navigation.js";

test("Katsana markers are deduplicated by location and retain separate front/back stops", () => {
  assert.equal(BUS_STOPS.length, 17);
  assert.equal(new Set(BUS_STOPS.map((stop) => stop.id)).size, BUS_STOPS.length);
  assert.equal(new Set(BUS_STOPS.map((stop) => stop.gps.join(","))).size, BUS_STOPS.length);
  for (const stop of BUS_STOPS) {
    assert.ok(stop.name && stop.katsanaName && stop.locationConfidence);
    assert.ok(stop.sources.includes("https://uthm.katsana.com/"));
    assert.ok(stop.routeNumbers.length > 0);
    assert.ok(stop.routeNumbers.every((id) => BUS_ROUTES.some((route) => route.id === id)));
    assert.deepEqual(Object.keys(stop.routeVisits).map(Number), stop.routeNumbers);
    assert.ok(stop.latitude > 1.854 && stop.latitude < 1.865 && stop.longitude > 103.077 && stop.longitude < 103.09);
    assert.ok([...stop.position, ...stop.entry, ...stop.roadPoint, stop.yaw, stop.roadWidth].every(Number.isFinite));
  }
  const front = BUS_STOPS.find((stop) => stop.katsanaId === 5);
  const back = BUS_STOPS.find((stop) => stop.katsanaId === 2);
  assert.notDeepEqual(front.gps, back.gps);
  assert.notDeepEqual(front.position, back.position);
  assert.ok(!BUS_STOPS.some((stop) => OFF_CAMPUS_KATSANA_STOPS.some((excluded) => excluded.katsanaId === stop.katsanaId)));
  assert.deepEqual(OFF_CAMPUS_KATSANA_STOPS.map((stop) => stop.katsanaId).sort((a, b) => a - b), [16, 17, 26]);
});

test("shelter pads face their roads and every arrival stays clear of campus buildings and ponds", () => {
  const collisions = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({
      measureText: (text) => ({ width: text.length * 50 }), fillText() {}, clearRect() {}, fillRect() {},
    }) }),
  };
  try {
    for (const id of ["library", "hall", "mosque", "swimming", "stadium"]) {
      const { root, boundaries } = createLandmark(id, { material: (color) => new THREE.MeshStandardMaterial({ color }) });
      collisions.push(...boundaries.map((boundary) => transformBoundary(boundary, CAMPUS_LANDMARKS[id])));
      root.traverse((object) => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  for (const [x, z, width, depth, yaw] of FSKTM.bounds)
    collisions.push(transformBoundary(rectangleBoundary(x + 15, z, width, depth, yaw), CAMPUS_LANDMARKS.fsktm));
  for (const footprint of BUILDING_FOOTPRINTS.filter((footprint) => !footprint.excludeLandmark))
    collisions.push(polygonBoundary(footprint.pixels.map(mapToWorld), 0.9, footprint.holes.map((hole) => hole.map(mapToWorld))));
  for (const pond of CAMPUS_PONDS) collisions.push(polygonBoundary(pond.pixels.map(mapToWorld), 0.5));
  const [minX, minZ] = mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.minY]);
  const [maxX, maxZ] = mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.maxY]);
  for (const stop of BUS_STOPS) {
    const front = [Math.sin(stop.yaw), Math.cos(stop.yaw)];
    const roadDelta = [stop.roadPoint[0] - stop.position[0], stop.roadPoint[1] - stop.position[1]];
    const distance = Math.hypot(...roadDelta);
    assert.ok((front[0] * roadDelta[0] + front[1] * roadDelta[1]) / distance > 0.999, `${stop.name} must open toward its road`);
    assert.ok(distance - (3.7 * 0.75) / 2 > stop.roadWidth / 2, `${stop.name} pad must remain outside the road`);
    assert.ok(Math.hypot(stop.entry[0] - stop.roadPoint[0], stop.entry[1] - stop.roadPoint[1]) > stop.roadWidth / 2, `${stop.name} arrival must remain outside the road`);
    assert.equal(collisions.some((boundary) => containsPoint(boundary, ...stop.entry)), false, `${stop.name} arrival must be walkable`);
    // Pad, side ramps and small safety margin at the actual 0.75 X/Z scale.
    for (const dx of [-5.25, 0, 5.25]) for (const dz of [-1.55, 0, 1.55]) {
      const x = stop.position[0] + dx * Math.cos(stop.yaw) + dz * Math.sin(stop.yaw);
      const z = stop.position[1] - dx * Math.sin(stop.yaw) + dz * Math.cos(stop.yaw);
      assert.ok(x > minX && x < maxX && z > minZ && z < maxZ, `${stop.name} shelter must remain inside the mapped campus`);
      assert.equal(collisions.some((boundary) => containsPoint(boundary, x, z)), false, `${stop.name} shelter/ramp must not intersect a building or pond`);
    }
  }
});
