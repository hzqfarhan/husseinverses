import { CAMPUS_ROADS, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { getCampusObstacles } from "./site-layout.js";
import { containsPoint } from "./navigation.js";

const EPSILON = 1e-7;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const cross = (ax, az, bx, bz) => ax * bz - az * bx;

function projection(x, z, segment) {
  const t = clamp(((x - segment.ax) * segment.dx + (z - segment.az) * segment.dz) / (segment.length * segment.length), 0, 1);
  const px = segment.ax + t * segment.dx, pz = segment.az + t * segment.dz;
  return { x: px, z: pz, distance: Math.hypot(x - px, z - pz), t };
}

function insideCorridor(x, z, segment, padding = 0) {
  const along = (x - segment.ax) * segment.tx + (z - segment.az) * segment.tz;
  const outward = (x - segment.ax) * segment.nx + (z - segment.az) * segment.nz;
  return along >= -.35 - padding && along <= segment.length + .35 + padding
    && Math.abs(outward) < segment.width / 2 + padding;
}

function obstacleDistance(boundary, x, z) {
  if (containsPoint(boundary, x, z)) return 0;
  if (!boundary.points) {
    const c = Math.cos(boundary.angle || 0), s = Math.sin(boundary.angle || 0);
    const dx = x - boundary.x, dz = z - boundary.z;
    return Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - boundary.hw), Math.max(0, Math.abs(dx * s + dz * c) - boundary.hd));
  }
  let distance = Infinity;
  for (const ring of [boundary.points, ...(boundary.holes || [])]) for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(EPSILON, length2), 0, 1);
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return Math.max(0, distance - (boundary.margin || 0));
}

function hasClearance(x, z, clearance, obstacles) {
  return !obstacles.some((obstacle) => x > obstacle.minX - clearance && x < obstacle.maxX + clearance
    && z > obstacle.minZ - clearance && z < obstacle.maxZ + clearance
    && obstacleDistance(obstacle, x, z) < clearance);
}

function junctionPoints(segments) {
  const points = [];
  const offer = (x, z, a, b) => {
    const existing = points.find((point) => Math.hypot(point.x - x, point.z - z) < 1.5);
    if (existing) {
      existing.radius = Math.max(existing.radius, a.width / 2, b.width / 2);
      for (const id of [a.roadId, b.roadId]) if (!existing.roadIds.includes(id)) existing.roadIds.push(id);
    } else points.push({ x, z, radius: Math.max(a.width, b.width) / 2, roadIds: [...new Set([a.roadId, b.roadId])] });
  };
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i], b = segments[j];
    if (a.roadId === b.roadId && Math.abs(a.index - b.index) <= 1) continue;
    const denominator = cross(a.dx, a.dz, b.dx, b.dz);
    if (Math.abs(denominator) > EPSILON) {
      const rx = b.ax - a.ax, rz = b.az - a.az;
      const t = cross(rx, rz, b.dx, b.dz) / denominator, u = cross(rx, rz, a.dx, a.dz) / denominator;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        offer(a.ax + t * a.dx, a.az + t * a.dz, a, b); continue;
      }
    }
    // Printed road branches sometimes stop a little short of the receiving
    // centreline. Treat touching carriageways as a junction too.
    for (const [x, z, source, target] of [[a.ax, a.az, a, b], [a.bx, a.bz, a, b], [b.ax, b.az, b, a], [b.bx, b.bz, b, a]]) {
      const p = projection(x, z, target);
      if (p.distance < Math.max(.65, (source.width + target.width) / 2))
        offer((x + p.x) / 2, (z + p.z) / 2, a, b);
    }
  }
  return points;
}

/** Street furniture follows the existing schematic road centreline exactly.
 * These are deterministic visual placements, not surveyed campus fixtures.
 */
