import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFSKTM } from "./models/fsktm.js";

function buildFSKTM() {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        measureText: (text) => ({ width: text.length * 50 }),
        fillText() {},
      }),
    }),
  };
  try {
    return createFSKTM({
      material: (color, extra) => new THREE.MeshStandardMaterial({ color, ...extra }),
    });
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

test("FSKTM has seven total tower floors and three total floors per wing", () => {
  const model = buildFSKTM();
  try {
    assert.deepEqual(model.userData.floorCounts, { tower: 7, leftWing: 3, rightWing: 3 });
    // Check the actual front glazing as well as metadata. Six upper rows plus
    // the entrance level form the tower; three glazed rows form the low wing.
    const glazing = model.children.find((child) => child.material.color.getHexString() === "436a66");
    const positions = glazing.geometry.attributes.position;
    const towerEdges = new Set(), wingEdges = new Set();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      if (x > -19 && x < -10.5 && z > 12.68 && z < 12.74 && y > 4)
        towerEdges.add(Number(y.toFixed(3)));
      if (x > 0 && x < 20 && z > 13.25 && z < 13.3)
        wingEdges.add(Number(y.toFixed(3)));
    }
    const centers = (edges) => {
      const ys = [...edges].sort((a, b) => a - b);
      return ys.filter((_, i) => i % 2 === 0).map((bottom, i) => Number(((bottom + ys[2 * i + 1]) / 2).toFixed(2)));
    };
    assert.deepEqual(centers(towerEdges), [6.3, 10.05, 13.8, 17.55, 21.3, 25.05]);
    assert.deepEqual(centers(wingEdges), [2.2, 6.25, 10.3]);
    assert.equal(model.userData.floorCenters.tower.length, 7);
    assert.equal(model.userData.floorCenters.leftWing.length, 3);
    assert.equal(model.userData.floorCenters.rightWing.length, 3);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(bounds.max.y < 33, "tower roof must be lowered along with its removed floor");
    assert.ok(model.userData.roofHeights.wings < 14, "wing roofs must follow the three-floor envelope");
    assert.ok(model.userData.triangles > 100_000, "model must retain its detailed architectural geometry");
    assert.ok(model.children.length < 40, "static details should remain batched for rendering");
    for (const child of model.children) {
      for (const attribute of Object.values(child.geometry.attributes)) {
        assert.ok(attribute.array.every(Number.isFinite), "generated geometry must have finite coordinates");
      }
    }
  } finally {
    model.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
  }
});
