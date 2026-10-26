import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, CAMPUS_ROADS, mapToWorld } from "./campus-layout.js";
import { FACULTIES } from "./faculty-data.js";
import { FSKTM } from "./models/fsktm.js";
import { MOSQUE_ARCADE, STADIUM_STAND } from "./model-layout.js";
import { polygonBoundary, rectangleBoundary } from "./navigation.js";

// Lightweight plan geometry shared by planting, prop placement and the 2D map.
// These are the envelopes of this project's actual procedural models. They are
// not surveyed campus boundaries and must never replace walking collisions:
// courts, steps, parking aprons and playing fields stay open to the walker.
const TAU = Math.PI * 2;
const circle = (radius, center = [0, 0], segments = 96) => Array.from({ length: segments }, (_, i) => [
  center[0] + Math.sin(i * TAU / segments) * radius,
  center[1] + Math.cos(i * TAU / segments) * radius,
]);
const rectangle = (x, z, width, depth, angle = 0) => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sz]) => [
  x + sx * width / 2 * Math.cos(angle) + sz * depth / 2 * Math.sin(angle),
  z - sx * width / 2 * Math.sin(angle) + sz * depth / 2 * Math.cos(angle),
]);
const annularSector = (inner, outer, start, end, segments = 96) => [
  ...Array.from({ length: segments + 1 }, (_, i) => {
    const a = start + (end - start) * i / segments; return [Math.sin(a) * outer, Math.cos(a) * outer];
  }),
  ...Array.from({ length: segments + 1 }, (_, i) => {
    const a = end - (end - start) * i / segments; return [Math.sin(a) * inner, Math.cos(a) * inner];
  }),
];
const capsule = (radius) => [
  ...Array.from({ length: 97 }, (_, i) => { const a = i * Math.PI / 96; return [Math.cos(a) * radius, -22 - Math.sin(a) * radius]; }),
  ...Array.from({ length: 97 }, (_, i) => { const a = i * Math.PI / 96; return [-Math.cos(a) * radius, 22 + Math.sin(a) * radius]; }),
];
const localShape = (id, landmarkId, kind, points, holes = []) => ({ id, landmarkId, kind, points, holes });

/** Apply the same uniform scale and clockwise X/Z rotation as Three.js. */
export function landmarkTransform(idOrPlacement, point) {
  const placement = typeof idOrPlacement === "string" ? CAMPUS_LANDMARKS[idOrPlacement] : idOrPlacement;
  if (!placement) throw new Error(`Unknown landmark placement: ${idOrPlacement}`);
  const { position: [x, z], yaw, modelScale: scale } = placement;
  const [px, pz] = point, c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + scale * (px * c + pz * s), z + scale * (-px * s + pz * c)];
}