export function computeRoadFurniture({ roads = CAMPUS_ROADS, obstacles = getCampusObstacles(), shelterExclusions = [] } = {}) {
  const segments = roads.flatMap((road) => {
    const points = road.pixels.map(mapToWorld), width = road.widthPixels * MAP_SCALE;
    return points.slice(1).flatMap(([bx, bz], index) => {
      const [ax, az] = points[index], dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
      if (length < .05) return [];
      return [{ roadId: road.id, index, ax, az, bx, bz, dx, dz, length, width,
        tx: dx / length, tz: dz / length, nx: dz / length, nz: -dx / length,
        angle: Math.atan2(dx, dz) }];
    });
  });
  const junctions = junctionPoints(segments), curbs = [], lamps = [], joints = [];
  const exclusions = [...obstacles, ...shelterExclusions];

  for (const segment of segments) for (const side of [-1, 1]) {
    const offset = segment.width / 2 + .3;
    const valid = (distance) => {
      const x = segment.ax + segment.tx * distance + segment.nx * side * offset;
      const z = segment.az + segment.tz * distance + segment.nz * side * offset;
      return !segments.some((other) => other !== segment && insideCorridor(x, z, other, .24))
        && hasClearance(x, z, .15, exclusions);
    };
    const steps = Math.max(1, Math.ceil(segment.length / .6)), step = segment.length / steps;
    let start = null;
    const finish = (end) => {
      if (start === null) return;
      const depth = end - start;
      if (depth > .24) {
        const middle = (start + end) / 2;
        curbs.push({ roadId: segment.roadId, segmentIndex: segment.index, side,
          x: segment.ax + segment.tx * middle + segment.nx * side * offset,
          z: segment.az + segment.tz * middle + segment.nz * side * offset,
          width: .23, depth, angle: segment.angle, start, end });
      }
      start = null;
    };
    for (let i = 0; i < steps; i++) {
      const a = i * step, b = (i + 1) * step;
      if (valid(a) && valid((a + b) / 2) && valid(b)) { if (start === null) start = a; }
      else finish(a);
    }
    finish(segment.length);
  }

  for (const road of roads) {
    const own = segments.filter((segment) => segment.roadId === road.id);
    let run = 0, next = 9, candidateIndex = 0;
    for (const segment of own) {
      if (segment.width >= 3.5) while (next < run + segment.length) {
        const distance = next - run, preferred = candidateIndex % 2 ? -1 : 1;
        for (const side of [preferred, -preferred]) {
          const offset = segment.width / 2 + .85;
          const x = segment.ax + segment.tx * distance + segment.nx * side * offset;
          const z = segment.az + segment.tz * distance + segment.nz * side * offset;
          const headX = x - segment.nx * side * .6, headZ = z - segment.nz * side * .6;
          if (junctions.some((point) => Math.hypot(point.x - x, point.z - z) < point.radius + 4)) continue;
          if (lamps.some((lamp) => Math.hypot(lamp.x - x, lamp.z - z) < 12)) continue;
          if (segments.some((other) => other !== segment && insideCorridor(x, z, other, .45))) continue;
          if (!hasClearance(x, z, .75, exclusions) || !hasClearance(headX, headZ, .3, exclusions)) continue;
          lamps.push({ x, z, headX, headZ, angle: segment.angle, side, roadId: road.id, segmentIndex: segment.index });
          break;
        }
        next += 24; candidateIndex++;
      }
      run += segment.length;
      // Narrow connector segments do not reset or backlog the regular rhythm.
      while (next < run) { next += 24; candidateIndex++; }
    }
    for (let i = 1; i < own.length; i++) {
      const a = own[i - 1], b = own[i];
      if (Math.hypot(a.bx - b.ax, a.bz - b.az) > .05 || Math.abs(cross(a.tx, a.tz, b.tx, b.tz)) < .08) continue;
      const x = a.bx, z = a.bz, radius = Math.min(a.width, b.width) / 2 + .025;
      if (junctions.some((point) => Math.hypot(point.x - x, point.z - z) < point.radius + 1)) continue;
      if (joints.some((joint) => Math.hypot(joint.x - x, joint.z - z) < .5)) continue;
      joints.push({ x, z, radius, roadId: road.id });
    }
  }
  return { curbs, lamps, joints, segments, junctions };
}
