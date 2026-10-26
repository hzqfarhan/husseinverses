// Read-only placement proposals: node lib/bus-stop-audit.mjs
// This file never changes BUS_STOPS. A proposal is not evidence of the real
// roadside: the user's specific stop or satellite view must resolve that.
import { pathToFileURL } from "node:url";
import { BUS_STOPS } from "./bus-stops.js";
import { CAMPUS_ROADS, MAP_BOUNDS, MAP_ORIGIN, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { getCampusObstacles } from "./site-layout.js";
import { containsPoint } from "./navigation.js";

const toPixel = ([x, z]) => [x / MAP_SCALE + MAP_ORIGIN[0], z / MAP_SCALE + MAP_ORIGIN[1]];
function segmentsOf(roads) {
  return roads.flatMap((road) => {
    const points = road.pixels.map(mapToWorld); let run = 0;
    return points.slice(1).map((b, index) => {
      const a = points[index], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const segment = { a, b, length, run, index, roadId: road.id, width: road.widthPixels * MAP_SCALE };
      run += length; return segment;
    });
  });
}

/** Find the nearest clear opposite-side proposal on this same named road.
 * Only a local along-road search is permitted; the original official GPS and
 * route data remain in the source module and are not rewritten by this audit.
 */
export function proposeOppositeBusStop(stop, { roads = CAMPUS_ROADS, obstacles = getCampusObstacles(), maxAlongShift = 36 } = {}) {
  const segments = segmentsOf(roads), [roadId, originalIndex, originalFraction, originalSide] = stop.placement;
  const original = segments.find((segment) => segment.roadId === roadId && segment.index === originalIndex);
  if (!original) return { id: stop.id, status: "missing-road-segment" };
  const sourceDistance = original.run + originalFraction * original.length;
  const oldNormal = [(original.b[1] - original.a[1]) / original.length, -(original.b[0] - original.a[0]) / original.length];
  const [minX, minZ] = mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.minY]);
  const [maxX, maxZ] = mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.maxY]);
  const blockedByRoad = (x, z) => segments.some((segment) => {
    const tx = (segment.b[0] - segment.a[0]) / segment.length, tz = (segment.b[1] - segment.a[1]) / segment.length;
    const along = (x - segment.a[0]) * tx + (z - segment.a[1]) * tz;
    return along > -.35 && along < segment.length + .35
      && Math.abs((x - segment.a[0]) * tz - (z - segment.a[1]) * tx) < segment.width / 2 + .07;
  });
  const offsets = [0];
  for (let distance = .5; distance <= maxAlongShift; distance += .5) offsets.push(distance, -distance);
  const observedBlockers = new Set();
  for (const shift of offsets) {
    const coordinate = sourceDistance + shift;
    const segment = segments.find((candidate) => candidate.roadId === roadId && candidate.run <= coordinate && candidate.run + candidate.length >= coordinate);
    if (!segment) continue;
    const fraction = (coordinate - segment.run) / segment.length, side = -originalSide;
    const tx = (segment.b[0] - segment.a[0]) / segment.length, tz = (segment.b[1] - segment.a[1]) / segment.length;
    const front = [side * tz, -side * tx], yaw = Math.atan2(front[0], front[1]);
    const roadPoint = [segment.a[0] + (segment.b[0] - segment.a[0]) * fraction, segment.a[1] + (segment.b[1] - segment.a[1]) * fraction];
    const offset = segment.width / 2 + 2.0875;
    const position = [roadPoint[0] - front[0] * offset, roadPoint[1] - front[1] * offset];
    // On a bend, retain the requested opposite half-plane of the original road
    // as well as changing the local side sign of the adjacent segment.
    const signedSide = (position[0] - stop.roadPoint[0]) * oldNormal[0] + (position[1] - stop.roadPoint[1]) * oldNormal[1];
    if (signedSide * originalSide < .5) continue;
    let blocked = false;
    // Full 0.75-scale end ramps and concrete pad, plus front steps and margin.
    for (let dx = -5.25; dx <= 5.251; dx += 1.05) for (let dz = -1.55; dz <= 1.951; dz += .5) {
      const x = position[0] + dx * Math.cos(yaw) + dz * Math.sin(yaw);
      const z = position[1] - dx * Math.sin(yaw) + dz * Math.cos(yaw);
      if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) { blocked = true; observedBlockers.add("campus-boundary"); }
      if (blockedByRoad(x, z)) { blocked = true; observedBlockers.add("road-carriageway"); }
      for (const obstacle of obstacles) if (containsPoint(obstacle, x, z)) { blocked = true; observedBlockers.add(obstacle.id || obstacle.kind || "obstacle"); }
    }
    const entry = [position[0] + front[0] * 1.8, position[1] + front[1] * 1.8];
    if (blocked || blockedByRoad(...entry) || obstacles.some((obstacle) => containsPoint(obstacle, ...entry))) continue;
    return {
      id: stop.id, name: stop.name, status: "proposal-only", originalPlacement: [...stop.placement],
      proposedPlacement: [roadId, segment.index, fraction, side], alongRoadShift: shift,
      position, pixel: toPixel(position), yaw, roadPoint, roadPixel: toPixel(roadPoint), entry, entryPixel: toPixel(entry),
      satelliteVerified: false, needsStopIdentityConfirmation: true,
      sourceConfidence: "Opposite-roadside proposal is geometrically clear on the existing schematic; actual roadside is not independently verified.",
      avoidedBlockers: [...observedBlockers],
    };
  }
  return { id: stop.id, name: stop.name, status: "no-safe-local-proposal", maxAlongShift, blockers: [...observedBlockers], satelliteVerified: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(BUS_STOPS.map((stop) => proposeOppositeBusStop(stop)), null, 2));