function localLandmarkShapes() {
  const shapes = [];
  const add = (id, landmarkId, kind, points, holes) => shapes.push(localShape(id, landmarkId, kind, points, holes));
  // PTTA's model is an annulus, with a real open central courtyard. The entrance
  // porch projects beyond its main cylinder and must be reserved separately.
  add("library-apron", "library", "paving", circle(28.5));
  add("library-court", "library", "courtyard", circle(10.5));
  add("library-roof", "library", "roof", circle(27.7), [circle(10.3)]);
  add("library-entrance-pad", "library", "paving", rectangle(0, 29, 16.8, 10));
  add("library-canopy", "library", "roof", rectangle(0, 29, 16, 9));
  add("hall-apron", "hall", "paving", rectangle(0, 2.7, 51, 43.5));
  add("hall-roof", "hall", "roof", rectangle(0, -1.5, 48.8, 33.8));
  add("hall-canopy", "hall", "roof", rectangle(0, 16.5, 51, 7.5));
  add("hall-steps", "hall", "paving", rectangle(0, 20.8, 47, 7.4));

  const star = Array.from({ length: 16 }, (_, i) => {
    const a = i * TAU / 16 + Math.PI / 8, r = i % 2 ? 23 : 29;
    return [Math.sin(a) * r, Math.cos(a) * r];
  });
  add("mosque-platform", "mosque", "paving", rectangle(0, 0, 46, 42));
  add("mosque-main-roof", "mosque", "roof", star);
  add("mosque-front-stairs", "mosque", "paving", rectangle(0, 28.5, 22.5, 16));
  const arcade = (points) => points.map(([x,z]) => [MOSQUE_ARCADE.center[0]+x*MOSQUE_ARCADE.scale,MOSQUE_ARCADE.center[1]+z*MOSQUE_ARCADE.scale]);
  add("mosque-arcade-apron", "mosque", "paving", arcade(annularSector(36.3, 44.8, -1.39, 1.39)));
  add("mosque-arcade-roof", "mosque", "roof", arcade(annularSector(36.4, 44.6, -1.38, 1.38)));
  // The open square between the stairs and crescent colonnade is intentional
  // forecourt space; planting there previously intruded through the building.
  add("mosque-open-forecourt", "mosque", "courtyard", rectangle(0, 27.5, 64, 27));
  for (const side of [-1, 1]) {
    add(`mosque-pavilion-${side}`, "mosque", "roof", circle(7.1, [side * 33, 13]));
    add(`mosque-side-arcade-${side}`, "mosque", "roof", rectangle(side * 21, 0, 5, 40));
  }
  add("mosque-minaret", "mosque", "roof", circle(4.3, [32, -10]));

  add("swimming-apron", "swimming", "paving", rectangle(0, 0, 46.7, 57));
  add("swimming-hall-roof", "swimming", "roof", rectangle(0, 0, 46.8, 57));
  add("swimming-entrance", "swimming", "paving", rectangle(0, 28, 12.7, 5.5));
  add("swimming-canopy", "swimming", "roof", rectangle(0, 28, 12, 5));

  add("stadium-track-and-field", "stadium", "sports", capsule(27.4));
  const fitStand=points=>points.map(([x,z])=>[x*STADIUM_STAND.xScale+STADIUM_STAND.xOffset,z]);
  for (const center of [-17, 17]) {
    add(`stadium-stand-${center}`, "stadium", "roof", fitStand(rectangle(-34, center, 13, 29)));
    add(`stadium-stand-apron-${center}`, "stadium", "paving", fitStand(rectangle(-34, center, 16.6, 29)));
  }
  add("stadium-officials-box", "stadium", "roof", fitStand(rectangle(-36, 0, 12.5, 12.5)));
  for (const x of [-33, 33]) for (const z of [-42, 42])
    add(`stadium-floodlight-${x}-${z}`, "stadium", "roof", rectangle(x, z, 5.2, 1));

  for (const [index, [x, z, width, depth, angle]] of FSKTM.bounds.entries()) {
    // createFSKTM recenters every child +15 along X, putting the tower at0.
    add(`fsktm-roof-${index}`, "fsktm", "roof", rectangle(x + 15, z, width + (index ? 3.4 : 3.6), depth + (index ? 3.4 : 3.6), angle));
  }
  add("fsktm-link", "fsktm", "roof", rectangle(-8.5, 5.5, 9, 10));
  add("fsktm-parking", "fsktm", "paving", rectangle(16, 22, 53, 19));
  add("fsktm-entrance-pad", "fsktm", "paving", rectangle(0, 17.4, 11, 6));
  add("fsktm-front-canopy", "fsktm", "roof", rectangle(0, 13.5, 9, 5.9));
  add("fsktm-parking-canopy", "fsktm", "roof", rectangle(20, 18, 15, 6.5));
  return shapes;
}

/** World-space model plans, in drawing order: open surfaces first, roofs last. */
export function getLandmarkPlanShapes({ includeSports = true, includePaving = true } = {}) {
  return localLandmarkShapes()
    .filter((shape) => (includeSports || shape.kind !== "sports") && (includePaving || !["paving", "courtyard"].includes(shape.kind)))
    .sort((a, b) => Number(a.kind === "roof") - Number(b.kind === "roof"))
    .map((shape) => ({ ...shape, points: shape.points.map((point) => landmarkTransform(shape.landmarkId, point)), holes: shape.holes.map((hole) => hole.map((point) => landmarkTransform(shape.landmarkId, point))) }));
}

