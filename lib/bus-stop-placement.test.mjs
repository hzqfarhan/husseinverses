import test from "node:test";
import assert from "node:assert/strict";
import { BUS_STOPS } from "./bus-stops.js";
import { proposeOppositeBusStop } from "./bus-stop-audit.mjs";
import { CAMPUS_ROADS, MAP_ORIGIN, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { getCampusObstacles } from "./site-layout.js";
import { containsPoint, rectangleBoundary } from "./navigation.js";

test("Library opposite-side proposal turns the shelter toward the road without rewriting source records", () => {
  const before = structuredClone(BUS_STOPS), stop = BUS_STOPS.find((candidate) => candidate.katsanaId === 12);
  const proposal = proposeOppositeBusStop(stop);
  assert.equal(proposal.status, "proposal-only");
  assert.equal(proposal.satelliteVerified, false);
  assert.equal(proposal.needsStopIdentityConfirmation, true);
  assert.equal(proposal.proposedPlacement[3], -stop.placement[3]);
  assert.ok(Math.abs(proposal.alongRoadShift) <= 10, "Library proposal must remain beside its original local road section");
  assert.deepEqual(BUS_STOPS, before, "an audit must never silently move stops or alter official GPS/route memberships");
  const oldFront = [Math.sin(stop.yaw), Math.cos(stop.yaw)], front = [Math.sin(proposal.yaw), Math.cos(proposal.yaw)];
  assert.ok(oldFront[0] * front[0] + oldFront[1] * front[1] < -.999, "opposite roadside needs a reversed road-facing elevation");
  const delta = [proposal.roadPoint[0] - proposal.position[0], proposal.roadPoint[1] - proposal.position[1]];
  assert.ok((delta[0] * front[0] + delta[1] * front[1]) / Math.hypot(...delta) > .999);
  const obstacles = getCampusObstacles();
  const roadSegments = CAMPUS_ROADS.flatMap((road) => {
    const points = road.pixels.map(mapToWorld);
    return points.slice(1).map((b, i) => ({ a: points[i], b, width: road.widthPixels * MAP_SCALE }));
  });
  for (let dx = -5.25; dx <= 5.251; dx += 1.05) for (let dz = -1.55; dz <= 1.951; dz += .5) {
    const x = proposal.position[0] + dx * Math.cos(proposal.yaw) + dz * Math.sin(proposal.yaw);
    const z = proposal.position[1] - dx * Math.sin(proposal.yaw) + dz * Math.cos(proposal.yaw);
    assert.equal(obstacles.some((obstacle) => containsPoint(obstacle, x, z)), false, "full pad/ramps/steps must clear architecture and ponds");
    assert.equal(roadSegments.some(({ a, b, width }) => {
      const vx = b[0] - a[0], vz = b[1] - a[1], length = Math.hypot(vx, vz);
      const along = ((x - a[0]) * vx + (z - a[1]) * vz) / length;
      return along > -.35 && along < length + .35 && Math.abs((x - a[0]) * vz - (z - a[1]) * vx) / length < width / 2;
    }), false, "proposal must clear other road carriageways as well as its own");
  }
  assert.equal(obstacles.some((obstacle) => containsPoint(obstacle, ...proposal.entry)), false);
});

test("a blocked opposite bank produces an unresolved proposal instead of forcing a shelter into it", () => {
  const toPixel = ([x, z]) => [x / MAP_SCALE + MAP_ORIGIN[0], z / MAP_SCALE + MAP_ORIGIN[1]];
  const road = { id: "test-road", pixels: [[-30, 0], [30, 0]].map(toPixel), widthPixels: 6 / MAP_SCALE };
  const stop = { id: "test-stop", name: "Test", placement: [road.id, 0, .5, 1], roadPoint: [0, 0] };
  const boundary = { ...rectangleBoundary(0, -7, 100, 12, 0, .5), id: "opposite-bank-pond", kind: "water" };
  const proposal = proposeOppositeBusStop(stop, { roads: [road], obstacles: [boundary], maxAlongShift: 10 });
  assert.equal(proposal.status, "no-safe-local-proposal");
  assert.ok(proposal.blockers.includes(boundary.id));
  assert.equal(proposal.position, undefined, "unsafe guesses must not become usable placements");
  assert.equal(proposal.satelliteVerified, false);
});
