import test from "node:test";
import assert from "node:assert/strict";
import { computeRoadFurniture } from "./road-layout.js";
import { CAMPUS_ROADS, MAP_ORIGIN, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { BUS_STOPS } from "./bus-stops.js";
import { getCampusObstacles } from "./site-layout.js";
import { containsPoint, rectangleBoundary } from "./navigation.js";

const toPixel = ([x, z]) => [x / MAP_SCALE + MAP_ORIGIN[0], z / MAP_SCALE + MAP_ORIGIN[1]];
const road = (id, points, width = 6) => ({ id, pixels: points.map(toPixel), widthPixels: width / MAP_SCALE });

function inCarriageway(segment, x, z, padding = 0) {
  const along = (x - segment.ax) * segment.tx + (z - segment.az) * segment.tz;
  const outward = (x - segment.ax) * segment.nx + (z - segment.az) * segment.nz;
  return along > -.35 && along < segment.length + .35 && Math.abs(outward) < segment.width / 2 + padding;
}

test("crossroads have openings instead of full-length curbs cutting across the carriageway", () => {
  const roads = [road("east-west", [[-40, 0], [40, 0]]), road("north-south", [[0, -40], [0, 40]])];
  const before = structuredClone(roads);
  const furniture = computeRoadFurniture({ roads, obstacles: [] });
  assert.deepEqual(roads, before, "road centreline data must not be changed");
  assert.equal(furniture.junctions.length, 1);
  assert.equal(furniture.joints.length, 0, "single-segment roads have no interior bend discs");
  assert.ok(furniture.curbs.length >= 8, "both sides of each crossing road should split around the junction");
  for (const curb of furniture.curbs) {
    assert.ok(curb.depth > .24 && curb.width === .23);
    for (let along = -curb.depth / 2; along <= curb.depth / 2; along += .2) {
      const x = curb.x + Math.sin(curb.angle) * along, z = curb.z + Math.cos(curb.angle) * along;
      assert.equal(furniture.segments.some((segment) => segment.roadId !== curb.roadId && inCarriageway(segment, x, z, .115)), false,
        "curb must not cross another road corridor");
    }
  }
  for (const lamp of furniture.lamps)
    assert.ok(Math.hypot(lamp.x, lamp.z) >= 7, "junction must have a clear pole-free apron");
});

test("asphalt joint discs only fill genuine interior bends away from intersections", () => {
  const bend = road("bend", [[-30, 0], [0, 0], [0, 30]]);
  const simple = computeRoadFurniture({ roads: [bend], obstacles: [] });
  assert.equal(simple.joints.length, 1);
  assert.ok(Math.hypot(simple.joints[0].x, simple.joints[0].z) < 1e-8);
  assert.ok(simple.joints[0].radius <= 3.1, "bend disc must fit the carriageway width");
  const crossed = computeRoadFurniture({ roads: [bend, road("cross", [[-15, -15], [15, 15]])], obstacles: [] });
  assert.equal(crossed.joints.length, 0, "crossing carriageways already fill the intersection");
  const straight = computeRoadFurniture({ roads: [road("straight", [[-30, 0], [0, 0], [30, 0]])], obstacles: [] });
  assert.equal(straight.joints.length, 0, "collinear traced points do not need circular paving patches");
});

test("campus lamps clear architecture, water, entrances and all seventeen bus shelters", () => {
  const obstacles = getCampusObstacles();
  const shelterExclusions = BUS_STOPS.flatMap((stop) => [
    { ...rectangleBoundary(...stop.position, 13.6 * .75, 3.7 * .75, stop.yaw, 1.15), id: `${stop.id}-shelter` },
    { ...rectangleBoundary(...stop.entry, 2.6, 2.6, stop.yaw, .35), id: `${stop.id}-entry` },
  ]);
  assert.equal(BUS_STOPS.length, 17);
  const furniture = computeRoadFurniture({ obstacles, shelterExclusions });
  assert.ok(furniture.lamps.length > 60 && furniture.lamps.length < 200);
  const exclusions = [...obstacles, ...shelterExclusions];
  for (const [index, lamp] of furniture.lamps.entries()) {
    assert.ok([lamp.x, lamp.z, lamp.headX, lamp.headZ, lamp.angle].every(Number.isFinite));
    assert.equal(exclusions.some((boundary) => containsPoint(boundary, lamp.x, lamp.z)), false, "pole must not intersect an exclusion");
    assert.equal(exclusions.some((boundary) => containsPoint(boundary, lamp.headX, lamp.headZ)), false, "lamp head must not intersect an exclusion");
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      assert.equal(exclusions.some((boundary) => containsPoint(boundary, lamp.x + Math.sin(angle) * .65, lamp.z + Math.cos(angle) * .65)), false,
        "pole must keep a real clearance from buildings, water, approach paths and shelters");
    }
    assert.ok(!furniture.lamps.slice(index + 1).some((other) => Math.hypot(lamp.x - other.x, lamp.z - other.z) < 12 - 1e-8), "lamps must not duplicate near segment or road boundaries");
    assert.ok(furniture.junctions.every((junction) => Math.hypot(lamp.x - junction.x, lamp.z - junction.z) >= junction.radius + 4 - 1e-8));
    const own = furniture.segments.find((segment) => segment.roadId === lamp.roadId && segment.index === lamp.segmentIndex);
    const poleOffset = (lamp.x - own.ax) * own.nx + (lamp.z - own.az) * own.nz;
    const headOffset = (lamp.headX - own.ax) * own.nx + (lamp.headZ - own.az) * own.nz;
    assert.ok(Math.abs(headOffset) < Math.abs(poleOffset), "head must extend toward its own road");
  }
  assert.ok(furniture.curbs.length > 100 && furniture.curbs.length < 700);
  assert.ok(furniture.joints.length > 10);
  for (const [index, joint] of furniture.joints.entries()) {
    assert.ok(furniture.junctions.every((junction) => Math.hypot(joint.x - junction.x, joint.z - junction.z) >= junction.radius + 1 - 1e-8));
    assert.ok(!furniture.joints.slice(index + 1).some((other) => Math.hypot(joint.x - other.x, joint.z - other.z) < .5));
    const source = CAMPUS_ROADS.find((candidate) => candidate.id === joint.roadId).pixels.map(mapToWorld);
    assert.ok(source.slice(1, -1).some(([x, z]) => Math.hypot(x - joint.x, z - joint.z) < 1e-8), "rounding discs must occur at interior source nodes only");
  }
});