/** Exclude foliage and props from complete modeled architecture and aprons.
 * Courtyards are deliberately reserved too: their existing designed planting
 * is in the landmark model, and random background trees must not be added.
 */
export function getLandmarkPlantingExclusions({ includeSports = true, margin = 1.5 } = {}) {
  return getLandmarkPlanShapes({ includeSports }).map((shape) => ({
    ...polygonBoundary(shape.points, margin), id: shape.id, landmarkId: shape.landmarkId, kind: shape.kind,
  }));
}

const ARRIVAL_PIXELS = { hall: [805, 991], swimming: [1058, 1300], stadium: [1120, 1496] };
const LOCAL_ENTRANCES = {
  library: [0, 33.7], hall: [0, 24.5], mosque: [0, 36.6],
  swimming: [0, 30.6], stadium: [-28.5, 0], fsktm: [0, 20.1],
};

function nearestRoadPoint([x, z]) {
  let nearest = null, distance = Infinity;
  for (const road of CAMPUS_ROADS) {
    const points = road.pixels.map(mapToWorld);
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const point = [ax + t * dx, az + t * dz], d = Math.hypot(x - point[0], z - point[1]);
      if (d < distance) { distance = d; nearest = point; }
    }
  }
  return nearest;
}

/** Reserved approach paths; they are clearances, not new surveyed footways. */
export function getEntryCorridors({ width = 2.4, margin = .5, includeFaculties = true } = {}) {
  const destinations = Object.entries(LOCAL_ENTRANCES).map(([id, local]) => ({
    id, entrance: landmarkTransform(id, local), entry: mapToWorld(ARRIVAL_PIXELS[id] || CAMPUS_LANDMARKS[id].frontPixel),
  }));
  if (includeFaculties) for (const faculty of FACULTIES)
    destinations.push({ id: faculty.id, entrance: faculty.entry, entry: faculty.entry });
  const corridors = [];
  for (const destination of destinations) {
    const roadPoint = nearestRoadPoint(destination.entry);
    const points = [destination.entrance, destination.entry, roadPoint].filter(Boolean);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < .05) continue;
      const angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
      corridors.push({ ...rectangleBoundary((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, width, length, angle, margin),
        id: `${destination.id}-approach-${i}`, landmarkId: destination.id, kind: "entrance", start: a, end: b,
      });
    }
    // Even a destination already on the roadway keeps its immediate arrival clear.
    corridors.push({ ...rectangleBoundary(...destination.entry, width, width, 0, margin),
      id: `${destination.id}-arrival`, landmarkId: destination.id, kind: "arrival", start: destination.entry, end: destination.entry,
    });
  }
  return corridors;
}

/** Conservative reservations for trees and street furniture, not collisions.
 * Traced landmark placeholders are replaced by current detailed-model shapes.
 * includeSports:false omits the open stadium field/track but keeps its stands.
 */
export function getCampusObstacles({ includeEntrances = true, includeSports = true, margin = .9 } = {}) {
  const obstacles = BUILDING_FOOTPRINTS.filter((footprint) => !footprint.excludeLandmark).map((footprint) => ({
    ...polygonBoundary(footprint.pixels.map(mapToWorld), margin, footprint.holes.map((hole) => hole.map(mapToWorld))),
    id: footprint.id, kind: "building", sourceCode: footprint.sourceCode,
  }));
  obstacles.push(...CAMPUS_PONDS.map((pond, i) => ({ ...polygonBoundary(pond.pixels.map(mapToWorld), margin), id: `pond-${i}`, kind: "water" })));
  obstacles.push(...getLandmarkPlantingExclusions({ includeSports, margin }));
  if (includeEntrances) obstacles.push(...getEntryCorridors({ margin }));
  return obstacles;
}
