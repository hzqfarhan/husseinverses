import test from "node:test";
import assert from "node:assert/strict";
import {
  rectangleBoundary,
  polygonBoundary,
  containsPoint,
} from "./navigation.js";

test("angled wing blocks its body while leaving space beside its bounding box walkable", () => {
  const wing = rectangleBoundary(0, 0, 20, 4, Math.PI / 4, 0);
  assert.equal(containsPoint(wing, 6, -6), true);
  assert.equal(containsPoint(wing, 6, 6), false);
  assert.equal(containsPoint(wing, 9, -9), false);
});

test("traced concave buildings and courtyard holes preserve open walking space", () => {
  const l = polygonBoundary(
    [
      [0, 0],
      [12, 0],
      [12, 4],
      [4, 4],
      [4, 12],
      [0, 12],
    ],
    0.4,
  );
  assert.equal(containsPoint(l, 2, 8), true);
  assert.equal(containsPoint(l, 8, 8), false);
  const court = polygonBoundary(
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    0.5,
    [
      [
        [5, 5],
        [15, 5],
        [15, 15],
        [5, 15],
      ],
    ],
  );
  assert.equal(containsPoint(court, 10, 10), false);
  assert.equal(containsPoint(court, 5.2, 10), true);
  assert.equal(containsPoint(court, 2, 10), true);
});
