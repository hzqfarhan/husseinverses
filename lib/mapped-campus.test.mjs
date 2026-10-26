import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildMappedCampus } from "./mapped-campus.js";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, mapToWorld } from "./campus-layout.js";
import { FACULTIES, facultyForFootprint } from "./faculty-data.js";
import { createLandmark } from "./models/landmarks.js";
import { FSKTM } from "./models/fsktm.js";
import { containsPoint, polygonBoundary, rectangleBoundary, transformBoundary } from "./navigation.js";

let scene, campus, collisions, result, detailedBoundaryCount;
const materials = new Map();
const footprints = BUILDING_FOOTPRINTS.filter((footprint) => !footprint.excludeLandmark);

before(() => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        measureText: (text) => ({ width: text.length * 50 }),
        fillText() {}, clearRect() {}, fillRect() {},
      }),
    }),
  };
  const material = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, ...extra }));
    return materials.get(key);
  };
  try {
    scene = new THREE.Scene();
    collisions = [];
    // Match the actual campus composition, including rotated/scaled landmark
    // boundaries, before testing faculty arrival points or planting geometry.
    for (const id of ["library", "hall", "mosque", "swimming", "stadium"]) {
      const { root, boundaries } = createLandmark(id, { material });
      const placement = CAMPUS_LANDMARKS[id];
      root.position.set(placement.position[0], 0, placement.position[1]);
      root.rotation.y = placement.yaw;
      root.scale.setScalar(placement.modelScale);
      scene.add(root);
      collisions.push(...boundaries.map((boundary) => transformBoundary(boundary, placement)));
    }
    for (const [x, z, width, depth, angle] of FSKTM.bounds)
      collisions.push(transformBoundary(rectangleBoundary(x + 15, z, width, depth, angle), CAMPUS_LANDMARKS.fsktm));
    detailedBoundaryCount = collisions.length;
    result = buildMappedCampus({ scene, material, collisions });
    campus = scene.getObjectByName("Detailed campus architecture");
    scene.updateMatrixWorld(true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

after(() => {
  const geometries = new Set(), allMaterials = new Set();
  scene?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) allMaterials.add(object.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of allMaterials) {
    material.map?.dispose();
    material.dispose();
  }
});

test("every traced building has detailed geometry and its original collision footprint", () => {
  assert.ok(campus);
  assert.equal(result.architecture.buildings, footprints.length);
  assert.equal(result.architecture.facultyBuildings, footprints.filter(facultyForFootprint).length);
  assert.equal(result.architecture.facultyProfiles.length,result.architecture.facultyBuildings,"all faculty models must be integrated in the live campus");
  assert.equal(result.architecture.facultyProfiles.find(p=>p.sourceCode==="QA").floors,7);
  assert.ok(result.architecture.facadeBays > 3_000, "retain individually modeled window bays across campus");
  assert.ok(result.architecture.roofDetails > 100, "retain distributed roof services and panel arrays");
  const mappedCollisions = collisions.slice(detailedBoundaryCount);
  assert.equal(mappedCollisions.length, footprints.length + CAMPUS_PONDS.length);
  for (const footprint of footprints) {
    const points = footprint.pixels.map(mapToWorld);
    const boundary = mappedCollisions.find((candidate) => candidate.points?.length === points.length
      && candidate.points.every(([x, z], i) => x === points[i][0] && z === points[i][1]));
    assert.ok(boundary, `${footprint.id} must retain its traced collision footprint`);
    assert.deepEqual(boundary.holes, footprint.holes.map((ring) => ring.map(mapToWorld)));
  }

  let drawObjects = 0, instanceCount = 0, renderedTriangles = 0;
  campus.traverse((object) => {
    if (!object.isMesh) return;
    drawObjects++;
    for (const attribute of Object.values(object.geometry.attributes))
      assert.ok(attribute.array.every(Number.isFinite), `${object.name} must have finite mesh coordinates`);
    const triangleCount = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    renderedTriangles += triangleCount * (object.isInstancedMesh ? object.count : 1);
    if (object.isInstancedMesh) {
      instanceCount += object.count;
      assert.ok(object.instanceMatrix.array.every(Number.isFinite), `${object.name} must have finite instance transforms`);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        assert.ok(matrix.determinant() > 0, `${object.name} instance ${i} must have positive dimensions`);
      }
    }
  });
  assert.ok(drawObjects < 100, "repeated campus details should remain batched");
  assert.ok(instanceCount > 20_000 && instanceCount < 60_000, "retain rich facade detail within the instance budget");
  assert.ok(renderedTriangles > 1_000_000 && renderedTriangles < 3_000_000, "retain detailed geometry within the campus rendering budget");
});

test("all faculty arrival points remain walkable against the complete campus", () => {
  for (const faculty of FACULTIES) {
    const [x, z] = faculty.entry;
    assert.ok(x > result.minX && x < result.maxX && z > result.minZ && z < result.maxZ, `${faculty.short} entry must be inside the campus`);
    assert.equal(collisions.some((boundary) => containsPoint(boundary, x, z)), false, `${faculty.short} entry must not intersect any building or pond`);
    const primary = footprints.find((footprint) => footprint.id === faculty.primaryFootprint);
    assert.ok(primary, `${faculty.short} must have a modeled primary footprint`);
    assert.equal(facultyForFootprint(primary)?.id, faculty.id);
  }
});

test("traced faculty courtyards stay open in collision and rendered roof geometry", () => {
  const courtyards = footprints.filter((footprint) => footprint.holes.length);
  assert.ok(courtyards.length >= 2);
  for (const footprint of courtyards) {
    for (const ring of footprint.holes) {
      const points = ring.map(mapToWorld);
      const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const z = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      assert.ok(containsPoint(polygonBoundary(points, 0), x, z), "sample must lie inside the courtyard");
      assert.equal(collisions.some((boundary) => containsPoint(boundary, x, z)), false, `${footprint.id} courtyard must remain walkable`);
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObject(campus, true);
      assert.ok(hits.length > 0, "courtyard sample must reach campus terrain");
      assert.ok(hits.every((hit) => hit.point.y < 0.5), `${footprint.id} courtyard must not be capped by a roof or roof service`);
    }
  }
});
